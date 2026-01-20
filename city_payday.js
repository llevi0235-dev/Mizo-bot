const { ref, get, update } = require('firebase/database');
const db = require('./database');
const Config = require('./config');

module.exports = (client) => {
    setInterval(async () => {
        try {
            const snapshot = await get(ref(db, 'users'));
            const users = snapshot.val();
            if (!users) return;

            const updates = {};
            for (let id in users) {
                const user = users[id];
                let salary = 200; 

                if (user.role === 'police') {
                    const rank = Config.POLICE_RANKS.find(r => (user.arrests || 0) >= r.min) || Config.POLICE_RANKS[0];
                    salary = rank.salary;
                } else if (user.role === 'businessman') {
                    salary = 1000;
                }

                updates[`users/${id}/cash`] = (user.cash || 0) + salary;
            }
            await update(ref(db), updates);
        } catch (err) { console.error("Payday Error:", err); }
    }, 20 * 60 * 1000);
};
