const { ref, get, update } = require('firebase/database');
const db = require('./database');
const Config = require('./config');
const Reporter = require('./city_reporter'); // Check if your file is 'city_reporter.js'

module.exports = async (message, user, content) => {
    const m = content.match(/^\/arrest\s*(\d+)$/);
    if (!m) return;

    const guess = m[1];
    
    // 1. Fetch all users directly from Firebase (No UM)
    const snapshot = await get(ref(db, 'users'));
    const allUsers = snapshot.val() || {};
    
    let targetUid = null;
    let targetData = null;

    // 2. Search for the robber with that 3-digit ID
    for (const [uid, u] of Object.entries(allUsers)) {
        if (String(u.id) === guess && u.role === 'robber') {
            targetUid = uid;
            targetData = u;
            break;
        }
    }

    if (!targetData) {
        return message.reply("❌ **Case Failed:** No robber found with that ID in the vicinity.");
    }

    // 3. Success Logic (Internalized reward calculation)
    const reward = Math.floor(Math.random() * (1500 - 800 + 1)) + 800; // Random $800-$1500
    const releaseTime = Date.now() + (10 * 60 * 1000); // 10 minutes
    const fmt = (n) => `$${(n || 0).toLocaleString()}`;

    // 4. Jail the robber
    await update(ref(db, `users/${targetUid}`), {
        role: 'prisoner',
        release_time: releaseTime,
        id: null // Clear their criminal ID
    });

    // 5. Reward the officer and update stats
    const currentCases = user.cases || 0;
    await update(ref(db, `users/${message.author.id}`), {
        cash: (user.cash || 0) + reward,
        cases: currentCases + 1
    });

    // 6. Log to News Feed
    try {
        await Reporter.logArrest(message.client, user, targetData, guess);
    } catch (e) {
        console.log("Reporter log failed, but arrest processed.");
    }

    return message.reply(`🚓 **CASE CLOSED:** You arrested **${targetData.username || 'the suspect'}**. Earned **${fmt(reward)}** and +1 Case File.`);
};
