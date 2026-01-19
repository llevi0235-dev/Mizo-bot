const { ref, update } = require('firebase/database');
const Config = require('./config');
const UM = require('./userManager');

// 📜 FLAVOR TEXT COLLECTION (The New Feature)
const PAY_MESSAGES = {
    robber: [
        "🕵️ **The Boss:** Here's your cut from the last job. Don't let the cops see this.",
        "💰 **Laundered Money:** Fresh from the dryer. Enjoy your cash.",
        "🔫 **Heist Payout:** Good work out there. Lay low for a while."
    ],
    businessman: [
        "📈 **Stocks Update:** Your portfolio is up! Here are your dividends.",
        "🤝 **Deal Closed:** Another successful quarter. Profits deposited.",
        "🏢 **Market Share:** You made a killing today. Here is your share."
    ],
    police: [
        "👮 **Payroll:** Officer, here is your bi-weekly paycheck. Keep the streets clean.",
        "🚓 **HQ:** Payment authorized. Good work out there.",
        "🍩 **Salary:** Don't spend it all on donuts. Money transferred."
    ],
    citizen: [
        "🏭 **Wages:** Thank you for your hard work. Payment received.",
        "🏛️ **Gov Stimulus:** Your welfare check has arrived.",
        "💵 **Payday:** Here are your wages for the day."
    ]
};

// 🧮 SALARY CALCULATOR (Updated to support Ranks)
function getSalary(user) {
    if (user.role === 'robber') return 600;
    if (user.role === 'businessman') return 1000;
    if (user.role === 'citizen') return 400;
    
    // Police Ranks
    if (user.role === 'police') {
        const rank = user.rank || 'Cadet'; // Default to Cadet
        if (rank === 'Chief') return 2000;
        if (rank === 'Sergeant') return 1200;
        if (rank === 'Officer') return 800;
        return 500; // Cadet
    }

    return 0; // Prisoners get nothing
}

module.exports = (client) => {

    // =========================================
    // 1️⃣ INCOME LOOP (Now with DMs)
    // =========================================
    setInterval(async () => {
        const users = await UM.getAllUsers();
        const now = Date.now();
        const interval = 30 * 60 * 1000; // 30 Minutes

        for (const [userId, user] of Object.entries(users)) {
            // Skip Prisoners
            if (user.role === 'prisoner') continue;

            // Check Time
            const last = user.last_income || 0;
            if (now - last < interval) continue;

            // Calculate Amount
            const amount = getSalary(user);
            if (amount <= 0) continue;

            // 1. Update Database (Give Money)
            await update(ref(UM.db, `users/${userId}`), { 
                cash: (user.cash || 0) + amount, 
                last_income: now 
            });

            // 2. Pick Random Message
            const msgs = PAY_MESSAGES[user.role] || PAY_MESSAGES['citizen'];
            const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];

            // 3. Send DM (Catch errors if DMs closed)
            try {
                const discordUser = await client.users.fetch(userId);
                if (discordUser) {
                    await discordUser.send(`${randomMsg}\n💸 **Received:** $${amount.toLocaleString()}`);
                }
            } catch (err) {
                console.log(`Could not DM user ${userId}.`);
            }
        }
    }, 60 * 1000); // Check every minute


    // =========================================
    // 2️⃣ JAIL RELEASE LOOP (Kept Exact Same)
    // =========================================
    setInterval(async () => {
        const users = await UM.getAllUsers();
        const now = Date.now();
        const guild = client.guilds.cache.get(Config.GUILD_ID);

        for (const [userId, user] of Object.entries(users)) {
            // Check if Prisoner AND Time is up
            if (user.role === 'prisoner' && user.release_time && now >= user.release_time) {

                // Generate New ID
                const newID = UM.getNewID('robber');

                await update(ref(UM.db, `users/${userId}`), {
                    role: 'robber',
                    release_time: null,
                    special_id: newID // New Identity
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

                // Notify Public Channel
                const jailChannel = client.channels.cache.get(Config.CHANNELS.PRISON_JAIL);
                if (jailChannel) {
                    jailChannel.send(`🔓 **${user.username}** has been released.\n🆔 **New Identity Assigned.**`);
                }
                
                // Notify User
                try {
                    const discordUser = await client.users.fetch(userId);
                    const mask = UM.maskID(newID, 'robber');
                    await discordUser.send(`🔓 **You are free.**\nYour old ID is burned. Your new ID is: **${mask}** (Last digit hidden)`).catch(()=>{});
                } catch (e) {}
            }
        }
    }, 60 * 1000); // Check every minute
};
