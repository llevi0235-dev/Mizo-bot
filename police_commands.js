const { ref, update } = require('firebase/database');
const db = require('./database');
const UM = require('./userManager');
const PoliceLogic = require('./police_logic');
const Reporter = require('./reporter');

module.exports = async (message, user, content) => {
    const m = content.match(/^\/arrest\s*(\d+)$/);
    if (!m) return;

    const guess = m[1];
    const allUsers = await UM.getAllUsers();
    let targetId = null, targetData = null;

    // Search for the robber with that ID
    for (const [uid, u] of Object.entries(allUsers)) {
        if (String(u.special_id) === guess && u.role === 'robber') {
            targetId = uid;
            targetData = u;
            break;
        }
    }

    if (!targetData) {
        return message.reply("❌ **Case Failed:** No robber found with that ID in the vicinity.");
    }

    // Success Logic
    const reward = PoliceLogic.calculateArrestReward();
    const releaseTime = Date.now() + (10 * 60 * 1000); // 10 minutes

    // 1. Jail the robber
    await update(ref(db, `users/${targetId}`), {
        role: 'prisoner',
        release_time: releaseTime,
        special_id: null
    });

    // 2. Reward the officer and INCREMENT their cases (The Fix!)
    const currentCases = user.cases || 0;
    await update(ref(db, `users/${message.author.id}`), {
        cash: (user.cash || 0) + reward,
        cases: currentCases + 1
    });

    // 3. Log to Police Records
    await Reporter.logArrest(message.client, user, targetData, guess);

    return message.reply(`🚓 **CASE CLOSED:** You arrested **${targetData.username}**. Earned **${UM.fmt(reward)}** and +1 Case File.`);
};
