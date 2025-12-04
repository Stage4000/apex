/*/
File: fn_whitelistDB.sqf
Author:

	Apex Framework Team
	
Last modified:

	2024 - SQL Whitelist Implementation
	
Description:

	SQL Database-based Whitelist System using ExtDB3
	This function handles loading and caching whitelists from SQL database.
	
Requirements:

	- ExtDB3 addon installed and configured
	- MySQL/MariaDB database with whitelist tables
	- See SQL-Setup-Guide.md for full setup instructions

Usage:
	
	// Get whitelisted UIDs for a type
	_uids = ['S3'] call QS_fnc_whitelistDB;
	
	// Check if UID is in whitelist
	if (_playerUID in (['CAS'] call QS_fnc_whitelistDB)) then { ... };
	
	// Force refresh of cached whitelist
	['S3', true] call QS_fnc_whitelistDB;

Whitelist Types:
	
	'S3' 		- Whitelisted roles, skins access
	'CAS' 		- Fixed-wing Jets access
	'S1' 		- Commander role access
	'OPFOR' 	- OPFOR slots access
	'ALL' 		- All staff UIDs
	'ADMIN' 	- Admin tools access
	'MODERATOR' - Moderator access
	'TRUSTED' 	- Trusted non-staff players
	'MEDIA' 	- Splendid Camera access
	'CURATOR' 	- Zeus access
	'DEVELOPER' - Debug Console and all tools
__________________________________________________________________________/*/

params [
	['_type', '', ['']],
	['_forceRefresh', false, [false]]
];

// Validate whitelist type
private _validTypes = ['S3', 'CAS', 'S1', 'OPFOR', 'ALL', 'ADMIN', 'MODERATOR', 'TRUSTED', 'MEDIA', 'CURATOR', 'DEVELOPER'];
if (!(_type in _validTypes)) exitWith {
	diag_log format ['[WhitelistDB] ERROR: Invalid whitelist type: %1', _type];
	[]
};

// Check if database is enabled
if (!(missionNamespace getVariable ['QS_server_isUsingDB', false])) exitWith {
	// Fall back to file-based whitelist if DB is not enabled
	[_type] call (missionNamespace getVariable 'QS_fnc_whitelistFile')
};

// Cache variable name for this whitelist type
private _cacheVar = format ['QS_whitelist_cache_%1', _type];
private _cacheTimeVar = format ['QS_whitelist_cacheTime_%1', _type];

// Cache duration in seconds (5 minutes default)
private _cacheDuration = missionNamespace getVariable ['QS_whitelist_cacheDuration', 300];

// Check if we have a valid cached result
private _cachedResult = missionNamespace getVariable [_cacheVar, []];
private _cacheTime = missionNamespace getVariable [_cacheTimeVar, 0];
private _currentTime = diag_tickTime;

// Return cached result if valid and not forcing refresh
if (!_forceRefresh && {(count _cachedResult) > 0} && {(_currentTime - _cacheTime) < _cacheDuration}) exitWith {
	_cachedResult
};

// Query database for whitelist
private _return = [];
private _dbProtocol = missionNamespace getVariable ['QS_extdb_protocol', 'apex_whitelist'];

// Build SQL query
private _query = format [
	"SELECT steam_uid FROM player_whitelist WHERE whitelist_type = '%1' AND is_active = 1",
	_type
];

// Execute query via ExtDB3
private _queryResult = '';
try {
	// Async query approach
	private _queryID = format ['whitelist_%1_%2', _type, round(random 999999)];
	
	// Send query
	_queryResult = 'extDB3' callExtension format ['1:%1:SQL:%2', _dbProtocol, _query];
	
	if (_queryResult isEqualTo '[1]' || _queryResult isEqualTo '["1"]') then {
		// Wait for async result
		private _timeout = diag_tickTime + 5;
		private _result = '';
		
		waitUntil {
			_result = 'extDB3' callExtension format ['5:%1', _dbProtocol];
			((_result isNotEqualTo '') && (_result isNotEqualTo '["1"]')) || (diag_tickTime > _timeout)
		};
		
		if (_result isNotEqualTo '' && _result isNotEqualTo '["1"]') then {
			// Parse result - ExtDB3 returns results in format [[row1], [row2], ...]
			private _parsed = parseSimpleArray _result;
			if (count _parsed > 0) then {
				{
					if ((_x isEqualType []) && {count _x > 0}) then {
						_return pushBackUnique (_x select 0);
					};
					if (_x isEqualType '') then {
						_return pushBackUnique _x;
					};
				} forEach _parsed;
			};
		};
	} else {
		// Sync query result - parse directly
		if (_queryResult isNotEqualTo '' && _queryResult isNotEqualTo '[0]') then {
			private _parsed = parseSimpleArray _queryResult;
			if (count _parsed > 1) then {
				// First element is usually status, rest is data
				private _data = _parsed select 1;
				if (_data isEqualType []) then {
					{
						if ((_x isEqualType []) && {count _x > 0}) then {
							_return pushBackUnique (_x select 0);
						};
						if (_x isEqualType '') then {
							_return pushBackUnique _x;
						};
					} forEach _data;
				};
			};
		};
	};
} catch {
	diag_log format ['[WhitelistDB] ERROR: Database query failed for type %1: %2', _type, _exception];
	// Fall back to file-based whitelist on error
	_return = [_type] call (missionNamespace getVariable 'QS_fnc_whitelistFile');
};

// If no results from DB, fall back to file-based whitelist
if (count _return == 0) then {
	diag_log format ['[WhitelistDB] No results from DB for type %1, using file fallback', _type];
	_return = [_type] call (missionNamespace getVariable 'QS_fnc_whitelistFile');
};

// Update cache
missionNamespace setVariable [_cacheVar, _return, false];
missionNamespace setVariable [_cacheTimeVar, _currentTime, false];

// Log the result count
diag_log format ['[WhitelistDB] Loaded %1 UIDs for whitelist type: %2', count _return, _type];

_return
