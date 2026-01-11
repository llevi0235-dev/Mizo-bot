const { ref, update } = require('firebase/database');
const { EmbedBuilder } = require('discord.js');
const Config = require('./config');
const UM = require('./userManager');

module.exports = (client) => {

    // 1️⃣ INCOME + DM LOOP (EVERY 30 MINUTES)
    setInterval(async () => {
        const users = await UM.getAllUsers();
        const now = Date.now();
        const interval = 30 * 60 * 1000;

        for (const [userId, user] of Object.entries(users)) {
            if (user.role === 'prisoner') continue;

            const last = user.last_income || 0;
            if (now - last < interval) continue;

            let amount = 0;
            let embed = null;

            // 👮 POLICE
            if (user.role === 'police') {
                const cases = user.cases || 0;
                const rank = [...Config.POLICE_RANKS].reverse().find(r => cases >= r.min);
                amount = rank.salary;

                embed = new EmbedBuilder()
                    .setTitle(`👮 Payday: ${UM.fmt(amount)}`)
                    .setDescription(
                        `Good work, **${rank.name}**. Your payment for maintaining order in **Sector 7** has been deposited.\n\n` +
                        `🏅 Current Rank: **${rank.name}**\n` +
                        `⏱️ You will receive your next payment in **30 minutes**.`
                    )
                    .setColor(0x00FF00);
            }

            // 🏘️ CITIZEN
            if (user.role === 'citizen') {
                amount = 400;
                embed = new EmbedBuilder()
                    .setTitle(`🏙️ Sector 7 Citizen Update`)
                    .setDescription(
                        `Routine work and city services have been completed.\n\n` +
                        `**$400 credited to your account.**\n` +
                        `⏱️ Next credit in **30 minutes**.`
                    )
                    .setColor(0x3498DB);
            }

            // 💼 BUSINESSMAN
            if (user.role === 'businessman') {
                amount = 1000;
                embed = new EmbedBuilder()
                    .setTitle(`🏙️ Sector 7 Economic Notice`)
                    .setDescription(
                        `To maintain commercial activity, Sector 7 has released support funds.\n\n` +
                        `**$1000 deposited**\n` +
                        `⏱️ Next fund release scheduled in **30 minutes**.`
                    )
                    .setColor(0xF1C40F);
            }

            // 🕶️ ROBBER
            if (user.role === 'robber') {
                amount = 600;
                embed = new EmbedBuilder()
                    .setTitle(`🕶️ Underworld Cut`)
                    .setDescription(
                        `Your network moved goods through the city.\n\n` +
                        `**$600 added to your stash.**\n` +
                        `⏱️ Next cut available in **30 minutes**.`
                    )
                    .setColor(0x8E44AD);
            }

            // APPLY PAYMENT + DM
            await update(ref(UM.db, `users/${userId}`), {
                cash: (user.cash || 0) + amount,
                last_income: now
            });

            client.users.send(userId, { embeds: [embed] }).catch(() => null);
        }
    }, 60 * 1000); // check every minute

    // 2️⃣ JAIL RELEASE LOOP (UNCHANGED)
    setInterval(async () => {
        const users = await UM.getAllUsers();
        const now = Date.now();
        const guild = client.guilds.cache.get(Config.GUILD_ID);

        for (const [userId, user] of Object.entries(users)) {
            if (user.role === 'prisoner' && user.release_time && now >= user.release_time) {

                const newID = UM.getNewID('robber');

                await update(ref(UM.db, `users/${userId}`), {
                    role: 'robber',
                    release_time: null,
                    special_id: newID
                });

                if (guild) {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member) {
                        const pris = guild.roles.cache.find(r => r.name === 'Prisoner');
                        const rob = guild.roles.cache.find(r => r.name === 'Robber');
                        if (pris) await member.roles.remove(pris).catch(() => {});
                        if (rob) await member.roles.add(rob).catch(() => {});
                    }
                }

                client.channels.cache
                    .get(Config.CHANNELS.PRISON_JAIL)
                    ?.send(`🔓 **${user.username}** has served their time and is released.\n🆔 **New ID Assigned.**`);
            }
        }
    }, 60 * 1000);
};