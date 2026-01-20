const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ref, get } = require('firebase/database');
const db = require('./database');
const Config = require('./config');

const refreshButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId('refresh_loot_leaderboard')
        .setLabel('Refresh Most Wanted')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Danger)
);

module.exports = {
    async update(client) {
        try {
            const channel = await client.channels.fetch(Config.CHANNELS.ROBBER_LEADERBOARD);
            if (!channel) return;

            // 1. Fetch directly from Firebase
            const snapshot = await get(ref(db, 'users'));
            const users = snapshot.val() || {};
            
            // 2. Local Formatter
            const fmt = (n) => `$${(n || 0).toLocaleString()}`;

            // 3. Filter and Sort
            const robbers = Object.values(users)
                .filter(u => (u.total_stolen || 0) > 0)
                .sort((a, b) => (b.total_stolen || 0) - (a.total_stolen || 0))
                .slice(0, 10);

            let content = `🕶️ **SECTOR 7: LOOT LEADERBOARD**\n*Ranked by total career theft*\n\n`;

            if (robbers.length === 0) {
                content += "The underworld is quiet. No major heists recorded.";
            } else {
                robbers.forEach((u, i) => {
                    const icon = i === 0 ? '💀' : '👥';
                    content += `${icon} **${u.username || 'Unknown'}** — ${fmt(u.total_stolen)} stolen\n`;
                });
            }

            content += `\n🕒 Last Sync: <t:${Math.floor(Date.now() / 1000)}:R>`;

            // 4. Update Message
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMsg = messages.find(m => m.author.id === client.user.id);

            if (botMsg) {
                await botMsg.edit({ content, components: [refreshButton] });
            } else {
                await channel.send({ content, components: [refreshButton] });
            }
        } catch (err) {
            console.error("Robber Leaderboard Error:", err);
        }
    }
};
