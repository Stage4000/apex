# Steam OAuth Whitelist for Apex Framework

This PHP application provides a self-service whitelist system that uses Steam OpenID authentication to automatically add players to the S3 and CAS whitelists.

## Features

- **Steam OpenID Authentication**: Securely authenticate users via their Steam accounts
- **Automatic Steam ID Retrieval**: No need for players to manually look up their Steam64 ID
- **Database Integration**: Directly adds players to the SQL whitelist database
- **Player Name Lookup**: Automatically fetches player display names from Steam API
- **Audit Logging**: All whitelist additions are logged for accountability
- **Modern UI**: Clean, responsive interface for the authentication flow

## Requirements

- PHP 7.4 or higher
- PHP PDO extension with MySQL driver
- MySQL/MariaDB database (with the Apex Framework whitelist schema)
- Web server (Apache, Nginx, etc.)
- SSL certificate (HTTPS is required for Steam OpenID)
- Steam Web API Key (optional, for fetching player names)

## Installation

### 1. Set Up the Database

First, ensure you have the Apex Framework whitelist database set up. Follow the instructions in `Extras/SQL/SQL-Setup-Guide.md` to:

1. Create the MySQL/MariaDB database
2. Import the schema from `Extras/SQL/whitelist_schema.sql`
3. Create a database user with appropriate permissions

### 2. Deploy the Application

1. Copy the entire `SteamOAuth` directory to your web server:

   ```bash
   # Example: copying to web root
   cp -r Extras/SteamOAuth /var/www/html/whitelist
   ```

2. Set proper permissions:

   ```bash
   chmod 755 /var/www/html/whitelist
   chmod 644 /var/www/html/whitelist/*.php
   ```

### 3. Configure the Application

1. Copy the example configuration file:

   ```bash
   cd /var/www/html/whitelist
   cp config.example.php config.php
   ```

2. Edit `config.php` with your settings:

   ```php
   <?php
   return [
       'database' => [
           'host' => 'localhost',
           'port' => 3306,
           'name' => 'apex_framework',
           'user' => 'arma3_user',
           'password' => 'your_actual_password',  // Replace this!
           'charset' => 'utf8mb4',
       ],
       
       'steam' => [
           // Get your API key from: https://steamcommunity.com/dev/apikey
           'api_key' => 'YOUR_STEAM_API_KEY',
       ],
       
       'app' => [
           // The full URL where this is hosted (no trailing slash)
           'base_url' => 'https://your-domain.com/whitelist',
           
           // Whitelist types to add users to
           'whitelist_types' => ['S3', 'CAS'],
           
           // Who added this entry (shown in audit log)
           'added_by' => 'Steam OAuth',
       ],
   ];
   ```

3. **Important**: Protect your config file:

   ```bash
   chmod 600 config.php
   ```

### 4. Configure Your Web Server

#### Apache (.htaccess)

The application works out of the box with Apache. Optionally, add an `.htaccess` file:

```apache
# Protect config file
<Files "config.php">
    Require all denied
</Files>

# Enable HTTPS redirect
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

#### Nginx

```nginx
location /whitelist {
    index index.php;
    
    # Protect config file
    location ~ config\.php$ {
        deny all;
    }
    
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

### 5. Get a Steam Web API Key (Optional but Recommended)

1. Go to [https://steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
2. Log in with your Steam account
3. Register your domain and accept the terms
4. Copy the API key to your `config.php`

The API key is used to fetch player display names. Without it, only the Steam ID will be recorded.

## Usage

### For Players

1. Navigate to your whitelist URL (e.g., `https://your-domain.com/whitelist`)
2. Click "Sign in through Steam"
3. Log in with your Steam account on the Steam website
4. You'll be redirected back and automatically added to the whitelists
5. Join the Arma 3 server - your whitelisted roles will now be available!

### URL Actions

- `/index.php` or `/index.php?action=login` - Start the login flow
- `/index.php?action=callback` - Steam redirects here after authentication
- `/index.php?action=status` - Check current whitelist status

## Configuration Options

### Database Settings

| Option | Description |
|--------|-------------|
| `host` | Database server hostname |
| `port` | Database server port (default: 3306) |
| `name` | Database name |
| `user` | Database username |
| `password` | Database password |
| `charset` | Character set (default: utf8mb4) |

### Steam Settings

| Option | Description |
|--------|-------------|
| `api_key` | Your Steam Web API key (optional, for player names) |

### Application Settings

| Option | Description |
|--------|-------------|
| `base_url` | Full URL where the application is hosted |
| `whitelist_types` | Array of whitelist types to add users to |
| `added_by` | Name shown in audit log for who added the entry |
| `success_redirect` | Optional URL to redirect to after success |
| `error_redirect` | Optional URL to redirect to after failure |

### Session Settings

| Option | Description |
|--------|-------------|
| `name` | Session cookie name |
| `lifetime` | Session lifetime in seconds |

## Available Whitelist Types

| Type | Description |
|------|-------------|
| `S3` | Whitelisted roles, vehicle skins, uniform skins, custom patches |
| `CAS` | Close Air Support - Fixed-wing Jets access |
| `S1` | Commander role access |
| `OPFOR` | OPFOR slots access |
| `ALL` | All staff UIDs - Robocop reporting |
| `ADMIN` | Admin tools access (below Developer) |
| `MODERATOR` | Moderator access |
| `TRUSTED` | Trusted non-staff players |
| `MEDIA` | Limited Splendid Camera access |
| `CURATOR` | Zeus and mission curation access |
| `DEVELOPER` | Debug Console and all in-game tools |

## Security Considerations

1. **Always use HTTPS**: Steam OpenID requires HTTPS for the callback URL
2. **Protect config.php**: Never expose database credentials
3. **Use a dedicated database user**: Only grant SELECT, INSERT, UPDATE permissions
4. **Don't commit config.php**: Add it to `.gitignore`
5. **Review audit logs**: Regularly check the `whitelist_audit_log` table

## Troubleshooting

### Steam Login Not Working

- Ensure your site uses HTTPS
- Check that `base_url` in config matches your actual URL
- Verify Steam's OpenID service is accessible from your server

### Database Connection Failed

- Verify database credentials in `config.php`
- Ensure MySQL/MariaDB is running
- Check that the user has proper permissions
- Test connection manually: `mysql -u arma3_user -p apex_framework`

### Player Names Not Showing

- Ensure you have a valid Steam Web API key configured
- Check API key hasn't been revoked
- Verify your server can reach `api.steampowered.com`

### Already Whitelisted Message

This is normal! If a player authenticates again, the system recognizes they're already whitelisted and displays this status.

## Integration with Discord Bots

If you also have a Discord bot for whitelisting, both systems can coexist. They use the same database, so entries from either source will work.

## File Structure

```
SteamOAuth/
├── index.php           # Main entry point and routing
├── SteamAuth.php       # Steam OpenID authentication handler
├── SteamAPI.php        # Steam Web API client
├── WhitelistDatabase.php # Database operations
├── config.example.php  # Example configuration
├── config.php          # Your configuration (create this)
└── README.md           # This file
```

## Support

For issues related to:

- **This whitelist system**: Open an issue on the repository
- **Apex Framework**: Visit [Discord](https://discord.gg/FfVaPce) or [BI Forums](https://forums.bistudio.com/forums/topic/212240-apex-framework/)
- **Steam API**: See [Steam Web API Documentation](https://developer.valvesoftware.com/wiki/Steam_Web_API)

## License

This project is part of the Apex Framework. See the main LICENSE file for details.
