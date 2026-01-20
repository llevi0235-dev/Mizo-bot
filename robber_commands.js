const { ref, update } = require('firebase/database');
const db = require('./database');
const UM = require('./userManager');
const RobberLogic = require('./robber_logic');
const Reporter = require('./reporter');

module.exports = async (message, user, content) => {
    // --- /tg (Target Selection) ---
    if (content.startsWith('/tg')) {
        const allUsers = await UM.getAllUsers();
        const victims = Object.values(allUsers)
            .filter(u => u.role !== 'robber' && u.role !== 'prisoner' && u.cash >= 100);

        if (victims.length === 0) return message.reply("🏙️ The streets are empty. No one worth robbing.");

        const target = victims[Math.floor(Math.random() * victims.length)];
        const maskedID = UM.maskID(target.special_id, target.role);
        return message.reply(`🎯 **TARGET SPOTTED:** Someone with ID **${maskedID}** looks wealthy.`);
    }

    // --- /rob (The Heist) ---
    const m = content.match(/^\/rob\s*(\d+)$/);
    if (!m) return;

    const guess = m[1];
    const allUsers = await UM.getAllUsers();
    let targetId = null, targetData = null;

    for (const [uid, u] of Object.entries(allUsers)) {
        if (String(u.special_id) === guess && u.role !== 'robber') {
            targetId = uid; targetData = u; break;
        }
    }

    if (!targetData) return message.reply("❌ **FAILED:** You missed. That ID isn't here.");
    if (!RobberLogic.isWorthIt(targetData.cash)) return message.reply("🤏 They're too poor. Find a bigger fish.");

    const stolen = RobberLogic.calculateStealAmount(targetData.cash);

    // Update Victim
    await update(ref(db, `users/${targetId}`), { cash: targetData.cash - stolen });

    // Update Robber (Fix: Adding total_stolen)
    await update(ref(db, `users/${message.author.id}`), { 
        cash: (user.cash || 0) + stolen,
        total_stolen: (user.total_stolen || 0) + stolen 
    });

    await Reporter.logRobbery(message.client, user, targetData, stolen);
    return message.reply(`💰 **SUCCESS!** You made off with **${UM.fmt(stolen)}**.`);
};
