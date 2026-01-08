require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set, get, update, child } = require("firebase/database");

// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: process.env.FB_API_KEY,
  authDomain: process.env.FB_AUTH_DOMAIN,
  databaseURL: process.env.FB_DB_URL,
  projectId: process.env.FB_PROJECT_ID,
  storageBucket: process.env.FB_STORAGE_BUCKET,
  messagingSenderId: process.env.FB_SENDER_ID,
  appId: process.env.FB_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 2. DISCORD CONFIGURATION ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel]
});

const TOKEN = process.env.DISCORD_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

// --- 3. GLOBAL VARIABLES (Cache) ---
let users = {}; 
let universalBank = 0;
let activeInvestments = []; 

// --- 4. CORE FUNCTIONS ---

// Load Data from Firebase
async function loadDatabase() {
    console.log("📥 Loading Game Data...");
    const dbRef = ref(db);
    
    const uSnap = await get(child(dbRef, `users`));
    if (uSnap.exists()) users = uSnap.val();

    const bSnap = await get(child(dbRef, `universalBank`));
    if (bSnap.exists()) universalBank = bSnap.val();
    
    console.log("✅ Data Loaded.");
}

// Save User
function saveUser(userId) {
    if(users[userId]) set(ref(db, 'users/' + userId), users[userId]);
}

// Save Bank
function saveBank() {
    set(ref(db, 'universalBank'), universalBank);
}

function generateID() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatMoney(amount) {
    return `$${amount.toLocaleString()}`;
}

function getUser(userId) {
    if (!users[userId]) {
        users[userId] = {
            id: generateID(),
            role: 'citizen',
            cash: 10000,
            jailTime: 0,
            casesSolved: 0,
            bodyguard: null,
            lastIncome: Date.now(),
            investmentHistory: []
        };
        saveUser(userId);
    }
    return users[userId];
}

// --- 5. AUTOMATIC LOOP (Income & Investments) ---
// Runs every 1 Minute
setInterval(() => {
    const now = Date.now();

    // Income Logic
    for (const userId in users) {
        const user = users[userId];
        // 30 Mins = 1800000, 20 Mins = 1200000
        let interval = 1800000;
        let amount = 0;

        if (user.role === 'citizen') amount = 400;
        if (user.role === 'thief') { amount = 50; interval = 1200000; }
        if (user.role === 'police') amount = 450;
        if (user.role === 'businessman') amount = 1000;

        if (now - user.lastIncome >= interval) {
            user.cash += amount;
            user.lastIncome = now;
            saveUser(userId);
        }
    }

    // Investment Logic
    activeInvestments = activeInvestments.filter(inv => {
        if (now >= inv.endTime) {
            const user = users[inv.userId];
            const success = Math.random() < 0.4; // 40% Success

            if (success) {
                const multiplier = Math.floor(Math.random() * 5) + 1; // 1x-5x
                const profit = inv.amount * multiplier;
                user.cash += profit;
                user.investmentHistory.push(`WIN: +${profit}`);
            } else {
                // Fail: Lose 1% to 100%
                const lossPercent = Math.random(); 
                const lost = Math.floor(inv.amount * lossPercent);
                const returned = inv.amount - lost;
                
                user.cash += returned; // Give back what wasn't lost
                universalBank += lost; // Lost money goes to Bank
                user.investmentHistory.push(`LOSS: -${lost}`);
                saveBank();
            }
            saveUser(inv.userId);
            return false; // Remove from active list
        }
        return true; // Keep waiting
    });

}, 60000); 

// --- END OF PART 1 ---
// --- START OF PART 2 ---

