-- MariaDB dump 10.19  Distrib 10.4.18-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: autoservice
-- ------------------------------------------------------
-- Server version	10.4.18-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `cars`
--

DROP TABLE IF EXISTS `cars`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cars` (
  `car_id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `vin` varchar(17) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'VIN-код автомобиля',
  `license_plate` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Государственный регистрационный номер',
  `brand` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Марка автомобиля',
  `model` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Модель автомобиля',
  `year` smallint(6) DEFAULT NULL COMMENT 'Год выпуска автомобиля',
  `photo_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Путь к фотографии автомобиля',
  PRIMARY KEY (`car_id`),
  UNIQUE KEY `uq_cars_vin` (`vin`),
  UNIQUE KEY `uq_cars_license_plate` (`license_plate`),
  KEY `fk_cars_client` (`client_id`),
  CONSTRAINT `chk_cars_vin` CHECK (`vin` is null or (`vin` regexp '^[A-HJ-NPR-Z0-9]{17}$')),
  CONSTRAINT `chk_cars_year` CHECK (`year` is null or (`year` >= 1886 and `year` <= 2100)),
  CONSTRAINT `fk_cars_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Автомобили клиентов автосервиса';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cars`
--

LOCK TABLES `cars` WRITE;
/*!40000 ALTER TABLE `cars` DISABLE KEYS */;
/*!40000 ALTER TABLE `cars` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clients`
--

DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `clients` (
  `client_id` int(11) NOT NULL AUTO_INCREMENT,
  `full_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ФИО клиента',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Контактный телефон',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Email клиента',
  `created_at` datetime DEFAULT current_timestamp() COMMENT 'Дата и время регистрации клиента',
  PRIMARY KEY (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Клиенты автосервиса';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clients`
--

LOCK TABLES `clients` WRITE;
/*!40000 ALTER TABLE `clients` DISABLE KEYS */;
/*!40000 ALTER TABLE `clients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employees` (
  `employee_id` int(11) NOT NULL AUTO_INCREMENT,
  `full_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ФИО сотрудника',
  `position` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Должность',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Контактный телефон сотрудника',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'Работает ли сотрудник в данный момент',
  PRIMARY KEY (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Сотрудники автосервиса';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_parts`
--

DROP TABLE IF EXISTS `order_parts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_parts` (
  `order_part_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `part_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1 COMMENT 'Количество использованных запчастей',
  `price` decimal(10,2) NOT NULL COMMENT 'Цена запчасти на момент использования',
  PRIMARY KEY (`order_part_id`),
  KEY `fk_order_parts_order` (`order_id`),
  KEY `fk_order_parts_part` (`part_id`),
  CONSTRAINT `fk_order_parts_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_parts_part` FOREIGN KEY (`part_id`) REFERENCES `parts` (`part_id`) ON UPDATE CASCADE,
  CONSTRAINT `chk_order_parts_qty` CHECK (`quantity` > 0),
  CONSTRAINT `chk_order_parts_price` CHECK (`price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Запчасти, использованные в заказ-наряде';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_parts`
--

LOCK TABLES `order_parts` WRITE;
/*!40000 ALTER TABLE `order_parts` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_parts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_statuses`
--

DROP TABLE IF EXISTS `order_statuses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_statuses` (
  `status_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Название статуса заказа',
  PRIMARY KEY (`status_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Справочник статусов заказ-наряда';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_statuses`
--

LOCK TABLES `order_statuses` WRITE;
/*!40000 ALTER TABLE `order_statuses` DISABLE KEYS */;
INSERT INTO `order_statuses` VALUES (3,'В работе'),(6,'Выдан'),(5,'Готов'),(2,'Диагностика'),(4,'Ожидание запчастей'),(7,'Отменён'),(1,'Принят');
/*!40000 ALTER TABLE `order_statuses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_works`
--

DROP TABLE IF EXISTS `order_works`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_works` (
  `order_work_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `work_type_id` int(11) NOT NULL,
  `employee_id` int(11) DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT 1.00 COMMENT 'Количество',
  `price` decimal(10,2) NOT NULL COMMENT 'Цена работы',
  PRIMARY KEY (`order_work_id`),
  KEY `fk_order_works_order` (`order_id`),
  KEY `fk_order_works_work_type` (`work_type_id`),
  KEY `fk_order_works_employee` (`employee_id`),
  CONSTRAINT `fk_order_works_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_order_works_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_works_work_type` FOREIGN KEY (`work_type_id`) REFERENCES `work_types` (`work_type_id`) ON UPDATE CASCADE,
  CONSTRAINT `chk_order_works_qty` CHECK (`quantity` > 0),
  CONSTRAINT `chk_order_works_price` CHECK (`price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Работы, входящие в заказ';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_works`
--

LOCK TABLES `order_works` WRITE;
/*!40000 ALTER TABLE `order_works` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_works` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `orders` (
  `order_id` int(11) NOT NULL AUTO_INCREMENT,
  `car_id` int(11) NOT NULL,
  `employee_id` int(11) DEFAULT NULL,
  `status_id` int(11) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp() COMMENT 'Дата и время создания заказа',
  `planned_finish_date` date DEFAULT NULL COMMENT 'Планируемая дата завершения работ',
  `mileage` int(11) DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL COMMENT 'Фактическая дата и время завершения заказа',
  `complaint` text COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Жалоба клиента',
  `diagnosis` text COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Результат диагностики',
  `comment` text COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Дополнительный комментарий по заказу',
  PRIMARY KEY (`order_id`),
  KEY `fk_orders_car` (`car_id`),
  KEY `fk_orders_employee` (`employee_id`),
  KEY `fk_orders_status` (`status_id`),
  CONSTRAINT `fk_orders_car` FOREIGN KEY (`car_id`) REFERENCES `cars` (`car_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_status` FOREIGN KEY (`status_id`) REFERENCES `order_statuses` (`status_id`) ON UPDATE CASCADE,
  CONSTRAINT `chk_orders_dates` CHECK (`finished_at` is null or `finished_at` >= `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Заказ автосервиса';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `parts`
--

DROP TABLE IF EXISTS `parts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `parts` (
  `part_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Название запчасти',
  `part_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Тип запчасти',
  `article` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Артикул запчасти',
  `manufacturer` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Производитель запчасти',
  `stock_quantity` int(11) NOT NULL DEFAULT 0 COMMENT 'Количество запчастей на складе',
  `price` decimal(10,2) NOT NULL COMMENT 'Текущая цена запчасти',
  PRIMARY KEY (`part_id`),
  CONSTRAINT `chk_parts_stock` CHECK (`stock_quantity` >= 0),
  CONSTRAINT `chk_parts_price` CHECK (`price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Справочник запчастей и остатков на складе';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parts`
--

LOCK TABLES `parts` WRITE;
/*!40000 ALTER TABLE `parts` DISABLE KEYS */;
/*!40000 ALTER TABLE `parts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payments` (
  `payment_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL COMMENT 'Сумма платежа',
  `payment_date` datetime DEFAULT current_timestamp() COMMENT 'Дата и время оплаты',
  `payment_method` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Способ оплаты',
  PRIMARY KEY (`payment_id`),
  KEY `fk_payments_order` (`order_id`),
  CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_payments_amount` CHECK (`amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Оплаты заказ-нарядов';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `work_types`
--

DROP TABLE IF EXISTS `work_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `work_types` (
  `work_type_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Название работы',
  `default_price` decimal(10,2) NOT NULL COMMENT 'Базовая цена работы по прайсу',
  `estimated_duration` int(11) DEFAULT NULL COMMENT 'Время выполнение',
  PRIMARY KEY (`work_type_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Справочник видов работ';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_types`
--

LOCK TABLES `work_types` WRITE;
/*!40000 ALTER TABLE `work_types` DISABLE KEYS */;
/*!40000 ALTER TABLE `work_types` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-28 11:50:18
