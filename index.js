const { Client, GatewayIntentBits, EmbedBuilder, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const { ref, update } = require('firebase/database');

// --- IMPORTS ---
const Config = require('./config');
const UM = require('./userManager'); 

// --- INITIALIZATION ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

// --- KEEP ALIVE ---
const http = require('http');
http.createServer((req, res) => { res.writeHead(200); res.end('Sector 7 Active'); }).listen(3000);

// --- SETUP IMMIGRATION PANEL (Run on Startup) ---
async function setupImmigration() {
    const channel = client.channels.cache.get(Config.CHANNELS.GET_ID_CARD);
    if (!channel) return;

    // Check if the button message already exists
    const messages = await channel.messages.fetch({ limit: 10 });
    const botMsg = messages.find(m => m.author.id === client.user.id);

    if (!botMsg) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('🪪 GET ID CARD')
                .setStyle(ButtonStyle.Primary)
        );
        
        const embed = new EmbedBuilder()
            .setTitle("Welcome to Sector 7")
            .setDescription("Click the button below to open a private ticket and choose your role.")
            .setColor(0x0099FF)
            .setFooter({ text: "Sector 7 Immigration" });

        await channel.send({ embeds: [embed], components: [row] });
        console.log("Immigration Panel Created.");
    }
}

// --- GAME LOOPS ---
// 1. Income Loop (Every 1 min check)
setInterval(async () => {
    const users = await UM.getAllUsers();
    const now = Date.now();
    for (const [userId, user] of Object.entries(users)) {
        if (user.role === 'prisoner') continue;
        
        // Income Logic
        let interval = 30 * 60 * 1000; // 30 mins default
        let amount = 0;
        
        if (user.role === 'citizen') amount = 400;
        if (user.role === 'police') amount = 450;
        if (user.role === 'businessman') amount = 1000;
        if (user.role === 'robber') { 
            interval = 20 * 60 * 1000; // 20 mins
            amount = 50; 
        }

        if (now - user.last_income >= interval) {
            await update(ref(UM.db, `users/${userId}`), { cash: user.cash + amount, last_income: now });
        }
    }
}, 60000);

// 2. Jail Timer Loop
setInterval(async () => {
    const users = await UM.getAllUsers();
    const now = Date.now();
    for (const [userId, user] of Object.entries(users)) {
        if (user.role === 'prisoner' && user.release_time && now >= user.release_time) {
            // Release from Jail
            await update(ref(UM.db, `users/${userId}`), { 
                role: 'robber', 
                release_time: null, 
                special_id: UM.getNewID('robber') // New ID on release
            });
            client.channels.cache.get(Config.CHANNELS.PRISON_JAIL)?.send(`<@${userId}> has been released from jail.`);
        }
    }
}, 60000);

// 3. Leaderboard Updater (Every 5 mins)
setInterval(async () => updateLeaderboards(), 5 * 60 * 1000);

async function updateLeaderboards() {
    const usersObj = await UM.getAllUsers();
    const users = Object.values(usersObj);

    // Sort Data
    const topCops = [...users].filter(u => u.role === 'police').sort((a,b) => b.cases_solved - a.cases_solved).slice(0, 25);
    const richest = [...users].sort((a,b) => b.cash - a.cash).slice(0, 25);
    const topRobbers = [...users].sort((a,b) => b.total_stolen - a.total_stolen).slice(0, 50);
    const topInv = [...users].filter(u => u.role === 'businessman').sort((a,b) => b.investment_profit - a.investment_profit).slice(0, 50);

    // Send Helper
    async function sendBoard(chId, embedsArray) {
        const ch = client.channels.cache.get(chId);
        if(!ch) return;
        const msgs = await ch.messages.fetch({limit:1});
        const last = msgs.first();
        (last && last.author.id === client.user.id) ? last.edit({embeds: embedsArray}) : ch.send({embeds: embedsArray});
    }

    // --- MAIN BOARD (Dual Leaderboard) ---
    const embedCops = new EmbedBuilder().setTitle("👮 TOP OFFICERS").setColor(0x0000FF)
        .setDescription(topCops.map((u,i) => `${i+1}. ${u.username} - ${u.cases_solved} Cases`).join('\n') || "No data.");
    
    const embedRich = new EmbedBuilder().setTitle("🏆 RICHEST CITIZENS").setColor(0xFFD700)
        .setDescription(richest.map((u,i) => `${i+1}. ${u.username} - ${UM.fmt(u.cash)}`).join('\n') || "No data.");

    await sendBoard(Config.CHANNELS.LEADERBOARD_MAIN, [embedCops, embedRich]);

    // --- OTHER BOARDS ---
    const embedRob = new EmbedBuilder().setTitle("💰 TOP ROBBERS").setColor(0xFF0000)
        .setDescription(topRobbers.map((u,i) => `${i+1}. ${u.username} - ${UM.fmt(u.total_stolen)}`).join('\n') || "No data.");
    sendBoard(Config.CHANNELS.LOOT_LEADERBOARD, [embedRob]);

    const embedInv = new EmbedBuilder().setTitle("📈 TOP INVESTORS").setColor(0x00FF00)
        .setDescription(topInv.map((u,i) => `${i+1}. ${u.username} - ${UM.fmt(u.investment_profit)}`).join('\n') || "No data.");
    sendBoard(Config.CHANNELS.TOP_INVESTORS, [embedInv]);
    
    // Also update Top Officers channel separately if you want just cops there
    sendBoard(Config.CHANNELS.TOP_OFFICERS, [embedCops]);
}

