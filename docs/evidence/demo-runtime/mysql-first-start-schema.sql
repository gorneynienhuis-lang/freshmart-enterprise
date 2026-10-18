
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `flyway_schema_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `flyway_schema_history` (
  `installed_rank` int NOT NULL,
  `version` varchar(50) DEFAULT NULL,
  `description` varchar(200) NOT NULL,
  `type` varchar(20) NOT NULL,
  `script` varchar(1000) NOT NULL,
  `checksum` int DEFAULT NULL,
  `installed_by` varchar(100) NOT NULL,
  `installed_on` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `execution_time` int NOT NULL,
  `success` tinyint(1) NOT NULL,
  PRIMARY KEY (`installed_rank`),
  KEY `flyway_schema_history_s_idx` (`success`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `fm_auth_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fm_auth_session` (
  `session_id` varchar(64) NOT NULL,
  `family_id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `access_hash` char(64) NOT NULL,
  `refresh_hash` char(64) NOT NULL,
  `status` varchar(16) NOT NULL,
  `access_expires_at` timestamp(6) NOT NULL,
  `refresh_expires_at` timestamp(6) NOT NULL,
  `created_at` timestamp(6) NOT NULL,
  `rotated_at` timestamp(6) NULL DEFAULT NULL,
  PRIMARY KEY (`session_id`),
  UNIQUE KEY `access_hash` (`access_hash`),
  UNIQUE KEY `refresh_hash` (`refresh_hash`),
  KEY `idx_session_family` (`family_id`),
  KEY `idx_session_user` (`user_id`,`status`),
  CONSTRAINT `fm_auth_session_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `fm_user` (`user_id`),
  CONSTRAINT `ck_session_status` CHECK ((`status` in (_utf8mb4'ACTIVE',_utf8mb4'ROTATED',_utf8mb4'REVOKED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `fm_category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fm_category` (
  `category_id` varchar(64) NOT NULL,
  `code` varchar(64) NOT NULL,
  `name` varchar(40) NOT NULL,
  `short_name` varchar(20) NOT NULL,
  `image_url` varchar(2048) NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `code` (`code`),
  CONSTRAINT `ck_category_sort` CHECK ((`sort_order` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `fm_csrf_context`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fm_csrf_context` (
  `context_hash` char(64) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` timestamp(6) NOT NULL,
  `created_at` timestamp(6) NOT NULL,
  PRIMARY KEY (`context_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `fm_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fm_user` (
  `user_id` varchar(64) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `password_hash` varchar(100) NOT NULL,
  `display_name` varchar(60) NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
  `must_change_password` tinyint(1) NOT NULL DEFAULT '0',
  `version` bigint NOT NULL DEFAULT '0',
  `created_at` timestamp(6) NOT NULL,
  `updated_at` timestamp(6) NOT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `phone` (`phone`),
  CONSTRAINT `ck_user_status` CHECK ((`status` in (_utf8mb4'ACTIVE',_utf8mb4'DISABLED'))),
  CONSTRAINT `ck_user_version` CHECK ((`version` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `fm_user_role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fm_user_role` (
  `user_id` varchar(64) NOT NULL,
  `role_code` varchar(20) NOT NULL,
  PRIMARY KEY (`user_id`,`role_code`),
  CONSTRAINT `fm_user_role_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `fm_user` (`user_id`),
  CONSTRAINT `ck_user_role` CHECK ((`role_code` in (_utf8mb4'MEMBER',_utf8mb4'PICKER',_utf8mb4'COURIER',_utf8mb4'OPERATOR',_utf8mb4'SERVICE',_utf8mb4'FINANCE',_utf8mb4'ADMIN')))
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
