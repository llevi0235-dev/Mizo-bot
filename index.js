console.log("▶️ SYSTEM STARTING... PLEASE WAIT...");

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

// --- CONFIGURATION ---
const ADMIN_NUMBER = "91923313773"; // Admin (No +)
const OWNER_NUMBER = "919233137736"; // Bot Owner & Bank
const MY_NUMBER = "919233137736";   // YOUR BOT NUMBER (Hardcoded to fix freezing)
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
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// --- HELPER FUNCTIONS ---
const getTimestamp = () => Date.now();
const formatMoney = (amount) => `₹${amount.toLocaleString()}`;
const txt = (eng, mizo) => `🇬🇧 ${eng}\n🇲🇿 ${mizo}`;

const generateID = (role) => {
    if (role === 'businessman') return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    return Math.floor(100 + Math.random() * 900).toString(); // 3 digits
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
            bodyguard: null, // JID of police
            employer: null,  // JID of businessman
            robbedBy: [],    // List of thieves who robbed this user
            cooldowns: { 
                roleChange: 0, 
                roleChangeCount: 0, 
                rob: 0, 
                jail: 0 
            }
        };
        saveDB();
    }
    // Update name if changed
    if (name) db.users[jid].name = name;
    return db.users[jid];
};

// --- INCOME & INVESTMENT LOOP (Runs every 1 minute) ---
setInterval(() => {
    const now = getTimestamp();
    let updated = false;

    // 1. INVESTMENTS
    // Filter active investments
    const activeInvestments = db.investments.filter(inv => now < inv.endTime);
    const finishedInvestments = db.investments.filter(inv => now >= inv.endTime);

    finishedInvestments.forEach(inv => {
        const user = db.users[inv.jid];
        if (!user) return;

        // 40% Success Rate
        const isSuccess = Math.random() < 0.4; 
        
        if (isSuccess) {
            const multiplier = Math.floor(Math.random() * 5) + 1; // 1X to 5X
            const profit = inv.amount * multiplier;
            const totalReturn = inv.amount + profit;
            user.cash += totalReturn;
            // Check Loan Repayment (9% of profit goes to bank if loan active - simplified logic)
            // (For now, just adding cash to user)
        } else {
            // 60% Fail Rate
            const lossPct = Math.floor(Math.random() * 100) + 1; // 1% to 100%
            const loss = Math.floor(inv.amount * (lossPct / 100));
            const refund = inv.amount - loss;
            
            user.cash += refund;
            db.bank += loss; // Lost money goes to Universal Bank
        }
        updated = true;
    });
    
    // Keep only active investments
    if (finishedInvestments.length > 0) {
        db.investments = activeInvestments;
        updated = true;
    }

    // 2. PASSIVE INCOME & JAIL
    for (let jid in db.users) {
        const user = db.users[jid];
        
        // JAIL CHECK
        if (user.cooldowns.jail > 0 && now > user.cooldowns.jail) {
            user.cooldowns.jail = 0;
            user.id = generateID('thief'); // New ID after jail
            updated = true;
        }

        // INCOME CHECK
        const limits = { citizen: 30, thief: 20, police: 30, businessman: 30 };
        const amounts = { citizen: 400, thief: 50, police: 450, businessman: 1000 };
        const minutes = limits[user.role] || 30;
        
        if (now - user.lastIncome >= minutes * 60 * 1000) {
            if (user.role === 'thief' && user.cooldowns.jail > 0) continue; // No income in jail
            user.cash += amounts[user.role] || 0;
            user.lastIncome = now;
            updated = true;
        }
    }

    if (updated) saveDB();
}, 60 * 1000);

