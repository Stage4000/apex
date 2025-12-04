<?php
/**
 * Steam OpenID Authentication Class
 * 
 * Handles Steam OpenID 2.0 authentication flow.
 * Steam uses OpenID 2.0 for authentication, not OAuth - but the process
 * is commonly referred to as "Steam OAuth" in the gaming community.
 * 
 * @see https://steamcommunity.com/dev
 */

declare(strict_types=1);

namespace ApexFramework\SteamOAuth;

class SteamAuth
{
    private const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';
    private const STEAM_ID_LENGTH = 17;
    
    private string $returnUrl;
    
    /**
     * Initialize Steam authentication with return URL
     * 
     * @param string $returnUrl The URL Steam should redirect back to after authentication
     */
    public function __construct(string $returnUrl)
    {
        $this->returnUrl = $returnUrl;
    }
    
    /**
     * Generate the Steam OpenID login URL
     * 
     * @return string The URL to redirect the user to for Steam login
     */
    public function getLoginUrl(): string
    {
        $params = [
            'openid.ns' => 'http://specs.openid.net/auth/2.0',
            'openid.mode' => 'checkid_setup',
            'openid.return_to' => $this->returnUrl,
            'openid.realm' => $this->getRealm(),
            'openid.identity' => 'http://specs.openid.net/auth/2.0/identifier_select',
            'openid.claimed_id' => 'http://specs.openid.net/auth/2.0/identifier_select',
        ];
        
        return self::STEAM_OPENID_URL . '?' . http_build_query($params);
    }
    
    /**
     * Validate the Steam OpenID response and extract the Steam ID
     * 
     * @param array<string, string> $params The $_GET parameters from the callback
     * @return string|null The Steam ID (64-bit) if valid, null otherwise
     */
    public function validate(array $params): ?string
    {
        // Check if this is a valid OpenID response
        if (!isset($params['openid_mode']) || $params['openid_mode'] !== 'id_res') {
            return null;
        }
        
        // Verify required parameters exist
        $requiredParams = [
            'openid_assoc_handle',
            'openid_signed',
            'openid_sig',
            'openid_claimed_id',
        ];
        
        foreach ($requiredParams as $param) {
            if (!isset($params[$param])) {
                return null;
            }
        }
        
        // Build verification request
        $verifyParams = [];
        foreach ($params as $key => $value) {
            if (strpos($key, 'openid_') === 0) {
                $verifyParams[str_replace('openid_', 'openid.', $key)] = $value;
            }
        }
        $verifyParams['openid.mode'] = 'check_authentication';
        
        // Verify with Steam
        if (!$this->verifyWithSteam($verifyParams)) {
            return null;
        }
        
        // Extract Steam ID from claimed_id
        // Format: https://steamcommunity.com/openid/id/76561198000000000
        $claimedId = $params['openid_claimed_id'];
        $pattern = '/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{' . self::STEAM_ID_LENGTH . '})$/';
        if (preg_match($pattern, $claimedId, $matches)) {
            return $matches[1];
        }
        
        return null;
    }
    
    /**
     * Verify the authentication response with Steam's servers
     * 
     * @param array<string, string> $params The parameters to verify
     * @return bool True if Steam confirms the authentication is valid
     */
    private function verifyWithSteam(array $params): bool
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content' => http_build_query($params),
                'timeout' => 30,
            ],
        ]);
        
        $result = file_get_contents(self::STEAM_OPENID_URL, false, $context);
        
        if ($result === false) {
            return false;
        }
        
        return strpos($result, 'is_valid:true') !== false;
    }
    
    /**
     * Get the realm (base URL) for OpenID
     * 
     * @return string The realm URL
     */
    private function getRealm(): string
    {
        $parsedUrl = parse_url($this->returnUrl);
        return ($parsedUrl['scheme'] ?? 'https') . '://' . ($parsedUrl['host'] ?? 'localhost');
    }
}
