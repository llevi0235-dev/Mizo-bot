const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UM = require('./userManager');
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
        const channel = await client.channels.fetch(Config.CHANNELS.MAIN_LEADERBOARD);
        if (!channel) return;

        const users = await UM.getAllUsers();
        
        // Sort: All users by cash (Highest first)
        const topWealth = Object.values(users)
            .sort((a, b) => (b.cash || 0) - (a.cash || 0))
            .slice(0, 10);

        let content = `🏆 **SECTOR 7: WEALTHIEST CITIZENS**\n*Total city-wide ranking*\n\n`;

        topWealth.forEach((u, i) => {
            const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '💰';
            content += `${medal} **${u.username}** — ${UM.fmt(u.cash || 0)}\n`;
        });

        content += `\n🕒 Last Sync: <t:${Math.floor(Date.now() / 1000)}:R>`;

        const messages = await channel.messages.fetch({ limit: 10 });
        const botMsg = messages.find(m => m.author.id === client.user.id);

        if (botMsg) {
            await botMsg.edit({ content, components: [refreshButton] });
        } else {
            await channel.send({ content, components: [refreshButton] });
        }
    }
};
