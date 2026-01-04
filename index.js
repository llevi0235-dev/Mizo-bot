const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

// --- CONFIGURATION ---
const ADMIN_NUMBER = "91923313773"; // Admin number
const OWNER_NUMBER = "919233137736"; // Bot Number
const DB_FILE = './database.json';

// --- DATABASE & STATE ---
let db = {
    users: {},
    bank: 0,
    loans: [],
    investments: []
};

// Load Database
if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE));
} else {
    saveDB();
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// --- HELPER FUNCTIONS ---
const getTimestamp = () => Date.now();
const formatMoney = (amount) => `₹${amount.toLocaleString()}`;

// Bilingual Response Helper
const txt = (eng, mizo) => `🇬🇧 ${eng}\n🇲🇿 ${mizo}`;

// ID Generator
const generateID = (role) => {
    if (role === 'businessman') return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    return Math.floor(100 + Math.random() * 900).toString(); // 3 digits
};

// Get User (Create if not exists)
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
            cooldowns: {
                roleChange: 0,
                roleChangeCount: 0,
                rob: 0,
                jail: 0
            }
        };
        saveDB();
    }
    return db.users[jid];
};

// --- GAME LOGIC LOOP (Income & Investments) ---
setInterval(() => {
    const now = getTimestamp();
    let updated = false;

    for (let jid in db.users) {
        const user = db.users[jid];

        // 1. JAIL TIME CHECK
        if (user.cooldowns.jail > 0 && now > user.cooldowns.jail) {
            user.cooldowns.jail = 0;
            user.id = generateID('thief'); // New ID after jail
            updated = true;
        }

        // 2. PASSIVE INCOME
        // Citizen: 400 every 30m
        if (user.role === 'citizen' && now - user.lastIncome >= 30 * 60 * 1000) {
            user.cash += 400;
            user.lastIncome = now;
            updated = true;
        }
        // Thief: 50 every 20m
        if (user.role === 'thief' && user.cooldowns.jail === 0 && now - user.lastIncome >= 20 * 60 * 1000) {
            user.cash += 50;
            user.lastIncome = now;
            updated = true;
        }
        // Police: 450 every 30m
        if (user.role === 'police' && now - user.lastIncome >= 30 * 60 * 1000) {
            user.cash += 450;
            user.lastIncome = now;
            updated = true;
        }
        // Businessman: 1000 every 30m
        if (user.role === 'businessman' && now - user.lastIncome >= 30 * 60 * 1000) {
            user.cash += 1000;
            user.lastIncome = now;
            updated = true;
        }
    }

    // 3. INVESTMENTS CHECK
    db.investments = db.investments.filter(inv => {
        if (now >= inv.endTime) {
            const user = db.users[inv.jid];
            // 40% success rate
            const isSuccess = Math.random() < 0.4; 
            
            if (isSuccess) {
                const multiplier = Math.floor(Math.random() * 5) + 1; // 1X to 5X
                const profit = inv.amount * multiplier;
                user.cash += inv.amount + profit;
            } else {
                const lossPct = Math.floor(Math.random() * 100) + 1;
                const loss = Math.floor(inv.amount * (lossPct / 100));
                const refund = inv.amount - loss;
                user.cash += refund;
                db.bank += loss; // Lost money goes to Universal Bank
            }
            updated = true;
            return false; // Remove from active list
        }
        return true;
    });

    if (updated) saveDB();
}, 60 * 1000); // Run every minute

