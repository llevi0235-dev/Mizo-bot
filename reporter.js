const Config = require('./config');
const UM = require('./userManager');

module.exports = {
    
    // 1. CRIME FEED (Robbery)
    async logRobbery(client, robber, target, amount, isExact) {
        const channel = client.channels.cache.get(Config.CHANNELS.CRIME_FEEDS);
        if (!channel) return;

        // "12????" Logic
        const idStr = String(robber.special_id);
        const visiblePart = idStr.substring(0, 2); 
        const maskedID = `${visiblePart}????`;

        const msg = `🚨 **ROBBERY!** ${robber.username} (${maskedID} Last Digits hidden..) robbed ${target.username} for ${UM.fmt(amount)}!`;
        
        await channel.send(msg);
    },

    // 2. SECTOR 7 NEWS (Global News)
    async postNews(client, type, actorName, targetName, amountStr) {
        const channel = client.channels.cache.get(Config.CHANNELS.SECTOR7_NEWS);
        if (!channel) return;

        const story = UM.generateNews(type, actorName, targetName, amountStr);
        await channel.send(story);
    },

    // 3. POLICE RECORD ROOM (Arrests)
    async logArrest(client, officer, robber, guess) {
        const channel = client.channels.cache.get(Config.CHANNELS.RECORD_ROOM);
        if (!channel) return;

        const msg = `📋 **POLICE INFORMATION**\n\nOfficer **${officer.username}** successfully solved the case and arrested **${robber.username}** (ID: ${guess}).\n\n*Case Status: Closed & Recorded.*`;
        await channel.send(msg);
    },

    // 4. JAIL FEED
    async logJail(client, prisonerName, timeString) {
        const channel = client.channels.cache.get(Config.CHANNELS.PRISON_JAIL);
        if (!channel) return;

        await channel.send(`🔒 **${prisonerName}** has been processed into Maximum Security.\n**Sentence:** ${timeString}`);
    }
};
