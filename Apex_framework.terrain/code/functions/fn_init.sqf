if (!isDedicated) exitWith {};
compileScript ['@Apex_cfg\please_enable_filePatching.sqf',TRUE];
missionNamespace setVariable ['QS_fnc_whitelist',(compileScript ['@Apex_cfg\whitelist.sqf',TRUE]),TRUE];
missionNamespace setVariable ['QS_fnc_whitelistFile',(compileScript ['@Apex_cfg\whitelist.sqf',TRUE]),FALSE]; // Keep reference to file-based whitelist for DB fallback
call (compileScript ['@Apex_cfg\parameters.sqf']);
0 spawn (missionNamespace getVariable 'QS_fnc_config');