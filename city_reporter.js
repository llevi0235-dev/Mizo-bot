const Config = require('./config');
const UM = require('./userManager');

module.exports = {
    async logRobbery(client, robber, victim, amount) {
        const channel = await client.channels.fetch(Config.CHANNELS.CRIME_FEED);
        if (!channel) return;
        
        const maskedID = UM.maskID(robber.special_id, 'robber');
        await channel.send(`🚨 **CRIME ALERT:** A robbery occurred! **${maskedID}** stole **${UM.fmt(amount)}** from **${victim.username}**.`);
    },

    async logArrest(client, officer, robber, idUsed) {
        const channel = await client.channels.fetch(Config.CHANNELS.NEWS);
        if (!channel) return;

        await channel.send(`📰 **CITY NEWS:** Officer **${officer.username}** has successfully apprehended suspect **${idUsed}**. The streets are safer today.`);
    }
};
