const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ChannelType, PermissionsBitField, EmbedBuilder
} = require('discord.js');
const Config = require('./config');
const UM = require('./userManager');

module.exports = (client) => {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        // ---------------------------------------------------------
        // 1. GET ID CARD (Start Ticket)
        // ---------------------------------------------------------
        if (interaction.customId === 'create_ticket') {
            await interaction.deferReply({ ephemeral: true });

            const channelName = `ticket-${interaction.user.username}`.toLowerCase();
            
            // Check if exists
            const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);
            if (existingChannel) {
                return interaction.editReply(`⚠️ You already have a ticket: ${existingChannel}`);
            }

            // Create Channel (With Fail-Safe)
            let ticketChannel;
            try {
                ticketChannel = await interaction.guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: Config.CHANNELS.IMMIGRATION_CATEGORY, // MUST BE CORRECT ID
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ],
                });
            } catch (error) {
                console.log("Category Error, creating in root:", error);
                // Fallback: Create without category if ID is wrong
                ticketChannel = await interaction.guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ],
                });
            }

            // Send Panel
            const embed = new EmbedBuilder().setTitle('#Choose Role..').setColor(0x0099FF);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('role_police').setLabel('Police').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('role_business').setLabel('Businessman').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('role_citizen').setLabel('Citizen').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('role_robber').setLabel('Robber').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
            return interaction.editReply(`✅ Ticket created: ${ticketChannel}`);
        }

        // ---------------------------------------------------------
        // 2. ROLE SELECTION (Overwrite Mode)
        // ---------------------------------------------------------
        const roles = { 'role_police': 'police', 'role_business': 'businessman', 'role_citizen': 'citizen', 'role_robber': 'robber' };

        if (roles[interaction.customId]) {
            await interaction.deferUpdate();
            const selectedRole = roles[interaction.customId];

            // 🛑 FORCE OVERWRITE DATA
            const newUser = await UM.createUser(interaction.user.id, interaction.user.username, selectedRole);

            await interaction.channel.send(`✅ **Role Assigned:** ${selectedRole.toUpperCase()}\n🆔 **ID:** ${newUser.special_id}\n\n*Closing...*`);
            setTimeout(() => interaction.channel.delete().catch(()=>{}), 3000);
        }

        // ---------------------------------------------------------
        // 3. JAIL TIMER
        // ---------------------------------------------------------
        if (interaction.customId === 'refresh_jail_timer') {
            await interaction.deferUpdate();
            const users = await UM.getAllUsers();
            const prisoners = Object.values(users).filter(u => u.role === 'prisoner').sort((a,b) => a.release_time - b.release_time);
            
            let content = `🔒 **SECTOR 7 PRISON ROSTER**\n\n`;
            if (prisoners.length === 0) content += `✅ **No active prisoners.**`;
            else prisoners.forEach((p, i) => {
                const min = Math.floor((p.release_time - Date.now()) / 60000);
                if(min >= 0) content += `${i+1}. **${p.username}** — ⏳ ${min} mins left\n`;
            });

            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('refresh_jail_timer').setLabel('Refresh Timer').setEmoji('⏱️').setStyle(ButtonStyle.Secondary));
            return interaction.message.edit({ content, components: [row] });
        }
    });
};
