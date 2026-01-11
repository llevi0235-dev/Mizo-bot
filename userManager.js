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

    // 4. Sync User (Update name if changed)
    async syncUser(userId, username) {
        const user = await this.getUser(userId);
        if (user && user.username !== username) {
            await update(ref(db, `users/${userId}`), { username: username });
        }
    },

    // 5. Utilities
    fmt(amount) { return `$${amount.toLocaleString()}`; },

    // 🔴 UPDATED: ROLE-BASED ID SYSTEM
    getNewID(role) {
        // Citizen & Robber → 3-digit ID
        if (role === 'citizen' || role === 'robber') {
            return Math.floor(100 + Math.random() * 900); // 100–999
        }

        // Police & Businessman → 6-digit ID
        return Math.floor(100000 + Math.random() * 900000); // 100000–999999
    },

    maskID(special_id, role) {
        if (!special_id) return 'Unknown';
        if (role === 'police') return 'Officer';
        if (role === 'robber') return 'Masked';

        const str = String(special_id);
        return str; // Citizens now truly have 3-digit IDs
    },

    generateNews(type, actor, target, amountOrRank) {
        const stories = {
            'promotion': [
                `🎙️ **SECTOR 7 EVENING NEWS**\n\nWe interrupt your daily broadcast... **${actor}** has been promoted to **${amountOrRank}**. Authority granted.`,
                `📻 **THE DAILY DISPATCH**\n\n**${actor}** has officially been promoted to **${amountOrRank}**. Sector 7 sleeps safer tonight.`
            ],
            'robbery': [
                `🛑 **BREAKING NEWS**\n\n**${actor}** (ID: Masked) intercepted **${target}** and extracted **${amountOrRank}**.`,
                `⚠️ **CRIME WATCH ALERT**\n\n**${target}** has fallen victim to a high-stakes robbery by **${actor}** (ID: Masked). Stolen: **${amountOrRank}**.`
            ],
            'arrest': [
                `⚖️ **JUSTICE SERVED**\n\nThe notorious **${target}** has been brought to justice by **${actor}**.`,
                `🚓 **SECTOR 7 CRIME BEAT**\n\nGotcha! **${target}** is now in custody thanks to **${actor}**.`
            ]
        };
        const category = stories[type];
        return category ? category[Math.floor(Math.random() * category.length)] : "News...";
    }
};

module.exports = UM;