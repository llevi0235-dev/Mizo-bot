const { Client, GatewayIntentBits, EmbedBuilder, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
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

// --- SETUP IMMIGRATION ---
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

// 2. Jail Timer (Fix: Swaps roles back)
setInterval(async () => {
    const users = await UM.getAllUsers();
    const now = Date.now();
    
    // Fetch the Guild to manage roles
    const guild = client.guilds.cache.first(); 

    for (const [userId, user] of Object.entries(users)) {
        if (user.role === 'prisoner' && user.release_time && now >= user.release_time) {
            
            // Database Update
            await update(ref(UM.db, `users/${userId}`), { 
                role: 'robber', 
                release_time: null, 
                special_id: UM.getNewID('robber') 
            });

            // Discord Role Update
            if (guild) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) {
                    const prisonerRole = guild.roles.cache.find(r => r.name === 'Prisoner');
                    const robberRole = guild.roles.cache.find(r => r.name === 'Robber');
                    if (prisonerRole) await member.roles.remove(prisonerRole).catch(e => console.log(e));
                    if (robberRole) await member.roles.add(robberRole).catch(e => console.log(e));
                }
            }

            client.channels.cache.get(Config.CHANNELS.PRISON_JAIL)?.send(`🔓 <@${userId}> has been released from jail.`);
        }
    }
}, 60000);

// 3. Investment Loop
setInterval(async () => {
    const snapshot = await get(ref(UM.db, 'investments'));
    if (!snapshot.exists()) return;
    const now = Date.now();

    for (const [key, inv] of Object.entries(snapshot.val())) {
        if (now >= inv.end_time) {
            const win = Math.random() < 0.4;
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
            await set(ref(UM.db, `investments/${key}`), null);
        }
    }
}, 60000);

// 4. Leaderboard Updater (Fix: Global Richest)
setInterval(async () => updateLeaderboards(), 5 * 60 * 1000);

