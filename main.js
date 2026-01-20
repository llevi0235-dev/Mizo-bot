const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { ref, get } = require('firebase/database');
const Config = require('./config');
const db = require('./database');

// --- IMPORT INFRASTRUCTURE ---
require('./keep_alive')(); 

// --- IMPORT SYSTEM MODULES ---
const Payday = require('./city_payday');
const Prison = require('./city_prison');
const Reporter = require('./city_reporter');
const Immigration = require('./citizen_immigration');
const UpdateFeed = require('./city_update');

// --- IMPORT LEADERBOARDS ---
const MainBoard = require('./citizen_leaderboard');
const PoliceBoard = require('./police_leaderboard');
const RobberBoard = require('./robber_leaderboard');
const BusinessBoard = require('./business_leaderboard');

// --- IMPORT COMMAND HANDLERS ---
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

client.once('ready', async () => {
    console.log(`✅ Sector 7 Core Online | 23 Files Connected`);
    Payday(client);
    Prison.watchReleases(client);
    await Immigration.setup(client);
    
    // Initial Board Updates
    try {
        await Promise.all([
            MainBoard.update(client),
            PoliceBoard.update(client),
            RobberBoard.update(client),
            BusinessBoard.update(client)
        ]);
    } catch (e) { console.log("Board update skipped: " + e.message); }

    await UpdateFeed(client);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('/')) return;

    // Direct Database Fetch (No userManager needed)
    const snapshot = await get(ref(db, `users/${message.author.id}`));
    const user = snapshot.val();
    if (!user) return; 

    const content = message.content.toLowerCase();

    // Route by Role
    if (user.role === 'police') {
        await PoliceCmds(message, user, content);
    } else if (user.role === 'robber') {
        await RobberCmds(message, user, content);
    } else if (user.role === 'businessman') {
        await BusinessCmds(message, user, content);
    }

    // General Commands
    await CitizenCmds(message, user, content);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'create_ticket') await Immigration.handleRegistration(interaction);
    else if (interaction.customId === 'refresh_main_leaderboard') { await interaction.deferUpdate(); await MainBoard.update(client); }
    else if (interaction.customId === 'refresh_police_leaderboard') { await interaction.deferUpdate(); await PoliceBoard.update(client); }
    else if (interaction.customId === 'refresh_loot_leaderboard') { await interaction.deferUpdate(); await RobberBoard.update(client); }
    else if (interaction.customId === 'refresh_top_investors') { await interaction.deferUpdate(); await BusinessBoard.update(client); }
});

client.login(Config.TOKEN);
