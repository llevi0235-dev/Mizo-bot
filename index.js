const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Config = require('./config');
const keepAlive = require('./keep_alive');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message]
});

async function setupImmigration() {
    const channel = client.channels.cache.get(Config.CHANNELS.GET_ID_CARD);
    if (!channel) return;
    const messages = await channel.messages.fetch({ limit: 5 });
    if (!messages.find(m => m.author.id === client.user.id)) {
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('create_ticket').setLabel('🪪 GET ID CARD').setStyle(ButtonStyle.Primary));
        const embed = new EmbedBuilder().setTitle("Welcome").setDescription("Click below.").setColor(0x0099FF);
        await channel.send({ embeds: [embed], components: [row] });
    }
}

client.once('ready', () => { 
    console.log("Sector 7 Online"); 
    setupImmigration();
    
    // IMPORT ALL MODULES
    require('./gameLoops')(client);   // Money and Jail Timers
    require('./event_buttons')(client); // Button Clicks
    require('./event_chat')(client);    // Commands (/rob, /arrest, etc)
});

keepAlive();
client.login(Config.DISCORD_TOKEN);
