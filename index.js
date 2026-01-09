const { Client, GatewayIntentBits, EmbedBuilder, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
// Added 'get' and 'set' to imports so the investment loop works
const { ref, update, get, set } = require('firebase/database');

const Config = require('./config');
const UM = require('./userManager'); 

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

// --- SETUP ---
async function setupImmigration() {
    const channel = client.channels.cache.get(Config.CHANNELS.GET_ID_CARD);
    if (!channel) return;
    const messages = await channel.messages.fetch({ limit: 10 });
    const botMsg = messages.find(m => m.author.id === client.user.id);

    if (!botMsg) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('create_ticket').setLabel('🪪 GET ID CARD').setStyle(ButtonStyle.Primary)
        );
        const embed = new EmbedBuilder().setTitle("Welcome to Sector 7").setDescription("Click below to start.").setColor(0x0099FF);
        await channel.send({ embeds: [embed], components: [row] });
    }
}

// --- GAME LOOPS ---

// 1. Income Loop
setInterval(async () => {
    const users = await UM.getAllUsers();
    const now = Date.now();
    for (const [userId, user] of Object.entries(users)) {
        if (user.role === 'prisoner') continue;
        let interval = 30 * 60 * 1000;
        let amount = 0;
        if (user.role === 'citizen') amount = 400;
        if (user.role === 'police') amount = 450;
        if (user.role === 'businessman') amount = 1000;
        if (user.role === 'robber') { interval = 20 * 60 * 1000; amount = 50; }

        if (now - user.last_income >= interval) {
            await update(ref(UM.db, `users/${userId}`), { cash: user.cash + amount, last_income: now });
        }
    }
}, 60000);

// 2. Jail Timer
setInterval(async () => {
    const users = await UM.getAllUsers();
    const now = Date.now();
    for (const [userId, user] of Object.entries(users)) {
        if (user.role === 'prisoner' && user.release_time && now >= user.release_time) {
            await update(ref(UM.db, `users/${userId}`), { role: 'robber', release_time: null, special_id: UM.getNewID('robber') });
            client.channels.cache.get(Config.CHANNELS.PRISON_JAIL)?.send(`<@${userId}> released from jail.`);
        }
    }
}, 60000);

// 3. INVESTMENT LOOP (FIXED: Added missing logic)
setInterval(async () => {
    const snapshot = await get(ref(UM.db, 'investments'));
    if (!snapshot.exists()) return;
    const now = Date.now();

    for (const [key, inv] of Object.entries(snapshot.val())) {
        if (now >= inv.end_time) {
            const win = Math.random() < 0.4; // 40% win
            let profit = 0, finalAmount = 0;

            if (win) {
                const mult = (Math.random() * 4) + 1; 
                finalAmount = Math.floor(inv.amount * mult);
                profit = finalAmount - inv.amount;
            } else {
                const lossPct = (Math.random() * 0.99) + 0.01;
                const loss = Math.floor(inv.amount * lossPct);
                finalAmount = inv.amount - loss;
                profit = -loss;
            }

            const user = await UM.getUser(inv.userId);
            if (user) {
                await update(ref(UM.db, `users/${inv.userId}`), { 
                    cash: user.cash + finalAmount, 
                    investment_profit: (user.investment_profit || 0) + (profit > 0 ? profit : 0) 
                });
                client.channels.cache.get(Config.CHANNELS.BUSINESS_INVEST_RECORD)?.send(`📊 **Result for ${user.username}**\n${win ? '✅ PROFIT' : '🔻 LOSS'}: ${UM.fmt(profit)}`);
            }
            await set(ref(UM.db, `investments/${key}`), null); // Delete investment
        }
    }
}, 60000);

// 4. Leaderboard Updater (FIXED: Role filtering)
setInterval(async () => updateLeaderboards(), 5 * 60 * 1000);

