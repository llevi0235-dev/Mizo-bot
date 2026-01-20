const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UM = require('./userManager');
const Config = require('./config');

const refreshButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId('refresh_top_investors')
        .setLabel('Refresh Market')
        .setEmoji('📈')
        .setStyle(ButtonStyle.Success)
);

module.exports = {
    async update(client) {
        const channel = await client.channels.fetch(Config.CHANNELS.BUSINESS_LEADERBOARD);
        if (!channel) return;

        const users = await UM.getAllUsers();
        
        // Filter: Only Businessmen. Sort: By Cash (Highest first)
        const investors = Object.values(users)
            .filter(u => u.role === 'businessman')
            .sort((a, b) => (b.cash || 0) - (a.cash || 0))
            .slice(0, 10);

        let content = `💼 **SECTOR 7: TOP INVESTORS**\n*Ranked by current liquid capital*\n\n`;

        if (investors.length === 0) {
            content += "No active business accounts found in the registry.";
        } else {
            investors.forEach((u, i) => {
                const icon = i === 0 ? '💰' : '💵';
                content += `${icon} **${u.username}** — ${UM.fmt(u.cash || 0)}\n`;
            });
        }

        content += `\n🕒 Last Market Update: <t:${Math.floor(Date.now() / 1000)}:R>`;

        const messages = await channel.messages.fetch({ limit: 10 });
        const botMsg = messages.find(m => m.author.id === client.user.id);

        if (botMsg) {
            await botMsg.edit({ content, components: [refreshButton] });
        } else {
            await channel.send({ content, components: [refreshButton] });
        }
    }
};
