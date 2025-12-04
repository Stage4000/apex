import { config } from 'dotenv';
config();

/**
 * Application configuration
 * Loaded from environment variables
 */
export default {
  // Discord configuration
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID || null,
    adminRoleId: process.env.DISCORD_ADMIN_ROLE_ID || null,
  },

  // Local whitelist file path
  whitelistPath: process.env.WHITELIST_FILE_PATH || '../@Apex_cfg/whitelist.sqf',

  // Pterodactyl Panel configuration
  pterodactyl: {
    enabled: !!(process.env.PTERODACTYL_PANEL_URL && process.env.PTERODACTYL_API_KEY),
    panelUrl: process.env.PTERODACTYL_PANEL_URL,
    apiKey: process.env.PTERODACTYL_API_KEY,
    serverId: process.env.PTERODACTYL_SERVER_ID,
    whitelistPath: process.env.PTERODACTYL_WHITELIST_PATH || '@Apex_cfg/whitelist.sqf',
  },

  // Valid whitelist roles from whitelist.sqf
  whitelistRoles: [
    { name: 'S3', description: 'Whitelisted Roles + Skins Access' },
    { name: 'CAS', description: 'Fixed-wing Jets Access' },
    { name: 'S1', description: 'Commander Role Access' },
    { name: 'OPFOR', description: 'OPFOR Slots Access' },
    { name: 'ALL', description: 'All Staff UIDs (required for all staff)' },
    { name: 'ADMIN', description: 'Admin Tools Access' },
    { name: 'MODERATOR', description: 'Moderator Access' },
    { name: 'TRUSTED', description: 'Trusted Non-Staff Access' },
    { name: 'MEDIA', description: 'Media/Camera Access' },
    { name: 'CURATOR', description: 'Zeus/Mission Curation Access' },
    { name: 'DEVELOPER', description: 'Developer/Debug Console Access' },
  ],
};
