import * as whitelist from './whitelist.js';

// Export all commands as an array
export const commands = [whitelist];

// Export commands as a Map for easy lookup
export const commandsMap = new Map(commands.map((cmd) => [cmd.data.name, cmd]));

export default commands;
