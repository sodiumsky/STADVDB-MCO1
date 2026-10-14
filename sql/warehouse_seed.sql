USE nyc_green_taxi_warehouse_2025;

-- Unknown geographic location
INSERT INTO dim_zone (
    zone_key,
    borough,
    zone_name,
    service_zone
)
VALUES (
    0,
    'Unknown',
    'Unknown / Unmatched',
    'Unknown'
)
ON DUPLICATE KEY UPDATE
    borough = 'Unknown',
    zone_name = 'Unknown / Unmatched',
    service_zone = 'Unknown';

-- Missing payment type
INSERT INTO dim_payment (
    payment_key,
    payment_description
)
VALUES (
    0,
    'Missing / Not Recorded'
)
ON DUPLICATE KEY UPDATE
    payment_description = 'Missing / Not Recorded';