const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const Config = require('./config');
const UM = require('./userManager');

module.exports = (client) => {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        const { customId, user, guild } = interaction;

        // 1. CREATE TICKET
        if (customId === 'create_ticket') {
            await interaction.deferReply({ ephemeral: true });
            const existing = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase()}` && c.parentId === Config.CHANNELS.IMMIGRATION_CATEGORY);
            if (existing) return interaction.editReply(`❌ Ticket exists: ${existing}`);

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

        // 2. ROLE SELECT
        if (customId.startsWith('role_')) {
            let finalRole = customId.replace('role_', '');
            if (finalRole === 'business') finalRole = 'businessman';
            
            await UM.createUser(user.id, user.username, finalRole);
            
            const map = { 'citizen': 'Citizen', 'robber': 'Robber', 'police': 'Police', 'businessman': 'Businessman' };
            const roleToAdd = guild.roles.cache.find(r => r.name === map[finalRole]);
            
            if (roleToAdd) {
                const allRoles = ['Citizen', 'Robber', 'Police', 'Businessman', 'Prisoner'];
                for (const name of allRoles) {
                    const r = guild.roles.cache.find(role => role.name === name);
                    if (r && interaction.member.roles.cache.has(r.id)) await interaction.member.roles.remove(r).catch(()=>{});
                }
                await interaction.member.roles.add(roleToAdd).catch(e => console.log(e));
            }

            // 👇 UPDATED: Reply and then DELETE INSTANTLY
            await interaction.reply(`✅ Registered as **${finalRole.toUpperCase()}**. Ticket closing...`);
            await interaction.channel.delete().catch(() => null); 
        }
    });
};
