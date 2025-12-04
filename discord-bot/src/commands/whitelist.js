import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import whitelistManager from '../services/manager.js';
import config from '../config.js';

/**
 * Whitelist management command
 */
export const data = new SlashCommandBuilder()
  .setName('whitelist')
  .setDescription('Manage Apex Framework whitelists')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('add')
      .setDescription('Add a Steam UID to a whitelist')
      .addStringOption((option) =>
        option
          .setName('role')
          .setDescription('The whitelist role to add to')
          .setRequired(true)
          .addChoices(...config.whitelistRoles.map((r) => ({ name: `${r.name} - ${r.description}`, value: r.name })))
      )
      .addStringOption((option) => option.setName('uid').setDescription('Steam64 UID (17 digits)').setRequired(true))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('remove')
      .setDescription('Remove a Steam UID from a whitelist')
      .addStringOption((option) =>
        option
          .setName('role')
          .setDescription('The whitelist role to remove from')
          .setRequired(true)
          .addChoices(...config.whitelistRoles.map((r) => ({ name: `${r.name} - ${r.description}`, value: r.name })))
      )
      .addStringOption((option) => option.setName('uid').setDescription('Steam64 UID (17 digits)').setRequired(true))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('list')
      .setDescription('List all UIDs in a whitelist')
      .addStringOption((option) =>
        option
          .setName('role')
          .setDescription('The whitelist role to list')
          .setRequired(true)
          .addChoices(...config.whitelistRoles.map((r) => ({ name: `${r.name} - ${r.description}`, value: r.name })))
      )
  )
  .addSubcommand((subcommand) => subcommand.setName('roles').setDescription('List all available whitelist roles'))
  .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Check server and whitelist status'))
  .addSubcommand((subcommand) => subcommand.setName('backup').setDescription('Create a backup of the whitelist file (Pterodactyl only)'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

/**
 * Check if user has permission to use whitelist commands
 * @param {import('discord.js').Interaction} interaction
 * @returns {boolean}
 */
function hasPermission(interaction) {
  // If no admin role is configured, allow based on Discord permissions (ManageGuild)
  if (!config.discord.adminRoleId) {
    return true;
  }

  // Check if user has the configured admin role
  return interaction.member?.roles?.cache?.has(config.discord.adminRoleId);
}

/**
 * Execute the whitelist command
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  // Check permissions
  if (!hasPermission(interaction)) {
    return interaction.reply({
      content: '❌ You do not have permission to use this command.',
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'add':
        await handleAdd(interaction);
        break;
      case 'remove':
        await handleRemove(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'roles':
        await handleRoles(interaction);
        break;
      case 'status':
        await handleStatus(interaction);
        break;
      case 'backup':
        await handleBackup(interaction);
        break;
    }
  } catch (error) {
    console.error('Error executing whitelist command:', error);
    const errorMessage = error.message || 'An unknown error occurred';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: `❌ Error: ${errorMessage}`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `❌ Error: ${errorMessage}`,
        ephemeral: true,
      });
    }
  }
}

/**
 * Handle the add subcommand
 */
async function handleAdd(interaction) {
  await interaction.deferReply();

  const role = interaction.options.getString('role');
  const uid = interaction.options.getString('uid');

  const result = await whitelistManager.addUid(role, uid);

  const embed = new EmbedBuilder()
    .setTitle(result.success ? '✅ UID Added' : '❌ Failed to Add UID')
    .setDescription(result.message)
    .setColor(result.success ? 0x00ff00 : 0xff0000)
    .addFields({ name: 'Role', value: role, inline: true }, { name: 'UID', value: uid, inline: true })
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.tag}` });

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle the remove subcommand
 */
async function handleRemove(interaction) {
  await interaction.deferReply();

  const role = interaction.options.getString('role');
  const uid = interaction.options.getString('uid');

  const result = await whitelistManager.removeUid(role, uid);

  const embed = new EmbedBuilder()
    .setTitle(result.success ? '✅ UID Removed' : '❌ Failed to Remove UID')
    .setDescription(result.message)
    .setColor(result.success ? 0x00ff00 : 0xff0000)
    .addFields({ name: 'Role', value: role, inline: true }, { name: 'UID', value: uid, inline: true })
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.tag}` });

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle the list subcommand
 */
async function handleList(interaction) {
  await interaction.deferReply();

  const role = interaction.options.getString('role');
  const uids = await whitelistManager.getUids(role);

  const roleInfo = config.whitelistRoles.find((r) => r.name === role);

  // Discord embed field values have a 1024 character limit
  // Handle pagination for large lists
  let uidDisplay;
  if (uids.length === 0) {
    uidDisplay = '*No UIDs in this whitelist*';
  } else {
    const formattedUids = uids.map((uid) => `\`${uid}\``);
    const joined = formattedUids.join('\n');
    if (joined.length > 1000) {
      // Truncate and show how many more
      const maxUids = Math.floor(1000 / 20); // ~20 chars per UID line
      uidDisplay = formattedUids.slice(0, maxUids).join('\n') + `\n... and ${uids.length - maxUids} more`;
    } else {
      uidDisplay = joined;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`📋 ${role} Whitelist`)
    .setDescription(roleInfo?.description || 'No description available')
    .setColor(0x0099ff)
    .addFields({
      name: `UIDs (${uids.length})`,
      value: uidDisplay,
    })
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.tag}` });

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle the roles subcommand
 */
async function handleRoles(interaction) {
  const roles = whitelistManager.getRoles();

  const embed = new EmbedBuilder()
    .setTitle('📋 Available Whitelist Roles')
    .setDescription('Use these role names with the `/whitelist add`, `/whitelist remove`, and `/whitelist list` commands.')
    .setColor(0x0099ff)
    .addFields(
      roles.map((role) => ({
        name: role.name,
        value: role.description,
        inline: true,
      }))
    )
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.tag}` });

  await interaction.reply({ embeds: [embed] });
}

/**
 * Handle the status subcommand
 */
async function handleStatus(interaction) {
  await interaction.deferReply();

  const isPterodactyl = whitelistManager.isPterodactylEnabled();
  let serverStatus = 'N/A';

  if (isPterodactyl) {
    try {
      serverStatus = (await whitelistManager.getServerStatus()) || 'Unknown';
    } catch {
      serverStatus = 'Error fetching status';
    }
  }

  // Get whitelist counts
  const whitelists = await whitelistManager.getAllWhitelists();
  const whitelistStats = Array.from(whitelists.entries())
    .map(([role, uids]) => `**${role}**: ${uids.length} UIDs`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📊 Whitelist Status')
    .setColor(0x0099ff)
    .addFields(
      { name: 'Mode', value: isPterodactyl ? 'Pterodactyl Panel' : 'Local File', inline: true },
      { name: 'Server Status', value: serverStatus, inline: true },
      { name: 'Whitelist Statistics', value: whitelistStats || 'No data available' }
    )
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.tag}` });

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle the backup subcommand
 */
async function handleBackup(interaction) {
  if (!whitelistManager.isPterodactylEnabled()) {
    return interaction.reply({
      content: '❌ Backup is only available when using Pterodactyl Panel integration.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const backupPath = await whitelistManager.createBackup();

  const embed = new EmbedBuilder()
    .setTitle('✅ Backup Created')
    .setDescription(`Whitelist backup saved to:\n\`${backupPath}\``)
    .setColor(0x00ff00)
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.tag}` });

  await interaction.editReply({ embeds: [embed] });
}
