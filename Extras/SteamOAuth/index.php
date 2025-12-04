<?php
/**
 * Steam OAuth Whitelist - Main Entry Point
 * 
 * This script handles the Steam OpenID authentication flow and
 * automatically adds authenticated users to the configured whitelists.
 * 
 * Usage:
 *   1. Copy config.example.php to config.php and configure your settings
 *   2. Host this directory on a web server with PHP 7.4+ and PDO MySQL
 *   3. Navigate to this script in a browser to start the authentication flow
 * 
 * @see config.example.php for configuration options
 */

declare(strict_types=1);

// Error handling
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Load dependencies
require_once __DIR__ . '/SteamAuth.php';
require_once __DIR__ . '/SteamAPI.php';
require_once __DIR__ . '/WhitelistDatabase.php';

use ApexFramework\SteamOAuth\SteamAuth;
use ApexFramework\SteamOAuth\SteamAPI;
use ApexFramework\SteamOAuth\WhitelistDatabase;

/**
 * Load configuration
 * 
 * @return array<string, mixed> Configuration array
 */
function loadConfig(): array
{
    $configFile = __DIR__ . '/config.php';
    
    if (!file_exists($configFile)) {
        renderError(
            'Configuration Missing',
            'Please copy config.example.php to config.php and configure your settings.'
        );
        exit(1);
    }
    
    $config = require $configFile;
    
    if (!is_array($config)) {
        renderError('Configuration Error', 'config.php must return an array.');
        exit(1);
    }
    
    return $config;
}

/**
 * Start or resume session
 * 
 * @param array<string, mixed> $sessionConfig Session configuration
 */