// --- INTERACTION HANDLER (Buttons & Tickets) ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId, user, guild } = interaction;

    // 1. Create Ticket
    if (customId === 'create_ticket') {
        const channelName = `ticket-${user.username}`.toLowerCase().replace(/[^a-z0-9]/g, ''); // Clean name
        
        // Check if ticket exists in category
        const existing = guild.channels.cache.find(c => c.name.includes(channelName) && c.parentId === Config.CHANNELS.IMMIGRATION_CATEGORY);
        if (existing) return interaction.reply({ content: `You already have a ticket: <#${existing.id}>`, ephemeral: true });

        // Create Private Channel
        const ticketChannel = await guild.channels.create({
            name: `ticket-${user.username}`,
            type: ChannelType.GuildText,
            parent: Config.CHANNELS.IMMIGRATION_CATEGORY,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, // Hide from everyone
                { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, // Show to user
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] } // Show to bot
            ]
        });

        // Send Role Buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('role_citizen').setLabel('Citizen').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('role_robber').setLabel('Robber').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('role_police').setLabel('Police').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('role_business').setLabel('Businessman').setStyle(ButtonStyle.Secondary)
        );

        await ticketChannel.send({ content: `<@${user.id}> Welcome to Sector 7! Please choose your Role to get your ID Card.`, components: [row] });
        return interaction.reply({ content: `Ticket created! Please go to <#${ticketChannel.id}>`, ephemeral: true });
    }

    // 2. Handle Role Selection
    if (customId.startsWith('role_')) {
        const roleName = customId.replace('role_', ''); // 'citizen', 'robber', etc.
        let finalRole = roleName;
        if (roleName === 'business') finalRole = 'businessman';

        // Create User in DB (REAL NAME + SPECIAL ID)
        await UM.createUser(user.id, user.username, finalRole);
        
        // Assign Discord Role (Make sure roles exist in Server Settings)
        const discordRole = guild.roles.cache.find(r => r.name.toLowerCase() === finalRole);
        if (discordRole) await interaction.member.roles.add(discordRole).catch(e => console.log("Role error: " + e));

        await interaction.reply(`✅ Identity Confirmed! You are now a **${finalRole.toUpperCase()}**.\nClosing ticket in 5 seconds...`);
        
        // Delete Ticket
        setTimeout(() => interaction.channel.delete().catch(()=>null), 5000);
    }
});

