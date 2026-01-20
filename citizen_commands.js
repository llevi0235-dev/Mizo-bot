const { ref, get } = require('firebase/database');
const db = require('./database');

module.exports = async (message, user, content) => {
    const fmt = (n) => `$${(n || 0).toLocaleString()}`;

    if (content === '/bal' || content === '/b') {
        return message.reply({
            content: `💳 **ID CARD: #${user.id || '000000'}**\n👤 **User:** <@${message.author.id}>\n💰 **Cash:** ${fmt(user.cash)}\n💼 **Role:** ${user.role.toUpperCase()}`
        });
    }
};
