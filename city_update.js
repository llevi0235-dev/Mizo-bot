const Config = require('./config');

module.exports = async (client) => {
    try {
        const channel = await client.channels.fetch(Config.CHANNELS.NEWS);
        if (channel) {
            await channel.send("📡 **SYSTEM:** Sector 7 Global Feed Synchronized.");
        }
    } catch (err) {
        console.error("News Feed Error: Check your Config ID for NEWS");
    }
};
