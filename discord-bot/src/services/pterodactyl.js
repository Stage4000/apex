import config from '../config.js';

/**
 * Service for interacting with Pterodactyl Panel API
 * Allows reading and writing the whitelist.sqf file on remote servers
 */
export class PterodactylService {
  constructor() {
    this.panelUrl = config.pterodactyl.panelUrl?.replace(/\/$/, '');
    this.apiKey = config.pterodactyl.apiKey;
    this.serverId = config.pterodactyl.serverId;
    this.whitelistPath = config.pterodactyl.whitelistPath;
  }

  /**
   * Check if Pterodactyl integration is enabled and configured
   * @returns {boolean}
   */
  isEnabled() {
    return !!(this.panelUrl && this.apiKey && this.serverId);
  }

  /**
   * Make an authenticated request to the Pterodactyl API
   * @param {string} endpoint - API endpoint
   * @param {object} options - Fetch options
   * @returns {Promise<Response>}
   */
  async request(endpoint, options = {}) {
    const url = `${this.panelUrl}/api/client/servers/${this.serverId}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pterodactyl API error (${response.status}): ${error}`);
    }

    return response;
  }

  /**
   * Get the contents of the whitelist.sqf file from the server
   * @returns {Promise<string>} File content
   */
  async getWhitelistFile() {
    if (!this.isEnabled()) {
      throw new Error('Pterodactyl integration is not configured');
    }

    const response = await this.request(`/files/contents?file=${encodeURIComponent(this.whitelistPath)}`);
    return response.text();
  }

  /**
   * Write content to the whitelist.sqf file on the server
   * @param {string} content - New file content
   * @returns {Promise<void>}
   */
  async writeWhitelistFile(content) {
    if (!this.isEnabled()) {
      throw new Error('Pterodactyl integration is not configured');
    }

    await this.request(`/files/write?file=${encodeURIComponent(this.whitelistPath)}`, {
      method: 'POST',
      body: content,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  /**
   * Send a command to the server console
   * @param {string} command - Command to send
   * @returns {Promise<void>}
   */
  async sendCommand(command) {
    if (!this.isEnabled()) {
      throw new Error('Pterodactyl integration is not configured');
    }

    await this.request('/command', {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
  }

  /**
   * Get server power state
   * @returns {Promise<string>} Power state (starting, running, stopping, offline)
   */
  async getPowerState() {
    if (!this.isEnabled()) {
      throw new Error('Pterodactyl integration is not configured');
    }

    const response = await this.request('/resources');
    const data = await response.json();
    return data.attributes.current_state;
  }

  /**
   * Send power action to the server
   * @param {string} signal - Power signal (start, stop, restart, kill)
   * @returns {Promise<void>}
   */
  async sendPowerAction(signal) {
    if (!this.isEnabled()) {
      throw new Error('Pterodactyl integration is not configured');
    }

    await this.request('/power', {
      method: 'POST',
      body: JSON.stringify({ signal }),
    });
  }

  /**
   * Restart the server (useful after whitelist changes)
   * @returns {Promise<void>}
   */
  async restartServer() {
    return this.sendPowerAction('restart');
  }

  /**
   * Get server details
   * @returns {Promise<object>} Server details
   */
  async getServerDetails() {
    if (!this.isEnabled()) {
      throw new Error('Pterodactyl integration is not configured');
    }

    const response = await this.request('');
    return response.json();
  }

  /**
   * List files in a directory
   * @param {string} directory - Directory path
   * @returns {Promise<object[]>} List of files
   */
  async listFiles(directory = '/') {
    if (!this.isEnabled()) {
      throw new Error('Pterodactyl integration is not configured');
    }

    const response = await this.request(`/files/list?directory=${encodeURIComponent(directory)}`);
    const data = await response.json();
    return data.data;
  }

  /**
   * Create a backup of the whitelist file
   * @returns {Promise<string>} Backup file path
   */
  async backupWhitelist() {
    if (!this.isEnabled()) {
      throw new Error('Pterodactyl integration is not configured');
    }

    const content = await this.getWhitelistFile();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = this.whitelistPath.replace('.sqf', `_backup_${timestamp}.sqf`);

    await this.request(`/files/write?file=${encodeURIComponent(backupPath)}`, {
      method: 'POST',
      body: content,
      headers: {
        'Content-Type': 'text/plain',
      },
    });

    return backupPath;
  }
}

export default new PterodactylService();
