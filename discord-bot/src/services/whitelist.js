import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import config from '../config.js';

/**
 * Service for parsing and modifying the whitelist.sqf file
 */
export class WhitelistService {
  constructor(filePath = null) {
    this.filePath = filePath || config.whitelistPath;
  }

  /**
   * Parse the whitelist.sqf file and extract UIDs for each role
   * @returns {Promise<Map<string, string[]>>} Map of role name to array of UIDs
   */
  async parseWhitelist() {
    const content = await this.readFile();
    return this.parseContent(content);
  }

  /**
   * Read the whitelist file
   * @returns {Promise<string>} File content
   */
  async readFile() {
    if (!existsSync(this.filePath)) {
      throw new Error(`Whitelist file not found: ${this.filePath}`);
    }
    return readFile(this.filePath, 'utf-8');
  }

  /**
   * Parse whitelist content and extract UIDs for each role
   * @param {string} content - File content
   * @returns {Map<string, string[]>} Map of role name to array of UIDs
   */
  parseContent(content) {
    const whitelists = new Map();
    const roles = config.whitelistRoles.map((r) => r.name);

    for (const role of roles) {
      // Match the pattern: if (_type isEqualTo 'ROLE') then { ... _return = [ ... ]; }
      const pattern = new RegExp(
        `if\\s*\\(\\s*_type\\s+isEqualTo\\s+['"]${role}['"]\\s*\\)\\s*then\\s*\\{[^}]*_return\\s*=\\s*\\[([^\\]]+)\\]`,
        's'
      );
      const match = content.match(pattern);

      if (match) {
        // Extract UIDs from the matched array
        const uidsString = match[1];
        const uids = uidsString
          .split(',')
          .map((uid) => uid.trim().replace(/['"]/g, ''))
          .filter((uid) => uid && uid !== '' && uid.match(/^\d+$/));
        whitelists.set(role, uids);
      } else {
        whitelists.set(role, []);
      }
    }

    return whitelists;
  }

  /**
   * Add a UID to a specific role's whitelist
   * @param {string} role - Role name (e.g., 'ADMIN', 'DEVELOPER')
   * @param {string} uid - Steam UID to add
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async addUid(role, uid) {
    // Validate role
    const validRoles = config.whitelistRoles.map((r) => r.name);
    if (!validRoles.includes(role.toUpperCase())) {
      return { success: false, message: `Invalid role: ${role}. Valid roles: ${validRoles.join(', ')}` };
    }

    // Validate UID format (Steam64 ID)
    if (!uid.match(/^\d{17}$/)) {
      return { success: false, message: `Invalid Steam UID format: ${uid}. Must be a 17-digit number.` };
    }

    const content = await this.readFile();
    const whitelists = this.parseContent(content);
    const normalizedRole = role.toUpperCase();

    // Check if UID already exists
    if (whitelists.get(normalizedRole)?.includes(uid)) {
      return { success: false, message: `UID ${uid} is already in the ${normalizedRole} whitelist.` };
    }

    // Add UID to the whitelist
    const updatedContent = this.updateWhitelistInContent(content, normalizedRole, [...(whitelists.get(normalizedRole) || []), uid]);

    await writeFile(this.filePath, updatedContent, 'utf-8');
    return { success: true, message: `Successfully added ${uid} to the ${normalizedRole} whitelist.` };
  }

  /**
   * Remove a UID from a specific role's whitelist
   * @param {string} role - Role name
   * @param {string} uid - Steam UID to remove
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async removeUid(role, uid) {
    // Validate role
    const validRoles = config.whitelistRoles.map((r) => r.name);
    if (!validRoles.includes(role.toUpperCase())) {
      return { success: false, message: `Invalid role: ${role}. Valid roles: ${validRoles.join(', ')}` };
    }

    const content = await this.readFile();
    const whitelists = this.parseContent(content);
    const normalizedRole = role.toUpperCase();

    // Check if UID exists
    const currentUids = whitelists.get(normalizedRole) || [];
    if (!currentUids.includes(uid)) {
      return { success: false, message: `UID ${uid} is not in the ${normalizedRole} whitelist.` };
    }

    // Remove UID from the whitelist
    const updatedUids = currentUids.filter((u) => u !== uid);
    const updatedContent = this.updateWhitelistInContent(content, normalizedRole, updatedUids);

    await writeFile(this.filePath, updatedContent, 'utf-8');
    return { success: true, message: `Successfully removed ${uid} from the ${normalizedRole} whitelist.` };
  }

  /**
   * Update the whitelist content with new UIDs for a role
   * @param {string} content - Original file content
   * @param {string} role - Role name
   * @param {string[]} uids - New UIDs array
   * @returns {string} Updated content
   */
  updateWhitelistInContent(content, role, uids) {
    // Format UIDs as SQF array
    const formattedUids = uids.map((uid) => `\t\t'${uid}'`).join(',\n');
    const replacement = formattedUids ? `\n${formattedUids}\n\t` : '\n\t';

    // Create pattern to match the _return array for this role
    const pattern = new RegExp(
      `(if\\s*\\(\\s*_type\\s+isEqualTo\\s+['"]${role}['"]\\s*\\)\\s*then\\s*\\{[^}]*_return\\s*=\\s*\\[)[^\\]]*(\\])`,
      's'
    );

    return content.replace(pattern, `$1${replacement}$2`);
  }

  /**
   * Get all UIDs for a specific role
   * @param {string} role - Role name
   * @returns {Promise<string[]>} Array of UIDs
   */
  async getUids(role) {
    const whitelists = await this.parseWhitelist();
    return whitelists.get(role.toUpperCase()) || [];
  }

  /**
   * Get all whitelists
   * @returns {Promise<Map<string, string[]>>}
   */
  async getAllWhitelists() {
    return this.parseWhitelist();
  }
}

export default new WhitelistService();
