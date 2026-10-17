from pathlib import Path
from datetime import datetime
import os

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL


# --------------------------------------------------
# 1. PROJECT CONFIGURATION
# --------------------------------------------------

# Resolve the project root based on the location of this script.
# This allows the ETL to find the shared data directory and .env file
# regardless of the current working directory when the script is executed.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"

# Load database configuration from the project's .env file.
load_dotenv(PROJECT_ROOT / ".env")

# These env variables are required to establish database connection.
required_vars = ["DB_USER", "DB_PASSWORD", "DB_NAME"]
missing_vars = [name for name in required_vars if not os.getenv(name)]

if missing_vars:
    raise ValueError(
        f"Missing environment variables in .env: {missing_vars}"
    )

# Prevent the ETL from accidentally writing dimension data to a different database.
if os.getenv("DB_NAME") != "green_taxi_dw":
    raise ValueError(
        "Expected DB_NAME=green_taxi_dw in the project .env file."
    )

# Create the SQLAlchemy engine used for all database operations.
#
# DB_HOST and DB_PORT have local MySQL defaults but can be overriden through env vairables.
#
# pool_pre_ping=True checks pooled connections before using them, which helps avoid
# failures caused by stale database connections.
engine = create_engine(
    URL.create(
        drivername="mysql+pymysql",
        username=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME"),
    ),
    pool_pre_ping=True,
)

# Max number of parameter dictionaries submitted to the database in a single execute call.
BATCH_SIZE = 1000

# Source payment type codes mapped to human-readable descriptions.
# Any codes not in this dictionary will be labeled as "Other/Unknown".
PAYMENT_DESCRIPTIONS = {
    1: "Credit card",
    2: "Cash",
    3: "No charge",
    4: "Dispute",
    5: "Unknown",
    6: "Voided trip",
}


# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

def execute_batches(connection, sql, rows):
    """
    Execute a list of parameter dictionaries in batches.

    Splitting a large collection of rows into smaller batches helps control memory usage
    and keeps individual database operations manageable.

    Args:
        connection: An active SQLAlchemy connection.
        sql: The SQL statement to execute, with named parameters.
        rows: A list of dictionaries, each representing a row to insert or update.

    Returns:
        None
    """

    for start in range(0, len(rows), BATCH_SIZE):
        batch = rows[start:start + BATCH_SIZE]

        connection.execute(
            text(sql),
            batch
        )


def get_time_period(hour):
    """
    Classify a time of day into a predefined time period.

    The classification is based on the hour component:
    06:00-11:59 - Morning
    12:00-16:59 - Afternoon
    17:00-20:59 - Evening
    Otherwise - Night

    Args:
        hour: Int hour in the 0-23 range

    Returns:
        str:  One of ``Morning``, ``Afternoon``, ``Evening``, or ``Night``.
    """
    if 6 <= hour <= 11:
        return "Morning"

    elif 12 <= hour <= 16:
        return "Afternoon"

    elif 17 <= hour <= 20:
        return "Evening"

    return "Night"


# --------------------------------------------------
# 2. READ SOURCE FILES AND COLLECT DIMENSION VALUES
# --------------------------------------------------

def collect_dimension_values():
    """
    Read source Parquet files and collect dimension values.

    The function scans the available 2025 Green Taxi Parquet files and extracts the unique
    values required to populate:
        - dim_date
        - dim_time
        - dim_payment

    Only the required source columns are read from each Parquet file to reduce unnecessary
    memory usage.

    Date values are collected from both pickup and dropoff timestamps.
    Time values are also collected from both pickup and dropoff timestamps.
    Payment codes are collected from the payment_type column.

    Returns:
        tuple:
            ``(
                parquet_files,
                dates,
                times,
                payment_codes
            )``

            where:
                parquet_files:
                    Sorted list of source Parquet files.

                dates:
                    Set of unique pickup/dropoff calendar dates.

                times:
                    Set of unique pickup/dropoff times formatted as
                    HH:MM:SS.

                payment_codes:
                    Set of integer payment type codes.
    Raises:
        FileNotFoundError: If no matching 2025 Green Taxi Parquet files are found.
    """

    # Locate all monthly 2025 Green Taxi Parquet files.
    parquet_files = sorted(
        DATA_DIR.glob("green_tripdata_2025-*.parquet")
    )

    if not parquet_files:
        raise FileNotFoundError(
            f"No 2025 Green Taxi Parquet files found in {DATA_DIR}"
        )

    # Sets automatically eliminate duplicate dimension values.
    dates = set()
    times = set()
    payment_codes = set()

    print(f"Found {len(parquet_files)} Parquet files.")

    # Inspect each source file independently.
    for file_path in parquet_files:
        print(f"Inspecting {file_path.name}...")

        # Read only the columns needed to build the dimensions.
        df = pd.read_parquet(
            file_path,
            columns=[
                "lpep_pickup_datetime",
                "lpep_dropoff_datetime",
                "payment_type",
            ],
        )

        # Process pickup and dropoff timestamps.
        for column in [
            "lpep_pickup_datetime",
            "lpep_dropoff_datetime",
        ]:

            # Convert invalid timestamps to NaT(Not a Time) and remove them.
            values = pd.to_datetime(
                df[column],
                errors="coerce"
            ).dropna()

            # Add unique calendar dates to the date dimension source set.
            dates.update(
                values.dt.date.tolist()
            )

            # Add unique HH:MM:SS values to the time dimension source set.
            times.update(
                values.dt.strftime("%H:%M:%S").tolist()
            )

        # Normalize payment codes to numberic values.
        payment_values = pd.to_numeric(
            df["payment_type"],
            errors="coerce"
        ).dropna()

        # Keep only whole number payment codes.
        for value in payment_values.unique():
            numeric_value = float(value)

            if numeric_value.is_integer():
                payment_codes.add(
                    int(numeric_value)
                )

    return (
        parquet_files,
        dates,
        times,
        payment_codes
    )


