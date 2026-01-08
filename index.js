require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, Partials } = require('discord.js');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, update, query, orderByChild, limitToLast } = require('firebase/database');

// --- CONFIGURATION ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "PASTE_YOUR_TOKEN_HERE"; 
const ADMIN_ID = "1373539575829368963";

// Firebase Config
const firebaseConfig = {
    apiKey: process.env.FB_API_KEY || "PASTE_API_KEY_HERE",
    authDomain: "j-bo-a567a.firebaseapp.com",
    databaseURL: "https://j-bo-a567a-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "j-bo-a567a",
    storageBucket: "j-bo-a567a.firebasestorage.app",
    messagingSenderId: "1029278826614",
    appId: "1:1029278826614:web:b608af7356752ff2e9df57"
};

// Channel IDs
const CHANNELS = {
    LEADERBOARD_MAIN: '1458852649544843274',
    TOP_OFFICERS: '1458851589686300736',
    LOOT_LEADERBOARD: '1458853409179304046',
    TOP_INVESTORS: '1458853822314053724',
    CRIME_FEEDS: '1458855691271012480',
    POLICE_RECORDS: '1458856052656443484',
    PRISON_JAIL: '1458858485750960233',
    PRISON_RECORDS: '1458856403308646461',
    BUSINESS_INVEST_STATUS: '1458856807845072989',
    BUSINESS_INVEST_RECORD: '1458888748052775085'
};

// --- INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

// --- HELPER FUNCTIONS ---

