const {
    Client,
    GatewayIntentBits,
    Partials,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');

const Config = require('./config');
const keepAlive = require('./keep_alive');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

// 🪪 IMMIGRATION SETUP
async function setupImmigration() {
    const channel = client.channels.cache.get(Config.CHANNELS.GET_ID_CARD);
    if (!channel) return;

    const messages = await channel.messages.fetch({ limit: 5 });
    if (!messages.find(m => m.author.id === client.user.id)) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('🪪 GET ID CARD')
                .setStyle(ButtonStyle.Primary)
        );

        const embed = new EmbedBuilder()
            .setTitle('Welcome to Sector 7')
            .setDescription('Click below to get your city ID.')
            .setColor(0x0099FF);

        await channel.send({ embeds: [embed], components: [row] });
    }
}

// 🔒 JAIL MONITOR SETUP (Added)
async function setupJailMonitor() {
    // Uses the PRISON_JAIL ID from your Config
    const channel = client.channels.cache.get(Config.CHANNELS.PRISON_JAIL); 
    if (!channel) return;

    // Check if message exists to avoid spam
    const messages = await channel.messages.fetch({ limit: 5 });
    const botMsg = messages.find(m => m.author.id === client.user.id && m.content.includes('PRISON ROSTER'));

    if (!botMsg) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('refresh_jail_timer')
                .setLabel('Refresh Timer')
                .setEmoji('⏱️')
                .setStyle(ButtonStyle.Secondary)
        );

        await channel.send({
            content: '🔒 **SECTOR 7 PRISON ROSTER**\n\n*Click below to check remaining time.*',
            components: [row]
        });
    }
}

// ✅ BOT READY
client.once('ready', async () => {
    console.log('Sector 7 Online');

    await setupImmigration();
    await setupJailMonitor(); // <--- JAIL MONITOR ACTIVATED

    // 🔔 POST UPDATE ANNOUNCEMENT
    require('./update_info')(client);

    // 🔁 LOAD SYSTEMS
    require('./gameLoops')(client);
    require('./event_buttons')(client);
    require('./event_chat')(client);
});

// 🌐 KEEP ALIVE
keepAlive();

// 🤖 LOGIN
client.login(Config.DISCORD_TOKEN);
