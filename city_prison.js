const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ref, get, update } = require('firebase/database');
const db = require('./database');
const Config = require('./config');

const refreshButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId('refresh_jail_timer')
        .setLabel('Refresh Roster')
        .setEmoji('⏱️')
        .setStyle(ButtonStyle.Danger)
);

module.exports = {
    async updateRoster(client) {
        try {
            const channel = await client.channels.fetch(Config.CHANNELS.PRISON_LOGS);
            if (!channel) return;

            // 1. Fetch directly from Firebase
            const snapshot = await get(ref(db, 'users'));
            const users = snapshot.val() || {};

            const prisoners = Object.values(users)
                .filter(u => u.role === 'prisoner')
                .sort((a, b) => (a.release_time || 0) - (b.release_time || 0));

            let content = `🔒 **SECTOR 7 PRISON ROSTER**\n\n`;
            if (prisoners.length === 0) {
                content += "✅ **The jail cells are currently empty.**";
            } else {
                prisoners.forEach((p, i) => {
                    const timeLeft = Math.max(0, Math.floor(((p.release_time || 0) - Date.now()) / 60000));
                    content += `${i + 1}. **${p.username || 'Inmate'}** — ⏳ ${timeLeft}m remaining\n`;
                });
            }

            const messages = await channel.messages.fetch({ limit: 10 });
            const botMsg = messages.find(m => m.author.id === client.user.id);
            if (botMsg) await botMsg.edit({ content, components: [refreshButton] });
            else await channel.send({ content, components: [refreshButton] });
        } catch (err) {
            console.error("Prison Roster Error:", err);
        }
    },

    async watchReleases(client) {
        setInterval(async () => {
            try {
                // 2. Fetch directly from Firebase
                const snapshot = await get(ref(db, 'users'));
                const users = snapshot.val() || {};
                const now = Date.now();

                for (const [uid, u] of Object.entries(users)) {
                    if (u.role === 'prisoner' && u.release_time && u.release_time <= now) {
                        // Release them back as a robber
                        await update(ref(db, `users/${uid}`), {
                            role: 'robber',
                            release_time: null,
                            id: Math.floor(100 + Math.random() * 899).toString() // Assign new 3-digit ID
                        });
                        
                        try {
                            const discordUser = await client.users.fetch(uid);
                            await discordUser.send("🔓 **RELEASED:** You have served your time. Your identity has been reset.");
                        } catch (e) {}
                    }
                }
            } catch (err) {
                console.error("Prison Release Loop Error:", err);
            }
        }, 60000); // Check every minute
    }
};
