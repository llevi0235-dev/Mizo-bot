const { ref, get, update } = require('firebase/database');
const db = require('./database');
const Config = require('./config');
const Reporter = require('./city_reporter'); // Ensure this matches your filename

module.exports = async (message, user, content) => {
    // Helper Formatter
    const fmt = (n) => `$${(n || 0).toLocaleString()}`;

    // --- /tg (Target Selection) ---
    if (content.startsWith('/tg')) {
        const snapshot = await get(ref(db, 'users'));
        const allUsers = snapshot.val() || {};
        
        const victims = Object.values(allUsers)
            .filter(u => u.role !== 'robber' && u.role !== 'prisoner' && (u.cash || 0) >= 100);

        if (victims.length === 0) return message.reply("🏙️ The streets are empty. No one worth robbing.");

        const target = victims[Math.floor(Math.random() * victims.length)];
        // Masking ID: citizen-123456 or businessman-123456
        const maskedID = `${target.role || 'citizen'}-${target.id || '???'}`;
        
        return message.reply(`🎯 **TARGET SPOTTED:** Someone with ID **${maskedID}** looks wealthy.`);
    }

    // --- /rob (The Heist) ---
    const m = content.match(/^\/rob\s*(\d+)$/);
    if (!m) return;

    const guess = m[1];
    const snapshot = await get(ref(db, 'users'));
    const allUsers = snapshot.val() || {};
    
    let targetUid = null;
    let targetData = null;

    for (const [uid, u] of Object.entries(allUsers)) {
        if (String(u.id) === guess && u.role !== 'robber' && u.role !== 'prisoner') {
            targetUid = uid;
            targetData = u;
            break;
        }
    }

    if (!targetData) return message.reply("❌ **FAILED:** You missed. That ID isn't here.");
    
    const targetCash = targetData.cash || 0;
    if (targetCash < 100) return message.reply("🤏 They're too poor. Find a bigger fish.");

    // Logic: Steal 5% to 15% of their cash
    const stealPercent = (Math.floor(Math.random() * 11) + 5) / 100;
    const stolen = Math.floor(targetCash * stealPercent);

    // Update Victim
    await update(ref(db, `users/${targetUid}`), { cash: targetCash - stolen });

    // Update Robber
    await update(ref(db, `users/${message.author.id}`), { 
        cash: (user.cash || 0) + stolen,
        total_stolen: (user.total_stolen || 0) + stolen 
    });

    // Log to Crime Feed
    try {
        await Reporter.logRobbery(message.client, user, targetData, stolen);
    } catch (e) {
        console.log("Crime reporter failed, but heist processed.");
    }

    return message.reply(`💰 **SUCCESS!** You made off with **${fmt(stolen)}**.`);
};
