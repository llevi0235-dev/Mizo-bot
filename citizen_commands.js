const UM = require('./userManager');

module.exports = async (message, user, content) => {
    // --- /b (Balance Check) ---
    if (content === '/b' || content === '/bal') {
        const maskedID = UM.maskID(user.special_id, user.role);
        return message.reply(`💳 **ID: ${maskedID}**\n💰 **Balance:** ${UM.fmt(user.cash || 0)}`);
    }

    // You can add more general commands here later, like /profile
};
