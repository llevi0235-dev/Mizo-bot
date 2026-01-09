const { ref, update, get, set } = require('firebase/database');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const Config = require('./config');
const UM = require('./userManager');

module.exports = (client) => {

    // --- 1. BUTTON INTERACTIONS (Tickets & Roles) ---
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        const { customId, user, guild } = interaction;

        // A. CREATE TICKET
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

        // B. ROLE SELECT
        if (customId.startsWith('role_')) {
            let finalRole = customId.replace('role_', '');
            if (finalRole === 'business') finalRole = 'businessman';
            await UM.createUser(user.id, user.username, finalRole);
            
            // Give Discord Role
            const map = { 'citizen': 'Citizen', 'robber': 'Robber', 'police': 'Police', 'businessman': 'Businessman' };
            const roleToAdd = guild.roles.cache.find(r => r.name === map[finalRole]);
            
            if (roleToAdd) {
                // Remove all other potential roles first
                const allRoles = ['Citizen', 'Robber', 'Police', 'Businessman', 'Prisoner'];
                for (const name of allRoles) {
                    const r = guild.roles.cache.find(role => role.name === name);
                    if (r && interaction.member.roles.cache.has(r.id)) await interaction.member.roles.remove(r).catch(()=>{});
                }
                await interaction.member.roles.add(roleToAdd).catch(e => console.log(e));
            }

            await interaction.reply(`✅ Registered as **${finalRole.toUpperCase()}**.`);
            setTimeout(() => interaction.channel.delete().catch(()=>null), 5000);
        }
    });

    // --- 2. CHAT COMMANDS ---
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('/')) return; 

        const content = message.content.trim();
        const userId = message.author.id;
        
        // Ensure user exists
        let user = await UM.getUser(userId);
        if (!user) {
            // Auto-sync if they just joined, or tell them to get ID
            await UM.syncUser(userId, message.author.username);
            user = await UM.getUser(userId);
            if (!user) return message.reply(`Get ID first: <#${Config.CHANNELS.GET_ID_CARD}>`);
        }

        // Global Commands
        if (content === '/menu') return message.reply("Menu:\n`/bl` - Balance\n`/scantarget` (Robber)\n`/rob <id>` (Robber)\n`/arrest <id>` (Police)\n`/invest <amount>` (Businessman)");
        if (content === '/bl') return message.reply(`💳 **${user.username}** | ${UM.fmt(user.cash)} | ID: ${UM.maskID(user.special_id, user.role)}`);

        // --- BUSINESSMAN COMMANDS ---
        if (user.role === 'businessman') {
            if (content.startsWith('/invest ')) {
                const amount = parseInt(content.split(' ')[1]);
                if (isNaN(amount) || amount <= 0 || user.cash < amount) return message.reply("Invalid amount.");
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash - amount });
                await set(ref(UM.db, `investments/${Date.now()}`), { userId, amount, start_time: Date.now(), end_time: Date.now() + 600000 });
                return message.reply(`📉 Invested ${UM.fmt(amount)}.`);
            }
            if (content === '/investst') {
                const snapshot = await get(ref(UM.db, 'investments'));
                if (!snapshot.exists()) return message.reply("No active investments.");
                let msg = "", found = false;
                Object.values(snapshot.val()).forEach(inv => {
                    if (inv.userId === userId) {
                        msg += `💰 ${UM.fmt(inv.amount)} | ⏳ ${Math.ceil((inv.end_time - Date.now())/60000)}m\n`; found = true;
                    }
                });
                return message.reply(found ? msg : "No active investments.");
            }
        }

        // --- ROBBER COMMANDS (RESTORED!) ---
        if (user.role === 'robber') {
            // A. Scan Target
            if (content === '/scantarget') {
                if(user.cash < 200) return message.reply("Need $200 to scan.");
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 200 });
                
                const all = Object.values(await UM.getAllUsers())
                    .filter(u => u.role === 'citizen' || u.role === 'businessman')
                    .sort(()=>0.5-Math.random())
                    .slice(0,10);
                
                const list = all.map(t => `${t.username} | ${UM.fmt(t.cash)} | ${UM.maskID(t.special_id, t.role)}`).join('\n') || "No targets found.";
                
                return message.author.send(`🎯 **Targets:**\n${list}`)
                    .then(() => message.reply("Targets sent to DM."))
                    .catch(() => message.reply("❌ Open your DMs!"));
            }

            // B. Rob Command
            const m = content.match(/^\/rob\s*(\d+)$/);
            if (m) {
                const guess = m[1];
                const allUsers = await UM.getAllUsers();
                let target = null, targetId = null, closestDiff = Infinity;
                
                // Find closest ID match
                for (const [uid, u] of Object.entries(allUsers)) {
                    if (u.role !== 'citizen' && u.role !== 'businessman') continue;
                    if (uid === userId) continue;
                    
                    const diff = Math.abs(parseInt(guess) - parseInt(u.special_id));
                    if (diff < closestDiff) { closestDiff = diff; target = u; targetId = uid; }
                }

                if (!target) return message.reply("No valid targets.");
                if (user.cash < 100) return message.reply("Need $100 for equipment.");
                if (user.robbery_cooldowns?.[targetId] && (Date.now() - user.robbery_cooldowns[targetId] < 1800000)) return message.reply("Cooldown active on this target.");
                
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 100 });
                
                // Success Chance based on ID accuracy
                let pct = (closestDiff === 0) ? 0.10 : (closestDiff <= 50) ? 0.02 : (closestDiff <= 200) ? 0.01 : 0;
                
                if (pct > 0) {
                    if (user.robbery_history?.[targetId]) return message.reply("You already robbed them clean!");
                    
                    const stolen = Math.floor(target.cash * pct);
                    // Reset victim ID so they can't be farmed
                    const newId = UM.getNewID(target.role);
                    
                    await update(ref(UM.db, `users/${targetId}`), { cash: target.cash - stolen, special_id: newId });
                    await update(ref(UM.db, `users/${userId}`), { cash: user.cash + stolen, total_stolen: (user.total_stolen||0)+stolen, [`robbery_history/${targetId}`]: true });
                    
                    client.channels.cache.get(Config.CHANNELS.CRIME_FEEDS)?.send(`🚨 **ROBBERY!** ${user.username} robbed ${target.username} for ${UM.fmt(stolen)}!`);
                    client.channels.cache.get(Config.CHANNELS.SECTOR7_NEWS)?.send(UM.generateNews('robbery', user.username, target.username, UM.fmt(stolen)));
                    return message.reply(`✅ **SUCCESS!** Stole ${UM.fmt(stolen)}.\nVictim ID has changed.`);
                } else {
                    await update(ref(UM.db, `users/${userId}`), { [`robbery_cooldowns/${targetId}`]: Date.now() });
                    return message.reply("❌ **FAILED.** ID match too far off. Target alerted.");
                }
            }
        }

        // --- POLICE COMMANDS ---
        if (user.role === 'police') {
            const m = content.match(/^\/arrest\s*(\d+)$/);
            if (m) {
                const guess = m[1];
                const allUsers = await UM.getAllUsers();
                let targetId = null, targetData = null;
                
                // Find Robber by Exact ID Match
                for (const [uid, u] of Object.entries(allUsers)) {
                    if (u.special_id == guess && u.role === 'robber') { 
                        targetId = uid; 
                        targetData = u; 
                        break; 
                    }
                }

                if (!targetData) return message.reply("No Robber found with that EXACT ID.");
                if (user.cash < 500) return message.reply("Need $500 for operation costs.");

                await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 500 });
                const seized = Math.floor(targetData.cash * 0.80);
                const reward = Math.floor(seized * 0.03);

                // Jail them
                const guild = client.guilds.cache.get(Config.GUILD_ID);
                if (guild) {
                    const member = await guild.members.fetch(targetId).catch(()=>null);
                    if(member) {
                        const robRole = guild.roles.cache.find(r=>r.name==='Robber');
                        const prisRole = guild.roles.cache.find(r=>r.name==='Prisoner');
                        if(robRole) await member.roles.remove(robRole).catch(()=>{});
                        if(prisRole) await member.roles.add(prisRole).catch(()=>{});
                    }
                }

                await update(ref(UM.db, `users/${targetId}`), { cash: targetData.cash - seized, role: 'prisoner', release_time: Date.now() + 600000, special_id: null });
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash + reward, cases: (user.cases||0)+1 });

                // Logs
                client.channels.cache.get(Config.CHANNELS.RECORD_ROOM)?.send(`📋 **POLICE INFORMATION**\n\nOfficer **${user.username}** successfully solved the case and arrested **${targetData.username}** (ID: ${guess}).\n\n*Case Status: Closed & Recorded.*`);
                client.channels.cache.get(Config.CHANNELS.SECTOR7_NEWS)?.send(UM.generateNews('arrest', user.username, targetData.username, null));
                
                return message.reply(`✅ **ARRESTED!** Reward: ${UM.fmt(reward)}`);
            }
        }
    });
};
