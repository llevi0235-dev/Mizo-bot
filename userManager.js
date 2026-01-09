const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, update } = require('firebase/database');
const Config = require('./config');

const app = initializeApp(Config.firebaseConfig);
const db = getDatabase(app);

// --- HELPER: Random ID Generator ---
function generateID(length) {
    let result = '';
    const characters = '0123456789';
    for (let i = 0; i < length; i++) result += characters.charAt(Math.floor(Math.random() * characters.length));
    return result;
}

const userManager = {
    db: db, 

    // --- 1. FIND USER BY SPECIAL ID (For /rob <id> commands) ---
    async findUserBySpecialID(specialIdTarget) {
        const snapshot = await get(ref(db, 'users'));
        if (!snapshot.exists()) return null;

        const users = snapshot.val();
        // Loop through all users to find who owns this ID
        for (const [userId, data] of Object.entries(users)) {
            if (data.special_id === specialIdTarget) {
                return { userId: userId, ...data };
            }
        }
        return null;
    },

    // --- 2. SYNC USERNAME ---
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

    async getAllUsers() {
        const snapshot = await get(ref(db, 'users'));
        return snapshot.exists() ? snapshot.val() : {};
    },

    // --- 3. CREATE OR SWITCH ROLE (With Penalty Logic) ---
    async createUser(userId, username, newRole) {
        const userRef = ref(db, `users/${userId}`);
        const snapshot = await get(userRef);
        
        // Determine ID Length for new role
        let idLength = (newRole === 'businessman') ? 6 : 3;
        let newSpecialID = generateID(idLength);

        // A. EXISTING USER (Switching Roles)
        if (snapshot.exists()) {
            const oldData = snapshot.val();
            let currentCash = oldData.cash;

            // Penalty Rule: Losing 50k if switching FROM Businessman
            if (oldData.role === 'businessman' && newRole !== 'businessman') {
                currentCash -= 50000;
            }

            // Update user but KEEP their cash (unless penalized)
            const updatedData = {
                role: newRole,
                special_id: newSpecialID,
                cash: currentCash, // Preserves cash
                username: username
            };

            await update(userRef, updatedData);
            return updatedData;
        } 
        
        // B. NEW USER (First Time)
        else {
            let startingCash = 10000;
            if (newRole === 'businessman') startingCash = 50000;

            const newUser = {
                username: username,
                role: newRole,
                cash: startingCash,
                special_id: newSpecialID,
                last_income: Date.now(),
                cases_solved: 0,
                total_stolen: 0,
                investment_profit: 0,
                jail_count: 0,
                robbery_history: {}
            };
            await set(userRef, newUser);
            return newUser;
        }
    },

    // --- 4. DISPLAY HELPERS ---
    fmt(amount) {
        return `$${Math.floor(amount).toLocaleString()}`;
    },

    maskID(id, role) {
        if (!id) return 'Unknown';
        // Businessman: 6 digits (Show 3, Hide 3) -> 123???
        if (role === 'businessman') return `${id.substring(0, 3)}???`; 
        // Others: 3 digits (Show 2, Hide 1) -> 12?
        return `${id.substring(0, 2)}?`; 
    },
    
    getNewID(role) {
        return generateID(role === 'businessman' ? 6 : 3);
    }
};

module.exports = userManager;
