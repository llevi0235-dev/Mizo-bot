const { EmbedBuilder } = require('discord.js');
const Config = require('./config');

module.exports = async (client) => {
    const channel = await client.channels.fetch(Config.CHANNELS.NEWS);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('🏙️ Sector 7: Modular Systems Live')
        .setDescription('The city has been reorganized into specialized districts (Police, Robber, Citizen, Business). All systems are now more stable and leaderboards are 100% accurate.')
        .setColor(0x2F80ED)
        .setTimestamp();

    await channel.send({ embeds: [embed] });
};