async function updateLeaderboards() {
    const usersObj = await UM.getAllUsers();
    const users = Object.values(usersObj);

    // FIXED: Filter out cops from "Richest" so they only appear in "Top Officers"
    const topCops = users.filter(u => u.role === 'police').sort((a,b) => (b.cases_solved||0) - (a.cases_solved||0)).slice(0, 25);
    const richest = users.filter(u => u.role === 'citizen' || u.role === 'businessman').sort((a,b) => b.cash - a.cash).slice(0, 25);
    const topRobbers = users.filter(u => u.role === 'robber').sort((a,b) => (b.total_stolen||0) - (a.total_stolen||0)).slice(0, 50);
    const topInv = users.filter(u => u.role === 'businessman').sort((a,b) => (b.investment_profit||0) - (a.investment_profit||0)).slice(0, 50);

    async function sendBoard(chId, embeds) {
        const ch = client.channels.cache.get(chId);
        if(!ch) return;
        const msgs = await ch.messages.fetch({limit:1});
        const last = msgs.first();
        (last && last.author.id === client.user.id) ? last.edit({embeds}) : ch.send({embeds});
    }

    const embedCops = new EmbedBuilder().setTitle("👮 TOP OFFICERS").setColor(0x0000FF).setDescription(topCops.map((u,i) => `${i+1}. ${u.username} - ${u.cases_solved||0} Cases`).join('\n') || "None");
    const embedRich = new EmbedBuilder().setTitle("🏆 RICHEST CIVILIANS").setColor(0xFFD700).setDescription(richest.map((u,i) => `${i+1}. ${u.username} - ${UM.fmt(u.cash)}`).join('\n') || "None");
    const embedRob = new EmbedBuilder().setTitle("💰 TOP ROBBERS").setColor(0xFF0000).setDescription(topRobbers.map((u,i) => `${i+1}. ${u.username} - ${UM.fmt(u.total_stolen||0)}`).join('\n') || "None");
    const embedInv = new EmbedBuilder().setTitle("📈 TOP INVESTORS").setColor(0x00FF00).setDescription(topInv.map((u,i) => `${i+1}. ${u.username} - ${UM.fmt(u.investment_profit||0)}`).join('\n') || "None");

    await sendBoard(Config.CHANNELS.LEADERBOARD_MAIN, [embedCops, embedRich]);
    sendBoard(Config.CHANNELS.LOOT_LEADERBOARD, [embedRob]);
    sendBoard(Config.CHANNELS.TOP_INVESTORS, [embedInv]);
    sendBoard(Config.CHANNELS.TOP_OFFICERS, [embedCops]);
}

