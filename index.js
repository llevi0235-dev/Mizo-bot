// --- RENDER KEEP ALIVE (Fake Server) ---
const http = require('http');
const port = process.env.PORT || 8000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WhatsApp Bot is Running!');
});
server.listen(port, () => {
    console.log(`✅ Server is listening on port ${port} (Render compatible)`);
});

console.log("▶️ SYSTEM STARTING... PLEASE WAIT...");

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, 
    jidNormalizedUser
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

// --- CONFIGURATION ---
// IMPORTANT: Put your phone number here in the format shown (without +)
const ADMIN_NUMBER = "919233137736"; 
const MY_NUMBER = "919233137736";   
const DB_FILE = './database.json';

// --- DATABASE & STATE ---
let db = {
    users: {},
    bank: 0,
    investments: [],
    banned: []
};

// Load Database
if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE));
    } catch(e) {
        console.log("Database corrupted, creating new one.");
        saveDB();
    }
} else {
    saveDB();
}

function saveDB() {
    // Write synchronously to ensure data is saved immediately
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error("Error saving database:", err);
    }
}

// --- HELPER FUNCTIONS ---
const getTimestamp = () => Date.now();
const formatMoney = (amount) => `₹${amount.toLocaleString()}`;
const txt = (eng, mizo) => `🇬🇧 ${eng}\n🇲🇿 ${mizo}`;

const generateID = (role) => {
    // Business: 6 digits, Others: 3 digits
    if (role === 'businessman') return Math.floor(100000 + Math.random() * 900000).toString(); 
    return Math.floor(100 + Math.random() * 900).toString(); 
};

const getUser = (jid, name) => {
    if (!db.users[jid]) {
        db.users[jid] = {
            id: generateID('citizen'),
            role: 'citizen',
            cash: 10000,
            name: name || 'Unknown',
            lastIncome: getTimestamp(),
            casesSolved: 0,
            bodyguard: null, 
            employer: null, 
            loanRepayCount: 0, // Track 9% returns
            robbedSuccessBy: [], // Who successfully robbed me
            cooldowns: { roleChange: 0, roleChangeCount: 0, jail: 0, robFail: {} } // robFail tracks wait time per target
        };
        saveDB();
    }
    if (name) db.users[jid].name = name;
    return db.users[jid];
};

// --- LOGIC LOOP (Income & Investments) ---
setInterval(() => {
    const now = getTimestamp();
    let updated = false;

    // 1. INVESTMENTS & LOAN REPAYMENT LOGIC
    const activeInvestments = db.investments.filter(inv => now < inv.endTime);
    const finishedInvestments = db.investments.filter(inv => now >= inv.endTime);

    finishedInvestments.forEach(inv => {
        const user = db.users[inv.jid];
        if (!user) return;

        const isSuccess = Math.random() < 0.4; // 40% Success
        if (isSuccess) {
            const multiplier = Math.floor(Math.random() * 5) + 1; 
            let profit = inv.amount * multiplier;
            
            // Loan Repayment Logic (9% to bank if active loan debt exists)
            if (user.loanRepayCount > 0) {
                const tax = Math.floor(profit * 0.09);
                profit -= tax;
                db.bank += tax;
                user.loanRepayCount--;
            }

            user.cash += inv.amount + profit;
        } else {
            const lossPct = Math.floor(Math.random() * 100) + 1; 
            const loss = Math.floor(inv.amount * (lossPct / 100));
            const refund = inv.amount - loss;
            user.cash += refund;
            db.bank += loss; 
        }
        updated = true;
    });
    
    if (finishedInvestments.length > 0) {
        db.investments = activeInvestments;
        updated = true;
    }

    // 2. PASSIVE INCOME
    for (let jid in db.users) {
        const user = db.users[jid];
        
        // Handle Jail Release
        if (user.role === 'thief' && user.cooldowns.jail > 0 && now > user.cooldowns.jail) {
            user.cooldowns.jail = 0;
            user.id = generateID('thief'); 
            updated = true;
        }

        const limits = { citizen: 30, thief: 20, police: 30, businessman: 30 };
        const amounts = { citizen: 400, thief: 50, police: 450, businessman: 1000 };
        const minutes = limits[user.role] || 30;
        
        // Give Income
        if (now - user.lastIncome >= minutes * 60 * 1000) {
            if (user.role === 'thief' && user.cooldowns.jail > 0) continue; // No income in jail
            user.cash += amounts[user.role] || 0;
            user.lastIncome = now;
            updated = true;
        }
    }

    if (updated) saveDB();
}, 60 * 1000); // Check every minute