# --------------------------------------------------
# 3. LOAD DATE DIMENSION
# --------------------------------------------------

def load_dates(connection, dates):
    """
    Populate the ``dim_date`` dimension.

    Each unique calendar date is converted into a dimensional record
    containing the date surrogate key and common calendar attributes.

    The date key uses YYYYMMDD format. For example:

        2025-01-15 -> 20250115

    Existing records are updated through ``ON DUPLICATE KEY UPDATE``,
    making the operation safe to rerun.

    Args:
        connection:
            Active SQLAlchemy database connection.

        dates:
            Set of Python ``date`` objects collected from the source files.

    Returns:
        None
    """

    rows = []

    # Build a one-dimensional record for each unique calendar date.
    for value in sorted(dates):

        rows.append({
            # YYYYMMDD surrogate/natural date key.
            "date_key": int(
                value.strftime("%Y%m%d")
            ),

            "full_date": value,

            "year": value.year,

            # Convert month number to calendar quarter.
            "quarter": (value.month - 1) // 3 + 1,

            "month": value.month,

            "month_name": value.strftime("%B"),

            "day": value.day,

            # Monday = 1, Sunday = 7
            "day_of_week": value.isoweekday(),

            "day_name": value.strftime("%A"),

            # Saturday and Sunday are treated as weekend days.
            "is_weekend": value.weekday() >= 5,
        })

    # Insert the prepared date dimension records.
    # If the date key already exists, the existing full_date is retained through the
    # duplicate-key update.
    sql = """
        INSERT INTO dim_date (
            date_key, full_date, year, quarter, month,
            month_name, day, day_of_week, day_name, is_weekend
        )
        VALUES (
            :date_key, :full_date, :year, :quarter, :month,
            :month_name, :day, :day_of_week, :day_name, :is_weekend
        )
        ON DUPLICATE KEY UPDATE
            full_date = VALUES(full_date)
    """

    execute_batches(
        connection,
        sql,
        rows
    )

    print(f"Date dimension processed: {len(rows)} dates.")


# --------------------------------------------------
# 4. LOAD TIME DIMENSION
# --------------------------------------------------

def load_times(connection, times):
    """
     Populate the ``dim_time`` dimension.

    Each unique HH:MM:SS value is converted into a time dimension record.

    The time key is generated using:

        hour * 10000 + minute * 100 + second

    For example:

        14:35:20 -> 143520

    The hour is also classified into a broader time period such as
    Morning, Afternoon, Evening, or Night.

    Args:
        connection:
            Active SQLAlchemy database connection.

        times:
            Set of unique time strings in HH:MM:SS format.

    Returns:
        None
    """

    rows = []

    # Create one dimension record for each unique time value.
    for value in sorted(times):

        # Convert the string representation into a Python time object.
        parsed_time = datetime.strptime(
            value,
            "%H:%M:%S"
        ).time()

        rows.append({
            # Create a numeric HHMMSS time key.
            "time_key": (
                parsed_time.hour * 10000
                + parsed_time.minute * 100
                + parsed_time.second
            ),

            "full_time": parsed_time,

            "hour": parsed_time.hour,
            "minute": parsed_time.minute,
            "second": parsed_time.second,

            # Classify the time into a business-readable period.
            "time_period": get_time_period(
                parsed_time.hour
            ),
        })

    sql = """
        INSERT INTO dim_time (
            time_key, full_time, hour, minute, second, time_period
        )
        VALUES (
            :time_key, :full_time, :hour, :minute, :second, :time_period
        )
        ON DUPLICATE KEY UPDATE
            full_time = VALUES(full_time)
    """

    execute_batches(
        connection,
        sql,
        rows
    )

    print(f"Time dimension processed: {len(rows)} distinct times.")


# --------------------------------------------------
# 5. LOAD ZONE DIMENSION
# --------------------------------------------------

