const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionsBitField
} = require('discord.js');

const Config = require('./config');
const UM = require('./userManager');

const refreshRow = (id) =>
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(id)
            .setLabel('Refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary)
    );

module.exports = (client) => {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        const { customId, user, guild } = interaction;

        // 1️⃣ CREATE TICKET
        if (customId === 'create_ticket') {
            await interaction.deferReply({ ephemeral: true });

            const existing = guild.channels.cache.find(
                c =>
                    c.name === `ticket-${user.username.toLowerCase()}` &&
                    c.parentId === Config.CHANNELS.IMMIGRATION_CATEGORY
            );

            if (existing) {
                return interaction.editReply(`❌ Ticket already exists: ${existing}`);
            }

            const ticketChannel = await guild.channels.create({
                name: `ticket-${user.username}`,
                type: ChannelType.GuildText,
                parent: Config.CHANNELS.IMMIGRATION_CATEGORY,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ]
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('role_citizen').setLabel('Citizen').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('role_robber').setLabel('Robber').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('role_police').setLabel('Police').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('role_business').setLabel('Businessman').setStyle(ButtonStyle.Secondary)
            );

            await ticketChannel.send({ content: `<@${user.id}> Choose Role:`, components: [row] });
            return interaction.editReply(`✅ Ticket Created: ${ticketChannel}`);
        }

        // 2️⃣ ROLE SELECTION
        if (customId.startsWith('role_')) {
            let finalRole = customId.replace('role_', '');
            if (finalRole === 'business') finalRole = 'businessman';

            await UM.createUser(user.id, user.username, finalRole);

            const roleMap = {
                citizen: 'Citizen',
                robber: 'Robber',
                police: 'Police',
                businessman: 'Businessman'
            };

            const roleToAdd = guild.roles.cache.find(r => r.name === roleMap[finalRole]);

            if (roleToAdd) {
                const allRoles = ['Citizen', 'Robber', 'Police', 'Businessman', 'Prisoner'];
                for (const name of allRoles) {
                    const r = guild.roles.cache.find(role => role.name === name);
                    if (r && interaction.member.roles.cache.has(r.id)) {
                        await interaction.member.roles.remove(r).catch(() => {});
                    }
                }
                await interaction.member.roles.add(roleToAdd).catch(() => {});
            }

            await interaction.reply(`✅ Registered as **${finalRole.toUpperCase()}**. Ticket closing...`);
            await interaction.channel.delete().catch(() => null);
            return;
        }

        // ===== LEADERBOARD REFRESHES =====
        await interaction.deferUpdate();
        const users = await UM.getAllUsers();

        // 3️⃣ MAIN LEADERBOARD
        if (customId === 'refresh_main_leaderboard') {
            const richest = Object.values(users)
                .sort((a, b) => (b.cash || 0) - (a.cash || 0))
                .slice(0, 5);

            const officers = Object.values(users)
                .filter(u => u.role === 'police')
                .sort((a, b) => (b.cases || 0) - (a.cases || 0))
                .slice(0, 5);

            let content = `🏆 **MAIN LEADERBOARD**\n\n💰 **Richest Players**\n`;
            richest.forEach((u, i) => content += `${i + 1}. ${u.username}\n`);

            content += `\n👮 **Top Officers**\n`;
            officers.forEach((u, i) => content += `${i + 1}. ${u.username} — ${u.cases || 0} cases\n`);

            content += `\n🕒 Last updated: <t:${Math.floor(Date.now() / 1000)}:R>`;

            return interaction.message.edit({ content, components: [refreshRow('refresh_main_leaderboard')] });
        }

        // 4️⃣ TOP OFFICERS
        if (customId === 'refresh_top_officers') {
            const officers = Object.values(users)
                .filter(u => u.role === 'police')
                .sort((a, b) => (b.cases || 0) - (a.cases || 0))
                .slice(0, 10);

            let content = `👮 **TOP OFFICERS**\n\n`;
            officers.forEach((u, i) => content += `${i + 1}. ${u.username} — ${u.cases || 0} cases\n`);
            content += `\n🕒 Last updated: <t:${Math.floor(Date.now() / 1000)}:R>`;

            return interaction.message.edit({ content, components: [refreshRow('refresh_top_officers')] });
        }

        // 5️⃣ LOOT LEADERBOARD
        if (customId === 'refresh_loot_leaderboard') {
            const robbers = Object.values(users)
                .filter(u => u.role === 'robber')
                .sort((a, b) => (b.total_stolen || 0) - (a.total_stolen || 0))
                .slice(0, 10);

            let content = `🕶️ **TOP ROBBERS**\n\n`;
            robbers.forEach((u, i) => content += `${i + 1}. ${u.username}\n`);
            content += `\n🕒 Last updated: <t:${Math.floor(Date.now() / 1000)}:R>`;

            return interaction.message.edit({ content, components: [refreshRow('refresh_loot_leaderboard')] });
        }

        // 6️⃣ TOP INVESTORS
        if (customId === 'refresh_top_investors') {
            const investors = Object.values(users)
                .filter(u => u.role === 'businessman')
                .sort((a, b) => (b.cash || 0) - (a.cash || 0))
                .slice(0, 10);

            let content = `💼 **TOP INVESTORS**\n\n`;
            investors.forEach((u, i) => content += `${i + 1}. ${u.username}\n`);
            content += `\n🕒 Last updated: <t:${Math.floor(Date.now() / 1000)}:R>`;

            return interaction.message.edit({ content, components: [refreshRow('refresh_top_investors')] });
        }
    });
};