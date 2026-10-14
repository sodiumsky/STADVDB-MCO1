
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const mysql = require("mysql2/promise");
const { parquetMetadata, parquetRead } = require("hyparquet");
const { compressors } = require("hyparquet-compressors");

const TABLE = "green_taxi_trips";
const CHUNK_SIZE = 10000;

const COLUMNS = [
    "VendorID",
    "lpep_pickup_datetime",
    "lpep_dropoff_datetime",
    "store_and_fwd_flag",
    "RatecodeID",
    "PULocationID",
    "DOLocationID",
    "passenger_count",
    "trip_distance",
    "fare_amount",
    "extra",
    "mta_tax",
    "tip_amount",
    "tolls_amount",
    "ehail_fee",
    "improvement_surcharge",
    "total_amount",
    "payment_type",
    "trip_type",
    "congestion_surcharge",
    "cbd_congestion_fee"
];

const MONTHS = [];

for (let i = 1; i <= 12; i++) {
    let month = String(i).padStart(2, "0");
    MONTHS.push("2025-" + month);
}

let currentChunk = Buffer.alloc(0);

function formatValue(value) {
    if (value === null || value === undefined) {
        return "\\N";
    }

    if (value instanceof Date) {
        return value.toISOString()
            .replace("T", " ")
            .replace("Z", "");
    }

    if (typeof value === "number" &&
        !Number.isFinite(value)) {
        throw new Error(`Invalid numeric value: ${value}`);
    }

    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/\t/g, "\\t")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");
}

function validateSchema(metadata, month) {
    const actual = [];

    for (const column of metadata.schema) {
        if (column.name !== "schema") {
            actual.push(column.name);
        }
    }

    if (JSON.stringify(actual) !==
        JSON.stringify(COLUMNS)) {
        throw new Error(
            `Schema mismatch in ${month}!\n` +
            `Expected: ${COLUMNS.join(", ")}\n` +
            `Actual: ${actual.join(", ")}`
        );
    }
}

async function importMonth(connection, month) {
    const filePath = path.join(
        __dirname,
        "..",
        "data",
        `green_tripdata_${month}.parquet`
    );

    console.log(`\n========== ${month} ==========`);

    const buffer = fs.readFileSync(filePath);

    const file = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    );

    const metadata = parquetMetadata(file);
    validateSchema(metadata, month);

    const totalRows = Number(metadata.num_rows);

    const [existing] = await connection.execute(
        `SELECT COUNT(*) AS count,
                MIN(source_row_number) AS first_row,
                MAX(source_row_number) AS last_row
         FROM ${TABLE}
         WHERE source_month = ?`,
        [month]
    );

    const count = Number(existing[0].count);
    const first = existing[0].first_row;
    const last = existing[0].last_row;

    if (
        count > 0 &&
        (Number(first) !== 0 ||
         Number(last) !== count - 1)
    ) {
        throw new Error(
            `${month}: Existing rows are not contiguous.`
        );
    }

    if (count > totalRows) {
        throw new Error(
            `${month}: Database has more rows than Parquet.`
        );
    }

    if (count === totalRows) {
        console.log(
            `Already complete: ${count} records. Skipping.`
        );
        return totalRows;
    }

    console.log(`Parquet rows: ${totalRows}`);
    console.log(`Resuming from row: ${count}`);

    const columnSQL = [
        ...COLUMNS,
        "source_month",
        "source_row_number"
    ].map(name => `\`${name}\``).join(", ");

    const loadSQL = `
        LOAD DATA LOCAL INFILE 'green_chunk.tsv'
        INTO TABLE ${TABLE}
        CHARACTER SET utf8mb4
        FIELDS TERMINATED BY '\\t'
        ESCAPED BY '\\\\'
        LINES TERMINATED BY '\\n'
        (${columnSQL})
    `;

    for (
        let start = count;
        start < totalRows;
        start += CHUNK_SIZE
    ) {
        const end = Math.min(
            start + CHUNK_SIZE,
            totalRows
        );

        let records;

        await parquetRead({
            file,
            compressors,
            rowStart: start,
            rowEnd: end,
            onComplete: rows => {
                records = rows;
            }
        });

        if (!records || records.length !== end - start) {
            throw new Error(
                `${month}: Unexpected Parquet row count at ${start}`
            );
        }

        const lines = [];

        for (let i = 0; i < records.length; i++) {
            const record = records[i];

            if (record.length !== COLUMNS.length) {
                throw new Error("Invalid column count");
            }

            const values = [];

            for (const value of record) {
                values.push(formatValue(value));
            }

            values.push(formatValue(month));
            values.push(formatValue(start + i));

            lines.push(values.join("\t"));
        }

        currentChunk = Buffer.from(
            lines.join("\n") + "\n",
            "utf8"
        );

        const [result] = await connection.query(loadSQL);

        if (result.warningStatus > 0) {
            const [warnings] = await connection.query(
                "SHOW WARNINGS LIMIT 10"
            );

            console.table(warnings);

            throw new Error(
                `${month}: ${result.warningStatus} MySQL warnings`
            );
        }

        if (result.affectedRows !== records.length) {
            throw new Error(
                `${month}: Expected ${records.length} inserts, ` +
                `got ${result.affectedRows}`
            );
        }

        console.log(
            `${month}: ${end.toLocaleString()} / ` +
            `${totalRows.toLocaleString()}`
        );
    }

    const [verified] = await connection.execute(
        `SELECT COUNT(*) AS count,
                MIN(source_row_number) AS first_row,
                MAX(source_row_number) AS last_row
         FROM ${TABLE}
         WHERE source_month = ?`,
        [month]
    );

    if (
        Number(verified[0].count) !== totalRows ||
        Number(verified[0].first_row) !== 0 ||
        Number(verified[0].last_row) !== totalRows - 1
    ) {
        throw new Error(`${month}: Final verification failed`);
    }

    console.log(`${month}: VERIFIED`);
    return totalRows;
}

async function main() {
    const selected = process.argv[2];

    if (selected &&
        selected !== "all" &&
        !MONTHS.includes(selected)) {
        throw new Error(
            "Usage: node scripts/importGreen.js [all|2025-01]"
        );
    }

    const months = selected && selected !== "all"
        ? [selected]
        : MONTHS;

    // Verify all requested files exist before importing.
    for (const month of months) {
        const filePath = path.join(
            __dirname,
            "..",
            "data",
            `green_tripdata_${month}.parquet`
        );

        if (!fs.existsSync(filePath)) {
            throw new Error(`Missing file: ${filePath}`);
        }
    }

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        infileStreamFactory: filename => {
            if (filename !== "green_chunk.tsv") {
                throw new Error(
                    `Unexpected infile request: ${filename}`
                );
            }

            return Readable.from([currentChunk]);
        }
    });

    let total = 0;

    try {
        for (const month of months) {
            total += await importMonth(
                connection,
                month
            );
        }

        console.log("\n========================");
        console.log("IMPORT COMPLETED");
        console.log("Months processed:", months.length);
        console.log("Total records:", total.toLocaleString());
        console.log("========================");
    } finally {
        await connection.end();
    }
}

main().catch(error => {
    console.error("\nIMPORT STOPPED:", error);
    process.exitCode = 1;
});
