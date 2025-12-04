import config from '../config.js';
import { WhitelistService } from './whitelist.js';
import pterodactylService from './pterodactyl.js';
import { writeFile, readFile, rm } from 'fs/promises';
import { mkdtempSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Manager that handles whitelist operations across local files and Pterodactyl Panel
 */
export class WhitelistManager {
  constructor() {
    this.usePterodactyl = pterodactylService.isEnabled();
    this.tempDir = null;
  }

  /**
   * Clean up temporary directory
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (this.tempDir && existsSync(this.tempDir)) {
      await rm(this.tempDir, { recursive: true, force: true });
      this.tempDir = null;
    }
  }

  /**
   * Get a whitelist service instance
   * If Pterodactyl is enabled, downloads the file to a temp location first
   * @returns {Promise<WhitelistService>}
   */
  async getWhitelistService() {
    if (this.usePterodactyl) {
      // Download file from Pterodactyl to temp location
      const content = await pterodactylService.getWhitelistFile();
      if (!this.tempDir) {
        this.tempDir = mkdtempSync(join(tmpdir(), 'apex-whitelist-'));
      }
      const tempPath = join(this.tempDir, 'whitelist.sqf');
      await writeFile(tempPath, content, 'utf-8');
      return new WhitelistService(tempPath);
    }

    return new WhitelistService();
  }

  /**
   * Sync changes back to Pterodactyl if enabled
   * @param {string} localPath - Path to the local file
   * @returns {Promise<void>}
   */
  async syncToPterodactyl(localPath) {
    if (this.usePterodactyl) {
      const content = await readFile(localPath, 'utf-8');
      await pterodactylService.writeWhitelistFile(content);
    }
  }

  /**
   * Add a UID to a whitelist role
   * @param {string} role - Role name
   * @param {string} uid - Steam UID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async addUid(role, uid) {
    const service = await this.getWhitelistService();
    const result = await service.addUid(role, uid);

    if (result.success && this.usePterodactyl) {
      await this.syncToPterodactyl(service.filePath);
      result.message += ' (synced to Pterodactyl server)';
    }

    return result;
  }

  /**
   * Remove a UID from a whitelist role
   * @param {string} role - Role name
   * @param {string} uid - Steam UID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async removeUid(role, uid) {
    const service = await this.getWhitelistService();
    const result = await service.removeUid(role, uid);

    if (result.success && this.usePterodactyl) {
      await this.syncToPterodactyl(service.filePath);
      result.message += ' (synced to Pterodactyl server)';
    }

    return result;
  }

  /**
   * Get all UIDs for a role
   * @param {string} role - Role name
   * @returns {Promise<string[]>}
   */
  async getUids(role) {
    const service = await this.getWhitelistService();
    return service.getUids(role);
  }

  /**
   * Get all whitelists
   * @returns {Promise<Map<string, string[]>>}
   */
  async getAllWhitelists() {
    const service = await this.getWhitelistService();
    return service.getAllWhitelists();
  }

  /**
   * Get available roles with descriptions
   * @returns {Array<{name: string, description: string}>}
   */
  getRoles() {
    return config.whitelistRoles;
  }

  /**
   * Check if using Pterodactyl
   * @returns {boolean}
   */
  isPterodactylEnabled() {
    return this.usePterodactyl;
  }

  /**
   * Create a backup of the whitelist (Pterodactyl only)
   * @returns {Promise<string|null>}
   */
  async createBackup() {
    if (this.usePterodactyl) {
      return pterodactylService.backupWhitelist();
    }
    return null;
  }

  /**
   * Get server status (Pterodactyl only)
   * @returns {Promise<string|null>}
   */
  async getServerStatus() {
    if (this.usePterodactyl) {
      return pterodactylService.getPowerState();
    }
    return null;
  }

  /**
   * Restart the server (Pterodactyl only)
   * @returns {Promise<void>}
   */
  async restartServer() {
    if (this.usePterodactyl) {
      await pterodactylService.restartServer();
    }
  }
}

export default new WhitelistManager();
