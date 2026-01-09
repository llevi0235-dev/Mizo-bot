const { ref, update, get, set } = require('firebase/database');
const Config = require('./config');
const UM = require('./userManager');
const Reporter = require('./reporter'); // 👈 IMPORT THE NEW FILE

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('/')) return; 

        const content = message.content.trim();
        const userId = message.author.id;
        
        let user = await UM.getUser(userId);
        if (!user) {
            await UM.syncUser(userId, message.author.username);
            user = await UM.getUser(userId);
            if (!user) return message.reply(`Get ID first: <#${Config.CHANNELS.GET_ID_CARD}>`);
        }

        // --- GLOBAL COMMANDS ---
        if (content === '/menu') return message.reply("Menu:\n`/bl` - Balance\n`/scantarget` (Robber)\n`/rob <id>` (Robber)\n`/arrest <id>` (Police)\n`/invest <amount>` (Businessman)");
        if (content === '/bl') return message.reply(`💳 **${user.username}** | ${UM.fmt(user.cash)} | ID: ${UM.maskID(user.special_id, user.role)}`);

        // --- BUSINESSMAN ---
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

        // --- ROBBER ---
        if (user.role === 'robber') {
            if (content === '/scantarget') {
                if(user.cash < 200) return message.reply("Need $200 to scan.");
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 200 });
                const all = Object.values(await UM.getAllUsers()).filter(u => u.role === 'citizen' || u.role === 'businessman').sort(()=>0.5-Math.random()).slice(0,10);
                const list = all.map(t => `${t.username} | ${UM.fmt(t.cash)} | ${UM.maskID(t.special_id, t.role)}`).join('\n') || "No targets found.";
                return message.author.send(`🎯 **Targets:**\n${list}`).then(() => message.reply("Targets sent to DM.")).catch(() => message.reply("❌ Open your DMs!"));
            }

            const m = content.match(/^\/rob\s*(\d+)$/);
            if (m) {
                const guess = m[1];
                const allUsers = await UM.getAllUsers();
                let target = null, targetId = null;
                let bestMatchLevel = 0; 

                for (const [uid, u] of Object.entries(allUsers)) {
                    if (u.role !== 'citizen' && u.role !== 'businessman') continue;
                    if (uid === userId) continue;
                    const idStr = String(u.special_id);
                    const guessStr = String(guess);
                    let matchLevel = 0;
                    if (idStr === guessStr) matchLevel = 3;
                    else if (idStr.endsWith(guessStr.slice(-2)) && guessStr.length >= 2) matchLevel = 2;
                    else if (idStr.endsWith(guessStr.slice(-1))) matchLevel = 1;
                    if (matchLevel > bestMatchLevel) { bestMatchLevel = matchLevel; target = u; targetId = uid; }
                }

                if (!target) return message.reply("No targets found matching that number.");
                if (user.cash < 100) return message.reply("Need $100 for equipment.");
                if (user.robbery_cooldowns?.[targetId] && (Date.now() - user.robbery_cooldowns[targetId] < 1800000)) return message.reply("Cooldown active on this target.");
                
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 100 });
                
                let pct = 0;
                let isExact = false;
                if (bestMatchLevel === 3) { pct = 0.15; isExact = true; } 
                else if (bestMatchLevel === 2) { pct = 0.04; }           
                else if (bestMatchLevel === 1) { pct = 0.01; }           
                
                if (pct > 0) {
                    const stolen = Math.floor(target.cash * pct);
                    const updates = { cash: target.cash - stolen };
                    if (isExact) updates.special_id = UM.getNewID(target.role); 
                    await update(ref(UM.db, `users/${targetId}`), updates);
                    await update(ref(UM.db, `users/${userId}`), { cash: user.cash + stolen, total_stolen: (user.total_stolen||0)+stolen, [`robbery_history/${targetId}`]: true });
                    
                    // 👇 NEW CLEANER LOGS 👇
                    await Reporter.logRobbery(client, user, target, stolen, isExact);
                    await Reporter.postNews(client, 'robbery', user.username, target.username, UM.fmt(stolen));
                    
                    return message.reply(`✅ **SUCCESS!**\nMatched: ${isExact ? "EXACT ID (New ID generated)" : (bestMatchLevel + " Digit(s)")}.\nStolen: ${UM.fmt(stolen)}.`);
                } else {
                    await update(ref(UM.db, `users/${userId}`), { [`robbery_cooldowns/${targetId}`]: Date.now() });
                    return message.reply("❌ **FAILED.** Digits didn't match.");
                }
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
                    if (u.special_id == guess && u.role === 'robber') { targetId = uid; targetData = u; break; }
                }

                if (!targetData) return message.reply("No Robber found with that EXACT ID.");
                if (user.cash < 500) return message.reply("Need $500.");

                await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 500 });
                const seized = Math.floor(targetData.cash * 0.80);
                const reward = Math.floor(seized * 0.03);

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

                // 👇 NEW CLEANER LOGS 👇
                await Reporter.logArrest(client, user, targetData, guess);
                await Reporter.postNews(client, 'arrest', user.username, targetData.username, null);
                
                return message.reply(`✅ Arrested! Reward: ${UM.fmt(reward)}`);
            }
        }
    });
};
