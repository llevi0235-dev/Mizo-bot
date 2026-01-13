const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, update } = require('firebase/database');
const Config = require('./config');

const app = initializeApp(Config.firebaseConfig);
const db = getDatabase(app);

const UM = {
    db: db,

    async getUser(userId) {
        const snapshot = await get(ref(db, `users/${userId}`));
        return snapshot.exists() ? snapshot.val() : null;
    },

    async getAllUsers() {
        const snapshot = await get(ref(db, 'users'));
        return snapshot.exists() ? snapshot.val() : {};
    },

    async createUser(userId, username, role) {
        const newUser = {
            username: username,
            role: role,
            cash: 500,
            special_id: this.getNewID(role),
            joined: Date.now()
        };
        await set(ref(db, `users/${userId}`), newUser);
        return newUser;
    },

    fmt(amount) { return `$${amount.toLocaleString()}`; },

    // 🆔 ID GENERATOR
    getNewID(role) {
        // Robber: 3 Digits (100 - 999)
        if (role === 'robber') return Math.floor(100 + Math.random() * 900);
        
        // Others: 6 Digits (100000 - 999999)
        return Math.floor(100000 + Math.random() * 900000);
    },

    // 🎭 MASKING SYSTEM (UPDATED)
    maskID(special_id, role) {
        if (!special_id) return 'Unknown';
        const str = String(special_id);

        // ROBBER: Hide last 1 digit (e.g. 123 -> 12?)
        if (role === 'robber') {
            return str.substring(0, str.length - 1) + '?';
        }

        // BUSINESSMAN: Hide last 3 digits (e.g. 123456 -> 123???)
        if (role === 'businessman') {
            return str.substring(0, str.length - 3) + '???';
        }

        // Police & Citizen: Show Full ID
        return str; 
    },

    generateNews(type, actor, target, amountOrRank) {
        return `📰 **${type.toUpperCase()}**: ${actor} vs ${target}`;
    }
};

module.exports = UM;
