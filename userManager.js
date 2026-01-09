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
        // --- ADD JAIL RECORD ---
    async addJailRecord(userId, officerName) {
        const recordID = Date.now(); // Use timestamp as a unique ID for this specific arrest
        const newRecord = {
            date: new Date().toLocaleString(),
            reason: "Robbery", // Default reason
            duration: 10, // 10 minutes
            officer: officerName
        };
        // Save to database under 'jail_history'
        await set(ref(db, `users/${userId}/jail_history/${recordID}`), newRecord);
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
    // --- NEWS REPORTER ENGINE ---
    generateNews(type, actor, target, amountOrRank) {
        const stories = {
            'promotion': [
                `🎙️ **SECTOR 7 EVENING NEWS**\n\nWe interrupt your daily broadcast for a moment of celebration. In a city often plagued by shadows, it is the shining stars of our Police Force that give us hope.\n\nToday, the department has recognized the tireless efforts of **${actor}**. Through dedication, late nights, and an unwavering commitment to justice, they have risen through the ranks.\n\nCitizens, please join us in congratulating our newest **${amountOrRank}**. Authority has been granted. The badge shines brighter today.`,
                
                `📻 **THE DAILY DISPATCH**\n\n"Discipline. Honor. Courage." These aren't just words; they are the code our officers live by. Today, one officer embodied them all.\n\n**${actor}** has officially been promoted to **${amountOrRank}**. Sources inside the station say this promotion was long overdue, citing a record of excellence that has set a new standard for rookies to follow.\n\nA toast to you, officer. Sector 7 sleeps safer tonight knowing you are on watch.`
            ],
            'robbery': [
                `🛑 **BREAKING NEWS: DAYLIGHT HEIST**\n\nChaos erupted in District 4 today as a brazen robbery left citizens shaken. Reports confirm that **${actor}** (ID: Masked) intercepted **${target}** in what police are calling a "calculated strike."\n\nWitnesses describe a tense scene near the Industrial Zone. The suspect, moving with alarming speed, managed to bypass security measures and extract **${amountOrRank}** before vanishing into the alleyways.\n\n"It happened so fast," said one bystander. "One minute it was quiet, the next, wallets were gone."\n\nLocal authorities are urging extreme caution. Lock your doors. Watch your sectors. The criminal element is getting bolder.`,
                
                `⚠️ **CRIME WATCH ALERT**\n\nA substantial theft has just occurred. **${target}** has fallen victim to a high-stakes robbery orchestrated by **${actor}** (ID: Masked).\n\nThe incident took place near the Trade Center. Despite the high foot traffic, the perpetrator managed to seize **${amountOrRank}** and evade capture. Sirens were heard moments later, but the trail had already gone cold.\n\nThis marks a significant escalation in street crime. Sector 7 Security advises all wealthy citizens to avoid unlit routes and carry minimal cash until this suspect is apprehended.`
            ],
            'arrest': [
                `⚖️ **JUSTICE SERVED: THE TAKEDOWN**\n\nThe streets are a little quieter tonight. In a dramatic turn of events, the notorious **${target}** (ID: Masked) has finally been brought to justice.\n\nThe operation was led by **${actor}**, who tracked the suspect across three sectors before making the arrest. Details are still emerging, but we understand a high-speed pursuit ended near the Old Sewers, where the officer successfully subdued the criminal without civilian casualties.\n\n"This sends a message," the Commissioner stated. "You cannot hide from the law."\n\nWe extend our deepest gratitude to **${actor}** for their bravery. Another predator is behind bars.`,
                
                `🚓 **SECTOR 7 CRIME BEAT**\n\nGotcha! A major arrest has been confirmed. **${target}** (ID: Masked), wanted for multiple financial crimes, is now in custody thanks to the sharp instincts of **${actor}**.\n\nThe investigation had been ongoing for weeks. Using advanced surveillance and old-fashioned detective work, the officer cornered the suspect in a dead-end alley. Despite an attempt to flee, the handcuffs were slapped on, and the suspect is now en route to the Maximum Security Wing.\n\nExcellent work, Officer **${actor}**. The city owes you a debt of gratitude.`
            ]
        };

        // Pick a random story
        const category = stories[type];
        const randomStory = category[Math.floor(Math.random() * category.length)];
        return randomStory;
    }

module.exports = userManager;
