const { Client, GatewayIntentBits, Partials } = require('discord.js');
const Config = require('./config');
const db = require('./database');
const UM = require('./userManager');

// --- 1. IMPORT INFRASTRUCTURE ---
require('./keep_alive')(); 

// --- 2. IMPORT SYSTEM MODULES ---
const Payday = require('./city_payday');
const Prison = require('./city_prison');
const Reporter = require('./city_reporter');
const Immigration = require('./citizen_immigration');
const UpdateFeed = require('./city_update');

// --- 3. IMPORT LEADERBOARDS (Strict Separation) ---
const MainBoard = require('./citizen_leaderboard');
const PoliceBoard = require('./police_leaderboard');
const RobberBoard = require('./robber_leaderboard');
const BusinessBoard = require('./business_leaderboard');

// --- 4. IMPORT COMMAND HANDLERS (Strict Separation) ---
const PoliceCmds = require('./police_commands');
const RobberCmds = require('./robber_commands');
const BusinessCmds = require('./business_commands');
const CitizenCmds = require('./citizen_commands');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

// 🚀 BOT STARTUP
client.once('ready', async () => {
    console.log(`✅ Sector 7 Core Online | 23 Files Linked`);
    
    // Start Background Loops
    Payday(client);
    Prison.watchReleases(client);
    
    // Initialize Boards & Immigration
    await Immigration.setup(client);
    await MainBoard.update(client);
    await PoliceBoard.update(client);
    await RobberBoard.update(client);
    await BusinessBoard.update(client);

    // Announce System Status
    await UpdateFeed(client);
});

// 📩 MESSAGE ROUTING (The "Traffic Controller")
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('/')) return;

    const user = await UM.getUser(message.author.id);
    if (!user) return; 

    const content = message.content.toLowerCase();

    // Send the message to the correct file based on Role
    if (user.role === 'police') {
        await PoliceCmds(message, user, content);
    } 
    else if (user.role === 'robber') {
        await RobberCmds(message, user, content);
    } 
    else if (user.role === 'businessman') {
        await BusinessCmds(message, user, content);
    }

    // Always check for general citizen commands (like /bal)
    await CitizenCmds(message, user, content);
});

// 🖱️ INTERACTION ROUTING (Buttons)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // Route Button Clicks to the correct Board or System file
    if (interaction.customId === 'create_ticket') {
        await Immigration.handleRegistration(interaction);
    } 
    else if (interaction.customId === 'refresh_main_leaderboard') {
        await interaction.deferUpdate();
        await MainBoard.update(client);
    } 
    else if (interaction.customId === 'refresh_police_leaderboard') {
        await interaction.deferUpdate();
        await PoliceBoard.update(client);
    } 
    else if (interaction.customId === 'refresh_loot_leaderboard') {
        await interaction.deferUpdate();
        await RobberBoard.update(client);
    } 
    else if (interaction.customId === 'refresh_top_investors') {
        await interaction.deferUpdate();
        await BusinessBoard.update(client);
    } 
    else if (interaction.customId === 'refresh_jail_timer') {
        await interaction.deferUpdate();
        await Prison.updateRoster(client);
    }
});

client.login(Config.TOKEN);
