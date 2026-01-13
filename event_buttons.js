const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionsBitField,
    EmbedBuilder
} = require('discord.js');

const Config = require('./config');
const UM = require('./userManager');

// 🔄 REFRESH BUTTON (Reusable)
const refreshRow = (id) =>
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(id)
            .setLabel('Refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary)
    );

module.exports = (client) => {

    // ====================================================
    // 🚀 STARTUP: POST LEADERBOARDS IF MISSING
    // ====================================================
    client.once('ready', async () => {
        try {
            // 1. MAIN LEADERBOARD
            const main = await client.channels.fetch(Config.CHANNELS.LEADERBOARD_MAIN).catch(() => null);
            if (main) {
                const msgs = await main.messages.fetch({ limit: 5 });
                if (!msgs.find(m => m.author.id === client.user.id)) {
                    await main.send({
                        content: '🏆 **MAIN LEADERBOARD**\n\n*Waiting for data...*\nClick 🔄 to refresh.',
                        components: [refreshRow('refresh_main_leaderboard')]
                    });
                }
            }

            // 2. TOP OFFICERS
            const police = await client.channels.fetch(Config.CHANNELS.TOP_OFFICERS).catch(() => null);
            if (police) {
                const msgs = await police.messages.fetch({ limit: 5 });
                if (!msgs.find(m => m.author.id === client.user.id)) {
                    await police.send({
                        content: '👮 **TOP OFFICERS**\n\n*Waiting for police...*\nClick 🔄 to refresh.',
                        components: [refreshRow('refresh_top_officers')]
                    });
                }
            }

            // 3. TOP ROBBERS
            const loot = await client.channels.fetch(Config.CHANNELS.LOOT_LEADERBOARD).catch(() => null);
            if (loot) {
                const msgs = await loot.messages.fetch({ limit: 5 });
                if (!msgs.find(m => m.author.id === client.user.id)) {
                    await loot.send({
                        content: '🕶️ **TOP ROBBERS**\n\n*Waiting for robbers...*\nClick 🔄 to refresh.',
                        components: [refreshRow('refresh_loot_leaderboard')]
                    });
                }
            }

            // 4. TOP INVESTORS
            const invest = await client.channels.fetch(Config.CHANNELS.TOP_INVESTORS).catch(() => null);
            if (invest) {
                const msgs = await invest.messages.fetch({ limit: 5 });
                if (!msgs.find(m => m.author.id === client.user.id)) {
                    await invest.send({
                        content: '💼 **TOP INVESTORS**\n\n*Waiting for investors...*\nClick 🔄 to refresh.',
                        components: [refreshRow('refresh_top_investors')]
                    });
                }
            }

        } catch (e) {
            console.error('Leaderboard Error:', e);
        }
    });

    // ====================================================
    // 🎛️ BUTTON INTERACTIONS
    // ====================================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        // --- 1. GET ID CARD (Start Ticket) ---
        if (interaction.customId === 'create_ticket') {
            await interaction.deferReply({ ephemeral: true });

            const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9]/g, '');
            const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);
            if (existingChannel) return interaction.editReply(`⚠️ Ticket already open: ${existingChannel}`);

            let ticketChannel;
            try {
                ticketChannel = await interaction.guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: Config.CHANNELS.IMMIGRATION_CATEGORY,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ],
                });
            } catch (error) {
                ticketChannel = await interaction.guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ],
                });
            }

            const embed = new EmbedBuilder().setTitle('#Choose Role..').setDescription("Click to assign role.").setColor(0x0099FF);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('role_police').setLabel('Police').setEmoji('👮').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('role_business').setLabel('Businessman').setEmoji('💼').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('role_citizen').setLabel('Citizen').setEmoji('🏙️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('role_robber').setLabel('Robber').setEmoji('🕶️').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
            return interaction.editReply(`✅ Ticket created: ${ticketChannel}`);
        }

        // --- 2. ROLE SELECTION ---
        const rolesMap = { 'role_police': 'police', 'role_business': 'businessman', 'role_citizen': 'citizen', 'role_robber': 'robber' };
        const discordRoleNames = { 'police': 'Police', 'businessman': 'Businessman', 'citizen': 'Citizen', 'robber': 'Robber' };

        if (rolesMap[interaction.customId]) {
            await interaction.deferUpdate();
            const selectedRoleKey = rolesMap[interaction.customId];

            // Update DB
            const newUser = await UM.createUser(interaction.user.id, interaction.user.username, selectedRoleKey);

            // Update Discord Roles
            const member = interaction.member;
            if (member) {
                Object.values(discordRoleNames).forEach(async name => {
                    const r = interaction.guild.roles.cache.find(role => role.name === name);
                    if (r && member.roles.cache.has(r.id)) await member.roles.remove(r);
                });
                const targetRole = interaction.guild.roles.cache.find(r => r.name === discordRoleNames[selectedRoleKey]);
                if (targetRole) await member.roles.add(targetRole);
            }

            await interaction.channel.send(`✅ **Role Assigned:** ${selectedRoleKey.toUpperCase()}\n🆔 **ID:** ${newUser.special_id}\n\n*Closing...*`);
            setTimeout(() => interaction.channel.delete().catch(() => {}), 4000);
        }

        // --- 3. LEADERBOARDS (REFRESH) ---
        if (interaction.customId.startsWith('refresh_')) {
            await interaction.deferUpdate();
            const users = await UM.getAllUsers();
            const now = Math.floor(Date.now() / 1000);

            // A. MAIN LEADERBOARD
            if (interaction.customId === 'refresh_main_leaderboard') {
                const richest = Object.values(users).sort((a, b) => (b.cash || 0) - (a.cash || 0)).slice(0, 10);
                let content = `🏆 **MAIN LEADERBOARD**\n\n`;
                if (richest.length === 0) content += "No players yet.";
                else richest.forEach((u, i) => content += `${i + 1}. **${u.username}** — ${UM.fmt(u.cash)}\n`);
                
                content += `\n🕒 Updated: <t:${now}:R>`;
                return interaction.message.edit({ content, components: [refreshRow('refresh_main_leaderboard')] });
            }

            // B. TOP OFFICERS
            if (interaction.customId === 'refresh_top_officers') {
                const officers = Object.values(users)
                    .filter(u => u.role === 'police') // Show all police, even with 0 cases
                    .sort((a, b) => (b.cases || 0) - (a.cases || 0))
                    .slice(0, 10);
                
                let content = `👮 **TOP OFFICERS**\n\n`;
                if (officers.length === 0) content += "No officers yet.";
                else officers.forEach((u, i) => content += `${i + 1}. **${u.username}** — ${u.cases || 0} Arrests\n`);

                content += `\n🕒 Updated: <t:${now}:R>`;
                return interaction.message.edit({ content, components: [refreshRow('refresh_top_officers')] });
            }

            // C. TOP ROBBERS
            if (interaction.customId === 'refresh_loot_leaderboard') {
                const robbers = Object.values(users)
                    .filter(u => u.role === 'robber')
                    .sort((a, b) => (b.total_stolen || 0) - (a.total_stolen || 0))
                    .slice(0, 10);

                let content = `🕶️ **TOP ROBBERS**\n\n`;
                if (robbers.length === 0) content += "No robbers yet.";
                else robbers.forEach((u, i) => content += `${i + 1}. **${u.username}** — Stolen: ${UM.fmt(u.total_stolen || 0)}\n`);

                content += `\n🕒 Updated: <t:${now}:R>`;
                return interaction.message.edit({ content, components: [refreshRow('refresh_loot_leaderboard')] });
            }

            // D. TOP INVESTORS
            if (interaction.customId === 'refresh_top_investors') {
                const investors = Object.values(users)
                    .filter(u => u.role === 'businessman')
                    .sort((a, b) => (b.cash || 0) - (a.cash || 0))
                    .slice(0, 10);

                let content = `💼 **TOP INVESTORS**\n\n`;
                if (investors.length === 0) content += "No businessmen yet.";
                else investors.forEach((u, i) => content += `${i + 1}. **${u.username}** — ${UM.fmt(u.cash)}\n`);

                content += `\n🕒 Updated: <t:${now}:R>`;
                return interaction.message.edit({ content, components: [refreshRow('refresh_top_investors')] });
            }
        }

        // --- 4. JAIL TIMER ---
        if (interaction.customId === 'refresh_jail_timer') {
            await interaction.deferUpdate();
            const users = await UM.getAllUsers();
            const prisoners = Object.values(users).filter(u => u.role === 'prisoner').sort((a, b) => a.release_time - b.release_time);

            let content = `🔒 **SECTOR 7 PRISON ROSTER**\n\n`;
            if (prisoners.length === 0) content += `✅ **No active prisoners.**`;
            else prisoners.forEach((p, i) => {
                const min = Math.floor((p.release_time - Date.now()) / 60000);
                const sec = Math.floor(((p.release_time - Date.now()) % 60000) / 1000);
                if (min >= 0) content += `${i + 1}. **${p.username}** — ⏳ ${min}m ${sec}s\n`;
            });
            
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('refresh_jail_timer').setLabel('Refresh Timer').setEmoji('⏱️').setStyle(ButtonStyle.Secondary));
            return interaction.message.edit({ content, components: [row] });
        }
    });
};