def load_zones(connection):
    """
    Populate the ``dim_zone`` dimension from the taxi zone CSV.

    The taxi zone lookup file provides the source location ID together with
    its borough, zone name, and service zone.

    Missing text values are converted to ``None`` so that they can be
    inserted as SQL NULL values.

    Args:
        connection:
            Active SQLAlchemy database connection.

    Returns:
        None

    Raises:
        FileNotFoundError: If the taxi zone lookup CSV does not exist.
    """

    zone_file = DATA_DIR / "taxi_zone_lookup.csv"

    if not zone_file.exists():
        raise FileNotFoundError(
            f"Zone lookup not found: {zone_file}"
        )

    # Load the official/source taxi-zone lookup CSV.
    df = pd.read_csv(zone_file)

    rows = []

    # Convert each CSV row into a database-ready dictionary.
    for record in df.to_dict(orient="records"):

        def clean_text(value):
            """
            Convert missing text values to None and all others to str.
            """
            if pd.isna(value):
                return None

            return str(value)

        rows.append({
            # LocationID is the source identifier used to map taxi trips to the warehouse
            # zone dimension.
            "location_id": int(
                record["LocationID"]
            ),

            "borough": clean_text(
                record["Borough"]
            ),

            "zone_name": clean_text(
                record["Zone"]
            ),

            "service_zone": clean_text(
                record["service_zone"]
            ),
        })

    sql = """
        INSERT INTO dim_zone (
            location_id, borough, zone_name, service_zone
        )
        VALUES (
            :location_id, :borough, :zone_name, :service_zone
        )
        ON DUPLICATE KEY UPDATE
            borough = VALUES(borough),
            zone_name = VALUES(zone_name),
            service_zone = VALUES(service_zone)
    """

    execute_batches(
        connection,
        sql,
        rows
    )

    print(f"Zone dimension processed: {len(rows)} locations.")


# --------------------------------------------------
# 6. LOAD PAYMENT DIMENSION
# --------------------------------------------------

def load_payments(connection, payment_codes):
    """
    Populate the ``dim_payment`` dimension.

    Each unique payment type code found in the source data is converted
    into a payment dimension record.

    Known payment codes use the descriptions defined in
    ``PAYMENT_DESCRIPTIONS``. Any code not explicitly defined receives
    an ``Other/Unknown`` description.

    Args:
        connection:
            Active SQLAlchemy database connection.

        payment_codes:
            Set of integer payment type codes found in the source data.

    Returns:
        None
    """

    rows = []

    # Build one payment dimension record for each unique source code.
    for code in sorted(payment_codes):

        rows.append({
            "payment_type_id": code,

            # Use the predefined description where availabel.
            # Otherwise provide a generic description containing the code.
            "payment_description": PAYMENT_DESCRIPTIONS.get(
                code,
                f"Other/Unknown (code {code})"
            ),
        })

    sql = """
        INSERT INTO dim_payment (
            payment_type_id, payment_description
        )
        VALUES (
            :payment_type_id, :payment_description
        )
        ON DUPLICATE KEY UPDATE
            payment_description = VALUES(payment_description)
    """

    execute_batches(
        connection,
        sql,
        rows
    )

    print(f"Payment dimension processed: {len(rows)} payment codes.")


# --------------------------------------------------
# 7. RUN THE DIMENSION ETL
# --------------------------------------------------

def main():
    """
    Run the complete dimension-table ETL.

    Process:
        1. Discovers the 2025 Green Taxi Parquet files.
        2. Collects unique date, time, and payment dimension values.
        3. Loads the date dimension.
        4. Loads the time dimension.
        5. Loads the taxi-zone dimension.
        6. Loads the payment dimension.
        7. Reports the resulting row counts.

    The database operations are executed inside a SQLAlchemy transaction.
    If an exception occurs during the transaction, the changes are rolled
    back.

    The dimension inserts use duplicate-key handling, allowing the ETL
    to be safely rerun without intentionally creating duplicate dimension
    records.

    Returns:
        None
    """

    try:
        # Read the source files and collect the values required by the date, time,
        # and payment dimensions.
        _, dates, times, payment_codes = collect_dimension_values()

        # --------------------------------------------------
        # LOAD ALL DIMENSIONS
        # --------------------------------------------------

        # engine.begin() provides a transactional connection.
        # If every dimension load succeeds, the transaction is committed.
        # If an exception occurs, SQLAlchemy rolls the transaction back.
        with engine.begin() as connection:

            load_dates(
                connection,
                dates
            )

            load_times(
                connection,
                times
            )

            load_zones(connection)

            load_payments(
                connection,
                payment_codes
            )

            # --------------------------------------------------
            # VERIFY DIMENSION ROW COUNTS
            # --------------------------------------------------

            print("\nDimension row counts:")

            for table in [
                "dim_date",
                "dim_time",
                "dim_zone",
                "dim_payment",
            ]:

                # The table names come from the fixed list above rather than user input,
                # so they are safe to interpolate into SQL.
                count = connection.execute(
                    text(
                        f"SELECT COUNT(*) FROM {table}"
                    )
                ).scalar_one()

                print(f"  {table}: {count}")

        print("\nDimension ETL completed successfully.")

    finally:
        # Release the SQLAlchemy connection pool and associated resources after the ETL
        # finished, regardless of success or fail.
        engine.dispose()

# --------------------------------------------------
# SCRIPT ENTRY POINT
# --------------------------------------------------

# Execute the ETL only when this file is run directly.
# Importing this module from another Python script will not automatically execute the dimension ETL.
if __name__ == "__main__":
    main()
