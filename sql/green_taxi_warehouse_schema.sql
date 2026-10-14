-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: nyc_green_taxi_warehouse_2025
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `dim_date`
--

DROP TABLE IF EXISTS `dim_date`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dim_date` (
  `date_key` int NOT NULL,
  `full_date` date NOT NULL,
  `day_number` tinyint NOT NULL,
  `month_number` tinyint NOT NULL,
  `month_name` varchar(15) NOT NULL,
  `quarter_number` tinyint NOT NULL,
  `year_number` smallint NOT NULL,
  `day_of_week` tinyint NOT NULL,
  `day_name` varchar(15) NOT NULL,
  PRIMARY KEY (`date_key`),
  UNIQUE KEY `full_date` (`full_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dim_payment`
--

DROP TABLE IF EXISTS `dim_payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dim_payment` (
  `payment_key` bigint NOT NULL,
  `payment_description` varchar(100) NOT NULL,
  PRIMARY KEY (`payment_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dim_time`
--

DROP TABLE IF EXISTS `dim_time`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dim_time` (
  `time_key` tinyint NOT NULL,
  `hour_number` tinyint NOT NULL,
  `time_period` varchar(20) NOT NULL,
  PRIMARY KEY (`time_key`),
  UNIQUE KEY `hour_number` (`hour_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dim_zone`
--

DROP TABLE IF EXISTS `dim_zone`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dim_zone` (
  `zone_key` int NOT NULL,
  `borough` varchar(100) DEFAULT NULL,
  `zone_name` varchar(150) DEFAULT NULL,
  `service_zone` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`zone_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `fact_trip`
--

DROP TABLE IF EXISTS `fact_trip`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fact_trip` (
  `trip_key` bigint NOT NULL AUTO_INCREMENT,
  `source_trip_id` bigint NOT NULL,
  `pickup_date_key` int NOT NULL,
  `dropoff_date_key` int NOT NULL,
  `pickup_time_key` tinyint NOT NULL,
  `dropoff_time_key` tinyint NOT NULL,
  `pickup_zone_key` int NOT NULL,
  `dropoff_zone_key` int NOT NULL,
  `payment_key` bigint NOT NULL,
  `pickup_datetime` datetime(6) DEFAULT NULL,
  `dropoff_datetime` datetime(6) DEFAULT NULL,
  `passenger_count` bigint DEFAULT NULL,
  `trip_distance` double DEFAULT NULL,
  `fare_amount` decimal(12,2) DEFAULT NULL,
  `tip_amount` decimal(12,2) DEFAULT NULL,
  `tolls_amount` decimal(12,2) DEFAULT NULL,
  `total_amount` decimal(12,2) DEFAULT NULL,
  `trip_count` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`trip_key`),
  UNIQUE KEY `source_trip_id` (`source_trip_id`),
  KEY `fk_pickup_date` (`pickup_date_key`),
  KEY `fk_dropoff_date` (`dropoff_date_key`),
  KEY `fk_pickup_time` (`pickup_time_key`),
  KEY `fk_dropoff_time` (`dropoff_time_key`),
  KEY `fk_pickup_zone` (`pickup_zone_key`),
  KEY `fk_dropoff_zone` (`dropoff_zone_key`),
  KEY `fk_payment` (`payment_key`),
  CONSTRAINT `fk_dropoff_date` FOREIGN KEY (`dropoff_date_key`) REFERENCES `dim_date` (`date_key`),
  CONSTRAINT `fk_dropoff_time` FOREIGN KEY (`dropoff_time_key`) REFERENCES `dim_time` (`time_key`),
  CONSTRAINT `fk_dropoff_zone` FOREIGN KEY (`dropoff_zone_key`) REFERENCES `dim_zone` (`zone_key`),
  CONSTRAINT `fk_payment` FOREIGN KEY (`payment_key`) REFERENCES `dim_payment` (`payment_key`),
  CONSTRAINT `fk_pickup_date` FOREIGN KEY (`pickup_date_key`) REFERENCES `dim_date` (`date_key`),
  CONSTRAINT `fk_pickup_time` FOREIGN KEY (`pickup_time_key`) REFERENCES `dim_time` (`time_key`),
  CONSTRAINT `fk_pickup_zone` FOREIGN KEY (`pickup_zone_key`) REFERENCES `dim_zone` (`zone_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-14 16:08:56
