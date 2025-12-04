<?php
/**
 * Steam OAuth Whitelist - Configuration File
 * 
 * Copy this file to 'config.php' and fill in your values.
 * NEVER commit config.php to version control!
 */

return [
    // Database Configuration
    'database' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'apex_framework',
        'user' => 'arma3_user',
        'password' => 'YOUR_DATABASE_PASSWORD_HERE',
        'charset' => 'utf8mb4',
    ],
    
    // Steam Configuration
    'steam' => [
        // Your Steam Web API Key - Get it from https://steamcommunity.com/dev/apikey
        'api_key' => 'YOUR_STEAM_API_KEY_HERE',
    ],
    
    // Application Configuration
    'app' => [
        // The full URL where this application is hosted (no trailing slash)
        'base_url' => 'https://your-domain.com/whitelist',
        
        // Whitelist types to add users to upon successful authentication
        // Available types: S3, CAS, S1, OPFOR, ALL, ADMIN, MODERATOR, TRUSTED, MEDIA, CURATOR, DEVELOPER
        'whitelist_types' => ['S3', 'CAS'],
        
        // Who to record as the person who added the whitelist entry
        'added_by' => 'Steam OAuth',
        
        // Optional: Redirect URL after successful whitelisting
        'success_redirect' => null,
        
        // Optional: Redirect URL after failed whitelisting
        'error_redirect' => null,
    ],
    
    // Session Configuration
    'session' => [
        'name' => 'apex_steam_oauth',
        'lifetime' => 3600, // 1 hour
    ],
];
