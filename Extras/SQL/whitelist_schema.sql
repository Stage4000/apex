-- ============================================================
-- Apex Framework SQL Whitelist Schema
-- ============================================================
-- This file creates the necessary tables for the SQL-based
-- whitelist system used by Apex Framework.
--
-- Supported databases: MySQL/MariaDB
--
-- Author: Apex Framework Team
-- Last Updated: 2024
-- ============================================================

-- Create the database if it doesn't exist
-- Uncomment the following lines if you want to create a new database
-- CREATE DATABASE IF NOT EXISTS apex_framework;
-- USE apex_framework;

-- ============================================================
-- Whitelist Types Table (Reference table)
-- ============================================================
-- Stores the different types of whitelists available

CREATE TABLE IF NOT EXISTS `whitelist_types` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `type_code` VARCHAR(20) NOT NULL UNIQUE,
    `description` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default whitelist types
INSERT INTO `whitelist_types` (`type_code`, `description`) VALUES
    ('S3', 'Whitelisted roles, skins access, and cosmetics'),
    ('CAS', 'Close Air Support - Fixed-wing Jets access'),
    ('S1', 'Commander role access'),
    ('OPFOR', 'OPFOR slots access'),
    ('ALL', 'All staff UIDs - Robocop reporting'),
    ('ADMIN', 'Admin tools access (below Developer)'),
    ('MODERATOR', 'Moderator access'),
    ('TRUSTED', 'Trusted non-staff players'),
    ('MEDIA', 'Limited Splendid Camera access'),
    ('CURATOR', 'Zeus and mission curation access'),
    ('DEVELOPER', 'Debug Console and all ingame tools')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- ============================================================
-- Player Whitelist Table
-- ============================================================
-- Stores player UIDs and their whitelist permissions

CREATE TABLE IF NOT EXISTS `player_whitelist` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `steam_uid` VARCHAR(20) NOT NULL,
    `player_name` VARCHAR(64) DEFAULT NULL,
    `whitelist_type` VARCHAR(20) NOT NULL,
    `added_by` VARCHAR(64) DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_player_whitelist` (`steam_uid`, `whitelist_type`),
    FOREIGN KEY (`whitelist_type`) REFERENCES `whitelist_types`(`type_code`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_steam_uid` (`steam_uid`),
    INDEX `idx_whitelist_type` (`whitelist_type`),
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Whitelist Audit Log Table (Optional)
-- ============================================================
-- Tracks changes to whitelist entries for security/auditing

CREATE TABLE IF NOT EXISTS `whitelist_audit_log` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `steam_uid` VARCHAR(20) NOT NULL,
    `whitelist_type` VARCHAR(20) NOT NULL,
    `action` ENUM('ADD', 'REMOVE', 'MODIFY') NOT NULL,
    `performed_by` VARCHAR(64) DEFAULT NULL,
    `old_values` JSON DEFAULT NULL,
    `new_values` JSON DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_audit_uid` (`steam_uid`),
    INDEX `idx_audit_type` (`whitelist_type`),
    INDEX `idx_audit_action` (`action`),
    INDEX `idx_audit_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Stored Procedures for Whitelist Operations
-- ============================================================

-- Get all UIDs for a specific whitelist type
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS `GetWhitelistByType`(IN p_type VARCHAR(20))
BEGIN
    SELECT `steam_uid` 
    FROM `player_whitelist` 
    WHERE `whitelist_type` = p_type 
    AND `is_active` = 1;
END //
DELIMITER ;

-- Add a player to a whitelist
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS `AddToWhitelist`(
    IN p_steam_uid VARCHAR(20),
    IN p_player_name VARCHAR(64),
    IN p_whitelist_type VARCHAR(20),
    IN p_added_by VARCHAR(64),
    IN p_notes TEXT
)
BEGIN
    INSERT INTO `player_whitelist` 
        (`steam_uid`, `player_name`, `whitelist_type`, `added_by`, `notes`)
    VALUES 
        (p_steam_uid, p_player_name, p_whitelist_type, p_added_by, p_notes)
    ON DUPLICATE KEY UPDATE 
        `player_name` = COALESCE(p_player_name, `player_name`),
        `is_active` = 1,
        `notes` = COALESCE(p_notes, `notes`);
    
    -- Log the action
    INSERT INTO `whitelist_audit_log` 
        (`steam_uid`, `whitelist_type`, `action`, `performed_by`, `new_values`)
    VALUES 
        (p_steam_uid, p_whitelist_type, 'ADD', p_added_by, 
         JSON_OBJECT('player_name', p_player_name, 'notes', p_notes));