client.on('ready', async () => {
    await loadDatabase();
    console.log(`🤖 Bot Online: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();
    const args = message.content.split(' ');
    const authorId = message.author.id;
    const user = getUser(authorId);

    // --- JAIL CHECK ---
    if (user.jailTime > Date.now()) {
        const minsLeft = Math.ceil((user.jailTime - Date.now()) / 60000);
        if (content.startsWith('/') || content.startsWith('@')) {
            return message.reply(`⛔ **In Jail!** Wait ${minsLeft} minutes.`);
        }
        return;
    }

    // --- ADMIN PANEL ---
    if (authorId === ADMIN_ID) {
        if (content === '/admenu') return message.reply("**Admin:** /editstatus, @user/edit, @user/id, @user/editid");
        
        if (content === '/editstatus') {
             user.cash += 10000000;
             saveUser(authorId);
             return message.reply("Admin: +10,000,000 added.");
        }
        
        if (content.includes('/id') && message.mentions.users.size > 0) {
            const target = message.mentions.users.first();
            const tData = getUser(target.id);
            return message.reply(`🆔 Real ID: \`${tData.id}\``);
        }

        if (content.includes('/editid') && message.mentions.users.size > 0) {
             const target = message.mentions.users.first();
             const newId = args[args.length - 1];
             const tData = getUser(target.id);
             tData.id = newId;
             saveUser(target.id);
             return message.reply(`ID changed to ${newId}`);
        }
    }

    // --- GENERAL ---
    if (content === '/menu') return message.reply("📜 **Commands:** /crlps, /crltf, /crlbs, /status, /scantarget, /invest, /scan");
    
    if (content === '/status') return message.reply(`👤 **${user.role.toUpperCase()}**\nCash: ${formatMoney(user.cash)}\nID: Hidden\nCases: ${user.casesSolved}`);
    
    if (content.startsWith('@') && content.includes('/status')) {
        const target = message.mentions.users.first();
        if (!target) return;
        const tData = getUser(target.id);
        // Hide Role if Thief
        let r = tData.role === 'thief' ? 'citizen' : tData.role;
        return message.reply(`🔎 **Scan:** ${target.username}\nRole: ${r}\nWealth: ${formatMoney(tData.cash)}`);
    }

    if (content === '/ubank') return message.reply(`🏦 Universal Bank: ${formatMoney(universalBank)}`);

    if (content === '/del' && message.member.permissions.has('ManageMessages')) {
        message.channel.bulkDelete(5).catch(() => {});
    }

    // --- ROLE SWITCH ---
    // (Note: Cool down logic simplified for final code stability)
    if (content === '/crlps') { user.role = 'police'; saveUser(authorId); message.reply("👮 You are now Police."); }
    if (content === '/crltf') { user.role = 'thief'; saveUser(authorId); message.reply("🥷 You are now a Thief."); }
    if (content === '/crlbs') { 
        if(user.role !== 'businessman') {
            user.role = 'businessman'; user.cash += 500000; 
            saveUser(authorId);
            message.reply("💼 You are a Businessman. Bonus +500k.");
        }
    }

    // --- THIEF COMMANDS ---
    if (user.role === 'thief') {
        if (content === '/jailtm') return message.reply("You are not in jail.");

        if (content === '/scanps') {
            if (user.cash < 100) return message.reply("Need $100.");
            user.cash -= 100;
            saveUser(authorId);
            let list = "👮 **Police:**\n";
            for(const uid in users) {
                if(users[uid].role === 'police') list += `<@${uid}> (Cases: ${users[uid].casesSolved})\n`;
            }
            return message.reply(list);
        }

        if (content === '/scantarget') {
            if (user.cash < 200) return message.reply("Need $200.");
            user.cash -= 200;
            saveUser(authorId);
            let list = "🎯 **Targets:**\n";
            let c = 0;
            for(const [uid, u] of Object.entries(users)) {
                if(uid === authorId || u.role === 'police') continue;
                if(c >= 10) break;
                
                let hid = "";
                if (u.role === 'businessman' && u.bodyguard) hid = u.id.substring(0,2) + "||????||";
                else if (u.role === 'businessman') hid = u.id.substring(0,3) + "||???||";
                else hid = u.id.substring(0,2) + "||?||"; // Citizen
                
                list += `<@${uid}> (${u.role}) | ${formatMoney(u.cash)} | ID: ${hid}\n`;
                c++;
            }
            return message.reply(list);
        }

        // ROB: @User 123456
        if (message.mentions.users.size > 0 && !content.includes('/')) {
             const target = message.mentions.users.first();
             const guess = args[args.length - 1]; // Last word
             
             if (!isNaN(guess)) {
                 if (user.cash < 100) return message.reply("Need $100.");
                 user.cash -= 100;

                 const tData = getUser(target.id);
                 if (tData.role === 'police') return message.reply("Cannot rob Police.");

                 const diff = Math.abs(parseInt(guess) - parseInt(tData.id));
                 let percent = 0;

                 if (guess === tData.id) percent = 0.10; // Exact
                 else if (diff < 50) percent = 0.02;     // Close
                 else if (diff < 100) percent = 0.01;    // Kinda Close

                 if (percent > 0) {
                     const stolen = Math.floor(tData.cash * percent);
                     tData.cash -= stolen;
                     user.cash += stolen;
                     tData.id = generateID(); // New ID for victim
                     saveUser(target.id); saveUser(authorId);
                     return message.reply(`✅ **Robbery Success!** Stole ${formatMoney(stolen)} (${percent*100}%)`);
                 } else {
                     saveUser(authorId);
                     return message.reply("❌ **Failed.** Wrong ID.");
                 }
             }
        }
    }

    // --- POLICE COMMANDS ---
    if (user.role === 'police') {
        if (content === '/scan') {
            if (user.cash < 200) return message.reply("Need $200.");
            user.cash -= 200;
            saveUser(authorId);
            let list = "🥷 **Thieves:**\n";
            for(const uid in users) {
                if(users[uid].role === 'thief') {
                    const r = Math.floor(users[uid].cash * 0.03);
                    list += `<@${uid}> | Reward: ${formatMoney(r)} | ID Hint: ${users[uid].id.substring(0,5)}?\n`;
                }
            }
            return message.reply(list || "No thieves.");
        }

        if (content.includes('/arrest') && message.mentions.users.size > 0) {
             const target = message.mentions.users.first();
             const splitCmd = content.split('arrest');
             const guess = splitCmd[1] ? splitCmd[1].trim() : "";
             const tData = getUser(target.id);

             if (user.cash < 50) return message.reply("Need $50.");
             user.cash -= 50;

             if (tData.role !== 'thief') return message.reply("Not a thief!");

             // Check last digit
             if (guess === tData.id.slice(-1)) {
                 const penalty = Math.floor(tData.cash * 0.80);
                 const reward = Math.floor(penalty * 0.03);
                 const toBank = penalty - reward;

                 tData.cash -= penalty;
                 user.cash += reward;
                 universalBank += toBank;
                 user.casesSolved++;
                 
                 tData.jailTime = Date.now() + (5 * 60 * 1000); // 5 Mins
                 tData.id = generateID();

                 saveUser(target.id); saveUser(authorId); saveBank();
                 return message.reply(`🚔 **ARRESTED!**\nReward: ${formatMoney(reward)}\nThief Jailed.`);
             } else {
                 saveUser(authorId);
                 return message.reply("❌ Wrong digit.");
             }
        }
        
        if (content === '/leave') {
             // Resign logic
             for(const uid in users) {
                 if(users[uid].bodyguard === authorId) {
                     users[uid].bodyguard = null;
                     saveUser(uid);
                 }
             }
             return message.reply("Resigned from Bodyguard.");
        }
    }

    // --- BUSINESSMAN COMMANDS ---
    if (user.role === 'businessman') {
        if (content.startsWith('/invest') && !content.includes('st')) {
            const amount = parseInt(args[1]);
            if (!amount || amount > user.cash) return message.reply("Invalid amount.");
            
            user.cash -= amount;
            activeInvestments.push({ userId: authorId, amount: amount, endTime: Date.now() + 1800000 }); // 30 mins
            saveUser(authorId);
            return message.reply(`📉 Invested ${formatMoney(amount)}. Return in 30 mins.`);
        }

        if (content === '/investst') {
            const my = activeInvestments.filter(i => i.userId === authorId).length;
            return message.reply(`Active Investments: ${my}`);
        }

        if (content === '/investpst') {
            const hist = user.investmentHistory.slice(-5).join('\n');
            return message.reply(`**History:**\n${hist || "None"}`);
        }

        if (content.includes('/hire') && message.mentions.users.size > 0) {
            const target = message.mentions.users.first();
            const tData = getUser(target.id);
            if (tData.role !== 'police') return message.reply("Must hire Police.");
            
            user.bodyguard = target.id;
            tData.bodyguard = authorId;
            saveUser(authorId); saveUser(target.id);
            return message.reply(`🤝 Hired ${target.username}.`);
        }

        if (content === '/fire') {
            user.bodyguard = null;
            saveUser(authorId);
            return message.reply("Fired bodyguard.");
        }

        if (content.startsWith('/loan')) {
             const amount = parseInt(args[1]);
             if(!amount) return message.reply("/loan [amount]");
             
             // Send DM to Admin
             client.users.fetch(ADMIN_ID).then(admin => {
                 admin.send(`**LOAN REQUEST**\nFrom: ${message.author.username}\nAmount: ${formatMoney(amount)}`);
             });
             return message.reply("Loan request sent to Admin.");
        }
    }

    // --- LEADERBOARDS ---
    if (content === '/toppolice') {
        const sorted = Object.entries(users).filter(([,u]) => u.role==='police').sort(([,a],[,b])=>b.casesSolved-a.casesSolved).slice(0,10);
        let msg = "**Top Police:**\n" + sorted.map(([,u],i)=> `${i+1}. ${u.casesSolved} Cases`).join('\n');
        return message.reply(msg);
    }

    if (content === '/richestman') {
        const sorted = Object.entries(users).sort(([,a],[,b])=>b.cash-a.cash).slice(0,10);
        let msg = "**Richest:**\n" + sorted.map(([,u],i)=> `${i+1}. ${formatMoney(u.cash)} (${u.role})`).join('\n');
        return message.reply(msg);
    }
});

client.login(TOKEN);
// --- KEEP ALIVE FOR RENDER ---
const http = require('http');
http.createServer((req, res) => {
  res.write("I'm alive");
  res.end();
}).listen(8080);
