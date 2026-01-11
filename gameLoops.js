const { ref, update } = require('firebase/database');
const { EmbedBuilder } = require('discord.js');
const Config = require('./config');
const UM = require('./userManager');

module.exports = (client) => {

    // 1️⃣ INCOME LOOP (Every 30 mins) - (Keep existing code)
    setInterval(async () => {
        const users = await UM.getAllUsers();
        const now = Date.now();
        const interval = 30 * 60 * 1000;

        for (const [userId, user] of Object.entries(users)) {
            if (user.role === 'prisoner') continue; // Prisoners get no money
            const last = user.last_income || 0;
            if (now - last < interval) continue;

            let amount = 0; 
            // ... (Your existing income logic here) ...
            // (If you need me to paste the income logic again, let me know, otherwise just keep what you had)
             if (user.role === 'robber') amount = 600;
             if (user.role === 'citizen') amount = 400;
             if (user.role === 'businessman') amount = 1000;
             if (user.role === 'police') amount = 500; // Simplified for brevity

             if (amount > 0) {
                 await update(ref(UM.db, `users/${userId}`), { cash: (user.cash||0)+amount, last_income: now });
             }
        }
    }, 60 * 1000);

    // 2️⃣ JAIL RELEASE LOOP (UPDATED)
    setInterval(async () => {
        const users = await UM.getAllUsers();
        const now = Date.now();
        const guild = client.guilds.cache.get(Config.GUILD_ID);

        for (const [userId, user] of Object.entries(users)) {
            // Check if Prisoner AND Time is up
            if (user.role === 'prisoner' && user.release_time && now >= user.release_time) {

                // 🆕 GENERATE NEW ID
                const newID = UM.getNewID('robber');

                await update(ref(UM.db, `users/${userId}`), {
                    role: 'robber',
                    release_time: null,
                    special_id: newID // 🔄 New Identity assigned
                });

                // Update Discord Roles
                if (guild) {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member) {
                        const pris = guild.roles.cache.find(r => r.name === 'Prisoner');
                        const rob = guild.roles.cache.find(r => r.name === 'Robber');
                        if (pris) await member.roles.remove(pris).catch(() => {});
                        if (rob) await member.roles.add(rob).catch(() => {});
                    }
                }

                // Notify Public
                client.channels.cache
                    .get(Config.CHANNELS.PRISON_JAIL)
                    ?.send(`🔓 **${user.username}** has been released.\n🆔 **New Identity Assigned.**`);
                
                // Notify User
                client.users.send(userId, `🔓 **You are free.**\nYour old ID is burned. Your new ID is: **${UM.maskID(newID, 'robber')}** (Last digit hidden)`).catch(()=>{});
            }
        }
    }, 60 * 1000);
};