// --- COMMANDS & INTERACTION ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const { customId, user, guild } = interaction;

    if (customId === 'create_ticket') {
        const channelName = `ticket-${user.username}`.toLowerCase().replace(/[^a-z0-9]/g, ''); 
        const existing = guild.channels.cache.find(c => c.name.includes(channelName) && c.parentId === Config.CHANNELS.IMMIGRATION_CATEGORY);
        if (existing) return interaction.reply({ content: `Check ticket: <#${existing.id}>`, ephemeral: true });

        const ticketChannel = await guild.channels.create({
            name: `ticket-${user.username}`, type: ChannelType.GuildText, parent: Config.CHANNELS.IMMIGRATION_CATEGORY,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('role_citizen').setLabel('Citizen').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('role_robber').setLabel('Robber').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('role_police').setLabel('Police').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('role_business').setLabel('Businessman').setStyle(ButtonStyle.Secondary)
        );
        await ticketChannel.send({ content: `<@${user.id}> Choose Role:`, components: [row] });
        return interaction.reply({ content: `Ticket: <#${ticketChannel.id}>`, ephemeral: true });
    }

    if (customId.startsWith('role_')) {
        let finalRole = customId.replace('role_', '');
        if (finalRole === 'business') finalRole = 'businessman';

        await UM.createUser(user.id, user.username, finalRole);
        
        // **IMPORTANT:** If this fails, your BOT ROLE is too low in Discord Server Settings.
        const discordRole = guild.roles.cache.find(r => r.name.toLowerCase() === finalRole);
        if (discordRole) await interaction.member.roles.add(discordRole).catch(() => console.log("ROLE ERROR: Move Bot Role Higher!"));

        await interaction.reply(`✅ Registered as **${finalRole.toUpperCase()}**.`);
        setTimeout(() => interaction.channel.delete().catch(()=>null), 5000);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    await UM.syncUser(message.author.id, message.author.username); 

    const content = message.content.trim();
    const userId = message.author.id;
    let user = await UM.getUser(userId);

    if (!user) { if (content.startsWith('/')) return message.reply(`Get ID first: <#${Config.CHANNELS.GET_ID_CARD}>`); return; }

    if (content === '/menu') {
        const embed = new EmbedBuilder().setTitle("Menu").setDescription(`
        **/bl** - Wealth | Role: ${user.role}
        ${user.role === 'robber' ? '`/scantarget`\n`@User/rob<id>`' : ''}
        ${user.role === 'police' ? '`@User/arrest<id>`' : ''}
        ${user.role === 'businessman' ? '`/invest <amt>`\n`/investst`' : ''}
        `);
        return message.reply({ embeds: [embed] });
    }

    if (content === '/bl') return message.reply(`💳 **${user.username}** | ${UM.fmt(user.cash)} | ID: ${user.special_id}`);

    if (user.role === 'businessman') {
        if (content.startsWith('/invest ')) {
            const amount = parseInt(content.split(' ')[1]);
            if (isNaN(amount) || amount <= 0 || user.cash < amount) return message.reply("Invalid amount.");
            await update(ref(UM.db, `users/${userId}`), { cash: user.cash - amount });
            await set(ref(UM.db, `investments/${Date.now()}`), { userId, amount, start_time: Date.now(), end_time: Date.now() + 600000 });
            return message.reply(`📉 Invested ${UM.fmt(amount)}.`);
        }
        if (content === '/investst') {
            const snapshot = await get(ref(UM.db, 'investments'));
            if (!snapshot.exists()) return message.reply("No active investments.");
            let msg = "", found = false;
            Object.values(snapshot.val()).forEach(inv => {
                if (inv.userId === userId) {
                    msg += `💰 ${UM.fmt(inv.amount)} | ⏳ ${Math.ceil((inv.end_time - Date.now())/60000)}m\n`; found = true;
                }
            });
            return message.reply(found ? msg : "No active investments.");
        }
    }

    if (user.role === 'robber') {
        if (content === '/scantarget') {
            if(user.cash < 200) return message.reply("Need $200.");
            await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 200 });
            const all = Object.values(await UM.getAllUsers()).filter(u => u.role === 'citizen' || u.role === 'businessman').sort(()=>0.5-Math.random()).slice(0,10);
            return message.author.send(all.map(t => `${t.username} | ${UM.fmt(t.cash)} | ${UM.maskID(t.special_id, t.role)}`).join('\n') || "No targets").then(()=>message.reply("Check DM.")).catch(()=>message.reply("Open DMs!"));
        }
        const m = content.match(/<@!?(\d+)>\s*\/rob(\d+)/);
        if (m) {
            const tId = m[1], guess = m[2], target = await UM.getUser(tId);
            if (!target || user.cash < 100) return message.reply("Invalid target or no cash.");
            if (user.robbery_cooldowns?.[tId] && (Date.now() - user.robbery_cooldowns[tId] < 1800000)) return message.reply("Cooldown.");
            
            await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 100 });
            const diff = Math.abs(parseInt(guess) - parseInt(target.special_id));
            let pct = (diff === 0) ? 0.10 : (diff <= 50) ? 0.02 : (diff <= 200) ? 0.01 : 0;
            
            if (pct > 0) {
                if (user.robbery_history?.[tId]) return message.reply("Already robbed.");
                const stolen = Math.floor(target.cash * pct);
                await update(ref(UM.db, `users/${tId}`), { cash: target.cash - stolen, special_id: UM.getNewID(target.role) });
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash + stolen, total_stolen: (user.total_stolen||0)+stolen, [`robbery_history/${tId}`]: true });
                client.channels.cache.get(Config.CHANNELS.CRIME_FEEDS)?.send(`🚨 **ROBBERY!** ${user.username} robbed ${target.username} for ${UM.fmt(stolen)}!`);
                return message.reply(`✅ Stole ${UM.fmt(stolen)}!`);
            } else {
                await update(ref(UM.db, `users/${userId}`), { [`robbery_cooldowns/${tId}`]: Date.now() });
                return message.reply("❌ Failed.");
            }
        }
    }

    if (user.role === 'police') {
        const m = content.match(/<@!?(\d+)>\s*\/arrest(\d+)/);
        if (m) {
            const tId = m[1], guess = m[2], target = await UM.getUser(tId);
            if (!target || target.role !== 'robber' || user.cash < 500) return message.reply("Invalid target or no cash.");
            
            await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 500 });
            if (guess === target.special_id.slice(-1)) {
                const seized = Math.floor(target.cash * 0.80), reward = Math.floor(seized * 0.03);
                await update(ref(UM.db, `users/${tId}`), { cash: target.cash - seized, role: 'prisoner', release_time: Date.now() + 600000, jail_count: (target.jail_count||0)+1 });
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash + reward, cases_solved: (user.cases_solved||0)+1 });
                client.channels.cache.get(Config.CHANNELS.PRISON_JAIL)?.send(`🔒 <@${tId}> jailed by <@${userId}>.`);
                return message.reply(`✅ Arrested! Reward: ${UM.fmt(reward)}`);
            } 
            return message.reply("❌ Failed.");
        }
    }
});

client.once('ready', () => { console.log("Sector 7 Online"); setupImmigration(); updateLeaderboards(); });
client.login(Config.DISCORD_TOKEN);