async function updateLeaderboards() {
    const usersObj = await UM.getAllUsers();
    const users = Object.values(usersObj);

    // A. Top Officers (Police Only)
    const topCops = users.filter(u => u.role === 'police').sort((a,b) => (b.cases_solved||0) - (a.cases_solved||0)).slice(0, 25);
    
    // B. Global Richest (EVERYONE - No filter)
    const richest = [...users].sort((a,b) => b.cash - a.cash).slice(0, 25);
    
    const topRobbers = users.filter(u => u.role === 'robber').sort((a,b) => (b.total_stolen||0) - (a.total_stolen||0)).slice(0, 50);
    const topInv = users.filter(u => u.role === 'businessman').sort((a,b) => (b.investment_profit||0) - (a.investment_profit||0)).slice(0, 50);

    async function sendBoard(chId, embeds) {
        const ch = client.channels.cache.get(chId);
        if(!ch) return;
        const msgs = await ch.messages.fetch({limit:1});
        const last = msgs.first();
        (last && last.author.id === client.user.id) ? last.edit({embeds}) : ch.send({embeds});
    }

    const embedCops = new EmbedBuilder().setTitle("👮 TOP OFFICERS").setColor(0x0000FF).setDescription(topCops.map((u,i) => `${i+1}. ${u.username}: ${u.cases_solved||0} Cases`).join('\n') || "None");
    // Updated Title: Richest Person (Global)
    const embedRich = new EmbedBuilder().setTitle("🏆 RICHEST PLAYERS").setColor(0xFFD700).setDescription(richest.map((u,i) => `${i+1}. ${u.username}: ${UM.fmt(u.cash)}`).join('\n') || "None");
    
    const embedRob = new EmbedBuilder().setTitle("💰 TOP ROBBERS").setColor(0xFF0000).setDescription(topRobbers.map((u,i) => `${i+1}. ${u.username}: ${UM.fmt(u.total_stolen||0)}`).join('\n') || "None");
    const embedInv = new EmbedBuilder().setTitle("📈 TOP INVESTORS").setColor(0x00FF00).setDescription(topInv.map((u,i) => `${i+1}. ${u.username}: ${UM.fmt(u.investment_profit||0)}`).join('\n') || "None");

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

    // --- ROLE SELECTION (Fix: One Role Policy) ---
    if (customId.startsWith('role_')) {
        let finalRole = customId.replace('role_', '');
        if (finalRole === 'business') finalRole = 'businessman';

        await UM.createUser(user.id, user.username, finalRole);
        
        // Role Management (Remove ALL old -> Add NEW)
        const roleMap = { 'citizen': 'Citizen', 'robber': 'Robber', 'police': 'Police', 'businessman': 'Businessman' };
        const roleToAdd = guild.roles.cache.find(r => r.name === roleMap[finalRole]);

        if (roleToAdd) {
            const allRoles = ['Citizen', 'Robber', 'Police', 'Businessman', 'Prisoner']; // Includes Prisoner!
            for (const name of allRoles) {
                const r = guild.roles.cache.find(role => role.name === name);
                if (r && interaction.member.roles.cache.has(r.id)) {
                    await interaction.member.roles.remove(r);
                }
            }
            await interaction.member.roles.add(roleToAdd).catch(() => console.log("ROLE ERROR: Bot too low!"));
        }

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
        ${user.role === 'robber' ? '`/scantarget`\n`/rob <id>`' : ''}
        ${user.role === 'police' ? '`/arrest <id>`' : ''}
        ${user.role === 'businessman' ? '`/invest <amt>`\n`/investst`' : ''}
        `);
        return message.reply({ embeds: [embed] });
    }

    if (content === '/bl') return message.reply(`💳 **${user.username}** | ${UM.fmt(user.cash)} | ID: ${user.special_id}`);

    // --- BUSINESSMAN ---
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

    // --- ROBBER (Fix: New /rob <id> command) ---
    if (user.role === 'robber') {
        if (content === '/scantarget') {
            if(user.cash < 200) return message.reply("Need $200.");
            await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 200 });
            const all = Object.values(await UM.getAllUsers()).filter(u => u.role === 'citizen' || u.role === 'businessman').sort(()=>0.5-Math.random()).slice(0,10);
            return message.author.send(all.map(t => `${t.username} | ${UM.fmt(t.cash)} | ${UM.maskID(t.special_id, t.role)}`).join('\n') || "No targets").then(()=>message.reply("Check DM.")).catch(()=>message.reply("Open DMs!"));
        }

        // Regex for /rob 123456 (No mentions)
        const m = content.match(/^\/rob\s*(\d+)$/);
        if (m) {
            const guess = m[1];
            
            // 1. Find Target by Special ID (Exact or Partial) logic handled via ID matching
            // We need to find WHO owns this ID (or close to it)
            // But wait, the game rule is: "Guess the HIDDEN digits".
            // So the user inputs the FULL ID they think it is.
            
            // We scan all valid targets
            const allUsers = await UM.getAllUsers();
            let target = null;
            let targetId = null;

            // Simple logic: Find user whose ID is closest to the guess
            // Note: In a real massive DB, this is slow, but for 50-100 users it's fine.
            let closestDiff = Infinity;
            
            for (const [uid, u] of Object.entries(allUsers)) {
                if (u.role !== 'citizen' && u.role !== 'businessman') continue; // Only rob civilians
                if (uid === userId) continue; // Can't rob self

                const diff = Math.abs(parseInt(guess) - parseInt(u.special_id));
                if (diff < closestDiff) {
                    closestDiff = diff;
                    target = u;
                    targetId = uid;
                }
            }

            if (!target) return message.reply("No valid targets found.");
            if (user.cash < 100) return message.reply("Need $100.");
            if (user.robbery_cooldowns?.[targetId] && (Date.now() - user.robbery_cooldowns[targetId] < 1800000)) return message.reply("Cooldown active for this target.");
            
            await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 100 });
            
            // Percentage Logic
            let pct = (closestDiff === 0) ? 0.10 : (closestDiff <= 50) ? 0.02 : (closestDiff <= 200) ? 0.01 : 0;
            
            if (pct > 0) {
                if (user.robbery_history?.[targetId]) return message.reply("You already robbed them successfully!");
                const stolen = Math.floor(target.cash * pct);
                
                await update(ref(UM.db, `users/${targetId}`), { cash: target.cash - stolen, special_id: UM.getNewID(target.role) });
                await update(ref(UM.db, `users/${userId}`), { cash: user.cash + stolen, total_stolen: (user.total_stolen||0)+stolen, [`robbery_history/${targetId}`]: true });
                
                client.channels.cache.get(Config.CHANNELS.CRIME_FEEDS)?.send(`🚨 **ROBBERY!** ${user.username} robbed ${target.username} for ${UM.fmt(stolen)}!`);
                return message.reply(`✅ Success! Stole ${UM.fmt(stolen)} (${pct*100}%) from ${target.username}.`);
            } else {
                await update(ref(UM.db, `users/${userId}`), { [`robbery_cooldowns/${targetId}`]: Date.now() });
                return message.reply("❌ Failed. ID match too far.");
            }
        }
    }

    // --- POLICE (Fix: New /arrest <id> command) ---
    if (user.role === 'police') {
        // Regex for /arrest 123 (No mentions)
        const m = content.match(/^\/arrest\s*(\d+)$/);
        if (m) {
            const guess = m[1]; // The ID guess (last digit usually)
            
            // Logic: Police enters the FULL ID or just the digit? 
            // Previous rule: "Guess the last 1 digit".
            // Command input: /arrest 123.
            
            // We need to find the Robber who owns this ID.
            const targetData = await UM.findUserBySpecialID(guess);
            
            if (!targetData) return message.reply("No Robber found with that EXACT ID.");
            if (targetData.role !== 'robber') return message.reply("Target is not a robber.");
            
            const targetId = targetData.userId;
            if (user.cash < 500) return message.reply("Need $500.");
            
            await update(ref(UM.db, `users/${userId}`), { cash: user.cash - 500 });
            
            // Since we found them by Exact ID match (using the helper), the guess is correct.
            const seized = Math.floor(targetData.cash * 0.80);
            const reward = Math.floor(seized * 0.03);
            
            // Jail Logic (Database + Discord Role)
            const guild = client.guilds.cache.first();
            if (guild) {
                const member = await guild.members.fetch(targetId).catch(()=>null);
                if(member) {
                    const robRole = guild.roles.cache.find(r=>r.name==='Robber');
                    const prisRole = guild.roles.cache.find(r=>r.name==='Prisoner');
                    if(robRole) await member.roles.remove(robRole);
                    if(prisRole) await member.roles.add(prisRole);
                }
            }

            // Set release time (10 mins)
            const releaseTime = Date.now() + (10 * 60 * 1000); 
            // Timestamps for display: <t:TIMESTAMP:R>
            const discordTime = Math.floor(releaseTime / 1000);

            await update(ref(UM.db, `users/${targetId}`), { 
                cash: targetData.cash - seized, 
                role: 'prisoner', 
                release_time: releaseTime, 
                jail_count: (targetData.jail_count||0)+1 
            });
            await update(ref(UM.db, `users/${userId}`), { cash: user.cash + reward, cases_solved: (user.cases_solved||0)+1 });
            
            client.channels.cache.get(Config.CHANNELS.PRISON_JAIL)?.send(`🔒 <@${targetId}> jailed by <@${userId}>.\n**Releasing:** <t:${discordTime}:R>`);
            return message.reply(`✅ Arrested! Reward: ${UM.fmt(reward)}`);
        }
    }
});

client.once('ready', () => { console.log("Sector 7 Online"); setupImmigration(); updateLeaderboards(); });
client.login(Config.DISCORD_TOKEN);