// --- MAIN BOT CONNECTION ---
async function startBot() {
    console.log("▶️ Loading Authentication...");
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) 
        },
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        getMessage: async (key) => { return undefined; }
    });

    if (!sock.authState.creds.me && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(MY_NUMBER);
                console.log(`CODE: ${code}`);
            } catch (err) { console.log("Error requesting code", err); }
        }, 5000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ BOT CONNECTED SUCCESSFULLY!');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const sender = jidNormalizedUser(msg.key.participant || from);
        
        // Extract Body
        const type = Object.keys(msg.message)[0];
        const body = (type === 'conversation') ? msg.message.conversation : 
                     (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : '';
        
        // Basic Parsers
        if (!body.startsWith('/') && !body.startsWith('@')) return;
        
        const args = body.trim().split(/ +/);
        let command = args[0].toLowerCase();
        
        // Handle @user/command syntax
        const isTagCommand = body.includes('/');
        let mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        
        // If user typed @User/rob123, 'command' might be '@919.../rob123'
        if (isTagCommand && command.includes('@')) {
            const parts = command.split('/');
            if (parts.length > 1) {
                command = '/' + parts[1].replace(/\d+/g, ''); // Extract 'rob' from 'rob123'
            }
        }

        // Get User Data
        const pushName = msg.pushName || "User";
        if (db.banned.includes(sender)) return; // Ignored banned users
        const user = getUser(sender, pushName);
        const isAdmin = sender.includes(ADMIN_NUMBER);

        // --- COMMANDS START ---

        // 1. MENU
        if (command === '/menu') {
            await sock.sendMessage(from, { text: txt(
                "📜 *GAME MENU*\n\n*Roles:*\n👮 /crlps (Police)\n🦹 /crltf (Thief)\n🤵 /crlbs (Businessman)\n\n*Stats:*\n🔍 /status (My Info)\n💰 /ubank (Universal Bank)\n🏆 /toppolice (Top Cops)\n🤑 /richestman (Top Rich)\n\n*Thief:*\n🎯 /scantarget (200)\n🚔 /scanps (100)\n@user/rob[ID] (100)\n\n*Police:*\n📡 /scan (200)\n@user/arrest[ID] (50)\n\n*Business:*\n💸 /invest[amount]\n🤝 @user/hire\n🏦 /loan[amount]", 
                "📜 *INKHEL MENU*\n\n*Nihna:*\n👮 /crlps (Police)\n🦹 /crltf (Rukru)\n🤵 /crlbs (Sumdawng)\n\n*Stats:*\n🔍 /status (Ka Chanchin)\n💰 /ubank (Universal Bank)\n🏆 /toppolice (Police Tha)\n🤑 /richestman (Mi Hausa)\n\n*Rukru:*\n🎯 /scantarget (Man 200)\n🚔 /scanps (Man 100)\n@user/rob[ID] (Man 100)\n\n*Police:*\n📡 /scan (Man 200)\n@user/arrest[ID] (Man 50)\n\n*Sumdawng:*\n💸 /invest[zat]\n🤝 @user/hire\n🏦 /loan[zat]"
            )});
        }

        // 2. ROLE SELECTION
        if (['/crlps', '/crltf', '/crlbs'].includes(command)) {
            // Cooldown Check
            if (!isAdmin && user.cooldowns.roleChangeCount >= 2 && Date.now() < user.cooldowns.roleChange) {
                const waitDays = Math.ceil((user.cooldowns.roleChange - Date.now()) / (1000 * 60 * 60 * 24));
                return sock.sendMessage(from, { text: txt(`Wait ${waitDays} days to change role.`, `Nihna thlak turin ni ${waitDays} i nghah a ngai.`) });
            }

            let newRole = '';
            let msgEng = '', msgMiz = '';

            if (command === '/crlps') { newRole = 'police'; msgEng = 'Role: Police'; msgMiz = 'Nihna: Police'; }
            if (command === '/crltf') { newRole = 'thief'; msgEng = 'Role: Thief'; msgMiz = 'Nihna: Rukru'; }
            if (command === '/crlbs') { 
                newRole = 'businessman'; 
                msgEng = 'Role: Businessman (+500k bonus)'; 
                msgMiz = 'Nihna: Sumdawng (+500k bonus)';
                if (user.role !== 'businessman') user.cash += 500000; 
            }

            user.role = newRole;
            user.id = generateID(newRole);
            
            if (!isAdmin) {
                user.cooldowns.roleChangeCount++;
                if (user.cooldowns.roleChangeCount >= 2) {
                    user.cooldowns.roleChange = Date.now() + (2 * 24 * 60 * 60 * 1000); 
                }
            }
            saveDB();
            await sock.sendMessage(from, { text: txt(msgEng, msgMiz) });
        }

        // 3. THIEF LOGIC
        if (user.role === 'thief') {
            // Jail Check
            if (user.cooldowns.jail > Date.now()) {
                const timeLeft = Math.ceil((user.cooldowns.jail - Date.now()) / 60000);
                return sock.sendMessage(from, { text: txt(`🚫 You are in JAIL! Wait ${timeLeft} mins.`, `🚫 Tan inah i awm! Minute ${timeLeft} nghak rawh.`) });
            }

            // /scantarget
            if (command === '/scantarget') {
                if (!isAdmin && user.cash < 200) return sock.sendMessage(from, { text: txt("Need 200 cash.", "Pawisa 200 a ngai.") });
                if (!isAdmin) user.cash -= 200;

                let out = "🎯 *TARGET LIST*\n";
                for (let k in db.users) {
                    const u = db.users[k];
                    if (u.role === 'citizen' || u.role === 'businessman') {
                        let idVis = "";
                        // Logic: Citizen (3 digit, show 2), Bus (6 digit, show 3), Bus+BG (6 digit, show 2)
                        if (u.role === 'citizen') idVis = `${u.id.substring(0,2)}?`;
                        if (u.role === 'businessman') {
                            if (u.bodyguard) idVis = `${u.id.substring(0,2)}???? 🛡️`;
                            else idVis = `${u.id.substring(0,3)}???`;
                        }
                        out += `👤 @${u.name} | 💰 ${formatMoney(u.cash)} | ID: ${idVis}\n`;
                    }
                }
                saveDB();
                await sock.sendMessage(from, { text: out });
            }

            // /rob logic
            if (command.includes('rob')) {
                // Extract Guess ID from body (e.g. @user/rob123 -> 123)
                const guessStr = body.match(/\d+$/);
                const guess = guessStr ? parseInt(guessStr[0]) : null;

                if (!mentionedJid || !guess) return sock.sendMessage(from, { text: txt("Format: @user/rob[ID]", "Ti dan: @user/rob[ID]") });
                if (!isAdmin && user.cash < 100) return sock.sendMessage(from, { text: txt("Need 100 cash.", "Pawisa 100 a ngai.") });
                if (!isAdmin) user.cash -= 100;

                const target = db.users[mentionedJid];
                if (!target) return;

                // Rule: Cannot rob same person twice if successful
                if (target.robbedSuccessBy && target.robbedSuccessBy.includes(sender)) {
                    return sock.sendMessage(from, { text: txt("🚫 Already robbed this person!", "🚫 He pa hi i ru tawh!") });
                }

                // Rule: Wait 30 mins if failed previously
                if (user.cooldowns.robFail[mentionedJid] && Date.now() < user.cooldowns.robFail[mentionedJid]) {
                    return sock.sendMessage(from, { text: txt("🚫 Wait 30 mins to rob them again.", "🚫 Minute 30 nghak rawh.") });
                }

                const realID = parseInt(target.id);
                const diff = Math.abs(realID - guess);
                let percent = 0;

                if (diff === 0) percent = 0.10; // Exact match
                else if (diff < 10) percent = 0.02; // Close
                else if (diff < 50) percent = 0.01; // Sort of close

                if (percent > 0) {
                    // SUCCESS
                    const stolen = Math.floor(target.cash * percent);
                    target.cash -= stolen;
                    user.cash += stolen;
                    
                    if (!target.robbedSuccessBy) target.robbedSuccessBy = [];
                    target.robbedSuccessBy.push(sender);
                    
                    target.id = generateID(target.role); // New ID for victim
                    
                    await sock.sendMessage(from, { text: txt(`✅ SUCCESS! Stole ${formatMoney(stolen)}`, `✅ I HLAWHTLING! ${formatMoney(stolen)} i ru.`) });
                } else {
                    // FAIL
                    user.cooldowns.robFail[mentionedJid] = Date.now() + (30 * 60 * 1000);
                    await sock.sendMessage(from, { text: txt("❌ FAILED! Wrong ID.", "❌ I hlawhchham! ID dik lo.") });
                }
                saveDB();
            }
        }

        // 4. POLICE LOGIC
        if (user.role === 'police') {
            if (command === '/scan') {
                if (!isAdmin && user.cash < 200) return sock.sendMessage(from, { text: txt("Need 200 cash.", "Pawisa 200 a ngai.") });
                if (!isAdmin) user.cash -= 200;

                let out = "📡 *THIEF SCAN*\n";
                for (let k in db.users) {
                    const t = db.users[k];
                    if (t.role === 'thief') {
                        // ID Logic: Thief has 3 digits, Police scan shows "12?"
                        out += `🦹 @${t.name} | ID: ${t.id.substring(0,2)}? | Reward: ${formatMoney(Math.floor(t.cash * 0.03))}\n`;
                    }
                }
                saveDB();
                await sock.sendMessage(from, { text: out });
            }

            if (command.includes('arrest')) {
                const guessStr = body.match(/\d+$/);
                const guess = guessStr ? parseInt(guessStr[0]) : null;

                if (!mentionedJid || !guess) return sock.sendMessage(from, { text: txt("Format: @user/arrest[ID]", "Ti dan: @user/arrest[ID]") });
                if (!isAdmin && user.cash < 50) return sock.sendMessage(from, { text: txt("Need 50 cash.", "Pawisa 50 a ngai.") });
                if (!isAdmin) user.cash -= 50;

                const thief = db.users[mentionedJid];
                if (!thief || thief.role !== 'thief') return sock.sendMessage(from, { text: txt("Not a thief!", "Rukru a ni lo!") });

                if (parseInt(thief.id) === guess) {
                    // SUCCESS
                    const seized = Math.floor(thief.cash * 0.80);
                    const reward = Math.floor(thief.cash * 0.03); 
                    const toBank = seized - reward;

                    thief.cash -= seized;
                    user.cash += reward;
                    db.bank += toBank;
                    user.casesSolved++;

                    thief.cooldowns.jail = Date.now() + (5 * 60 * 1000); // 5 mins jail
                    thief.id = generateID('thief');

                    await sock.sendMessage(from, { text: txt(`✅ ARRESTED! Reward: ${formatMoney(reward)}`, `✅ MAN A NI! Lawmman: ${formatMoney(reward)}`) });
                } else {
                    await sock.sendMessage(from, { text: txt("❌ Wrong ID!", "❌ ID dik lo!") });
                }
                saveDB();
            }
        }

        // 5. BUSINESSMAN LOGIC
        if (user.role === 'businessman') {
            // Invest
            if (command.startsWith('/invest') && !command.includes('pst')) {
                const amount = parseInt(command.replace(/\D/g, ''));
                if (!amount || user.cash < amount) return sock.sendMessage(from, { text: txt("Not enough cash.", "Pawisa i daih lo.") });

                user.cash -= amount;
                db.investments.push({
                    jid: sender,
                    amount: amount,
                    endTime: isAdmin ? Date.now() + 1000 : Date.now() + (30 * 60 * 1000)
                });
                saveDB();
                await sock.sendMessage(from, { text: txt(`Invested ${formatMoney(amount)}`, `${formatMoney(amount)} invest a ni e`) });
            }

            // Loan
            if (command.startsWith('/loan')) {
                const amount = parseInt(command.replace(/\D/g, ''));
                if (!amount) return;
                
                // Send Request to Admin/Owner
                await sock.sendMessage(ADMIN_NUMBER + "@s.whatsapp.net", { 
                    text: `🏦 *LOAN REQUEST*\nUser: @${user.name} (${sender.split('@')[0]})\nAmount: ${amount}\n\nTo accept type:\n/grantloan @user ${amount}` 
                });
                await sock.sendMessage(from, { text: txt("Loan request sent.", "Loan dilna thawn a ni.") });
            }

            // Hire Police
            if (command.includes('hire')) {
                if (!mentionedJid) return;
                const cop = db.users[mentionedJid];
                if (cop.role === 'police' && !cop.employer) {
                    cop.employer = sender;
                    user.bodyguard = mentionedJid;
                    saveDB();
                    await sock.sendMessage(from, { text: txt("Bodyguard Hired!", "Bodyguard chhawr a ni!") });
                } else {
                    await sock.sendMessage(from, { text: txt("Cannot hire this person.", "A chhawr theih loh.") });
                }
            }
        }

        // 6. LEADERBOARDS & UTILS
        if (command === '/toppolice') {
            const sorted = Object.values(db.users)
                .filter(u => u.role === 'police')
                .sort((a, b) => b.casesSolved - a.casesSolved)
                .slice(0, 10);
            let out = "🏆 *TOP POLICE*\n";
            sorted.forEach((u, i) => out += `${i+1}. ${u.name} - ${u.casesSolved} cases\n`);
            await sock.sendMessage(from, { text: out });
        }

        if (command === '/richestman') {
            const sorted = Object.values(db.users)
                .sort((a, b) => b.cash - a.cash)
                .slice(0, 10);
            let out = "💰 *RICHEST PEOPLE*\n";
            sorted.forEach((u, i) => out += `${i+1}. ${u.name} - ${formatMoney(u.cash)}\n`);
            await sock.sendMessage(from, { text: out });
        }
        
        if (command === '/status') {
            let dRole = user.role === 'thief' ? 'citizen' : user.role;
            if (isAdmin) dRole = user.role; // Admin sees real role
            await sock.sendMessage(from, { text: txt(
                `Name: ${user.name}\nRole: ${dRole}\nCash: ${formatMoney(user.cash)}\nCases: ${user.casesSolved}`, 
                `Hming: ${user.name}\nNihna: ${dRole}\nPawisa: ${formatMoney(user.cash)}\nCase chin fel: ${user.casesSolved}`
            )});
        }
        
        if (command === '/ubank') {
             await sock.sendMessage(from, { text: `🏦 Universal Bank: ${formatMoney(db.bank)}` });
        }

        // 7. ADMIN COMMANDS
        if (isAdmin) {
            // Grant Loan: /grantloan @user 10000
            if (command === '/grantloan' && mentionedJid) {
                const amount = parseInt(args[2]);
                if (amount && db.users[mentionedJid]) {
                    db.bank -= amount;
                    db.users[mentionedJid].cash += amount;
                    db.users[mentionedJid].loanRepayCount += 10; // Next 10 investments pay 9%
                    saveDB();
                    await sock.sendMessage(from, { text: "✅ Loan Granted & Money Sent!" });
                }
            }

            // Edit Status: @user/edit cash 9999
            if (command.includes('edit') && mentionedJid) {
                // simple parser: /edit [key] [value]
                // Note: Complex parsing omitted for brevity, giving manual control
                const target = db.users[mentionedJid];
                // Example usage: @user/edit cash 1000000
                if (body.includes('cash')) {
                    const val = parseInt(body.match(/\d+$/)[0]);
                    target.cash = val;
                    await sock.sendMessage(from, { text: "✅ Cash Updated" });
                }
                saveDB();
            }

            // Reveal ID: @user/id
            if (command.includes('id') && mentionedJid) {
                const target = db.users[mentionedJid];
                await sock.sendMessage(from, { text: `🕵️ REAL ID: ${target.id}` });
            }

            // Ban User: @user/band
            if (command.includes('band') && mentionedJid) {
                db.banned.push(mentionedJid);
                saveDB();
                await sock.sendMessage(from, { text: "🚫 User Banned." });
            }
        }
    });
}

startBot();