// --- MAIN BOT CONNECTION ---
async function startBot() {
    console.log("▶️ Loading Authentication...");
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Chrome", "Linux", ""]
    });

    // --- PAIRING CODE LOGIC (HARDCODED) ---
    if (!sock.authState.creds.me && !sock.authState.creds.registered) {
        console.log(`\n⚠️ WAITING 3 SECONDS TO REQUEST CODE FOR: ${MY_NUMBER}...\n`);
        
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(MY_NUMBER);
                console.log(`\n================================`);
                console.log(`   YOUR CODE:  ${code}`);
                console.log(`================================\n`);
            } catch (err) {
                console.log("❌ Error requesting code. Check internet or number.", err);
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
            console.log('✅ BOT CONNECTED SUCCESSFULLY!');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const body = (type === 'conversation') ? msg.message.conversation : 
                     (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : '';
        
        if (!body.startsWith('/') && !body.startsWith('@')) return;

        const sender = msg.key.participant || from; 
        const pushName = msg.pushName;
        const user = getUser(sender, pushName);
        const args = body.trim().split(/ +/);
        const command = args[0].toLowerCase();
        
        // ADMIN CHECK
        const isAdmin = sender.includes(ADMIN_NUMBER);

        // --- COMMANDS ---

        // 1. MENU
        if (command === '/menu') {
            await sock.sendMessage(from, { text: txt(
                "📜 *GAME COMMANDS* 📜\n\nChoose Role:\n👮 /crlps - Police\n🦹 /crltf - Thief\n🤵 /crlbs - Businessman\n\nStats:\n🔍 /status - My Info\n💰 /ubank - Universal Bank\n🏆 /toppolice - Top Cops\n🤑 /richestman - Top Rich\n\nThief:\n🎯 /scantarget (Cost 200)\n🚔 /scanps (Cost 100)\n@user/rob[ID] (Cost 100)\n\nPolice:\n📡 /scan (Cost 200)\n@user/arrest[ID] (Cost 50)\n\nBusinessman:\n💸 /invest[amount]\n🤝 @user/hire\n🏦 /loan[amount]", 
                
                "📜 *GAME COMMANDS* 📜\n\nNihna Thlang Rawh:\n👮 /crlps - Police\n🦹 /crltf - Rukru\n🤵 /crlbs - Sumdawng\n\nStats:\n🔍 /status - Ka Chanchin\n💰 /ubank - Universal Bank\n🏆 /toppolice - Police Tha\n🤑 /richestman - Mi Hausa\n\nRukru:\n🎯 /scantarget (Man 200)\n🚔 /scanps (Man 100)\n@user/rob[ID] (Man 100)\n\nPolice:\n📡 /scan (Man 200)\n@user/arrest[ID] (Man 50)\n\nSumdawng:\n💸 /invest[zat]\n🤝 @user/hire\n🏦 /loan[zat]"
            )});
        }

        // 2. ROLE SELECTION
        if (['/crlps', '/crltf', '/crlbs'].includes(command)) {
            // Cooldown Check (Skip for Admin)
            if (!isAdmin && user.cooldowns.roleChangeCount >= 2 && Date.now() < user.cooldowns.roleChange) {
                const waitDays = Math.ceil((user.cooldowns.roleChange - Date.now()) / (1000 * 60 * 60 * 24));
                return sock.sendMessage(from, { text: txt(`Wait ${waitDays} days to change role.`, `Nihna thlak turin ni ${waitDays} i nghah a ngai.`) });
            }

            let newRole = '';
            let msgEng = '', msgMiz = '';

            if (command === '/crlps') { newRole = 'police'; msgEng = 'You are now a Police Officer!'; msgMiz = 'Police i ni ta!'; }
            if (command === '/crltf') { newRole = 'thief'; msgEng = 'You are now a Thief!'; msgMiz = 'Rukru i ni ta!'; }
            if (command === '/crlbs') { 
                newRole = 'businessman'; 
                msgEng = 'You are now a Businessman!'; 
                msgMiz = 'Sumdawng i ni ta!';
                if (user.role !== 'businessman') user.cash += 500000; // First time bonus logic simplified
            }

            user.role = newRole;
            user.id = generateID(newRole);
            
            if (!isAdmin) {
                user.cooldowns.roleChangeCount++;
                if (user.cooldowns.roleChangeCount >= 2) {
                    user.cooldowns.roleChange = Date.now() + (2 * 24 * 60 * 60 * 1000); // 2 Days
                }
            }
            saveDB();
            await sock.sendMessage(from, { text: txt(msgEng, msgMiz) });
        }

        // 3. THIEF COMMANDS
        if (user.role === 'thief') {
            if (user.cooldowns.jail > Date.now()) {
                const timeLeft = Math.ceil((user.cooldowns.jail - Date.now()) / 60000);
                return sock.sendMessage(from, { text: txt(`You are in jail for ${timeLeft} mins!`, `Tan in ah minute ${timeLeft} chhung i tang!`) });
            }

            // SCAN TARGET
            if (command === '/scantarget') {
                if (!isAdmin && user.cash < 200) return sock.sendMessage(from, { text: txt("Not enough cash (200 needed).", "Pawisa i nei tlem (200 a ngai).") });
                if (!isAdmin) user.cash -= 200;
                
                let out = "🎯 *TARGETS:*\n";
                for (let k in db.users) {
                    const u = db.users[k];
                    if (u.role === 'citizen' || u.role === 'businessman') {
                        let idVis = "";
                        if (u.role === 'citizen') idVis = `${u.id.substring(0,2)}?`;
                        if (u.role === 'businessman') {
                            if (u.bodyguard) idVis = `${u.id.substring(0,2)}????`;
                            else idVis = `${u.id.substring(0,3)}???`;
                        }
                        out += `@${u.name} | ${u.role} | ${formatMoney(u.cash)} | ID: ${idVis}\n`;
                    }
                }
                saveDB();
                await sock.sendMessage(from, { text: out });
            }

            // SCAN POLICE
            if (command === '/scanps') {
                if (!isAdmin && user.cash < 100) return sock.sendMessage(from, { text: txt("Not enough cash (100 needed).", "Pawisa i nei tlem (100 a ngai).") });
                if (!isAdmin) user.cash -= 100;
                
                let out = "🚔 *POLICE FORCE:*\n";
                for (let k in db.users) {
                    if (db.users[k].role === 'police') {
                        out += `@${db.users[k].name} | Cases: ${db.users[k].casesSolved}\n`;
                    }
                }
                saveDB();
                await sock.sendMessage(from, { text: out });
            }

            // ROB LOGIC
            if (command.includes('/rob')) {
                // Parse: @user/rob123
                const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                const guess = parseInt(body.replace(/\D/g, '')); // Extract numbers
                
                if (!isAdmin && user.cash < 100) return sock.sendMessage(from, { text: txt("Not enough cash (100 needed).", "Pawisa i nei tlem (100 a ngai).") });
                if (!isAdmin) user.cash -= 100;

                if (mentioned && db.users[mentioned]) {
                    const target = db.users[mentioned];
                    
                    // Rules: Can't rob same person if previously successful
                    if (target.robbedBy && target.robbedBy.includes(sender)) {
                        return sock.sendMessage(from, { text: txt("You already robbed this person!", "He pa hi i ru tawh!") });
                    }

                    const realID = parseInt(target.id);
                    const diff = Math.abs(realID - guess);
                    let stolen = 0;
                    let percent = 0;

                    if (diff === 0) { percent = 0.10; } // Exact
                    else if (diff < 10) { percent = 0.02; } // Close
                    else if (diff < 50) { percent = 0.01; } // Somewhat close

                    stolen = Math.floor(target.cash * percent);

                    if (stolen > 0) {
                        target.cash -= stolen;
                        user.cash += stolen;
                        // Add to robbed list
                        if (!target.robbedBy) target.robbedBy = [];
                        target.robbedBy.push(sender);
                        
                        // New ID for victim
                        target.id = generateID(target.role);
                        saveDB();
                        await sock.sendMessage(from, { text: txt(`✅ Robbery Success! Stole ${formatMoney(stolen)}`, `✅ Rukruk a hlawhtling! ${formatMoney(stolen)} i ru chhuak`) });
                    } else {
                        // Cooldown logic for failed attempt could go here
                        await sock.sendMessage(from, { text: txt(`❌ Robbery Failed. Wrong ID.`, `❌ Rukruk a hlawhchham. ID i hre sual.`) });
                    }
                } else {
                    await sock.sendMessage(from, { text: txt("Tag a user to rob! Ex: @user/rob123", "Mi rawk turin tag rawh! Ex: @user/rob123") });
                }
            }
            
            // JAIL TIME
            if (command === '/jailtm') {
                const timeLeft = user.cooldowns.jail > 0 ? Math.ceil((user.cooldowns.jail - Date.now()) / 60000) : 0;
                await sock.sendMessage(from, { text: txt(`Jail Time: ${timeLeft} mins`, `Tan hun la awm: Minute ${timeLeft}`) });
            }
        }

        // 4. POLICE COMMANDS
        if (user.role === 'police') {
            // SCAN THIEVES
            if (command === '/scan') {
                 if (!isAdmin && user.cash < 200) return sock.sendMessage(from, { text: txt("Not enough cash (200 needed).", "Pawisa i nei tlem (200 a ngai).") });
                 if (!isAdmin) user.cash -= 200;
                 
                 let out = "📡 *THIEVES SCAN:*\n";
                 for (let k in db.users) {
                     const t = db.users[k];
                     if (t.role === 'thief') {
                        out += `@${t.name} | ID: ${t.id.substring(0, 2)}? | Reward: ${formatMoney(Math.floor(t.cash * 0.03))}\n`;
                     }
                 }
                 saveDB();
                 await sock.sendMessage(from, { text: out });
            }

            // ARREST LOGIC
            if (command.includes('/arrest')) {
                const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                const guess = parseInt(body.replace(/\D/g, ''));
                
                if (!isAdmin && user.cash < 50) return sock.sendMessage(from, { text: txt("Not enough cash (50 needed).", "Pawisa i nei tlem (50 a ngai).") });
                if (!isAdmin) user.cash -= 50;

                if (mentioned && db.users[mentioned]) {
                    const thief = db.users[mentioned];
                    if (thief.role !== 'thief') return sock.sendMessage(from, { text: txt("That user is not a thief!", "Kha chu rukru a ni lo!") });

                    // Guess last digit (Logic: ID 123, input 123)
                    if (parseInt(thief.id) === guess) {
                        const totalCash = thief.cash;
                        const seized = Math.floor(totalCash * 0.80); // Thief loses 80%
                        const reward = Math.floor(seized * 0.03); // Police gets 3% of seized
                        const bankShare = seized - reward;

                        thief.cash -= seized;
                        user.cash += reward;
                        db.bank += bankShare;
                        user.casesSolved++;

                        // Send thief to jail (5 mins)
                        thief.cooldowns.jail = Date.now() + (5 * 60 * 1000);
                        thief.id = generateID('thief'); // New ID

                        saveDB();
                        await sock.sendMessage(from, { text: txt(
                            `✅ ARRESTED! seized ${formatMoney(seized)}. Reward: ${formatMoney(reward)}.`,
                            `✅ MAN A NI! ${formatMoney(seized)} lak sak. Lawmman: ${formatMoney(reward)}.`
                        )});
                    } else {
                        await sock.sendMessage(from, { text: txt("❌ Failed! Wrong ID.", "❌ Hlawhchham! ID dik lo.") });
                    }
                }
            }
        }

        // 5. BUSINESSMAN COMMANDS
        if (user.role === 'businessman') {
            // INVEST
            if (command.startsWith('/invest') && !command.includes('st')) {
                const amount = parseInt(command.replace('/invest', ''));
                if (isNaN(amount) || amount <= 0) return sock.sendMessage(from, { text: txt("Invalid amount.", "Zat dik lo.") });
                if (user.cash < amount) return sock.sendMessage(from, { text: txt("Not enough cash.", "Pawisa i daih lo.") });

                user.cash -= amount;
                db.investments.push({
                    jid: sender,
                    amount: amount,
                    endTime: isAdmin ? Date.now() + 1000 : Date.now() + (30 * 60 * 1000) // Instant for admin, 30m for others
                });
                saveDB();
                await sock.sendMessage(from, { text: txt(`Invested ${formatMoney(amount)}. Wait 30 mins.`, `${formatMoney(amount)} i invest e. Minute 30 nghak rawh.`) });
            }

            // LOAN
            if (command.startsWith('/loan')) {
                const amount = parseInt(command.replace('/loan', ''));
                // Simplified: Auto-approve for now (or notify admin)
                // For this code, I'll just log it. Real approval needs DM logic.
                await sock.sendMessage(OWNER_NUMBER + "@s.whatsapp.net", { text: `LOAN REQUEST: ${user.name} wants ${amount}` });
                await sock.sendMessage(from, { text: txt("Loan request sent to bank.", "Loan dilna bank ah thawn a ni.") });
            }
            
            // HIRE
            if (command.includes('/hire')) {
                const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (mentioned && db.users[mentioned] && db.users[mentioned].role === 'police') {
                     // Check if police already employed
                     if (db.users[mentioned].employer) return sock.sendMessage(from, { text: txt("Police already hired.", "Police hi chhawr lai a ni.") });
                     
                     // Hire logic
                     db.users[mentioned].employer = sender;
                     user.bodyguard = mentioned;
                     saveDB();
                     await sock.sendMessage(from, { text: txt("Bodyguard hired!", "Bodyguard chhawr a ni!") });
                } else {
                    await sock.sendMessage(from, { text: txt("Tag a police officer!", "Police officer tag rawh!") });
                }
            }
        }

        // 6. GENERAL COMMANDS
        if (command === '/status') {
            let displayRole = user.role;
            if (displayRole === 'thief') displayRole = 'citizen'; // Disguise in status
            // Admin sees real role
            if (isAdmin) displayRole = user.role;

            await sock.sendMessage(from, { 
                text: txt(
                    `👤 Role: ${displayRole}\n💰 Wealth: ${formatMoney(user.cash)}\n💼 Cases: ${user.casesSolved}`,
                    `👤 Nihna: ${displayRole}\n💰 Hausakna: ${formatMoney(user.cash)}\n💼 Case Chin Fel: ${user.casesSolved}`
                )
            });
        }
        
        if (command === '/ubank') {
             await sock.sendMessage(from, { text: `🏦 *Universal Bank*\n💰 Balance: ${formatMoney(db.bank)}` });
        }

        // 7. ADMIN
        if (isAdmin) {
            if (command === '/editstatus') {
                user.cash = 999999999;
                saveDB();
                await sock.sendMessage(from, { text: "👑 Admin Power: Infinite Cash" });
            }
        }

    });
}

startBot();