// Generate Random ID (digits)
function generateID(length) {
    let result = '';
    const characters = '0123456789';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Get User Role from Discord Member (You must create these roles in Discord Server)
function getDiscordRole(member) {
    if (member.roles.cache.some(r => r.name.toLowerCase() === 'police')) return 'police';
    if (member.roles.cache.some(r => r.name.toLowerCase() === 'robber')) return 'robber';
    if (member.roles.cache.some(r => r.name.toLowerCase() === 'businessman')) return 'businessman';
    if (member.roles.cache.some(r => r.name.toLowerCase() === 'prisoner')) return 'prisoner';
    return 'citizen'; // Default
}

// Helper to mask ID
function maskID(id, role) {
    if (!id) return 'Unknown';
    if (role === 'businessman') return `${id.substring(0, 3)}???`; // Hide last 3 of 6
    return `${id.substring(0, 2)}?`; // Hide last 1 of 3
}

// Format Currency
const fmt = (amount) => `$${Math.floor(amount).toLocaleString()}`;

// --- DATABASE FUNCTIONS ---

async function getUser(userId) {
    const snapshot = await get(ref(db, `users/${userId}`));
    return snapshot.exists() ? snapshot.val() : null;
}

async function createUser(userId, username, role) {
    let startingCash = 10000;
    let idLength = 3;
    if (role === 'businessman') {
        startingCash = 50000;
        idLength = 6;
    }
    
    const newUser = {
        username: username,
        role: role,
        cash: startingCash,
        special_id: generateID(idLength),
        last_income: Date.now(),
        cases_solved: 0,
        total_stolen: 0,
        investment_profit: 0,
        jail_count: 0,
        robbery_history: {} // Records who they successfully robbed
    };
    await set(ref(db, `users/${userId}`), newUser);
    return newUser;
}

// --- GAME LOGIC ---

// 1. Income Loop (Runs every minute)
setInterval(async () => {
    const snapshot = await get(ref(db, 'users'));
    if (!snapshot.exists()) return;

    const users = snapshot.val();
    const now = Date.now();

    for (const [userId, user] of Object.entries(users)) {
        if (user.role === 'prisoner') continue; // Prisoners don't get income

        let interval = 30 * 60 * 1000; // 30 mins
        let amount = 0;

        if (user.role === 'citizen') amount = 400;
        if (user.role === 'police') amount = 450;
        if (user.role === 'businessman') amount = 1000;
        if (user.role === 'robber') {
            interval = 20 * 60 * 1000; // 20 mins
            amount = 50;
        }

        if (now - user.last_income >= interval) {
            await update(ref(db, `users/${userId}`), {
                cash: user.cash + amount,
                last_income: now
            });
        }
    }
}, 60000); // Check every 1 minute

// 2. Investment Timer Loop (Runs every minute)
setInterval(async () => {
    const snapshot = await get(ref(db, 'investments'));
    if (!snapshot.exists()) return;

    const investments = snapshot.val();
    const now = Date.now();

    for (const [key, inv] of Object.entries(investments)) {
        if (now >= inv.end_time && !inv.processed) {
            // Process Investment
            const win = Math.random() < 0.4; // 40% win rate
            let profit = 0;
            let loss = 0;
            let finalAmount = 0;

            if (win) {
                const multiplier = (Math.random() * 4) + 1; // 1x to 5x
                finalAmount = inv.amount * multiplier;
                profit = finalAmount - inv.amount;
            } else {
                const lossPct = (Math.random() * 0.99) + 0.01; // 1% to 100%
                loss = inv.amount * lossPct;
                finalAmount = inv.amount - loss;
                profit = -loss; // Negative profit
            }

            // Update User
            const user = await getUser(inv.userId);
            if (user) {
                await update(ref(db, `users/${inv.userId}`), {
                    cash: user.cash + finalAmount,
                    investment_profit: (user.investment_profit || 0) + (profit > 0 ? profit : 0)
                });

                // Log to Record Channel
                const channel = client.channels.cache.get(CHANNELS.BUSINESS_INVEST_RECORD);
                if (channel) {
                    const date = new Date().toLocaleString();
                    channel.send(`**Investment Result for ${user.username}**\nDate: ${date}\nInvested: ${fmt(inv.amount)}\nResult: ${win ? 'PROFIT' : 'LOSS'}\nProfit: ${win ? fmt(profit) : '$0'}\nLoss: ${!win ? fmt(loss) : '$0'}`);
                }
            }

            // Remove active investment, add to history (optional, simplified to delete here)
            await set(ref(db, `investments/${key}`), null);
        }
    }
}, 60000);

// 3. Jail Timer Loop
setInterval(async () => {
    const snapshot = await get(ref(db, 'users'));
    if (!snapshot.exists()) return;
    const users = snapshot.val();
    const now = Date.now();

    for (const [userId, user] of Object.entries(users)) {
        if (user.role === 'prisoner' && user.release_time && now >= user.release_time) {
            // Release Prisoner
            await update(ref(db, `users/${userId}`), {
                role: 'robber', // Default back to robber? or citizen? User implied robbers get caught.
                release_time: null,
                special_id: generateID(3) // New ID after jail
            });
            const channel = client.channels.cache.get(CHANNELS.PRISON_JAIL);
            if(channel) channel.send(`<@${userId}> has been released from jail.`);
        }
    }
}, 60000);

// --- LEADERBOARD UPDATER (Every 5 mins) ---
setInterval(async () => {
    updateLeaderboards();
}, 5 * 60 * 1000);

async function updateLeaderboards() {
    const snapshot = await get(ref(db, 'users'));
    if (!snapshot.exists()) return;
    const users = Object.values(snapshot.val());

    // 1. Top Officers (Cases Solved)
    const topCops = [...users].filter(u => u.role === 'police').sort((a, b) => b.cases_solved - a.cases_solved).slice(0, 50);
    sendLeaderboard(CHANNELS.TOP_OFFICERS, "👮 TOP OFFICERS (Cases Solved)", topCops.map((u, i) => `${i+1}. ${u.username} - ${u.cases_solved} Cases`));

    // 2. Richest Users (Leaderboard Main - Mixed)
    const richest = [...users].sort((a, b) => b.cash - a.cash).slice(0, 50);
    // Combine with top cops for the "Main" board
    const mainBoardText = `**Richest Users**\n` + richest.map((u, i) => `${i+1}. ${u.username} - ${fmt(u.cash)}`).join('\n');
    sendLeaderboard(CHANNELS.LEADERBOARD_MAIN, "🏆 SECTOR 7 MAIN LEADERBOARD", [mainBoardText]); // Pass as array for logic

    // 3. Loot Leaderboard
    const topRobbers = [...users].sort((a, b) => b.total_stolen - a.total_stolen).slice(0, 50);
    sendLeaderboard(CHANNELS.LOOT_LEADERBOARD, "💰 TOP ROBBERS (Cash Stolen)", topRobbers.map((u, i) => `${i+1}. ${u.username} - ${fmt(u.total_stolen)}`));

    // 4. Top Investors
    const topInvestors = [...users].filter(u => u.role === 'businessman').sort((a, b) => b.investment_profit - a.investment_profit).slice(0, 50);
    sendLeaderboard(CHANNELS.TOP_INVESTORS, "📈 TOP INVESTORS (Profit)", topInvestors.map((u, i) => `${i+1}. ${u.username} - ${fmt(u.investment_profit)}`));
}

async function sendLeaderboard(channelId, title, lines) {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    // Fetch last message to edit, or send new
    const messages = await channel.messages.fetch({ limit: 1 });
    const lastMsg = messages.first();

    let description = Array.isArray(lines) ? lines.join('\n') : lines;
    if (description.length > 4000) description = description.substring(0, 4000) + "...";

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description || "No data yet.")
        .setColor(0x00FF00)
        .setTimestamp();

    if (lastMsg && lastMsg.author.id === client.user.id) {
        await lastMsg.edit({ embeds: [embed] });
    } else {
        await channel.send({ embeds: [embed] });
    }
}

