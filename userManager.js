const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, update } = require('firebase/database');
const Config = require('./config');

const app = initializeApp(Config.firebaseConfig);
const db = getDatabase(app);

const UM = {
    db: db,

    // 1. Get User
    async getUser(userId) {
        const snapshot = await get(ref(db, `users/${userId}`));
        return snapshot.exists() ? snapshot.val() : null;
    },

    // 2. Get All Users
    async getAllUsers() {
        const snapshot = await get(ref(db, 'users'));
        return snapshot.exists() ? snapshot.val() : {};
    },

    // 3. Create User
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

    // 4. Sync User
    async syncUser(userId, username) {
        const user = await this.getUser(userId);
        if (user && user.username !== username) {
            await update(ref(db, `users/${userId}`), { username: username });
        }
    },

    // 5. Utilities
    fmt(amount) { return `$${amount.toLocaleString()}`; },

    // 🆔 ID GENERATOR
    getNewID(role) {
        // Robber: STRICTLY 3 Digits (100 - 999)
        if (role === 'robber') {
            return Math.floor(100 + Math.random() * 900);
        }
        // Citizen: 3 Digits
        if (role === 'citizen') {
            return Math.floor(100 + Math.random() * 900);
        }
        // Police/Business: 6 Digits
        return Math.floor(100000 + Math.random() * 900000);
    },

    // 🎭 MASKING SYSTEM (HIDDEN DIGIT)
    maskID(special_id, role) {
        if (!special_id) return 'Unknown';
        if (role === 'police') return `👮 Officer ${special_id}`;
        
        const str = String(special_id);

        // ROBBER: Hide the last digit (e.g. "492" becomes "49#")
        if (role === 'robber') {
            const visible = str.substring(0, 2); 
            return `${visible}#`; 
        }

        // Citizen: Show full ID
        return str; 
    },

    generateNews(type, actor, target, amountOrRank) {
        const stories = {
            'promotion': [
                `🎙️ **SECTOR 7 NEWS**\n\n**${actor}** promoted to **${amountOrRank}**.`
            ],
            'robbery': [
                `🛑 **CRIME ALERT**\n\n**${actor}** (ID Hidden) robbed **${target}** for **${amountOrRank}**.`
            ],
            'arrest': [
                `⚖️ **JUSTICE**\n\nOfficer **${actor}** cracked the code and arrested **${target}**.`
            ]
        };
        const category = stories[type];
        return category ? category[Math.floor(Math.random() * category.length)] : "News...";
    }
};

module.exports = UM;
