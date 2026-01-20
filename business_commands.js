const { ref, update } = require('firebase/database');
const db = require('./database');
const UM = require('./userManager');
const BusinessLogic = require('./business_logic');

module.exports = async (message, user, content) => {
    // Check for /invest [amount]
    const m = content.match(/^\/invest\s*(\d+)$/);
    if (!m) return;

    const amount = parseInt(m[1]);

    if (isNaN(amount) || amount <= 0) {
        return message.reply("❌ **Invalid Amount:** How much do you want to invest?");
    }

    if ((user.cash || 0) < amount) {
        return message.reply("❌ **Insufficient Funds:** Your corporate account doesn't have enough liquid capital.");
    }

    // Use logic to determine outcome
    const result = BusinessLogic.processInvestment(amount);
    const newBalance = (user.cash || 0) + result.change;

    await update(ref(db, `users/${message.author.id}`), {
        cash: newBalance
    });

    if (result.success) {
        return message.reply(`📈 **INVESTMENT SUCCESS:** Your venture paid off! You earned **${UM.fmt(result.change)}**.\nNew Balance: **${UM.fmt(newBalance)}**`);
    } else {
        return message.reply(`📉 **MARKET CRASH:** The investment failed. You lost **${UM.fmt(Math.abs(result.change))}**.\nNew Balance: **${UM.fmt(newBalance)}**`);
    }
};
