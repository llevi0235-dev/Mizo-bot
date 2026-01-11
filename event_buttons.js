const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionsBitField
} = require('discord.js');

const Config = require('./config');
const UM = require('./userManager');

// 🔄 Reusable refresh button
const refreshRow = (id) =>
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(id)
            .setLabel('Refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary)
    );

module.exports = (client) => {

    // ===============================
    // 🚀 POST LEADERBOARDS ON STARTUP
    // ===============================
    client.once('ready', async () => {
        try {
            const main = await client.channels.fetch(Config.CHANNELS.LEADERBOARD_MAIN);
            if (main) {
                await main.send({
                    content: '🏆 **MAIN LEADERBOARD**\n\nClick 🔄 to refresh.',
                    components: [refreshRow('refresh_main_leaderboard')]
                });
            }

            const police = await client.channels.fetch(Config.CHANNELS.TOP_OFFICERS);
            if (police) {
                await police.send({
                    content: '👮 **TOP OFFICERS**\n\nClick 🔄 to refresh.',
                    components: [refreshRow('refresh_top_officers')]
                });
            }

            const loot = await client.channels.fetch(Config.CHANNELS.LOOT_LEADERBOARD);
            if (loot) {
                await loot.send({
                    content: '🕶️ **TOP ROBBERS**\n\nClick 🔄 to refresh.',
                    components: [refreshRow('refresh_loot_leaderboard')]
                });
            }

            const invest = await client.channels.fetch(Config.CHANNELS.TOP_INVESTORS);
            if (invest) {
                await invest.send({
                    content: '💼 **TOP INVESTORS**\n\nClick 🔄 to refresh.',
                    components: [refreshRow('refresh_top_investors')]
                });
            }
        } catch (e) {
            console.error('Leaderboard startup error:', e);
        }
    });

    // ===============================
    // 🎛️ BUTTON INTERACTIONS
    // ===============================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        await interaction.deferUpdate();

        const users = await UM.getAllUsers();
        const now = Math.floor(Date.now() / 1000);

        // 🏆 MAIN LEADERBOARD
        if (interaction.customId === 'refresh_main_leaderboard') {
            const richest = Object.values(users)
                .sort((a, b) => (b.cash || 0) - (a.cash || 0))
                .slice(0, 5);

            const officers = Object.values(users)
                .filter(u => u.role === 'police')
                .sort((a, b) => (b.cases || 0) - (a.cases || 0))
                .slice(0, 5);

            let content = `🏆 **MAIN LEADERBOARD**\n\n💰 **Richest Players**\n`;
            richest.forEach((u, i) => content += `${i + 1}. ${u.username}\n`);

            content += `\n👮 **Top Officers**\n`;
            officers.forEach((u, i) => content += `${i + 1}. ${u.username} — ${u.cases || 0} cases\n`);

            content += `\n🕒 Updated: <t:${now}:R>`;

            return interaction.message.edit({
                content,
                components: [refreshRow('refresh_main_leaderboard')]
            });
        }

        // 👮 TOP OFFICERS
        if (interaction.customId === 'refresh_top_officers') {
            const officers = Object.values(users)
                .filter(u => u.role === 'police')
                .sort((a, b) => (b.cases || 0) - (a.cases || 0))
                .slice(0, 10);

            let content = `👮 **TOP OFFICERS**\n\n`;
            officers.forEach((u, i) => content += `${i + 1}. ${u.username} — ${u.cases || 0} cases\n`);
            content += `\n🕒 Updated: <t:${now}:R>`;

            return interaction.message.edit({
                content,
                components: [refreshRow('refresh_top_officers')]
            });
        }

        // 🕶️ TOP ROBBERS
        if (interaction.customId === 'refresh_loot_leaderboard') {
            const robbers = Object.values(users)
                .filter(u => u.role === 'robber')
                .sort((a, b) => (b.total_stolen || 0) - (a.total_stolen || 0))
                .slice(0, 10);

            let content = `🕶️ **TOP ROBBERS**\n\n`;
            robbers.forEach((u, i) => content += `${i + 1}. ${u.username}\n`);
            content += `\n🕒 Updated: <t:${now}:R>`;

            return interaction.message.edit({
                content,
                components: [refreshRow('refresh_loot_leaderboard')]
            });
        }

        // 💼 TOP INVESTORS
        if (interaction.customId === 'refresh_top_investors') {
            const investors = Object.values(users)
                .filter(u => u.role === 'businessman')
                .sort((a, b) => (b.cash || 0) - (a.cash || 0))
                .slice(0, 10);

            let content = `💼 **TOP INVESTORS**\n\n`;
            investors.forEach((u, i) => content += `${i + 1}. ${u.username}\n`);
            content += `\n🕒 Updated: <t:${now}:R>`;

            return interaction.message.edit({
                content,
                components: [refreshRow('refresh_top_investors')]
            });
        }
    });
};