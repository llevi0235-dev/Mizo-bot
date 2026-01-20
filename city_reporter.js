const Config = require('./config');

module.exports = {
    async logRobbery(client, robber, victim, amount) {
        const channel = await client.channels.fetch(Config.CHANNELS.CRIME_FEED);
        if (!channel) return;
        
        // Formatter: 1000 -> $1,000
        const fmt = (n) => `$${(n || 0).toLocaleString()}`;
        
        // Simple Mask: Takes the 3-digit ID and prefixes it
        const maskedID = `robber-${robber.id || '??? '}`;
        
        await channel.send(`🚨 **CRIME ALERT:** A robbery occurred! **${maskedID}** stole **${fmt(amount)}** from **${victim.username || 'a citizen'}**.`);
    },

    async logArrest(client, officer, robber, idUsed) {
        const channel = await client.channels.fetch(Config.CHANNELS.NEWS);
        if (!channel) return;

        await channel.send(`📰 **CITY NEWS:** Officer **${officer.username}** has successfully apprehended suspect **${idUsed}**. The streets are safer today.`);
    }
};
