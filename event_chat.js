const { ref, update, get, set } = require('firebase/database');
const Config = require('./config');
const UM = require('./userManager');
const Reporter = require('./reporter');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('/')) return; 

        const content = message.content.trim();
        const userId = message.author.id;
        
        let user = await UM.getUser(userId);
        if (!user) {
            // Auto-sync if missing, but usually they need ID card first
            return message.reply(`Get ID first: <#${Config.CHANNELS.GET_ID_CARD}>`);
        }

        // 🛠️ DEV COMMAND: RESET MY DATA (Keep this for your testing)
        if (content === '/reset') {
            await set(ref(UM.db, `users/${userId}`), null);
            return message.reply("♻️ **Account Reset.**");
        }

        // 🛑 CRITICAL: BLOCK PRISONERS
        if (user.role === 'prisoner') {
            const releaseSecs = Math.floor(user.release_time / 1000);
            return message.reply(`🔒 **YOU ARE IN JAIL!**\nYou are locked down.\nRelease: <t:${releaseSecs}:R>`);
        }

        // --- GLOBAL COMMANDS ---
        if (content === '/menu') return message.reply("Menu:\n`/bl` - Balance\n`/tg` (Robber Scan)\n`/rob <id>` (Robber)\n`/arrest <id>` (Police)\n`/invest <amount>` (Businessman)");
        
        // 💳 BALANCE (Shows Masked ID even to owner!)
        if (content === '/bl') {
            return message.reply(`💳 **${user.username}** | ${UM.fmt(user.cash)} | ID: ${UM.maskID(user.special_id, user.role)}`);
        }

        // --- BUSINESSMAN ---
        if (user.role === 'businessman') {
            if (content.startsWith('/invest ')) {
                const amount = parseInt(content.split(' ')[1]);
                if (isNaN(amount) || amount <= 0 || user.cash < amount) return message.reply("Invalid amount.");
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash - amount });
                await set(ref(UM.db, `investments/${Date.now()}`), { userId, amount, start_time: Date.now(), end_time: Date.now() + 600000 });
                return message.reply(`📉 Invested ${UM.fmt(amount)}.`);
            }
        }

        // --- ROBBER ---
        if (user.role === 'robber') {
            // 🎯 SCAN TARGETS (Renamed to /tg)
            if (content === '/tg') {
                if(user.cash < 200) return message.reply("Need $200 to scan.");
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 200 });
                
                const all = Object.values(await UM.getAllUsers())
                    .filter(u => u.role === 'citizen' || u.role === 'businessman')
                    .sort(()=>0.5-Math.random())
                    .slice(0,10);
                
                const list = all.map(t => `${t.username} | ${UM.fmt(t.cash)} | ${UM.maskID(t.special_id, t.role)}`).join('\n') || "No targets found.";
                return message.reply(`🎯 **Targets:**\n${list}`);
            }

            // 🔫 ROBBERY
            const m = content.match(/^\/rob\s*(\d+)$/);
            if (m) {
                const guess = m[1];
                const allUsers = await UM.getAllUsers();
                let targetId = null, target = null;

                // Simple Match Logic
                for (const [uid, u] of Object.entries(allUsers)) {
                    if (u.role !== 'citizen' && u.role !== 'businessman') continue;
                    if (String(u.special_id) === guess) { targetId = uid; target = u; break; }
                }

                if (!target) return message.reply("Invalid Target ID.");
                if (user.cash < 100) return message.reply("Need $100 for equipment.");
                
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 100 });
                
                // Success Calculation
                const stolen = Math.floor(target.cash * 0.15);
                await update(ref(UM.db, `users/${targetId}`), { cash: target.cash - stolen });
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash + stolen, total_stolen: (user.total_stolen||0)+stolen });
                
                await Reporter.postNews(client, 'robbery', user.username, target.username, UM.fmt(stolen));
                return message.reply(`✅ **SUCCESS!** Stole ${UM.fmt(stolen)} from ${target.username}.`);
            }
        }

        // --- POLICE ---
        if (user.role === 'police') {
            const m = content.match(/^\/arrest\s*(\d+)$/);
            if (m) {
                const guess = m[1]; // The Police must guess the FULL 3 digits (e.g. 492) even though they only see 49#
                
                const allUsers = await UM.getAllUsers();
                let targetId = null, targetData = null;
                
                for (const [uid, u] of Object.entries(allUsers)) {
                    // Prevent Double Arrest: Only look for 'robber', ignore 'prisoner'
                    if (String(u.special_id) === guess && u.role === 'robber') { 
                        targetId = uid; 
                        targetData = u; 
                        break; 
                    }
                }

                if (!targetData) return message.reply("❌ No active Robber found with that ID. (Did you guess the last digit wrong?)");
                if (user.cash < 500) return message.reply("Need $500 to file arrest warrant.");

                await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 500 });
                const seized = Math.floor(targetData.cash * 0.80);
                const reward = Math.floor(seized * 0.03);

                const guild = client.guilds.cache.get(Config.GUILD_ID);
                // Try to update Discord Roles if possible
                if (guild) {
                    const member = await guild.members.fetch(targetId).catch(()=>null);
                    if(member) {
                        const robRole = guild.roles.cache.find(r=>r.name==='Robber');
                        const prisRole = guild.roles.cache.find(r=>r.name==='Prisoner');
                        if(robRole) await member.roles.remove(robRole).catch(()=>{});
                        if(prisRole) await member.roles.add(prisRole).catch(()=>{});
                    }
                }

                // 🛑 JAIL LOGIC: Change Role to PRISONER + Remove ID
                const releaseTime = Date.now() + (10 * 60 * 1000); // 10 Minutes
                
                await update(ref(UM.db, `users/${targetId}`), { 
                    cash: targetData.cash - seized, 
                    role: 'prisoner', 
                    release_time: releaseTime, 
                    special_id: null // Remove ID so they can't be tracked or arrested again
                });

                await update(ref(UM.db, `users/${userId}`), { cash: user.cash + reward, cases: (user.cases||0)+1 });

                await Reporter.logArrest(client, user, targetData, guess);
                await Reporter.postNews(client, 'arrest', user.username, targetData.username, null);
                
                const jailChannel = client.channels.cache.get(Config.CHANNELS.PRISON_JAIL);
                if (jailChannel) {
                    jailChannel.send(`🔒 **${targetData.username}** arrested by **${user.username}**.\n**Release:** <t:${Math.floor(releaseTime/1000)}:R>`);
                }

                return message.reply(`✅ **ARREST SUCCESSFUL!**\nTarget jailed. Reward: ${UM.fmt(reward)}`);
            }
        }
    });
};
