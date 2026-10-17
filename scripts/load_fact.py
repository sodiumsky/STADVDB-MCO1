from pathlib import Path
import os

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

# Resolve the project root relative to this script's location so the ETL can be run from any working directory.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"

# Load environment variables from .env file in the project root.
load_dotenv(PROJECT_ROOT / ".env")

# Validate required environment variables for the database connection.
required_vars = ["DB_USER", "DB_PASSWORD", "DB_NAME"]
missing_vars = [var for var in required_vars if not os.getenv(var)]

if missing_vars:
    raise ValueError(f"Missing environment variables: {missing_vars}")

# Prevents accidental loading into the wrong database.
if os.getenv("DB_NAME") != "green_taxi_dw":
    raise ValueError("DB_NAME must be green_taxi_dw")

# Number of rows to process in each batch. Adjust based on available memory and performance.
# Bataching reduces memory usage and allows for incremental loading of large datasets.
BATCH_SIZE = 5000

# Create the SQLAlchemy engine for connecting to the MySQL database using environment variables.
#
# The connection uses:
# - MySQL through the PyMySQL driver (mysql+pymysql)
# - Credentials supplied through env variables (DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME)
# - localhost and port defaults when they are not explicitly set in the environment.
# - pool_pre_ping to detect stale database connections before use
engine = create_engine(
    URL.create(
        "mysql+pymysql",
        username=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME"),
    ),
    pool_pre_ping=True,
)

# --------------------------------------------------
# LOAD DIMENSION LOOKUPS
# --------------------------------------------------

def load_lookups(connection):
    """
    Load source-to-warehouse key mappings from the dimension tables

    The ETL uses these dictionaries to translate natural/source identifiers (dates, times, zone IDs,
    payment type IDs) into surrogate keys for the fact table.

    Loading the mappings once per ETL run avoids repeatedly querying the dimension tables for individual rows
    or batches.

    Args:
        connection: SQLAlchemy connection object to the database.

    Returns:
        Tuple of four dictionaries: (date_lookup, time_lookup, zone_lookup, payment_lookup)
    """

    # Map calendar dates to surrogate date keys in the dim_date table.
    date_lookup = {
        row.full_date: row.date_key
        for row in connection.execute(
            text("SELECT full_date, date_key FROM dim_date")
        )
    }

    # Map calendar times to surrogate time keys in the dim_time table.
    # TIME_FORMAT ensures that the time is represented in the same HH:MM:SS format to be used
    # later when processing the Parquet data.
    time_lookup = {
        row.full_time: row.time_key
        for row in connection.execute(
            text("""
                SELECT TIME_FORMAT(full_time, '%H:%i:%s') AS full_time,
                    time_key
                FROM dim_time
            """)
        )
    }

    # Map source taxi-zone/location IDs to warehouse zone surrogate keys in the dim_zone table.
    zone_lookup = {
        row.location_id: row.zone_key
        for row in connection.execute(
            text("SELECT location_id, zone_key FROM dim_zone")
        )
    }

    # Map source payment type IDs to warehouse payment surrogate keys in the dim_payment table.
    payment_lookup = {
        row.payment_type_id: row.payment_key
        for row in connection.execute(
            text("SELECT payment_type_id, payment_key FROM dim_payment")
        )
    }

    return date_lookup, time_lookup, zone_lookup, payment_lookup


# --------------------------------------------------
# TRANSFORM AND LOAD ONE BATCH
# --------------------------------------------------

