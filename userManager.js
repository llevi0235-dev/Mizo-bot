const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, update } = require('firebase/database');
const Config = require('./config');

const app = initializeApp(Config.firebaseConfig);
const db = getDatabase(app);

function generateID(length) {
    let result = '';
    const characters = '0123456789';
    for (let i = 0; i < length; i++) result += characters.charAt(Math.floor(Math.random() * characters.length));
    return result;
}

const userManager = {
    db: db, // Exporting DB so index.js can use it for investments

    async syncUser(userId, username) {
        const userRef = ref(db, `users/${userId}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            if (snapshot.val().username !== username) {
                await update(userRef, { username: username });
            }
        }
    },

    async getUser(userId) {
        const snapshot = await get(ref(db, `users/${userId}`));
        return snapshot.exists() ? snapshot.val() : null;
    },

    async createUser(userId, username, role) {
        let startingCash = 10000;
        let idLength = 3;
        
        if (role === 'businessman') {
            startingCash = 50000;
            idLength = 6;
        } else if (role === 'police') {
             startingCash = 10000; 
        }

        const newUser = {
            username: username,
            role: role,
            cash: startingCash,
            special_id: generateID(idLength),
            last_income: Date.now(),
            cases_solved: 0,
            total_stolen: 0,
            investment_profit: 0,
            jail_count: 0,
            robbery_history: {}
        };
        await set(ref(db, `users/${userId}`), newUser);
        return newUser;
    },

    async getAllUsers() {
        const snapshot = await get(ref(db, 'users'));
        return snapshot.exists() ? snapshot.val() : {};
    },

    fmt(amount) {
        return `$${Math.floor(amount).toLocaleString()}`;
    },

    maskID(id, role) {
        if (!id) return 'Unknown';
        if (role === 'businessman') return `${id.substring(0, 3)}???`;
        return `${id.substring(0, 2)}?`;
    },
    
    getNewID(role) {
        return generateID(role === 'businessman' ? 6 : 3);
    }
};

module.exports = userManager;
