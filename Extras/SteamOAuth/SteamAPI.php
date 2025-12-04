<?php
/**
 * Steam API Helper
 * 
 * Provides methods to fetch player information from Steam Web API.
 * 
 * @see https://developer.valvesoftware.com/wiki/Steam_Web_API
 */

declare(strict_types=1);

namespace ApexFramework\SteamOAuth;

class SteamAPI
{
    private const API_BASE_URL = 'https://api.steampowered.com';
    
    private string $apiKey;
    
    /**
     * Initialize with Steam Web API key
     * 
     * @param string $apiKey Your Steam Web API key
     */
    public function __construct(string $apiKey)
    {
        $this->apiKey = $apiKey;
    }
    
    /**
     * Get player summary information
     * 
     * @param string $steamId The player's Steam ID (64-bit)
     * @return array<string, mixed>|null Player data or null if not found
     */
    public function getPlayerSummary(string $steamId): ?array
    {
        $url = sprintf(
            '%s/ISteamUser/GetPlayerSummaries/v0002/?key=%s&steamids=%s',
            self::API_BASE_URL,
            urlencode($this->apiKey),
            urlencode($steamId)
        );
        
        $response = $this->makeRequest($url);
        
        if ($response === null) {
            return null;
        }
        
        $players = $response['response']['players'] ?? [];
        
        return !empty($players) ? $players[0] : null;
    }
    
    /**
     * Get player's display name
     * 
     * @param string $steamId The player's Steam ID (64-bit)
     * @return string|null The player's display name or null
     */
    public function getPlayerName(string $steamId): ?string
    {
        $player = $this->getPlayerSummary($steamId);
        return $player['personaname'] ?? null;
    }
    
    /**
     * Make an HTTP request to the Steam API
     * 
     * @param string $url The URL to request
     * @return array<string, mixed>|null Decoded JSON response or null on failure
     */
    private function makeRequest(string $url): ?array
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 10,
                'header' => "Accept: application/json\r\n",
            ],
        ]);
        
        $response = file_get_contents($url, false, $context);
        
        if ($response === false) {
            return null;
        }
        
        $decoded = json_decode($response, true);
        
        if (!is_array($decoded)) {
            return null;
        }
        
        return $decoded;
    }
}
