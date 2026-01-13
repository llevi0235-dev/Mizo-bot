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

            const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            // Check if exists
            const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);
            if (existingChannel) {
                return interaction.editReply(`⚠️ You already have a ticket open: ${existingChannel}`);
            }

            // Create Channel
            let ticketChannel;
            try {
                // Try creating inside the Category
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
                console.log("Category Error (Creating in root):", error);
                // Fallback if Category ID is wrong
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
            const embed = new EmbedBuilder().setTitle('#Choose Role..').setDescription("Clicking a role will assign it immediately.").setColor(0x0099FF);
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
        // 2. ROLE SELECTION (Auto-Give Discord Role)
        // ---------------------------------------------------------
        const rolesMap = { 
            'role_police': 'police', 
            'role_business': 'businessman', 
            'role_citizen': 'citizen', 
            'role_robber': 'robber' 
        };

        // These must match your Server Role Names EXACTLY
        const discordRoleNames = {
            'police': 'Police',
            'businessman': 'Businessman',
            'citizen': 'Citizen',
            'robber': 'Robber'
        };

        if (rolesMap[interaction.customId]) {
            await interaction.deferUpdate();
            const selectedRoleKey = rolesMap[interaction.customId];

            // A. Update Database
            const newUser = await UM.createUser(interaction.user.id, interaction.user.username, selectedRoleKey);

            // B. Manage Discord Roles
            const member = interaction.member; 
            if (member) {
                // 1. Remove ALL game roles first (Clean sweep)
                const allRoleNames = Object.values(discordRoleNames);
                for (const name of allRoleNames) {
                    const r = interaction.guild.roles.cache.find(role => role.name === name);
                    if (r && member.roles.cache.has(r.id)) {
                        await member.roles.remove(r);
                    }
                }

                // 2. Add the NEW role
                const targetRoleName = discordRoleNames[selectedRoleKey];
                const targetRole = interaction.guild.roles.cache.find(role => role.name === targetRoleName);
                
                if (targetRole) {
                    await member.roles.add(targetRole);
                } else {
                    interaction.channel.send(`⚠️ **Warning:** I could not find a Discord Role named "${targetRoleName}". Please create it in Server Settings.`);
                }
            }

            await interaction.channel.send(`✅ **Role Assigned:** ${selectedRoleKey.toUpperCase()}\n🆔 **ID:** ${newUser.special_id}\n\n*Closing ticket...*`);
            setTimeout(() => interaction.channel.delete().catch(()=>{}), 4000);
        }

        // ---------------------------------------------------------
        // 3. JAIL TIMER REFRESH (Unchanged)
        // ---------------------------------------------------------
        if (interaction.customId === 'refresh_jail_timer') {
            await interaction.deferUpdate();
            const users = await UM.getAllUsers();
            const prisoners = Object.values(users).filter(u => u.role === 'prisoner').sort((a,b) => a.release_time - b.release_time);
            
            let content = `🔒 **SECTOR 7 PRISON ROSTER**\n\n`;
            if (prisoners.length === 0) content += `✅ **No active prisoners.**`;
            else prisoners.forEach((p, i) => {
                const min = Math.floor((p.release_time - Date.now()) / 60000);
                const sec = Math.floor(((p.release_time - Date.now()) % 60000) / 1000);
                if(min >= 0) content += `${i+1}. **${p.username}** — ⏳ ${min}m ${sec}s\n`;
            });

            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('refresh_jail_timer').setLabel('Refresh Timer').setEmoji('⏱️').setStyle(ButtonStyle.Secondary));
            return interaction.message.edit({ content, components: [row] });
        }
    });
};
