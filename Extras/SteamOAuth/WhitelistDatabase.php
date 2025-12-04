<?php
/**
 * Whitelist Database Handler
 * 
 * Manages connections to the Apex Framework whitelist database
 * and provides methods for adding players to whitelists.
 */

declare(strict_types=1);

namespace ApexFramework\SteamOAuth;

use PDO;
use PDOException;

class WhitelistDatabase
{
    private PDO $pdo;
    
    /**
     * Initialize database connection
     * 
     * @param array<string, mixed> $config Database configuration array
     * @throws PDOException If connection fails
     */
    public function __construct(array $config)
    {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $config['host'],
            $config['port'],
            $config['name'],
            $config['charset']
        );
        
        $this->pdo = new PDO($dsn, $config['user'], $config['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    
    /**
     * Add a player to specified whitelists
     * 
     * @param string $steamId The player's Steam ID (64-bit)
     * @param string|null $playerName Optional player name
     * @param array<int, string> $whitelistTypes Array of whitelist types to add
     * @param string $addedBy Who is adding this entry
     * @param string|null $notes Optional notes about the entry
     * @return array<string, array<string, bool|string>> Results for each whitelist type
     */
    public function addToWhitelists(
        string $steamId,
        ?string $playerName,
        array $whitelistTypes,
        string $addedBy,
        ?string $notes = null
    ): array {
        $results = [];
        
        foreach ($whitelistTypes as $type) {
            $results[$type] = $this->addToWhitelist($steamId, $playerName, $type, $addedBy, $notes);
        }
        
        return $results;
    }
    
    /**
     * Add a player to a single whitelist
     * 
     * @param string $steamId The player's Steam ID (64-bit)
     * @param string|null $playerName Optional player name
     * @param string $whitelistType The whitelist type (e.g., 'S3', 'CAS')
     * @param string $addedBy Who is adding this entry
     * @param string|null $notes Optional notes about the entry
     * @return array<string, bool|string> Result with 'success' boolean and optional 'message'
     */
    public function addToWhitelist(
        string $steamId,
        ?string $playerName,
        string $whitelistType,
        string $addedBy,
        ?string $notes = null
    ): array {
        // Validate whitelist type exists
        if (!$this->isValidWhitelistType($whitelistType)) {
            return [
                'success' => false,
                'message' => "Invalid whitelist type: {$whitelistType}",
            ];
        }
        
        try {
            // Check if already whitelisted
            if ($this->isWhitelisted($steamId, $whitelistType)) {
                return [
                    'success' => true,
                    'message' => 'Already whitelisted',
                    'already_existed' => true,
                ];
            }
            
            // Insert new whitelist entry
            $sql = "INSERT INTO player_whitelist 
                    (steam_uid, player_name, whitelist_type, added_by, notes, is_active) 
                    VALUES (:steam_uid, :player_name, :whitelist_type, :added_by, :notes, 1)
                    ON DUPLICATE KEY UPDATE 
                        player_name = COALESCE(:player_name2, player_name),
                        is_active = 1,
                        notes = COALESCE(:notes2, notes)";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':steam_uid' => $steamId,
                ':player_name' => $playerName,
                ':whitelist_type' => $whitelistType,
                ':added_by' => $addedBy,
                ':notes' => $notes,
                ':player_name2' => $playerName,
                ':notes2' => $notes,
            ]);
            
            // Log to audit table
            $this->logAudit($steamId, $whitelistType, 'ADD', $addedBy, $playerName, $notes);
            
            return [
                'success' => true,
                'message' => 'Successfully added to whitelist',
            ];
        } catch (PDOException $e) {
            return [
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage(),
            ];
        }
    }
    
    /**
     * Check if a player is already whitelisted for a specific type
     * 
     * @param string $steamId The player's Steam ID
     * @param string $whitelistType The whitelist type to check
     * @return bool True if whitelisted and active
     */
    public function isWhitelisted(string $steamId, string $whitelistType): bool
    {
        $sql = "SELECT COUNT(*) FROM player_whitelist 
                WHERE steam_uid = :steam_uid 
                AND whitelist_type = :whitelist_type 
                AND is_active = 1";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':steam_uid' => $steamId,
            ':whitelist_type' => $whitelistType,
        ]);
        
        return (int) $stmt->fetchColumn() > 0;
    }
    
    /**
     * Check if a whitelist type is valid
     * 
     * @param string $type The whitelist type to validate
     * @return bool True if valid
     */
    public function isValidWhitelistType(string $type): bool
    {
        $sql = "SELECT COUNT(*) FROM whitelist_types WHERE type_code = :type_code";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':type_code' => $type]);
        
        return (int) $stmt->fetchColumn() > 0;
    }
    
    /**
     * Get all valid whitelist types
     * 
     * @return array<int, array<string, string>> Array of whitelist types with code and description
     */
    public function getWhitelistTypes(): array
    {
        $sql = "SELECT type_code, description FROM whitelist_types ORDER BY type_code";
        $stmt = $this->pdo->query($sql);
        
        $result = $stmt->fetchAll();
        return $result !== false ? $result : [];
    }
    
    /**
     * Get all whitelists for a player
     * 
     * @param string $steamId The player's Steam ID
     * @return array<int, array<string, mixed>> Array of whitelist entries
     */
    public function getPlayerWhitelists(string $steamId): array
    {
        $sql = "SELECT pw.*, wt.description 
                FROM player_whitelist pw 
                JOIN whitelist_types wt ON pw.whitelist_type = wt.type_code 
                WHERE pw.steam_uid = :steam_uid AND pw.is_active = 1";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':steam_uid' => $steamId]);
        
        $result = $stmt->fetchAll();
        return $result !== false ? $result : [];
    }
    
    /**
     * Log an action to the audit table
     * 
     * @param string $steamId The player's Steam ID
     * @param string $whitelistType The whitelist type
     * @param string $action The action (ADD, REMOVE, MODIFY)
     * @param string $performedBy Who performed the action
     * @param string|null $playerName The player's name
     * @param string|null $notes Additional notes
     */
    private function logAudit(
        string $steamId,
        string $whitelistType,
        string $action,
        string $performedBy,
        ?string $playerName = null,
        ?string $notes = null
    ): void {
        try {
            $sql = "INSERT INTO whitelist_audit_log 
                    (steam_uid, whitelist_type, action, performed_by, new_values) 
                    VALUES (:steam_uid, :whitelist_type, :action, :performed_by, :new_values)";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':steam_uid' => $steamId,
                ':whitelist_type' => $whitelistType,
                ':action' => $action,
                ':performed_by' => $performedBy,
                ':new_values' => json_encode([
                    'player_name' => $playerName,
                    'notes' => $notes,
                ]),
            ]);
        } catch (PDOException $e) {
            // Audit logging failure should not break the main operation
            error_log('Audit logging failed: ' . $e->getMessage());
        }
    }
}
