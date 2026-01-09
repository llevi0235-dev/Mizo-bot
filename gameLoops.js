const { ref, update, get, set } = require('firebase/database');
const { EmbedBuilder } = require('discord.js');
const Config = require('./config');
const UM = require('./userManager');

module.exports = (client) => {
    
    // 1. INCOME LOOP
    setInterval(async () => {
        const users = await UM.getAllUsers();
        const now = Date.now();
        const guild = client.guilds.cache.get(Config.GUILD_ID) || client.guilds.cache.first();

        for (const [userId, user] of Object.entries(users)) {
            if (user.role === 'prisoner') continue;

            let interval = 30 * 60 * 1000;
            let amount = 0;

            if (user.role === 'police') {
                const cases = user.cases || 0; 
                const rank = [...Config.POLICE_RANKS].reverse().find(r => cases >= r.min) || Config.POLICE_RANKS[0];
                amount = rank.salary;

                if (now - user.last_income >= interval) {
                    await update(ref(UM.db, `users/${userId}`), { cash: user.cash + amount, last_income: now });
                    
                    // Rank Sync
                    if (guild) {
                        const member = await guild.members.fetch(userId).catch(() => null);
                        if (member) {
                            const newRole = guild.roles.cache.find(r => r.name === rank.name);
                            if (newRole && !member.roles.cache.has(newRole.id)) {
                                for (const rData of Config.POLICE_RANKS) {
                                    const oldRole = guild.roles.cache.find(r => r.name === rData.name);
                                    if (oldRole && member.roles.cache.has(oldRole.id)) await member.roles.remove(oldRole).catch(()=>{});
                                }
                                await member.roles.add(newRole).catch(e => console.log(e));
                                
                                if (cases > 0) {
                                    client.channels.cache.get(Config.CHANNELS.POLICE_PROMOTIONS)?.send(`📢 **PROMOTION**\n**${user.username}** is now **${rank.name}**.`);
                                    client.channels.cache.get(Config.CHANNELS.SECTOR7_NEWS)?.send(UM.generateNews('promotion', user.username, null, rank.name));
                                }
                            }
                        }
                    }
                    // DM
                    const embed = new EmbedBuilder().setTitle(`👮 Payday: ${UM.fmt(amount)}`).setDescription(`Rank: **${rank.name}**`).setColor(0x00FF00);
                    client.users.send(userId, { embeds: [embed] }).catch(() => null);
                }
                continue;
            }

            // Other Roles
            if (user.role === 'citizen') amount = 400;
            if (user.role === 'businessman') amount = 1000;
            if (user.role === 'robber') { interval = 20 * 60 * 1000; amount = 50; }

            if (now - user.last_income >= interval) {
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash + amount, last_income: now });
            }
        }
    }, 60000);

    // 2. JAIL & LEADERBOARD (Simplified for space)
    setInterval(async () => {
        const users = await UM.getAllUsers();
        const now = Date.now();
        const guild = client.guilds.cache.get(Config.GUILD_ID);

        for (const [userId, user] of Object.entries(users)) {
            if (user.role === 'prisoner' && user.release_time && now >= user.release_time) {
                await update(ref(UM.db, `users/${userId}`), { role: 'robber', release_time: null, special_id: UM.getNewID('robber') });
                if (guild) {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if(member) {
                        const pris = guild.roles.cache.find(r => r.name === 'Prisoner');
                        const rob = guild.roles.cache.find(r => r.name === 'Robber');
                        if(pris) member.roles.remove(pris);
                        if(rob) member.roles.add(rob);
                    }
                }
                client.channels.cache.get(Config.CHANNELS.PRISON_JAIL)?.send(`🔓 <@${userId}> released.`);
            }
        }
    }, 60000);
};
