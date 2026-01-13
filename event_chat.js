const { ref, update, set } = require('firebase/database');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js'); // <--- ADDED THIS
const Config = require('./config');
const UM = require('./userManager');
const Reporter = require('./reporter');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('/')) return; 

        const content = message.content.trim();
        const userId = message.author.id;

        // =========================================================
        // 🛠️ ADMIN COMMAND: FORCE SETUP LEADERBOARDS
        // =========================================================
        if (content === '/setup') {
            // Define your leaderboard channels and buttons
            const channels = [
                { id: Config.CHANNELS.LEADERBOARD_MAIN, name: '🏆 MAIN LEADERBOARD', btn: 'refresh_main_leaderboard' },
                { id: Config.CHANNELS.TOP_OFFICERS, name: '👮 TOP OFFICERS', btn: 'refresh_top_officers' },
                { id: Config.CHANNELS.LOOT_LEADERBOARD, name: '🕶️ TOP ROBBERS', btn: 'refresh_loot_leaderboard' },
                { id: Config.CHANNELS.TOP_INVESTORS, name: '💼 TOP INVESTORS', btn: 'refresh_top_investors' }
            ];

            await message.reply("🔄 **Initializing Leaderboards...** Please check the channels.");

            for (const c of channels) {
                const chan = client.channels.cache.get(c.id);
                if (chan) {
                    // 1. Clear old messages (clean slate)
                    try {
                        const msgs = await chan.messages.fetch({ limit: 10 });
                        await chan.bulkDelete(msgs).catch(() => {}); 
                    } catch(e) {}

                    // 2. Post New Board with Refresh Button
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(c.btn)
                            .setLabel('Refresh')
                            .setEmoji('🔄')
                            .setStyle(ButtonStyle.Secondary)
                    );
                    
                    await chan.send({ 
                        content: `${c.name}\n\n*Waiting for data...*\nClick 🔄 to refresh.`, 
                        components: [row] 
                    });
                }
            }
            return;
        }

        // =========================================================
        // 👤 USER COMMANDS
        // =========================================================
        
        let user = await UM.getUser(userId);
        
        // 🛠️ RESET COMMAND
        if (content === '/reset') {
            await set(ref(UM.db, `users/${userId}`), null);
            return message.reply("♻️ Data Wiped.");
        }

        if (!user) return message.reply(`Get ID first: <#${Config.CHANNELS.GET_ID_CARD}>`);
        if (user.role === 'prisoner') return message.reply(`🔒 **You are in JAIL.**`);

        // 💳 SIMPLE BALANCE
        if (content === '/b') {
            return message.reply(`💳 **Balance:** ${UM.fmt(user.cash)}`);
        }

        // --- ROBBER ---
        if (user.role === 'robber') {
            // 🎯 TARGETS
            if (content === '/tg') {
                if(user.cash < 200) return message.reply("Need $200 to scan.");
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 200 });
                
                const all = Object.values(await UM.getAllUsers())
                    .filter(u => u.role === 'citizen' || u.role === 'businessman')
                    .sort(()=>0.5-Math.random())
                    .slice(0,10);
                
                // Uses maskID correctly now
                const list = all.map(t => `👤 **${t.username}** | 💰 ${UM.fmt(t.cash)} | 🆔 ${UM.maskID(t.special_id, t.role)}`).join('\n');
                return message.reply(`🎯 **Available Targets:**\n${list || "No targets."}`);
            }

            // 🔫 ROBBERY
            const m = content.match(/^\/rob\s*(\d+)$/);
            if (m) {
                const guess = m[1];
                const allUsers = await UM.getAllUsers();
                let target = null, targetId = null;

                for (const [uid, u] of Object.entries(allUsers)) {
                    if (String(u.special_id) === guess) { targetId = uid; target = u; break; }
                }

                if (!target) return message.reply("❌ Invalid ID.");
                if (user.cash < 100) return message.reply("Need $100.");
                
                const stolen = Math.floor(target.cash * 0.15);
                await update(ref(UM.db, `users/${targetId}`), { cash: target.cash - stolen });
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash + stolen });
                
                return message.reply(`✅ **SUCCESS!** Stole ${UM.fmt(stolen)}.`);
            }
        }

        // --- POLICE ---
        if (user.role === 'police') {
            const m = content.match(/^\/arrest\s*(\d+)$/);
            if (m) {
                const guess = m[1];
                const allUsers = await UM.getAllUsers();
                let targetId = null, targetData = null;
                
                for (const [uid, u] of Object.entries(allUsers)) {
                    if (String(u.special_id) === guess && u.role === 'robber') { 
                        targetId = uid; targetData = u; break; 
                    }
                }

                if (!targetData) return message.reply("❌ Robber not found (Check last digit).");

                const releaseTime = Date.now() + (10 * 60 * 1000);
                await update(ref(UM.db, `users/${targetId}`), { role: 'prisoner', release_time: releaseTime, special_id: null });
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash + 500 }); // Reward

                return message.reply(`✅ **ARRESTED!** ${targetData.username} is now in jail.`);
            }
        }
    });
};