// --- COMMAND HANDLER ---

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.trim();
    const userId = message.author.id;
    const username = message.author.username;

    // Ensure user exists in DB
    let user = await getUser(userId);
    if (!user) {
        // Determine role from Discord Role
        const role = getDiscordRole(message.member);
        user = await createUser(userId, username, role);
    }

    // --- MENU ---
    if (content === '/menu') {
        const embed = new EmbedBuilder().setTitle("Sector 7 Command Menu").setDescription(`
        **/bl** - Check your wealth
        **Role: ${user.role.toUpperCase()}**
        ${user.role === 'robber' ? '`/scantarget` - Scan for victims ($200)\n`@User/rob<guess>` - Rob a target ($100)' : ''}
        ${user.role === 'police' ? '`@User/arrest<guess>` - Arrest a robber ($500)' : ''}
        ${user.role === 'businessman' ? '`/invest <amount>` - Invest cash\n`/investst` - Investment Status\n`/investpst` - History' : ''}
        `);
        return message.reply({ embeds: [embed] });
    }

    // --- BALANCE ---
    if (content === '/bl') {
        return message.reply(`💳 **${user.username}**\nRole: ${user.role}\nWealth: ${fmt(user.cash)}\nID: ${user.special_id}`);
    }

    // --- ROBBER COMMANDS ---
    if (user.role === 'robber') {
        // Scan Target
        if (content === '/scantarget') {
            if (user.cash < 200) return message.reply("You don't have enough cash ($200 needed).");
            
            await update(ref(db, `users/${userId}`), { cash: user.cash - 200 });

            // Fetch all users
            const snapshot = await get(ref(db, 'users'));
            const allUsers = snapshot.val();
            let msg = "**Scan Results:**\n";
            
            // Randomly pick 5 targets to avoid spamming chat
            const targets = Object.values(allUsers).filter(u => u.role === 'citizen' || u.role === 'businessman');
            const sample = targets.sort(() => 0.5 - Math.random()).slice(0, 10);

            sample.forEach(t => {
                msg += `Name: ${t.username} | Role: ${t.role} | Wealth: ${fmt(t.cash)} | ID: ${maskID(t.special_id, t.role)}\n`;
            });

            return message.author.send(msg).then(() => message.reply("Sent scan results to DM.")).catch(() => message.reply("Please open DMs."));
        }

        // Rob Command Logic: @User/rob123
        // Regex to match mention + /rob + digits
        // Matches: <@123> /rob123 OR <@123>/rob123
        const robRegex = /<@!?(\d+)>\s*\/rob(\d+)/;
        const match = content.match(robRegex);

        if (match) {
            const targetId = match[1];
            const guess = match[2];

            if (user.cash < 100) return message.reply("You need $100 to attempt a robbery.");
            
            const targetUser = await getUser(targetId);
            if (!targetUser) return message.reply("Target not found.");
            if (targetUser.role !== 'citizen' && targetUser.role !== 'businessman') return message.reply("You can only rob Citizens or Businessmen.");

            // Cooldown check (Cannot rob same person twice if successful)
            if (user.robbery_history && user.robbery_history[targetId]) {
                 // Check logic: "Cannot rob same person twice if guessed correctly"
                 // If failed previously, they have 30 min cooldown.
                 // We need a cooldown field specifically for this target.
                 const lastRobAttempt = user.robbery_cooldowns ? user.robbery_cooldowns[targetId] : 0;
                 if (Date.now() - lastRobAttempt < 30 * 60 * 1000) return message.reply("You must wait 30 mins before robbing this person again.");
            }

            // Deduct cost
            await update(ref(db, `users/${userId}`), { cash: user.cash - 100 });

            const actualID = targetUser.special_id;
            let percentStolen = 0;

            // Guess Logic
            // Businessman (6 digits, guess last 3)
            // Citizen (3 digits, guess last 1)
            
            const numericGuess = parseInt(guess);
            const numericActual = parseInt(actualID);
            const diff = Math.abs(numericGuess - numericActual);

            if (diff === 0) percentStolen = 0.10; // Exact
            else if (diff <= 50) percentStolen = 0.02; // Close
            else if (diff <= 200) percentStolen = 0.01; // Somewhat close

            if (percentStolen > 0) {
                // Success
                // Check if already robbed successfully
                if (user.robbery_history && user.robbery_history[targetId]) {
                    return message.reply("You have already robbed this person successfully. Move on.");
                }

                const stolenAmount = Math.floor(targetUser.cash * percentStolen);
                
                // Transaction
                await update(ref(db, `users/${targetId}`), { 
                    cash: targetUser.cash - stolenAmount,
                    special_id: generateID(targetUser.role === 'businessman' ? 6 : 3) // Generate NEW ID for victim
                });
                
                await update(ref(db, `users/${userId}`), { 
                    cash: user.cash + stolenAmount,
                    total_stolen: (user.total_stolen || 0) + stolenAmount,
                    [`robbery_history/${targetId}`]: true // Mark as robbed
                });

                // Feed
                const feedChannel = client.channels.cache.get(CHANNELS.CRIME_FEEDS);
                if(feedChannel) feedChannel.send(`🚨 **ROBBERY!** ${user.username} robbed ${targetUser.username} and stole ${fmt(stolenAmount)}!`);

                return message.reply(`✅ Success! You guessed close enough and stole ${fmt(stolenAmount)} (${percentStolen*100}%)`);
            } else {
                // Fail - Cooldown
                await update(ref(db, `users/${userId}`), { [`robbery_cooldowns/${targetId}`]: Date.now() });
                return message.reply("❌ Wrong ID guess. You failed.");
            }
        }
    }

    // --- POLICE COMMANDS ---
    if (user.role === 'police') {
        const arrestRegex = /<@!?(\d+)>\s*\/arrest(\d+)/;
        const match = content.match(arrestRegex);

        if (match) {
            const targetId = match[1];
            const guess = match[2]; // Last 1 digit

            if (user.cash < 500) return message.reply("You need $500 to attempt an arrest.");

            const targetUser = await getUser(targetId);
            if (!targetUser || targetUser.role !== 'robber') return message.reply("Target is not a robber.");

            await update(ref(db, `users/${userId}`), { cash: user.cash - 500 });

            // Check guess (Last 1 digit)
            const actualLastDigit = targetUser.special_id.slice(-1);
            
            if (guess === actualLastDigit) {
                // Success
                const seized = Math.floor(targetUser.cash * 0.80); // Robber loses 80%
                const reward = Math.floor(seized * 0.03); // Cop gets 3% of seized

                // Update Robber (Prisoner)
                await update(ref(db, `users/${targetId}`), { 
                    cash: targetUser.cash - seized,
                    role: 'prisoner',
                    release_time: Date.now() + (10 * 60 * 1000), // 10 mins jail
                    jail_count: (targetUser.jail_count || 0) + 1
                });

                // Update Cop
                await update(ref(db, `users/${userId}`), {
                    cash: user.cash + reward,
                    cases_solved: (user.cases_solved || 0) + 1
                });

                // Logs
                const jailChannel = client.channels.cache.get(CHANNELS.PRISON_JAIL);
                if(jailChannel) jailChannel.send(`🔒 **ARRESTED!** <@${targetId}> has been jailed by <@${userId}> for 10 minutes.`);

                const recordChannel = client.channels.cache.get(CHANNELS.POLICE_RECORDS);
                if(recordChannel) recordChannel.send(`📂 **CASE SOLVED**\nOfficer: ${user.username}\nCriminal: ${targetUser.username}\nSeized: ${fmt(seized)}\nReward: ${fmt(reward)}`);

                return message.reply(`✅ You arrested the robber! Reward: ${fmt(reward)}`);

            } else {
                return message.reply("❌ Wrong digit. Arrest failed.");
            }
        }
    }

    // --- BUSINESSMAN COMMANDS ---
    if (user.role === 'businessman') {
        // /invest 1000
        if (content.startsWith('/invest ')) {
            const amount = parseInt(content.split(' ')[1]);
            if (isNaN(amount) || amount <= 0) return message.reply("Invalid amount.");
            if (user.cash < amount) return message.reply("Not enough cash.");

            // Deduct Cash
            await update(ref(db, `users/${userId}`), { cash: user.cash - amount });

            // Create Investment
            const investId = Date.now().toString();
            await set(ref(db, `investments/${investId}`), {
                userId: userId,
                amount: amount,
                start_time: Date.now(),
                end_time: Date.now() + (10 * 60 * 1000) // 10 mins
            });

            return message.reply(`📉 Invested ${fmt(amount)}. Returns in 10 minutes.`);
        }

        if (content === '/investst') {
            // Get active investments
            // Note: In real app, querying via index is better, but here we scan for simplicity
            const snapshot = await get(ref(db, 'investments'));
            if (!snapshot.exists()) return message.reply("No active investments.");
            
            let msg = "**Active Investments:**\n";
            let found = false;
            for (const inv of Object.values(snapshot.val())) {
                if (inv.userId === userId) {
                    const timeLeft = Math.ceil((inv.end_time - Date.now()) / 60000);
                    msg += `Amt: ${fmt(inv.amount)} | Time Left: ${timeLeft} mins\n`;
 found = true;
                }
            }
            if(!found) return message.reply("No active investments.");
            return message.reply(msg);
        }
    }
});

client.once('ready', () => {
    console.log(`Sector 7 Bot Online as ${client.user.tag}`);
    updateLeaderboards(); // Run immediately on start
});

client.login(DISCORD_TOKEN);
// --- KEEP ALIVE (WEB SERVER) ---
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Sector 7 Bot is active!');
});

server.listen(3000, () => {
    console.log('Keep-Alive Server running on port 3000');
});