// --- MAIN CONNECTION FUNCTION ---
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Chrome", "Linux", ""]
    });

    // --- PAIRING CODE LOGIC (FIXED FOR DEPLOYMENT) ---
    if (!sock.authState.creds.me && !sock.authState.creds.registered) {
        
        // Your bot number hardcoded to prevent freezing
        const phoneNumber = "919233137736"; 
        
        console.log(`\nRequesting pairing code for ${phoneNumber}... Please wait.`);

        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n\nYOUR PAIRING CODE: ${code}\n\n`);
            } catch (err) {
                console.log("Error requesting code: ", err);
            }
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('Bot Connected!');
        }
    });

    // --- MESSAGE HANDLER ---
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const body = (type === 'conversation') ? msg.message.conversation : 
                     (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : '';
        
        const pushName = msg.pushName;
        const sender = msg.key.participant || from; 
        
        if (!body.startsWith('/') && !body.startsWith('@')) return;

        // Initialize User
        const user = getUser(sender, pushName);
        const args = body.trim().split(/ +/);
        const command = args[0].toLowerCase();
        
        const isAdmin = sender.includes(ADMIN_NUMBER);

        // 1. MENU
        if (command === '/menu') {
            const menu = `
╔══ *GAME MENU* ══╗
╠ 👮 /crlps - Become Police
╠ 🦹 /crltf - Become Thief
╠ 🤵 /crlbs - Become Businessman
╠ 🔍 /status - Check your status
╠ 💰 /ubank - Universal Bank info
╠ 🏆 /toppolice - Top Police
╠ 🤑 /richestman - Richest Players
╠ 🗑️ /del - Delete commands
╠
╠ *Thief Only:*
╠ 🎯 /scantarget - Find targets
╠ 🚔 /scanps - Find Police
╠ 🕰️ /jailtm - Check jail time
╠ @user/rob123 - Rob user (guess ID)
╠
╠ *Police Only:*
╠ 📡 /scan - Find Thieves
╠ @user/arrest123 - Arrest (guess ID)
╠
╠ *Businessman Only:*
╠ 💸 /invest1000 - Invest cash
╠ 📜 /investst - Active investments
╠ 🤝 @user/hire - Hire Bodyguard
╠ 🏦 /loan1000 - Request Loan
╚═════════════════`;
            await sock.sendMessage(from, { text: menu });
        }

        // 2. ROLE SELECTION
        if (['/crlps', '/crltf', '/crlbs'].includes(command)) {
            // Check Cooldown (skip for Admin)
            if (!isAdmin && user.cooldowns.roleChangeCount >= 2 && Date.now() < user.cooldowns.roleChange) {
                const waitDays = Math.ceil((user.cooldowns.roleChange - Date.now()) / (1000 * 60 * 60 * 24));
                return sock.sendMessage(from, { text: txt(`You must wait ${waitDays} days to change roles again.`, `Nihna thlak turin ni ${waitDays} i nghah a ngai.`) });
            }

            let newRole = '';
            let msgEng = '', msgMiz = '';

            if (command === '/crlps') { newRole = 'police'; msgEng = 'You are now a Police Officer!'; msgMiz = 'Police i ni ta!'; }
            if (command === '/crltf') { newRole = 'thief'; msgEng = 'You are now a Thief!'; msgMiz = 'Rukru i ni ta!'; }
            if (command === '/crlbs') { 
                newRole = 'businessman'; 
                msgEng = 'You are now a Businessman!'; 
                msgMiz = 'Sumdawng i ni ta!';
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

        // 3. THIEF COMMANDS
        if (user.role === 'thief') {
            // Check Jail
            if (user.cooldowns.jail > Date.now()) {
                return sock.sendMessage(from, { text: txt("You are in jail!", "Tan in ah i tang mek!") });
            }

            if (command === '/scantarget') {
                if (user.cash < 200) return sock.sendMessage(from, { text: txt("Not enough cash!", "Pawisa i nei tlem lutuk!") });
                user.cash -= 200;
                
                let output = "🎯 *TARGETS:*\n";
                for (let targetJid in db.users) {
                    const t = db.users[targetJid];
                    if (t.role === 'citizen' || t.role === 'businessman') {
                        let idShow = "";
                        if (t.role === 'citizen') idShow = t.id.substring(0, 2) + "?";
                        if (t.role === 'businessman') {
                            if (t.bodyguard) idShow = t.id.substring(0, 2) + "????";
                            else idShow = t.id.substring(0, 3) + "???";
                        }
                        output += `@${t.name} | Role: ${t.role} | Wealth: ${t.cash} | ID: ${idShow}\n`;
                    }
                }
                saveDB();
                await sock.sendMessage(from, { text: output });
            }

            // --- ROBBERY LOGIC ---
            if (command.includes('/rob')) {
                const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                const guess = parseInt(body.replace(/\D/g, '')); // Extract numbers from command

                if (mentionedJid && db.users[mentionedJid]) {
                    const target = db.users[mentionedJid];
                    
                    const realID = parseInt(target.id);
                    const diff = Math.abs(realID - guess);
                    let stolen = 0;

                    if (diff === 0) {
                        stolen = Math.floor(target.cash * 0.10); // 10%
                    } else if (diff < 10) { 
                        stolen = Math.floor(target.cash * 0.02); // 2%
                    } else if (diff < 50) {
                        stolen = Math.floor(target.cash * 0.01); // 1%
                    }

                    if (stolen > 0) {
                        target.cash -= stolen;
                        user.cash += stolen;
                        target.id = generateID(target.role); // New ID for victim
                        saveDB();
                        await sock.sendMessage(from, { text: txt(`Robbery Successful! You stole ₹${stolen}`, `Rukruk a hlawhtling! ₹${stolen} i ru chhuak`) });
                    } else {
                         await sock.sendMessage(from, { text: txt(`Robbery Failed! ID was wrong.`, `Rukruk a hlawhchham! ID i hre sual.`) });
                    }
                } else {
                    await sock.sendMessage(from, { text: txt("Tag a user to rob them! (e.g., @user/rob123)", "Mi rawk turin tag rawh! (e.g., @user/rob123)") });
                }
            }
        } 

        // 4. POLICE COMMANDS
        if (user.role === 'police') {
            if (command === '/scan') {
                 if (user.cash < 200) return sock.sendMessage(from, { text: txt("Not enough cash!", "Pawisa i nei tlem lutuk!") });
                 user.cash -= 200;
                 let output = "📡 *THIEVES:*\n";
                 for (let tJid in db.users) {
                     const t = db.users[tJid];
                     if (t.role === 'thief') {
                        // Police see ID: 12?
                        output += `@${t.name} | ID: ${t.id.substring(0, 2)}? | Reward: ${Math.floor(t.cash * 0.03)}\n`;
                     }
                 }
                 saveDB();
                 await sock.sendMessage(from, { text: output });
            }
        }

        // 5. STATUS
        if (command === '/status' || command.includes('/status')) {
            let targetUser = user; 
            let displayRole = targetUser.role;
            if (displayRole === 'thief') displayRole = 'citizen'; // Disguise

            await sock.sendMessage(from, { 
                text: txt(
                    `Role: ${displayRole}\nWealth: ${targetUser.cash}\nCases Solved: ${targetUser.casesSolved}`,
                    `Nihna: ${displayRole}\nHausakna: ${targetUser.cash}\nMisual man zat: ${targetUser.casesSolved}`
                )
            });
        }
        
        // 6. UNIVERSAL BANK
        if (command === '/ubank') {
             await sock.sendMessage(from, { text: `🏦 *Universal Bank*\n💰 Balance: ${formatMoney(db.bank)}` });
        }

        // 7. ADMIN COMMANDS
        if (isAdmin) {
            if (command === '/editstatus') {
                user.cash = 999999999; 
                saveDB();
                await sock.sendMessage(from, { text: "Admin status updated." });
            }
        }

    });
}

startBot();