def process_batch(
    connection,
    batch,
    filename,
    row_offset,
    date_lookup,
    time_lookup,
    zone_lookup,
    payment_lookup,
):
    """
    Validate, transform, map, and insert one batch of source trips.

    Processing is intentionally performed in stages:
    1. Track the original source-row position.
    2. Normalize timestamps and numeric source columns.
    3. Drop rows with missing required values.
    4. Validate identifier fields.
    5. Resolve surrogate keys through dimension lookups.
    6. Resolve rows whose required dimension references are missing.
    7. Build deterministic source IDs for idempotent loading.
    8. Convert rows into MySQL-compatible Python values.
    9. Insert the prepared records into the fact_trip table.

    Args:
        connection: SQLAlchemy connection object to the database.
        batch: Pandas DataFrame containing the current batch of source trips.
        filename: Name of the source Parquet file being processed.
        row_offset: The starting row index of this batch within the source file.
        date_lookup: Dictionary mapping full_date to date_key from dim_date.
        time_lookup: Dictionary mapping full_time to time_key from dim_time.
        zone_lookup: Dictionary mapping location_id to zone_key from dim_zone.
        payment_lookup: Dictionary mapping payment_type_id to payment_key from dim_payment.

    Returns:
        Tuple of two integers: (original_count, loaded_count)
        - original_count: Number of rows in the batch before processing.
        - loaded_count: Number of rows successfully prepared and inserted into the fact_trip table.
    """

    # Nothing to process if the batch contains no rows.
    if batch.empty:
        return 0, 0

    # To keep track of how many source rows entered the batch before validation.
    original_count = len(batch)

    # Record each row's original position in the source file.
    # This position is later combined with the filename to create a deterministic source_trip_id for idempotent loading.
    batch["_source_position"] = range(
        row_offset, row_offset + len(batch)
    )

    # --------------------------------------------------
    # NORMALIZE SOURCE DATA TYPES
    # --------------------------------------------------

    # Normalize source timestamps.
    # Invalid timestamp values are converted to NaT (Not a Time) so that they can be removed
    # during required-field validation. This prevents invalid timestamps from causing errors during dimension mapping or insertion.
    batch["lpep_pickup_datetime"] = pd.to_datetime(
        batch["lpep_pickup_datetime"], errors="coerce"
    )

    batch["lpep_dropoff_datetime"] = pd.to_datetime(
        batch["lpep_dropoff_datetime"], errors="coerce"
    )

    # Source numeric fields are explicitly converted to numeric values.
    # Invalid values become NaN and can be removed during required-field validation.
    # This prevents invalid numeric values from causing errors during dimension mapping or insertion.
    numeric_columns = [
        "PULocationID",
        "DOLocationID",
        "payment_type",
        "passenger_count",
        "trip_distance",
        "fare_amount",
        "tip_amount",
        "tolls_amount",
        "total_amount",
    ]

    for column in numeric_columns:
        batch[column] = pd.to_numeric(
            batch[column],
            errors="coerce"
        )

    # --------------------------------------------------
    # REQUIRED SOURCE FIELD VALIDATION
    # --------------------------------------------------

    # Drop rows that cannot form a complete fact record before dimension-key resolution.
    # passenger_count and payment_type are intentionally not included because they can be null.
    batch = batch.dropna(
        subset=[
            "lpep_pickup_datetime",
            "lpep_dropoff_datetime",
            "PULocationID",
            "DOLocationID",
            "trip_distance",
            "fare_amount",
            "tip_amount",
            "tolls_amount",
            "total_amount",
        ]
    ).copy()

    # --------------------------------------------------
    # IDENTIFIER VALIDATION
    # --------------------------------------------------

    # Source dimension IDs must be non-negative whole numbers.
    # Invalid values are dropped before dimension-key resolution.
    # Null values remain allowable because some source identifiers may be nullable.
    # Required dimension mappings will be enforced later.
    for column in ["PULocationID", "DOLocationID", "payment_type"]:
        valid = batch[column].isna() | (
            (batch[column] >= 0) & (batch[column] % 1 == 0)
        )
        batch = batch.loc[valid].copy()

    # If validation removed every row in the batch, return early to avoid unnecessary processing.
    if batch.empty:
        return original_count, 0

    # --------------------------------------------------
    # PREPARE DIMENSION LOOKUP VALUES
    # --------------------------------------------------

    # Extract date and time components from the normalized timestamps.
    batch["pickup_date"] = batch["lpep_pickup_datetime"].dt.date
    batch["dropoff_date"] = batch["lpep_dropoff_datetime"].dt.date

    batch["pickup_time"] = batch["lpep_pickup_datetime"].dt.strftime(
        "%H:%M:%S"
    )

    batch["dropoff_time"] = batch["lpep_dropoff_datetime"].dt.strftime(
        "%H:%M:%S"
    )

    # Resolve natural/source values to warehouse surrogate keys.
    batch["pickup_date_key"] = batch["pickup_date"].map(date_lookup)
    batch["dropoff_date_key"] = batch["dropoff_date"].map(date_lookup)

    batch["pickup_time_key"] = batch["pickup_time"].map(time_lookup)
    batch["dropoff_time_key"] = batch["dropoff_time"].map(time_lookup)

    batch["pickup_zone_key"] = batch["PULocationID"].map(zone_lookup)
    batch["dropoff_zone_key"] = batch["DOLocationID"].map(zone_lookup)

    batch["payment_key"] = batch["payment_type"].map(payment_lookup)

    # --------------------------------------------------
    # DIMENSION REFERENTIAL VALIDATION
    # --------------------------------------------------

    # Required dimension references must exist in the warehouse.
    # A missing lookup result becomes NaN.
    # Rows with missing required dimension keys are removed rather than inserted with
    # invalid foreign-key references.
    # This prevents referential integrity violations in the fact table.
    batch = batch.dropna(
        subset=[
            "pickup_date_key",
            "dropoff_date_key",
            "pickup_time_key",
            "dropoff_time_key",
            "pickup_zone_key",
            "dropoff_zone_key",
        ]
    ).copy()

    # If no rows have valid dimension references, nothing remains to load.
    if batch.empty:
        return original_count, 0

    # --------------------------------------------------
    # BUILD DETERMINISTIC SOURCE IDENTIFIERS
    # --------------------------------------------------

    # Create a stable identifier from the source filename and original source-row position.
    #
    # Ex: green_tripdata_2025-01.parquet:12345
    # Because the identifier is deterministic, rerunning the same source data can safely use
    # the table's duplicate-key handling.
    batch["source_trip_id"] = batch["_source_position"].map(
        lambda position: f"{filename}:{position}"
    )

    # --------------------------------------------------
    # PREPARE NULLABLE MEASURESS
    # --------------------------------------------------

    # Preserve missing passenger counts as SQL NULL rather than pandas NaN.
    # This allows the fact table to accurately reflect missing data rather than defaulting to zero.
    batch["passenger_count"] = batch["passenger_count"].where(
        batch["passenger_count"].notna(), None
    )

    # --------------------------------------------------
    # CONVERT DATA TO DATABASE RECORDS
    # --------------------------------------------------

    # Convert pandas numberic values to native Python values accepted by the MySQL/PyMySQL driver.
    def to_int_or_none(value):
        """
        Convert a numeric value to int, preserving missing values as None.
        """
        return None if pd.isna(value) else int(value)

    def to_float(value):
        """
        Convert a numeric value to native Python float.
        """
        return float(value)

    records = []

    # Convert every validated DataFrame row into a dictionary whose keys correspond
    # directly to fact_trip inster parameters.
    for row in batch.to_dict("records"):
        records.append({
            "source_trip_id": row["source_trip_id"],

            "pickup_date_key": int(row["pickup_date_key"]),
            "pickup_time_key": int(row["pickup_time_key"]),

            "dropoff_date_key": int(row["dropoff_date_key"]),
            "dropoff_time_key": int(row["dropoff_time_key"]),

            "pickup_zone_key": int(row["pickup_zone_key"]),
            "dropoff_zone_key": int(row["dropoff_zone_key"]),

            "payment_key": to_int_or_none(row["payment_key"]),

            "pickup_datetime": row["lpep_pickup_datetime"].to_pydatetime(),
            "dropoff_datetime": row["lpep_dropoff_datetime"].to_pydatetime(),

            "passenger_count": to_int_or_none(
                row["passenger_count"]
            ),

            "trip_distance": to_float(
                row["trip_distance"]
            ),

            "fare_amount": to_float(
                row["fare_amount"]
            ),

            "tip_amount": to_float(
                row["tip_amount"]
            ),

            "tolls_amount": to_float(
                row["tolls_amount"]
            ),

            "total_amount": to_float(
                row["total_amount"]
            ),

            # Each source row represents one trip/fact.
            "trip_count": 1,
        })

    # --------------------------------------------------
    # INSERT INTO FACT TABLE
    # --------------------------------------------------

    connection.execute(
        text("""
            INSERT INTO fact_trip (
                source_trip_id,
                pickup_date_key,
                pickup_time_key,
                dropoff_date_key,
                dropoff_time_key,
                pickup_zone_key,
                dropoff_zone_key,
                payment_key,
                pickup_datetime,
                dropoff_datetime,
                passenger_count,
                trip_distance,
                fare_amount,
                tip_amount,
                tolls_amount,
                total_amount,
                trip_count
            )
            VALUES (
                :source_trip_id,
                :pickup_date_key,
                :pickup_time_key,
                :dropoff_date_key,
                :dropoff_time_key,
                :pickup_zone_key,
                :dropoff_zone_key,
                :payment_key,
                :pickup_datetime,
                :dropoff_datetime,
                :passenger_count,
                :trip_distance,
                :fare_amount,
                :tip_amount,
                :tolls_amount,
                :total_amount,
                :trip_count
            )
            ON DUPLICATE KEY UPDATE
                source_trip_id = VALUES(source_trip_id)
        """),
        records,
    )

    # Return both the number of source rows inspected and the number of validated
    # records actually prepared for insertion.
    return original_count, len(records)


