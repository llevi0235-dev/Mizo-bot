const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ref, get } = require('firebase/database');
const db = require('./database');
const Config = require('./config');

const refreshButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId('refresh_police_leaderboard')
        .setLabel('Refresh Ranks')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary)
);

module.exports = {
    async update(client) {
        try {
            const channel = await client.channels.fetch(Config.CHANNELS.POLICE_LEADERBOARD);
            if (!channel) return;

            // 1. Fetch directly from Firebase
            const snapshot = await get(ref(db, 'users'));
            const users = snapshot.val() || {};

            // 2. Filter: Only Police. Sort: By Cases (Highest first)
            const officers = Object.values(users)
                .filter(u => u.role === 'police')
                .sort((a, b) => (b.cases || 0) - (a.cases || 0))
                .slice(0, 10);

            let content = `👮 **SECTOR 7: TOP OFFICERS**\n*Ranked by successful arrests*\n\n`;

            if (officers.length === 0) {
                content += "No active duty officers recorded.";
            } else {
                officers.forEach((u, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🔹';
                    content += `${medal} **${u.username || 'Officer'}** — ${u.cases || 0} Cases Solved\n`;
                });
            }

            content += `\n🕒 Last Sync: <t:${Math.floor(Date.now() / 1000)}:R>`;

            // 3. Edit existing or send new message
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMsg = messages.find(m => m.author.id === client.user.id);

            if (botMsg) {
                await botMsg.edit({ content, components: [refreshButton] });
            } else {
                await channel.send({ content, components: [refreshButton] });
            }
        } catch (err) {
            console.error("Police Leaderboard Error:", err);
        }
    }
};
