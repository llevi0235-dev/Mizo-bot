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
        // JAIL TIMER REFRESH
        // ---------------------------------------------------------
        if (interaction.customId === 'refresh_jail_timer') {
            await interaction.deferUpdate(); // Acknowledge click

            const users = await UM.getAllUsers();
            const now = Date.now();

            // Filter Prisoners
            const prisoners = Object.values(users)
                .filter(u => u.role === 'prisoner')
                .sort((a, b) => a.release_time - b.release_time);

            let content = `🔒 **SECTOR 7 PRISON ROSTER**\n\n`;

            if (prisoners.length === 0) {
                content += `✅ **No active prisoners.**`;
            } else {
                prisoners.forEach((p, i) => {
                    const timeLeft = p.release_time - now;
                    
                    if (timeLeft > 0) {
                        // Calculate Exact Time
                        const minutes = Math.floor(timeLeft / 60000);
                        const seconds = Math.floor((timeLeft % 60000) / 1000);
                        content += `${i+1}. **${p.username}** — ⏳ ${minutes}m ${seconds}s remaining\n`;
                    } else {
                        content += `${i+1}. **${p.username}** — *Processing Release...*\n`;
                    }
                });
            }

            content += `\n👇 *Click Refresh to update time.*`;

            // Keep the button there
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('refresh_jail_timer')
                    .setLabel('Refresh Timer')
                    .setEmoji('⏱️')
                    .setStyle(ButtonStyle.Secondary)
            );

            return interaction.message.edit({ content, components: [row] });
        }


        // ---------------------------------------------------------
        // 1. GET ID CARD (Start Ticket)
        // ---------------------------------------------------------
        if (interaction.customId === 'create_ticket') {
            await interaction.deferReply({ ephemeral: true });

            // 🔓 TEST MODE ENABLED: 
            // The "Check if user exists" block is REMOVED. 
            // You can now open a ticket anytime.

            // A. Create Private Ticket Channel
            const channelName = `ticket-${interaction.user.username}`;
            
            // Check if ticket already exists to prevent spamming channels
            const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName.toLowerCase());
            if (existingChannel) {
                return interaction.editReply(`⚠️ You already have a ticket open: ${existingChannel}`);
            }

            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: Config.CHANNELS.IMMIGRATION_CATEGORY, 
                permissionOverwrites: [
                    {
                        id: interaction.guild.id, // Deny Everyone
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: interaction.user.id, // Allow User
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                    },
                    {
                        id: client.user.id, // Allow Bot
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                    }
                ],
            });

            // B. Send the Role Selection Panel
            const embed = new EmbedBuilder()
                .setTitle('#Choose Role..')
                .setDescription("⚠️ **TEST MODE:** Choosing a role will reset your current progress.")
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

            const selectedRole = roles[interaction.customId];

            // 🛑 FORCE OVERWRITE (Because you are Admin/Testing)
            // We do NOT check if user exists. We just overwrite them.
            const newUser = await UM.createUser(interaction.user.id, interaction.user.username, selectedRole);

            // C. Confirm and Delete
            await interaction.channel.send(`✅ **Role Switched:** ${selectedRole.toUpperCase()}\n🆔 **New ID:** ${newUser.special_id}\n\n*Closing ticket in 5 seconds...*`);

            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 5000);
            return;
        }

        // ---------------------------------------------------------
        // 3. LEADERBOARD REFRESH LOGIC (Unchanged)
        // ---------------------------------------------------------
        if (interaction.customId.startsWith('refresh_')) {
            await interaction.deferUpdate();
            const users = await UM.getAllUsers();
            const now = Math.floor(Date.now() / 1000);

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

            if (interaction.customId === 'refresh_top_officers') {
                const officers = Object.values(users).filter(u => u.role === 'police').sort((a, b) => (b.cases || 0) - (a.cases || 0)).slice(0, 10);
                let content = `👮 **TOP OFFICERS**\n\n`;
                officers.forEach((u, i) => content += `${i + 1}. ${u.username} — ${u.cases || 0} cases\n`);
                content += `\n🕒 Updated: <t:${now}:R>`;
                return interaction.message.edit({ content, components: [refreshRow('refresh_top_officers')] });
            }

            if (interaction.customId === 'refresh_loot_leaderboard') {
                const robbers = Object.values(users).filter(u => u.role === 'robber').sort((a, b) => (b.total_stolen || 0) - (a.total_stolen || 0)).slice(0, 10);
                let content = `🕶️ **TOP ROBBERS**\n\n`;
                robbers.forEach((u, i) => content += `${i + 1}. ${u.username}\n`);
                content += `\n🕒 Updated: <t:${now}:R>`;
                return interaction.message.edit({ content, components: [refreshRow('refresh_loot_leaderboard')] });
            }

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
