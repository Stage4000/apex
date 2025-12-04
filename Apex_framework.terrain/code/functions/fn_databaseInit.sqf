/*/
File: fn_databaseInit.sqf
Author:

	Apex Framework Team
	
Last modified:

	2024 - SQL Database Initialization
	
Description:

	Initialize ExtDB3 database connection for Apex Framework.
	This should be called during server startup before any DB operations.
	
Requirements:

	- ExtDB3 addon loaded on server
	- extdb3-conf.ini configured properly
	- MySQL/MariaDB database with whitelist schema
	
Usage:

	Called automatically from fn_config.sqf when database is enabled
__________________________________________________________________________/*/

if (!isServer) exitWith {false};

diag_log '[Database] Initializing ExtDB3 connection...';

private _return = false;
private _dbName = missionNamespace getVariable ['QS_extdb_database', 'apex_framework'];
private _protocol = missionNamespace getVariable ['QS_extdb_protocol', 'apex_whitelist'];

// Check if ExtDB3 extension is loaded
private _extLoaded = 'extDB3' callExtension 'VERSION';

if (_extLoaded isEqualTo '') then {
	diag_log '[Database] ERROR: ExtDB3 extension not loaded!';
	diag_log '[Database] Make sure extDB3.dll is in your Arma 3 directory';
	diag_log '[Database] Falling back to file-based whitelist system';
	missionNamespace setVariable ['QS_server_isUsingDB', false, false];
} else {
	diag_log format ['[Database] ExtDB3 version: %1', _extLoaded];
	
	// Connect to database
	private _connResult = 'extDB3' callExtension format ['9:ADD_DATABASE:%1', _dbName];
	
	if (_connResult isEqualTo '[1]') then {
		diag_log format ['[Database] Successfully connected to database: %1', _dbName];
		
		// Add protocol for SQL queries
		private _protoResult = 'extDB3' callExtension format ['9:ADD_DATABASE_PROTOCOL:%1:SQL:%2', _dbName, _protocol];
		
		if (_protoResult isEqualTo '[1]') then {
			diag_log format ['[Database] Protocol %1 added successfully', _protocol];
			
			// Lock the database connection
			private _lockResult = 'extDB3' callExtension '9:LOCK';
			
			if (_lockResult isEqualTo '[1]') then {
				diag_log '[Database] Connection locked and ready';
				missionNamespace setVariable ['QS_server_isUsingDB', true, false];
				missionNamespace setVariable ['QS_extdb_protocol', _protocol, false];
				_return = true;
				
				// Test the connection by querying whitelist types
				private _testQuery = 'extDB3' callExtension format ['0:%1:SELECT COUNT(*) FROM whitelist_types', _protocol];
				diag_log format ['[Database] Connection test result: %1', _testQuery];
				
			} else {
				diag_log format ['[Database] ERROR: Failed to lock connection: %1', _lockResult];
			};
		} else {
			diag_log format ['[Database] ERROR: Failed to add protocol: %1', _protoResult];
		};
	} else {
		diag_log format ['[Database] ERROR: Failed to connect to database: %1', _connResult];
		diag_log '[Database] Check your extdb3-conf.ini configuration';
		diag_log format ['[Database] Expected database name: %1', _dbName];
	};
};

if (!_return) then {
	diag_log '[Database] Database initialization failed - using file-based whitelist';
	missionNamespace setVariable ['QS_server_isUsingDB', false, false];
};

_return