function initSession(array $sessionConfig): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_name($sessionConfig['name'] ?? 'apex_steam_oauth');
        session_set_cookie_params([
            'lifetime' => $sessionConfig['lifetime'] ?? 3600,
            'httponly' => true,
            'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

/**
 * Get the current request URL
 * 
 * @param string $baseUrl Base URL from config
 * @return string The callback URL for Steam
 */
function getCallbackUrl(string $baseUrl): string
{
    return rtrim($baseUrl, '/') . '/index.php?action=callback';
}

/**
 * Render a simple HTML page
 * 
 * @param string $title Page title
 * @param string $content HTML content
 * @param string $type Message type (success, error, info)
 */
function renderPage(string $title, string $content, string $type = 'info'): void
{
    $colors = [
        'success' => '#28a745',
        'error' => '#dc3545',
        'info' => '#17a2b8',
    ];
    $color = $colors[$type] ?? $colors['info'];
    
    $html = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$title} - Apex Framework Whitelist</title>
    <style>
        * {
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #ffffff;
            min-height: 100vh;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 {
            margin: 0 0 20px;
            color: {$color};
            font-size: 28px;
        }
        .content {
            margin: 20px 0;
            line-height: 1.6;
        }
        .steam-btn {
            display: inline-block;
            background: #1b2838;
            color: #ffffff;
            padding: 15px 30px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 16px;
            font-weight: 600;
            transition: all 0.3s ease;
            border: 2px solid #66c0f4;
        }
        .steam-btn:hover {
            background: #66c0f4;
            color: #1b2838;
            transform: translateY(-2px);
        }
        .steam-btn img {
            vertical-align: middle;
            margin-right: 10px;
        }
        .result-list {
            text-align: left;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            padding: 15px 20px;
            margin: 20px 0;
        }
        .result-item {
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .result-item:last-child {
            border-bottom: none;
        }
        .badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-success {
            background: #28a745;
        }
        .badge-error {
            background: #dc3545;
        }
        .badge-info {
            background: #17a2b8;
        }
        .steam-id {
            font-family: monospace;
            background: rgba(0, 0, 0, 0.3);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
        }
        .logo {
            margin-bottom: 20px;
        }
        .logo svg {
            width: 60px;
            height: 60px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <svg viewBox="0 0 100 100" fill="{$color}">
                <path d="M50 5L90 25v50L50 95 10 75V25L50 5zm0 10L20 30v40l30 15 30-15V30L50 15z"/>
                <circle cx="50" cy="50" r="15"/>
            </svg>
        </div>
        <h1>{$title}</h1>
        <div class="content">
            {$content}
        </div>
    </div>
</body>
</html>
HTML;
    
    echo $html;
}

/**
 * Render success page
 * 
 * @param string $title Title
 * @param string $content Content
 */
function renderSuccess(string $title, string $content): void
{
    renderPage($title, $content, 'success');
}

/**
 * Render error page
 * 
 * @param string $title Title
 * @param string $content Content
 */
function renderError(string $title, string $content): void
{
    renderPage($title, $content, 'error');
}

/**
 * Main application logic
 */
function main(): void
{
    // Load configuration
    $config = loadConfig();
    
    // Initialize session
    initSession($config['session'] ?? []);
    
    // Determine action
    $action = $_GET['action'] ?? 'login';
    
    switch ($action) {
        case 'login':
            handleLogin($config);
            break;
            
        case 'callback':
            handleCallback($config);
            break;
            
        case 'status':
            handleStatus($config);
            break;
            
        default:
            renderError('Invalid Action', 'The requested action is not valid.');
    }
}

/**
 * Handle login - redirect to Steam
 * 
 * @param array<string, mixed> $config Configuration
 */
function handleLogin(array $config): void
{
    $callbackUrl = getCallbackUrl($config['app']['base_url']);
    $steamAuth = new SteamAuth($callbackUrl);
    
    $content = <<<HTML
<p>Click the button below to authenticate with your Steam account.</p>
<p>After authentication, you will be automatically added to the whitelist.</p>
<a href="{$steamAuth->getLoginUrl()}" class="steam-btn">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 8px;">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
        <circle cx="12" cy="12" r="3"/>
    </svg>
    Sign in through Steam
</a>
HTML;
    
    renderPage('Steam Whitelist', $content, 'info');
}

/**
 * Handle callback from Steam
 * 
 * @param array<string, mixed> $config Configuration
 */
function handleCallback(array $config): void
{
    $callbackUrl = getCallbackUrl($config['app']['base_url']);
    $steamAuth = new SteamAuth($callbackUrl);
    
    // Validate Steam response
    $steamId = $steamAuth->validate($_GET);
    
    if ($steamId === null) {
        if (isset($config['app']['error_redirect'])) {
            header('Location: ' . $config['app']['error_redirect']);
            exit;
        }
        renderError('Authentication Failed', 'Steam authentication failed. Please try again.');
        return;
    }
    
    // Store Steam ID in session
    $_SESSION['steam_id'] = $steamId;
    
    // Get player name from Steam API if API key is configured
    $playerName = null;
    if (!empty($config['steam']['api_key']) && $config['steam']['api_key'] !== 'YOUR_STEAM_API_KEY_HERE') {
        $steamAPI = new SteamAPI($config['steam']['api_key']);
        $playerName = $steamAPI->getPlayerName($steamId);
    }
    $_SESSION['player_name'] = $playerName;
    
    // Connect to database and add to whitelists
    try {
        $db = new WhitelistDatabase($config['database']);
        $whitelistTypes = $config['app']['whitelist_types'] ?? ['S3', 'CAS'];
        $addedBy = $config['app']['added_by'] ?? 'Steam OAuth';
        
        $results = $db->addToWhitelists($steamId, $playerName, $whitelistTypes, $addedBy);
        $_SESSION['whitelist_results'] = $results;
        
        // Check if all succeeded
        $allSuccess = true;
        foreach ($results as $result) {
            if (!($result['success'] ?? false)) {
                $allSuccess = false;
                break;
            }
        }
        
        // Redirect if configured
        if ($allSuccess && isset($config['app']['success_redirect'])) {
            header('Location: ' . $config['app']['success_redirect']);
            exit;
        }
        
        // Show results
        $resultHtml = '<p><strong>Steam ID:</strong> <span class="steam-id">' . htmlspecialchars($steamId) . '</span></p>';
        
        if ($playerName !== null) {
            $resultHtml .= '<p><strong>Player Name:</strong> ' . htmlspecialchars($playerName) . '</p>';
        }
        
        $resultHtml .= '<div class="result-list">';
        foreach ($results as $type => $result) {
            $success = $result['success'] ?? false;
            $message = $result['message'] ?? ($success ? 'Success' : 'Failed');
            $alreadyExisted = $result['already_existed'] ?? false;
            
            if ($alreadyExisted) {
                $badgeClass = 'badge-info';
                $badgeText = 'Already Exists';
            } elseif ($success) {
                $badgeClass = 'badge-success';
                $badgeText = 'Added';
            } else {
                $badgeClass = 'badge-error';
                $badgeText = 'Failed';
            }
            
            $resultHtml .= '<div class="result-item">';
            $resultHtml .= '<span>' . htmlspecialchars($type) . ' Whitelist</span>';
            $resultHtml .= '<span class="badge ' . $badgeClass . '">' . $badgeText . '</span>';
            $resultHtml .= '</div>';
        }
        $resultHtml .= '</div>';
        
        $resultHtml .= '<p style="margin-top: 20px; opacity: 0.8;">You can now join the server with your whitelisted roles!</p>';
        
        renderSuccess('Whitelist Complete', $resultHtml);
        
    } catch (Exception $e) {
        error_log('Whitelist error: ' . $e->getMessage());
        
        if (isset($config['app']['error_redirect'])) {
            header('Location: ' . $config['app']['error_redirect']);
            exit;
        }
        
        renderError(
            'Database Error',
            'Failed to connect to the whitelist database. Please contact an administrator.'
        );
    }
}

/**
 * Handle status check - show current session status
 * 
 * @param array<string, mixed> $config Configuration
 */
function handleStatus(array $config): void
{
    $steamId = $_SESSION['steam_id'] ?? null;
    
    if ($steamId === null) {
        $content = '<p>You are not currently authenticated.</p>';
        $content .= '<a href="?action=login" class="steam-btn">Sign in with Steam</a>';
        renderPage('Not Authenticated', $content, 'info');
        return;
    }
    
    $playerName = $_SESSION['player_name'] ?? 'Unknown';
    
    $content = '<p><strong>Steam ID:</strong> <span class="steam-id">' . htmlspecialchars($steamId) . '</span></p>';
    $content .= '<p><strong>Player Name:</strong> ' . htmlspecialchars($playerName) . '</p>';
    
    // Show current whitelists from database
    try {
        $db = new WhitelistDatabase($config['database']);
        $whitelists = $db->getPlayerWhitelists($steamId);
        
        if (!empty($whitelists)) {
            $content .= '<div class="result-list">';
            $content .= '<p style="margin: 0 0 10px; font-weight: 600;">Your Whitelists:</p>';
            foreach ($whitelists as $wl) {
                $content .= '<div class="result-item">';
                $content .= '<span>' . htmlspecialchars($wl['whitelist_type']) . '</span>';
                $content .= '<span class="badge badge-success">Active</span>';
                $content .= '</div>';
            }
            $content .= '</div>';
        } else {
            $content .= '<p style="opacity: 0.8;">You have no active whitelists.</p>';
        }
    } catch (Exception $e) {
        $content .= '<p style="color: #dc3545;">Unable to fetch whitelist status.</p>';
    }
    
    renderSuccess('Whitelist Status', $content);
}

// Run the application
main();
