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

// 🔄 Reusable refresh button (Leaderboards)
const refreshRow = (id) =>
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(id)
            .setLabel('Refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary)
    );

module.exports = (client) => {

    // ===============================
    // 🎛️ BUTTON INTERACTION HANDLER
    // ===============================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        // ---------------------------------------------------------
        // 1. GET ID CARD (Start Ticket)
        // ---------------------------------------------------------
        if (interaction.customId === 'create_ticket') {
            await interaction.deferReply({ ephemeral: true });

            // A. Check if user already exists
            const existingUser = await UM.getUser(interaction.user.id);
            if (existingUser) {
                return interaction.editReply("❌ You already have an ID. You cannot change roles.");
            }

            // B. Create Private Ticket Channel
            const channelName = `ticket-${interaction.user.username}`;
            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: Config.CHANNELS.IMMIGRATION_CATEGORY, // Puts it in the category
                permissionOverwrites: [
                    {
                        id: interaction.guild.id, // Everyone
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: interaction.user.id, // The User
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                    },
                    {
                        id: client.user.id, // The Bot
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                    }
                ],
            });

            // C. Send the Role Selection Panel
            const embed = new EmbedBuilder()
                .setTitle('#Choose Role..')
                .setColor(0x0099FF);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('role_police').setLabel('Police').setEmoji('👮').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('role_business').setLabel('Businessman').setEmoji('💼').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('role_citizen').setLabel('Citizen').setEmoji('🏙️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('role_robber').setLabel('Robber').setEmoji('🕶️').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });

            return interaction.editReply(`✅ Ticket created: ${ticketChannel}`);
        }

        // ---------------------------------------------------------
        // 2. ROLE SELECTION (Inside Ticket)
        // ---------------------------------------------------------
        const roles = {
            'role_police': 'police',
            'role_business': 'businessman',
            'role_citizen': 'citizen',
            'role_robber': 'robber'
        };

        if (roles[interaction.customId]) {
            await interaction.deferUpdate();

            // A. Double check (Prevent double clicking)
            const checkAgain = await UM.getUser(interaction.user.id);
            if (checkAgain) return interaction.channel.send("❌ You already have a role!");

            // B. Create the User in Database
            const selectedRole = roles[interaction.customId];
            const newUser = await UM.createUser(interaction.user.id, interaction.user.username, selectedRole);

            // C. Confirm and Delete
            await interaction.channel.send(`✅ **Role Assigned:** ${selectedRole.toUpperCase()}\n🆔 **ID:** ${newUser.special_id}\n\n*Closing ticket in 5 seconds...*`);

            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 5000);
            return;
        }

        // ---------------------------------------------------------
        // 3. LEADERBOARD REFRESH LOGIC (Kept from before)
        // ---------------------------------------------------------
        if (interaction.customId.startsWith('refresh_')) {
            await interaction.deferUpdate();
            const users = await UM.getAllUsers();
            const now = Math.floor(Date.now() / 1000);

            // MAIN LEADERBOARD
            if (interaction.customId === 'refresh_main_leaderboard') {
                const richest = Object.values(users).sort((a, b) => (b.cash || 0) - (a.cash || 0)).slice(0, 5);
                const officers = Object.values(users).filter(u => u.role === 'police').sort((a, b) => (b.cases || 0) - (a.cases || 0)).slice(0, 5);

                let content = `🏆 **MAIN LEADERBOARD**\n\n💰 **Richest Players**\n`;
                richest.forEach((u, i) => content += `${i + 1}. ${u.username}\n`);
                content += `\n👮 **Top Officers**\n`;
                officers.forEach((u, i) => content += `${i + 1}. ${u.username} — ${u.cases || 0} cases\n`);
                content += `\n🕒 Updated: <t:${now}:R>`;

                return interaction.message.edit({ content, components: [refreshRow('refresh_main_leaderboard')] });
            }

            // TOP OFFICERS
            if (interaction.customId === 'refresh_top_officers') {
                const officers = Object.values(users).filter(u => u.role === 'police').sort((a, b) => (b.cases || 0) - (a.cases || 0)).slice(0, 10);
                let content = `👮 **TOP OFFICERS**\n\n`;
                officers.forEach((u, i) => content += `${i + 1}. ${u.username} — ${u.cases || 0} cases\n`);
                content += `\n🕒 Updated: <t:${now}:R>`;
                return interaction.message.edit({ content, components: [refreshRow('refresh_top_officers')] });
            }

            // TOP ROBBERS
            if (interaction.customId === 'refresh_loot_leaderboard') {
                const robbers = Object.values(users).filter(u => u.role === 'robber').sort((a, b) => (b.total_stolen || 0) - (a.total_stolen || 0)).slice(0, 10);
                let content = `🕶️ **TOP ROBBERS**\n\n`;
                robbers.forEach((u, i) => content += `${i + 1}. ${u.username}\n`);
                content += `\n🕒 Updated: <t:${now}:R>`;
                return interaction.message.edit({ content, components: [refreshRow('refresh_loot_leaderboard')] });
            }

            // TOP INVESTORS
            if (interaction.customId === 'refresh_top_investors') {
                const investors = Object.values(users).filter(u => u.role === 'businessman').sort((a, b) => (b.cash || 0) - (a.cash || 0)).slice(0, 10);
                let content = `💼 **TOP INVESTORS**\n\n`;
                investors.forEach((u, i) => content += `${i + 1}. ${u.username}\n`);
                content += `\n🕒 Updated: <t:${now}:R>`;
                return interaction.message.edit({ content, components: [refreshRow('refresh_top_investors')] });
            }
        }
    });
};
