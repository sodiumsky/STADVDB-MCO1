
const fs = require("fs");
const path = require("path");
const { parquetMetadata, parquetRead } = require("hyparquet");
const { compressors } = require("hyparquet-compressors");

async function main() {
    const month = process.argv[2] || "2025-01";

    const filePath = path.join(
        __dirname,
        "..",
        "data",
        `green_tripdata_${month}.parquet`
    );

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);
    const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    );

    const metadata = parquetMetadata(arrayBuffer);

    console.log("Month:", month);
    console.log("Total rows:", metadata.num_rows.toString());

    console.log("\nPARQUET COLUMNS:");

    for (const column of metadata.schema) {
        if (column.name === "schema") continue;

        console.log(
            `${column.name} | ` +
            `type: ${column.type || "group"} | ` +
            `converted: ${column.converted_type || "none"}`
        );
    }

    console.log("\nFIRST 3 RECORDS:");

    await parquetRead({
        file: arrayBuffer,
        compressors,
        rowStart: 0,
        rowEnd: 3,
        onComplete: (rows) => {
            console.dir(rows, { depth: null });
        }
    });
}

main().catch(console.error);
