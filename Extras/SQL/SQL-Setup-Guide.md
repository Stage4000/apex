# Apex Framework SQL Whitelist Setup Guide

This guide provides detailed instructions for setting up the SQL-based whitelist system for Apex Framework using ExtDB3 and MySQL/MariaDB.

## Table of Contents

1. [Overview](#overview)
2. [Requirements](#requirements)
3. [ExtDB3 Installation](#extdb3-installation)
4. [Database Setup](#database-setup)
5. [Configuration](#configuration)
6. [Migration from File-Based Whitelist](#migration-from-file-based-whitelist)
7. [Managing Whitelists](#managing-whitelists)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The SQL-based whitelist system offers several advantages over the traditional file-based system:

- **Real-time updates**: Add or remove players without server restart
- **Centralized management**: Manage multiple servers from one database
- **Audit logging**: Track who added/removed whitelist entries
- **Integration ready**: Easy to integrate with Discord bots, web panels, etc.
- **Scalability**: Handle thousands of whitelisted players efficiently

### Whitelist Types

| Type | Description |
|------|-------------|
| `S3` | Whitelisted roles, vehicle skins, uniform skins, custom patches |
| `CAS` | Close Air Support - Fixed-wing Jets access |
| `S1` | Commander role access (if Commander whitelisting is used) |
| `OPFOR` | OPFOR slots access |
| `ALL` | All staff UIDs - Robocop reports trolling/hacking events to these players |
| `ADMIN` | Admin tools access (below Developer level) |
| `MODERATOR` | Moderator access |
| `TRUSTED` | Trusted non-staff players |
| `MEDIA` | Limited Splendid Camera access |
| `CURATOR` | Zeus and mission curation functionality |
| `DEVELOPER` | Debug Console and all ingame tools |

---

## Requirements

### Server Requirements

- Windows x64 or Linux server
- Arma 3 Dedicated Server
- MySQL 5.7+ or MariaDB 10.2+
- ExtDB3 addon (v1.031 or later)

### Downloads

- **ExtDB3**: https://github.com/SteezCram/extDB3/releases
- **MySQL Community Server**: https://dev.mysql.com/downloads/mysql/
- **MariaDB**: https://mariadb.org/download/
- **HeidiSQL** (Windows DB client): https://www.heidisql.com/download.php
- **DBeaver** (Cross-platform DB client): https://dbeaver.io/download/

---

## ExtDB3 Installation

### Step 1: Download ExtDB3

1. Go to https://github.com/SteezCram/extDB3/releases
2. Download the latest release for your platform:
   - Windows: `extDB3-windows.zip`
   - Linux: `extDB3-linux.tar.gz`

### Step 2: Install ExtDB3

**Windows:**
```
1. Extract the downloaded archive
2. Copy the following files to your Arma 3 server directory:
   - extDB3.dll
   - extDB3_x64.dll
   - tbbmalloc.dll
   - tbbmalloc_x64.dll
3. Copy the @extDB3 folder to your server mods directory
```

**Linux:**
```bash
# Extract the archive
tar -xzf extDB3-linux.tar.gz

# Copy the .so file to your Arma 3 server directory
cp extDB3.so /path/to/arma3server/

# Copy the @extDB3 folder
cp -r @extDB3 /path/to/arma3server/
```

### Step 3: Configure ExtDB3

Create the configuration file `extdb3-conf.ini` in your Arma 3 server directory:

```ini
[Main]
; Log directory (relative to Arma 3 server directory)
Log Folder = extDB3/logs

[apex_framework]
; Database connection settings
Type = MySQL
Name = apex_framework
Username = arma3_user
Password = YOUR_SECURE_PASSWORD_HERE
IP = 127.0.0.1
Port = 3306

; Connection pool settings
; Increase Max Threads for busy servers
Min Threads = 2
Max Threads = 8

; Character encoding
Encoding = UTF8
```

**Important Security Notes:**
- Use a dedicated MySQL user with limited permissions
- Never use root credentials
- Keep the extdb3-conf.ini file secure
- Use a strong password

---

## Database Setup

### Step 1: Create the Database

Connect to your MySQL/MariaDB server and create the database:

```sql
-- Create the database
CREATE DATABASE apex_framework CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create a dedicated user (replace with your actual password)
CREATE USER 'arma3_user'@'localhost' IDENTIFIED BY 'YOUR_SECURE_PASSWORD_HERE';

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON apex_framework.* TO 'arma3_user'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;
```

### Step 2: Import the Schema

Import the whitelist schema file located at `Extras/SQL/whitelist_schema.sql`:

**Using MySQL command line:**
```bash
mysql -u arma3_user -p apex_framework < Extras/SQL/whitelist_schema.sql
```

**Using HeidiSQL:**
1. Connect to your database
2. Select the `apex_framework` database
3. Go to File → Run SQL file...
4. Select `whitelist_schema.sql`
5. Click Execute

**Using DBeaver:**
1. Connect to your database
2. Right-click on `apex_framework`
3. Select "Execute SQL Script"
4. Select `whitelist_schema.sql`

### Step 3: Verify the Installation

Run this query to verify the tables were created:

```sql
SHOW TABLES;
```

You should see:
- `player_whitelist`
- `whitelist_audit_log`
- `whitelist_types`

---

## Configuration

### Step 1: Enable Database in Apex Framework

Edit `@Apex_cfg/parameters.sqf` and add the following settings at the end of the file (before the "DO NOT EDIT BELOW" section):

```sqf
//===================================================== DATABASE SETTINGS

_useDatabase = 1;                           // 0 - Disabled (use file whitelist). 1 - Enabled (use SQL whitelist).
_databaseName = 'apex_framework';           // Must match the section name in extdb3-conf.ini
_databaseProtocol = 'apex_whitelist';       // Protocol name for ExtDB3
_whitelistCacheDuration = 300;              // Cache duration in seconds (300 = 5 minutes)
```

### Step 2: Server Launch Parameters

Add ExtDB3 to your server mod line:

**Windows (steamcmd example):**
```batch
start arma3server_x64.exe -servermod=@Apex;@extDB3 -mod= -config=server.cfg -filePatching -port=2302
```

**Linux:**
```bash
./arma3server_x64 -servermod="@Apex;@extDB3" -mod="" -config=server.cfg -filePatching -port=2302
```

---

## Migration from File-Based Whitelist

If you have an existing `whitelist.sqf` file with player UIDs, you can migrate them to the database.

### Option 1: Manual Entry

1. Open the `@Apex_cfg/whitelist.sqf` file
2. For each UID and type, insert into the database:

```sql
-- Example: Add an admin
INSERT INTO player_whitelist (steam_uid, player_name, whitelist_type, added_by, notes)
VALUES ('76561198000000001', 'PlayerName', 'ALL', 'Migration', 'Migrated from whitelist.sqf');

INSERT INTO player_whitelist (steam_uid, player_name, whitelist_type, added_by, notes)
VALUES ('76561198000000001', 'PlayerName', 'ADMIN', 'Migration', 'Migrated from whitelist.sqf');
```

### Option 2: Bulk Migration Script

Save this as a `.sql` file and run it after modifying with your actual UIDs:

```sql
-- Bulk migration script
-- Replace the UIDs and names with your actual data

-- S3 Whitelisted Players
INSERT INTO player_whitelist (steam_uid, player_name, whitelist_type, added_by) VALUES
('76561198000000001', 'Player1', 'S3', 'Migration'),
('76561198000000002', 'Player2', 'S3', 'Migration');

-- CAS Pilots
INSERT INTO player_whitelist (steam_uid, player_name, whitelist_type, added_by) VALUES
('76561198000000003', 'Pilot1', 'CAS', 'Migration'),
('76561198000000004', 'Pilot2', 'CAS', 'Migration');

-- Staff (ALL)
INSERT INTO player_whitelist (steam_uid, player_name, whitelist_type, added_by) VALUES
('76561198000000005', 'Admin1', 'ALL', 'Migration'),
('76561198000000006', 'Mod1', 'ALL', 'Migration');

-- Admins
INSERT INTO player_whitelist (steam_uid, player_name, whitelist_type, added_by) VALUES
('76561198000000005', 'Admin1', 'ADMIN', 'Migration');

-- Moderators
INSERT INTO player_whitelist (steam_uid, player_name, whitelist_type, added_by) VALUES
('76561198000000006', 'Mod1', 'MODERATOR', 'Migration');

-- Developers
INSERT INTO player_whitelist (steam_uid, player_name, whitelist_type, added_by) VALUES
('76561198000000007', 'Dev1', 'DEVELOPER', 'Migration');

-- Zeus/Curators
INSERT INTO player_whitelist (steam_uid, player_name, whitelist_type, added_by) VALUES
('76561198000000008', 'Zeus1', 'CURATOR', 'Migration');
```

---

## Managing Whitelists

### Adding a Player

```sql
-- Using the stored procedure (recommended)
CALL AddToWhitelist('76561198123456789', 'PlayerName', 'CAS', 'YourAdminName', 'Trusted pilot');

-- Or direct insert
INSERT INTO player_whitelist (steam_uid, player_name, whitelist_type, added_by, notes)
VALUES ('76561198123456789', 'PlayerName', 'CAS', 'YourAdminName', 'Trusted pilot');
```

### Removing a Player

```sql
-- Using stored procedure (soft delete - keeps record)
CALL RemoveFromWhitelist('76561198123456789', 'CAS', 'YourAdminName');

-- Or hard delete
DELETE FROM player_whitelist 
WHERE steam_uid = '76561198123456789' AND whitelist_type = 'CAS';
```

### Viewing All Whitelisted Players

```sql
-- View all active whitelisted players
SELECT * FROM v_active_whitelist;

-- View staff members specifically
SELECT * FROM v_staff_members;

-- View players with specific whitelist type
SELECT * FROM player_whitelist WHERE whitelist_type = 'CAS' AND is_active = 1;
```

### Checking if Player is Whitelisted

```sql
CALL CheckWhitelist('76561198123456789', 'CAS');
```

---

## Troubleshooting

### Common Issues

#### ExtDB3 Not Loading

**Symptoms:** Server starts but database features don't work

**Solutions:**
1. Check that extDB3.dll (or .so) is in the Arma 3 server directory
2. Verify @extDB3 is in your -servermod parameter
3. Check the server RPT log for ExtDB3 errors

#### Database Connection Failed

**Symptoms:** Error in RPT: "Failed to connect to database"

**Solutions:**
1. Verify MySQL/MariaDB is running
2. Check credentials in extdb3-conf.ini
3. Ensure the database name matches exactly
4. Test the connection using a MySQL client

```bash
# Test MySQL connection
mysql -u arma3_user -p -h 127.0.0.1 apex_framework
```

#### Whitelist Not Loading

**Symptoms:** Players not recognized as whitelisted

**Solutions:**
1. Check the server RPT for "[Database]" and "[WhitelistDB]" messages
2. Verify data exists in the database:
   ```sql
   SELECT * FROM player_whitelist WHERE is_active = 1;
   ```
3. Ensure UIDs are stored correctly (should be Steam64 ID format)
4. Clear the cache by restarting the server

#### Cache Issues

**Symptoms:** Changes not taking effect immediately

**Solution:**
The whitelist is cached for performance. Default cache duration is 5 minutes. Either:
- Wait for the cache to expire
- Restart the server
- Modify `_whitelistCacheDuration` in parameters.sqf

### Checking Logs

**Server RPT Log:**
Look for these log prefixes:
- `[Database]` - Database connection status
- `[WhitelistDB]` - Whitelist query results

**ExtDB3 Logs:**
Located in `extDB3/logs/` directory. Check for:
- Connection errors
- SQL syntax errors
- Authentication failures

### Getting Help

If you encounter issues:

1. Check the Apex Framework Discord: https://discord.gg/FfVaPce
2. Check the BI Forums: https://forums.bistudio.com/forums/topic/212240-apex-framework/
3. ExtDB3 GitHub Issues: https://github.com/SteezCram/extDB3/issues

---

## Security Best Practices

1. **Use dedicated database user** - Never use root credentials
2. **Limit permissions** - Only grant SELECT, INSERT, UPDATE, DELETE
3. **Secure extdb3-conf.ini** - Don't share or commit this file
4. **Use strong passwords** - At least 16 characters with mixed case, numbers, symbols
5. **Enable audit logging** - The schema includes audit tables by default
6. **Regular backups** - Back up your database regularly
7. **Network security** - If DB is remote, use SSL/TLS connection

---

## Advanced: Steam OAuth Self-Service Whitelist

For a self-service whitelist system where players can authenticate via Steam and be automatically added to the whitelist, see the `Extras/SteamOAuth` directory. This PHP application:

- Uses Steam OpenID for secure authentication
- Automatically retrieves the player's Steam ID
- Adds players to configured whitelists (S3, CAS, etc.)
- Logs all additions to the audit table

See `Extras/SteamOAuth/README.md` for setup instructions.

---

## Advanced: Discord Bot Integration

The SQL-based whitelist system makes it easy to integrate with Discord bots. Here's a simple example using Python:

```python
import discord
import mysql.connector
from discord.ext import commands

bot = commands.Bot(command_prefix='!')

# Database connection
db = mysql.connector.connect(
    host="localhost",
    user="arma3_user",
    password="YOUR_PASSWORD",
    database="apex_framework"
)

@bot.command()
@commands.has_role('Admin')
async def whitelist(ctx, steam_uid: str, whitelist_type: str, player_name: str = None):
    """Add a player to a whitelist"""
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO player_whitelist (steam_uid, player_name, whitelist_type, added_by) "
        "VALUES (%s, %s, %s, %s) ON DUPLICATE KEY UPDATE is_active = 1",
        (steam_uid, player_name, whitelist_type.upper(), str(ctx.author))
    )
    db.commit()
    await ctx.send(f"Added {steam_uid} to {whitelist_type} whitelist")

bot.run('YOUR_DISCORD_BOT_TOKEN')
```

---

## Version History

- **2024** - Initial SQL whitelist implementation
- **2024** - Steam OAuth self-service whitelist added
- Based on Apex Framework 1.5.6

---

*For more information, visit the Apex Framework community resources or contact the server administrators.*
