const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');
const Config = require('./config');

// Initialize Firebase
const app = initializeApp(Config.firebaseConfig);
const db = getDatabase(app);

const UM = {
    db: db,

    // 1. Get All Users
    async getAllUsers() {
        const snapshot = await get(ref(db, 'users'));
        return snapshot.exists() ? snapshot.val() : {};
    },

    // 2. Format Money (e.g. $1,000)
    fmt(amount) {
        return `$${amount.toLocaleString()}`;
    },

    // 3. Mask ID (e.g. Emily***)
    maskID(special_id, role) {
        if (!special_id) return 'Unknown';
        if (role === 'police') return 'Officer'; // Police show rank/title instead
        if (role === 'robber') return 'Masked';  // Robbers are hidden
        
        // Default: Show first 3 chars + stars
        const str = String(special_id);
        if (str.length <= 3) return str;
        return str.substring(0, 3) + '***';
    },

    // 4. Generate News Engine
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

        const category = stories[type];
        return category ? category[Math.floor(Math.random() * category.length)] : "Breaking News in Sector 7...";
    }
};

module.exports = UM;
