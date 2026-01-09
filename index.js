const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Config = require('./config');
const keepAlive = require('./keep_alive'); // 👇 Imports your separate file

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

// --- SETUP IMMIGRATION MESSAGE ---
async function setupImmigration() {
    const channel = client.channels.cache.get(Config.CHANNELS.GET_ID_CARD);
    if (!channel) return;
    
    // Check last 5 messages to see if bot already posted the button
    const messages = await channel.messages.fetch({ limit: 5 });
    if (!messages.find(m => m.author.id === client.user.id)) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('create_ticket').setLabel('🪪 GET ID CARD').setStyle(ButtonStyle.Primary)
        );
        const embed = new EmbedBuilder().setTitle("Welcome to Sector 7").setDescription("Click below to start.").setColor(0x0099FF);
        await channel.send({ embeds: [embed], components: [row] });
    }
}

// --- INITIALIZE ---
client.once('ready', () => { 
    console.log("Sector 7 Online"); 
    
    // 1. Draw the Button (if missing)
    setupImmigration();
    
    // 2. Start Game Loops (Income, Jail, etc) - imported from gameLoops.js
    require('./gameLoops')(client);

    // 3. Start Command & Button Handlers - imported from handlers.js
    require('./handlers')(client);
});

// Start the Web Server
keepAlive();

// Login
client.login(Config.DISCORD_TOKEN);
