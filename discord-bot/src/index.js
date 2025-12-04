import { Client, GatewayIntentBits, REST, Routes, Events } from 'discord.js';
import config from './config.js';
import { commands, commandsMap } from './commands/index.js';

// Validate required configuration
if (!config.discord.token) {
  console.error('❌ Error: DISCORD_TOKEN environment variable is required');
  process.exit(1);
}

if (!config.discord.clientId) {
  console.error('❌ Error: DISCORD_CLIENT_ID environment variable is required');
  process.exit(1);
}

// Create Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

/**
 * Register slash commands with Discord
 */
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  try {
    console.log('🔄 Registering slash commands...');

    const commandData = commands.map((cmd) => cmd.data.toJSON());

    if (config.discord.guildId) {
      // Register commands to a specific guild (faster for development)
      await rest.put(Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId), {
        body: commandData,
      });
      console.log(`✅ Registered ${commandData.length} commands to guild ${config.discord.guildId}`);
    } else {
      // Register commands globally (takes up to an hour to propagate)
      await rest.put(Routes.applicationCommands(config.discord.clientId), {
        body: commandData,
      });
      console.log(`✅ Registered ${commandData.length} commands globally`);
    }
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
    throw error;
  }
}

// Handle client ready event
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);

  // Register commands when the bot is ready
  await registerCommands();

  // Log configuration status
  console.log('📋 Configuration:');
  console.log(`   - Mode: ${config.pterodactyl.enabled ? 'Pterodactyl Panel' : 'Local File'}`);
  console.log(`   - Whitelist path: ${config.whitelistPath}`);
  if (config.pterodactyl.enabled) {
    console.log(`   - Pterodactyl URL: ${config.pterodactyl.panelUrl}`);
    console.log(`   - Server ID: ${config.pterodactyl.serverId}`);
  }
  if (config.discord.adminRoleId) {
    console.log(`   - Admin Role ID: ${config.discord.adminRoleId}`);
  }

  console.log('🚀 Bot is ready!');
});

// Handle interaction events
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commandsMap.get(interaction.commandName);

  if (!command) {
    console.error(`Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);

    const errorMessage = '❌ There was an error executing this command.';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

// Handle errors
client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Login to Discord
console.log('🔌 Connecting to Discord...');
client.login(config.discord.token);