// --- MESSAGE HANDLER (Commands) ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // *** CRITICAL FIX: Sync Name Immediately ***
    await UM.syncUser(message.author.id, message.author.username); 

    const content = message.content.trim();
    const userId = message.author.id;
    let user = await UM.getUser(userId);

    // If user is not in DB, tell them to get ID
    if (!user) {
        if (content.startsWith('/')) {
            return message.reply(`You are not registered! Go to <#${Config.CHANNELS.GET_ID_CARD}> to get your ID Card.`);
        }
        return; 
    }

    // --- COMMANDS ---
    
    // Menu
    if (content === '/menu') {
        const embed = new EmbedBuilder().setTitle("Sector 7 Command Menu").setDescription(`
        **/bl** - Check wealth | **/menu** - Help
        **Current Role:** ${user.role.toUpperCase()}
        ${user.role === 'robber' ? '`/scantarget` ($200)\n`@User/rob<guess>` ($100)' : ''}
        ${user.role === 'police' ? '`@User/arrest<guess>` ($500)' : ''}
        ${user.role === 'businessman' ? '`/invest <amount>`\n`/investst` (Status)' : ''}
        `);
        return message.reply({ embeds: [embed] });
    }

    // Balance
    if (content === '/bl') {
        return message.reply(`💳 **${user.username}**\nRole: ${user.role}\nWealth: ${UM.fmt(user.cash)}\nID: ${user.special_id}`);
    }

    // --- ROBBER LOGIC ---
    if (user.role === 'robber') {
        // Scan
        if (content === '/scantarget') {
            if(user.cash < 200) return message.reply("Need $200.");
            await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 200 });
            
            const all = await UM.getAllUsers();
            const targets = Object.values(all).filter(u => u.role === 'citizen' || u.role === 'businessman').sort(()=>0.5-Math.random()).slice(0,10);
            let msg = "**Scan Results:**\n";
            targets.forEach(t => msg += `${t.username} | ${t.role} | ${UM.fmt(t.cash)} | ID: ${UM.maskID(t.special_id, t.role)}\n`);
            return message.author.send(msg).then(()=>message.reply("Sent to DM.")).catch(()=>message.reply("Open DMs!"));
        }

        // Rob
        const robMatch = content.match(/<@!?(\d+)>\s*\/rob(\d+)/);
        if (robMatch) {
            const targetId = robMatch[1];
            const guess = robMatch[2];
            const target = await UM.getUser(targetId);

            if (!target) return message.reply("Target invalid.");
            if (user.cash < 100) return message.reply("Need $100.");
            
            if (user.robbery_cooldowns && user.robbery_cooldowns[targetId] && (Date.now() - user.robbery_cooldowns[targetId] < 30*60000)) {
                return message.reply("Cooldown active for this target.");
            }

            await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 100 });

            const diff = Math.abs(parseInt(guess) - parseInt(target.special_id));
            let pct = (diff === 0) ? 0.10 : (diff <= 50) ? 0.02 : (diff <= 200) ? 0.01 : 0;

            if (pct > 0) {
                if (user.robbery_history && user.robbery_history[targetId]) return message.reply("Already robbed successfully.");
                const stolen = Math.floor(target.cash * pct);
                await update(ref(UM.db, `users/${targetId}`), { cash: target.cash - stolen, special_id: UM.getNewID(target.role) });
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash + stolen, total_stolen: (user.total_stolen||0)+stolen, [`robbery_history/${targetId}`]: true });
                client.channels.cache.get(Config.CHANNELS.CRIME_FEEDS)?.send(`🚨 **ROBBERY!** ${user.username} robbed ${target.username} for ${UM.fmt(stolen)}!`);
                return message.reply(`✅ Success! Stole ${UM.fmt(stolen)}.`);
            } else {
                await update(ref(UM.db, `users/${userId}`), { [`robbery_cooldowns/${targetId}`]: Date.now() });
                return message.reply("❌ Failed. Wrong ID.");
            }
        }
    }

    // --- POLICE LOGIC ---
    if (user.role === 'police') {
        const arrestMatch = content.match(/<@!?(\d+)>\s*\/arrest(\d+)/);
        if (arrestMatch) {
            const targetId = arrestMatch[1];
            const guess = arrestMatch[2];
            const target = await UM.getUser(targetId);

            if(!target || target.role !== 'robber') return message.reply("Target not a robber.");
            if(user.cash < 500) return message.reply("Need $500.");
            
            await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 500 });

            if (guess === target.special_id.slice(-1)) {
                const seized = Math.floor(target.cash * 0.80);
                const reward = Math.floor(seized * 0.03);
                await update(ref(UM.db, `users/${targetId}`), { cash: target.cash - seized, role: 'prisoner', release_time: Date.now() + 600000, jail_count: (target.jail_count||0)+1 });
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash + reward, cases_solved: (user.cases_solved||0)+1 });
                client.channels.cache.get(Config.CHANNELS.PRISON_JAIL)?.send(`🔒 <@${targetId}> jailed by <@${userId}>.`);
                return message.reply(`✅ Arrested! Reward: ${UM.fmt(reward)}`);
            } else {
                return message.reply("❌ Failed. Wrong digit.");
            }
        }
    }
    
    // --- BUSINESSMAN LOGIC ---
    if (user.role === 'businessman') {
        if (content.startsWith('/invest ')) {
            const amount = parseInt(content.split(' ')[1]);
            if (isNaN(amount) || amount <= 0 || user.cash < amount) return message.reply("Invalid amount.");
            await update(ref(UM.db, `users/${userId}`), { cash: user.cash - amount });
            await update(ref(UM.db, `investments/${Date.now()}`), { userId: userId, amount: amount, start_time: Date.now(), end_time: Date.now() + 600000 });
            return message.reply(`📉 Invested ${UM.fmt(amount)}.`);
        }
        if (content === '/investst') {
             // Basic check
             return message.reply("Investment system active. (Add detailed view if needed)");
        }
    }
});

client.once('ready', () => {
    console.log(`Sector 7 Online: ${client.user.tag}`);
    setupImmigration(); // Creates the ID Card Button
    updateLeaderboards(); // Starts Boards
});

client.login(Config.DISCORD_TOKEN);