END //
DELIMITER ;

-- Remove a player from a whitelist (soft delete)
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS `RemoveFromWhitelist`(
    IN p_steam_uid VARCHAR(20),
    IN p_whitelist_type VARCHAR(20),
    IN p_removed_by VARCHAR(64)
)
BEGIN
    UPDATE `player_whitelist` 
    SET `is_active` = 0 
    WHERE `steam_uid` = p_steam_uid 
    AND `whitelist_type` = p_whitelist_type;
    
    -- Log the action
    INSERT INTO `whitelist_audit_log` 
        (`steam_uid`, `whitelist_type`, `action`, `performed_by`)
    VALUES 
        (p_steam_uid, p_whitelist_type, 'REMOVE', p_removed_by);
END //
DELIMITER ;

-- Check if a player is in a specific whitelist
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS `CheckWhitelist`(
    IN p_steam_uid VARCHAR(20),
    IN p_whitelist_type VARCHAR(20)
)
BEGIN
    SELECT COUNT(*) > 0 AS `is_whitelisted`
    FROM `player_whitelist` 
    WHERE `steam_uid` = p_steam_uid 
    AND `whitelist_type` = p_whitelist_type
    AND `is_active` = 1;
END //
DELIMITER ;

-- ============================================================
-- Views for Easy Access
-- ============================================================

-- View: All active whitelisted players with their types
CREATE OR REPLACE VIEW `v_active_whitelist` AS
SELECT 
    pw.`steam_uid`,
    pw.`player_name`,
    pw.`whitelist_type`,
    wt.`description` AS `whitelist_description`,
    pw.`added_by`,
    pw.`created_at`
FROM `player_whitelist` pw
JOIN `whitelist_types` wt ON pw.`whitelist_type` = wt.`type_code`
WHERE pw.`is_active` = 1
ORDER BY pw.`whitelist_type`, pw.`player_name`;

-- View: Staff members (ALL, ADMIN, MODERATOR, DEVELOPER)
CREATE OR REPLACE VIEW `v_staff_members` AS
SELECT DISTINCT
    pw.`steam_uid`,
    pw.`player_name`,
    GROUP_CONCAT(pw.`whitelist_type` ORDER BY pw.`whitelist_type`) AS `roles`
FROM `player_whitelist` pw
WHERE pw.`whitelist_type` IN ('ALL', 'ADMIN', 'MODERATOR', 'DEVELOPER')
AND pw.`is_active` = 1
GROUP BY pw.`steam_uid`, pw.`player_name`;

-- ============================================================
-- Example Data (Uncomment to insert sample data)
-- ============================================================
-- INSERT INTO `player_whitelist` (`steam_uid`, `player_name`, `whitelist_type`, `added_by`, `notes`) VALUES
--     ('76561198000000001', 'ExampleAdmin', 'ALL', 'System', 'Server administrator'),
--     ('76561198000000001', 'ExampleAdmin', 'ADMIN', 'System', 'Server administrator'),
--     ('76561198000000001', 'ExampleAdmin', 'S3', 'System', 'Full cosmetic access'),
--     ('76561198000000002', 'ExampleMod', 'ALL', 'ExampleAdmin', 'Community moderator'),
--     ('76561198000000002', 'ExampleMod', 'MODERATOR', 'ExampleAdmin', 'Community moderator'),
--     ('76561198000000003', 'ExamplePilot', 'CAS', 'ExampleAdmin', 'Trusted jet pilot');

-- ============================================================
-- Cleanup Script (Use with caution!)
-- ============================================================
-- Uncomment to drop all tables and start fresh
-- DROP VIEW IF EXISTS `v_staff_members`;
-- DROP VIEW IF EXISTS `v_active_whitelist`;
-- DROP PROCEDURE IF EXISTS `CheckWhitelist`;
-- DROP PROCEDURE IF EXISTS `RemoveFromWhitelist`;
-- DROP PROCEDURE IF EXISTS `AddToWhitelist`;
-- DROP PROCEDURE IF EXISTS `GetWhitelistByType`;
-- DROP TABLE IF EXISTS `whitelist_audit_log`;
-- DROP TABLE IF EXISTS `player_whitelist`;
-- DROP TABLE IF EXISTS `whitelist_types`;