# --------------------------------------------------
# MAIN ETL
# --------------------------------------------------

def main():
    """
    Run the complete 2025 Green Taxi fact-table ETL.

    Process:
    1. Discovers the expected monthly Parquet source files.
    2. Loads dimension lookups once.
    3. Reads each monthly file.
    4. Processes source data in fixed-size batches to reduce memory usage.
    5. Validates and transforms each batch.
    6. Inserts valid records into the fact_trip table.
    7. Reports processing and loading totals.
    8. Reports the final fact_trip row count after all files are processed.

    Raises:
        FileNotFoundError:
        If the expected 12 monthly Parquet files are not found in the data directory.

        ValueError:
        If the database name is not "green_taxi_dw" to prevent accidental loading into the wrong database.
    """

    # Discover all monthly Green Taxi Parquet files for 2025 in the data directory.
    files = sorted(
        DATA_DIR.glob("green_tripdata_2025-*.parquet")
    )

    # The ETL expects exactly one source file for each month of 2025.
    # If the expected files are not found, raise an error to prevent partial or incorrect loading.
    if len(files) != 12:
        raise FileNotFoundError(
            f"Expected 12 monthly Parquet files, found {len(files)}."
        )

    # Global ETL counters for reporting after all files are processed.
    total_processed = 0
    total_loaded = 0

    # Use one transaction for the complete fact-table load.
    # If an exception occurs, the SQLAlchemy rolls back the transaction rather than leaving
    # a partially committed load.
    with engine.begin() as connection:

        # Load all dimension mappings once before processing the source files.
        date_lookup, time_lookup, zone_lookup, payment_lookup = (
            load_lookups(connection)
        )

        # ------------------------------------------------
        # PROCESS EACH MONTHLY SOURCE FILE
        # ------------------------------------------------

        for file_path in files:

            print(f"\nProcessing {file_path.name}...")

            file_processed = 0
            file_loaded = 0

            # Starting source-row positon for the current file.
            row_offset = 0

            # Read the complete Parquet file into the DataFrame.
            data = pd.read_parquet(file_path)

            # Process the source file in fixed-size batches to reduce memory usage.
            for start in range(0, len(data), BATCH_SIZE):

                batch = data.iloc[
                    start:start + BATCH_SIZE
                ].copy()

                # Validate, transform, map, and insert the current batch into the fact_trip table.
                processed, loaded = process_batch(
                    connection,
                    batch,
                    file_path.name,
                    start,
                    date_lookup,
                    time_lookup,
                    zone_lookup,
                    payment_lookup,
                )

                # Accumulate statistics for the current source file.
                file_processed += processed
                file_loaded += loaded

            # Release the DataFrame references before moving to the next file.
            del data

            print(
                f"  Source rows inspected: {file_processed:,}"
            )

            print(
                f"  Rows loaded: {file_loaded:,}"
            )

            # Accumulate global ETL statistics.
            total_processed += file_processed
            total_loaded += file_loaded

    # ------------------------------------------------
    # FINAL LOAD VERIFICATION
    # ------------------------------------------------

    # Open a new read-only connection after the transaction has completed and retrieve
    # the current number of rows in the fact table.
    # This provides a final verification of the ETL's effect on the database.
    with engine.connect() as connection:
        final_count = connection.execute(
            text("SELECT COUNT(*) FROM fact_trip")
        ).scalar_one()

    # Display final ETL statistics.
    print("\nFact ETL completed.")

    print(
        f"Rows inspected: {total_processed:,}"
    )

    print(
        f"Rows prepared for insertion: {total_loaded:,}"
    )

    print(
        f"Current fact_trip row count: {final_count:,}"
    )


# --------------------------------------------------
# SCRIPT ENTRY POINT
# --------------------------------------------------

# Only execute the ETL when this file is run directly.
# This allows the functions in the module to be imported elsewhere without
# automatically starting the ETL process.
if __name__ == "__main__":
    main()
