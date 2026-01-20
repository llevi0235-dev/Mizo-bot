const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ref, get } = require('firebase/database');
const db = require('./database');
const Config = require('./config');

const refreshButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId('refresh_main_leaderboard')
        .setLabel('Refresh Wealthiest')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary)
);

module.exports = {
    async update(client) {
        try {
            const channel = await client.channels.fetch(Config.CHANNELS.MAIN_LEADERBOARD);
            if (!channel) return;

            // 1. Fetch all users directly from Firebase
            const snapshot = await get(ref(db, 'users'));
            const users = snapshot.val() || {};
            
            // 2. Local Formatter (replaces UM.fmt)
            const fmt = (n) => `$${(n || 0).toLocaleString()}`;

            // 3. Sort: All users by cash (Highest first)
            const topWealth = Object.values(users)
                .sort((a, b) => (b.cash || 0) - (a.cash || 0))
                .slice(0, 10);

            let content = `🏆 **SECTOR 7: WEALTHIEST CITIZENS**\n*Total city-wide ranking*\n\n`;

            if (topWealth.length === 0) {
                content += "No citizens registered in the database yet.";
            } else {
                topWealth.forEach((u, i) => {
                    const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '💰';
                    content += `${medal} **${u.username || 'Unknown'}** — ${fmt(u.cash)}\n`;
                });
            }

            content += `\n🕒 Last Sync: <t:${Math.floor(Date.now() / 1000)}:R>`;

            // 4. Update or Send the message
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMsg = messages.find(m => m.author.id === client.user.id);

            if (botMsg) {
                await botMsg.edit({ content, components: [refreshButton] });
            } else {
                await channel.send({ content, components: [refreshButton] });
            }
        } catch (err) {
            console.error("Main Leaderboard Error:", err);
        }
    }
};
