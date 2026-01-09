const { ref, update, get, set } = require('firebase/database');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const Config = require('./config');
const UM = require('./userManager');

module.exports = (client) => {

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        const { customId, user, guild } = interaction;

        // TICKET SYSTEM
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

        // ROLE SELECT
        if (customId.startsWith('role_')) {
            let finalRole = customId.replace('role_', '');
            if (finalRole === 'business') finalRole = 'businessman';
            await UM.createUser(user.id, user.username, finalRole);
            
            // Give Discord Role
            const map = { 'citizen': 'Citizen', 'robber': 'Robber', 'police': 'Police', 'businessman': 'Businessman' };
            const roleToAdd = guild.roles.cache.find(r => r.name === map[finalRole]);
            if (roleToAdd) await interaction.member.roles.add(roleToAdd).catch(e => console.log(e));

            await interaction.reply(`✅ Registered as **${finalRole.toUpperCase()}**.`);
            setTimeout(() => interaction.channel.delete().catch(()=>null), 5000);
        }
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('/')) return; // Optimization

        const content = message.content.trim();
        const userId = message.author.id;
        let user = await UM.getUser(userId);

        if (!user) return message.reply(`Get ID first: <#${Config.CHANNELS.GET_ID_CARD}>`);

        if (content === '/menu') return message.reply("Menu: /bl, /rob <id>, /arrest <id>");
        if (content === '/bl') return message.reply(`💳 **${user.username}** | ${UM.fmt(user.cash)} | ID: ${UM.maskID(user.special_id, user.role)}`);

        // POLICE ARREST
        if (user.role === 'police') {
            const m = content.match(/^\/arrest\s*(\d+)$/);
            if (m) {
                const guess = m[1];
                const allUsers = await UM.getAllUsers();
                let targetId = null, targetData = null;
                
                // Find user by Special ID
                for (const [uid, u] of Object.entries(allUsers)) {
                    if (u.special_id == guess && u.role === 'robber') { targetId = uid; targetData = u; break; }
                }

                if (!targetData) return message.reply("No Robber found with that ID.");
                if (user.cash < 500) return message.reply("Need $500.");

                await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 500 });
                const seized = Math.floor(targetData.cash * 0.80);
                const reward = Math.floor(seized * 0.03);

                await update(ref(UM.db, `users/${targetId}`), { cash: targetData.cash - seized, role: 'prisoner', release_time: Date.now() + 600000 });
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash + reward, cases: (user.cases||0)+1 });

                // Logs
                client.channels.cache.get(Config.CHANNELS.RECORD_ROOM)?.send(`📋 **POLICE RECORD**\nOfficer **${user.username}** arrested **${targetData.username}**.`);
                client.channels.cache.get(Config.CHANNELS.SECTOR7_NEWS)?.send(UM.generateNews('arrest', user.username, targetData.username, null));
                
                return message.reply(`✅ Arrested! Reward: ${UM.fmt(reward)}`);
            }
        }
    });
};
