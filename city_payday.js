const { ref, update } = require('firebase/database');
const db = require('./database');
const UM = require('./userManager');
const PoliceLogic = require('./police_logic');
const CitizenLogic = require('./citizen_logic');

module.exports = (client) => {
    setInterval(async () => {
        const users = await UM.getAllUsers();
        
        for (const [uid, u] of Object.entries(users)) {
            if (u.role === 'prisoner') continue; // No pay in jail

            let salary = 0;
            if (u.role === 'police') salary = PoliceLogic.getRankInfo(u.cases || 0).salary;
            else if (u.role === 'businessman') salary = 1000;
            else if (u.role === 'robber') salary = 600;
            else salary = CitizenLogic.getBasicWages();

            // Update Database
            await update(ref(db, `users/${uid}`), {
                cash: (u.cash || 0) + salary
            });

            // Try to notify via DM
            try {
                const discordUser = await client.users.fetch(uid);
                await discordUser.send(`💰 **PAYDAY:** You received your city income of **${UM.fmt(salary)}**.`);
            } catch (e) { /* DM closed */ }
        }
        console.log("🏙️ Payday processed for all active citizens.");
    }, 30 * 60 * 1000); // 30 Minutes
};
