const { ref, update } = require('firebase/database');
const db = require('./database');
const BusinessLogic = require('./business_logic');

module.exports = async (message, user, content) => {
    const m = content.match(/^\/invest\s*(\d+)$/);
    if (!m) return;

    const amount = parseInt(m[1]);
    const fmt = (n) => `$${Math.abs(n).toLocaleString()}`;

    if (isNaN(amount) || amount <= 0) return message.reply("❌ Use: `/invest [amount]`");
    if ((user.cash || 0) < amount) return message.reply("❌ Insufficient funds.");

    const result = BusinessLogic.processInvestment(amount);
    const newBalance = (user.cash || 0) + result.change;

    await update(ref(db, `users/${message.author.id}`), { cash: newBalance });

    if (result.success) {
        return message.reply(`📈 **PROFIT:** You made **${fmt(result.change)}**! Total: **${fmt(newBalance)}**`);
    } else {
        return message.reply(`📉 **LOSS:** You lost **${fmt(result.change)}**. Total: **${fmt(newBalance)}**`);
    }
};
