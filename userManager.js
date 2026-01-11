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
        // Robber: STRICTLY 3 Digits (100 - 999)
        if (role === 'robber') return Math.floor(100 + Math.random() * 900);
        
        // Police/Business/Citizen: 6 Digits
        return Math.floor(100000 + Math.random() * 900000);
    },

    // 🎭 MASKING SYSTEM
    maskID(special_id, role) {
        if (!special_id) return 'Unknown';
        
        const str = String(special_id);

        // ROBBER: 3 Digit ID (e.g. 492) -> Show "49?"
        if (role === 'robber') {
            const visible = str.substring(0, 2); 
            return `${visible}?`; 
        }

        // Everyone else: Show Full ID
        return str; 
    },

    generateNews(type, actor, target, amountOrRank) {
        // (News logic kept same as before to save space)
        return `📰 **${type.toUpperCase()}**: ${actor} vs ${target}`;
    }
};

module.exports = UM;
