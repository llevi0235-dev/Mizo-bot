const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UM = require('./userManager');
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
        const channel = await client.channels.fetch(Config.CHANNELS.ROBBER_LEADERBOARD);
        if (!channel) return;

        const users = await UM.getAllUsers();
        const robbers = Object.values(users)
            .filter(u => u.total_stolen > 0)
            .sort((a, b) => b.total_stolen - a.total_stolen)
            .slice(0, 10);

        let content = `🕶️ **SECTOR 7: LOOT LEADERBOARD**\n*Ranked by total career theft*\n\n`;

        if (robbers.length === 0) {
            content += "The underworld is quiet. No major heists recorded.";
        } else {
            robbers.forEach((u, i) => {
                content += `${i + 1}. **${u.username}** — ${UM.fmt(u.total_stolen)} stolen\n`;
            });
        }

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
