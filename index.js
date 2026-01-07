const keepAlive = require('./keep_alive');

console.log("▶️ SYSTEM STARTING...");

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, 
    jidNormalizedUser,
    delay
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const admin = require("firebase-admin");

// --- FIREBASE CONFIGURATION ---
const serviceAccount = {
  "type": "service_account",
  "project_id": "j-bo-a567a",
  "private_key_id": "774d8e00478d3c5fb6aefa442a76fa9c1efbc20e",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC8PLn6M8+z3eck\nKYMChU6QBSYzOLkNe7HVimJvSnKac20nau0WzG6Ppj1RfKlIBfBX1Y/DFN/sw36f\nv0wLmpKr6rNnXRMoFz6i1fhIniWiSRfN9rDUGz1IctZ2Id4J9LGVVuovLPNlYTjP\nD6PacbAstZlcOT4ETCx9wNHiiQ1PJf9Xlo7wyeQDBQOYy9V7+gj5Wf8dWKhRUTi9\nm6WNnqMoDDeAs02GY97HsEAfm8wPnHH9J3Fn2+kB6Mpc/35gtFV+cyJAzyRZCovt\niPaX7+uDSHUpYukT4hxSOU+jl7tKYRh96mQrzcr/V3FEpp6aZ808yojzKiIRPmIG\nC0MCN7uPAgMBAAECggEAAy/OADffVM61ao3PW3wRQ+vqZSSZMWq+LHzOxM6QWSAK\nIYg0YlXsqz7nu9jt7ru3AW2qpOVWEyaOHrs42NtxjzqGdgID4IJgO5Z+wQ/4WCJ/\npit+e+DILVFQYyiYnzeGyB30Ef9jUXyPXyYHIpwZHPCoG4EWlTEK8cgRZZHnaUcW\ncKDWZFAlki+9P8LLZ5/228GC4Rm562UiOnss8L3D5uUi2pSNX2V0B6CLrCmiP/if\ng4piKHkgWN6c8PXk8SUmnxF0kfChTdKcGx/6nTLZJHxiBsH+vTZ/2ehpL66+dNIv\nKPsb4XWzJFbHxPI1ee/F0H5X65jXXO2vMhfu/jDv/QKBgQDwGd+iVpBulS+Sp6am\nCw6uG9q4RAyE0x1RzKgxmfq/rWPxy0e7BtWEvd3ng/0BYL89pROXb7tGfT4CGUHc\nXueU9koCrZw7CToHJfakkk9+1TDes92/AGJjL8cxr8ZfKsjsGHR4DAlYVLDi4yJk\nRGmSaXWdjWV7e1MA9CG2HPF30wKBgQDIs6vYJc9Y+MecqofJPoi4QwzqpQL9vWln\nbxHQCLR363pMdyS/Y1TM7PZjDuq5PQaf8ae02qSoDopK1+kIjzf7bxu1dhSDdA9L\ngNTykn+yZnF0vUYPJcmLH9jjNXpXQ1NrO8BANgPC1oITO1XAtIlrkH9lAiVWdV/8\nouYvTdAz1QKBgQCad9rjgxOKwVoI3Oke/BAmvW7ai5UOQxAi1ysCNlEWzgN1xNVS\nItRtgQVpdAXqxAZlL3XKQKzYbazeBsfTcg9FS6pTzMOtS4NUo/zo5eRU8e1t6YPo\n5ONnco6Rjcdu5IS9OAJ+VSgR9vKSFZTDsyvEcSqlARnf9nhxLZ8encJP1wKBgGMg\nosKaQiQOlACkFXbnJP3lWA7Yu3Z5xAKrUB/w/LmyG3CC9Cp3NB4W98aLSpF9O7Vp\n1Mw1pVe//rvikh2BJ0RPZ18j2BPpEdjX49V/WATUJjtjdKPspPPLIgNumWNaRGxV\nUaolQ4xLCGnZR4xrXug6sUFBYxGl3WfZSVmZ1DiVAoGAUbbKBgOJ/aK/xNozElae\n/EIzY4U8BLMw/9iECvFJRr7QAqyZUPk6cYp9QJL2YnLT+mTKQ0k7OpPaT8n+EFPB\nXBDd9uHjON0KsPJjzmXCeBpQFyUjX//Nja8ridN0h8ANeeQ+r7Zj+O9xZKUv1JT3\nUP0fL4evPSOlU19WuNWjLmQ=\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@j-bo-a567a.iam.gserviceaccount.com",
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// --- GAME CONFIGURATION ---
const OWNER_NUMBER = "919233137736"; 
const MY_NUMBER = "919233137736";   

// --- LOCAL CACHE (For Speed) ---
// We load data from Firebase into here on start, and save back to Firebase on changes
let localUsers = {};
let localBank = { balance: 0 };
let localInvestments = [];
let localBanned = [];

// --- HELPER FUNCTIONS ---
const getTimestamp = () => Date.now();
const formatMoney = (amount) => `₹${amount.toLocaleString()}`;
const txt = (eng, mizo) => `🇬🇧 ${eng}\n🇲🇿 ${mizo}`;

const generateID = (role) => {
    if (role === 'businessman') return Math.floor(100000 + Math.random() * 900000).toString(); 
    return Math.floor(100 + Math.random() * 900).toString(); 
};

// --- DATABASE SYNC FUNCTIONS ---
async function loadData() {
    console.log("🔄 Syncing with Firebase...");
    try {
        // Load Users
        const usersSnap = await db.collection('users').get();
        usersSnap.forEach(doc => { localUsers[doc.id] = doc.data(); });
        
        // Load Bank
        const bankSnap = await db.collection('global').doc('bank').get();
        if (bankSnap.exists) localBank = bankSnap.data();
        else await db.collection('global').doc('bank').set({ balance: 0 });

        // Load Investments
        const invSnap = await db.collection('investments').get();
        invSnap.forEach(doc => { localInvestments.push(doc.data()); });

        // Load Banned
        const banSnap = await db.collection('global').doc('banned').get();
        if (banSnap.exists) localBanned = banSnap.data().list || [];
        
        console.log("✅ Data Loaded Successfully.");
    } catch (e) {
        console.error("❌ Error loading data:", e);
    }
}

async function saveUser(jid) {
    if (localUsers[jid]) {
        await db.collection('users').doc(jid).set(localUsers[jid]);
    }
}

async function saveBank() {
    await db.collection('global').doc('bank').set(localBank);
}

async function saveInvestments() {
    // We rewrite the whole collection for simplicity in this logic
    // In production, deleting/adding individual docs is better
    const batch = db.batch();
    // (Simplified: In a real app we'd manage docs individually. For now, we rely on memory state mostly)
}

async function saveBanned() {
    await db.collection('global').doc('banned').set({ list: localBanned });
}

// Get User Helper
const getUser = (jid, name) => {
    if (!localUsers[jid]) {
        localUsers[jid] = {
            id: generateID('citizen'),
            role: 'citizen',
            cash: 10000,
            name: name || 'Unknown',
            lastIncome: getTimestamp(),
            casesSolved: 0,
            bodyguard: null, 
            employer: null, 
            loanRepayCount: 0, 
            robbedSuccessBy: [],    
            pastInvestments: [],
            cooldowns: { roleChange: 0, roleChangeCount: 0, jail: 0, robFail: {} }
        };
        saveUser(jid); // Save new user to Firebase immediately
    }
    if (name) localUsers[jid].name = name;
    return localUsers[jid];
};

// --- INCOME LOOP ---
setInterval(() => {
    const now = getTimestamp();
    let bankUpdated = false;

    // 1. INVESTMENTS
    // Filter active vs finished
    const active = [];
    
    localInvestments.forEach(async (inv) => {
        if (now >= inv.endTime) {
            // Process Finished
            const user = localUsers[inv.jid];
            if (user) {
                const isSuccess = Math.random() < 0.4;
                let profit = 0;
                let loss = 0;
                let resultText = "";

                if (isSuccess) {
                    const multiplier = Math.floor(Math.random() * 5) + 1; 
                    profit = inv.amount * multiplier;
                    
                    // Loan 9% Tax Logic
                    if (user.loanRepayCount > 0) {
                        const tax = Math.floor(profit * 0.09);
                        profit -= tax;
                        localBank.balance += tax;
                        user.loanRepayCount--;
                        bankUpdated = true;
                    }
                    user.cash += inv.amount + profit;
                    resultText = "Profit";
                } else {
                    const lossPct = Math.floor(Math.random() * 100) + 1; 
                    loss = Math.floor(inv.amount * (lossPct / 100));
                    const refund = inv.amount - loss;
                    user.cash += refund;
                    localBank.balance += loss;
                    bankUpdated = true;
                    resultText = "Loss";
                }

                // Add to History
                user.pastInvestments.push({
                    date: new Date().toLocaleString(),
                    amount: inv.amount,
                    result: resultText,
                    value: isSuccess ? profit : loss
                });
                
                await saveUser(inv.jid);
            }
        } else {
            active.push(inv);
        }
    });
    
    // Update local investments list if changes happen
    if (localInvestments.length !== active.length) {
        localInvestments = active;
        // In a real DB scenario we would delete the doc, but for now we rely on memory for the loop
    }

    // 2. PASSIVE INCOME
    for (let jid in localUsers) {
        const user = localUsers[jid];
        let userUpdated = false;

        // Jail Release
        if (user.role === 'thief' && user.cooldowns.jail > 0 && now > user.cooldowns.jail) {
            user.cooldowns.jail = 0;
            user.id = generateID('thief'); 
            userUpdated = true;
        }

        const limits = { citizen: 30, thief: 20, police: 30, businessman: 30 };
        const amounts = { citizen: 400, thief: 50, police: 450, businessman: 1000 };
        const minutes = limits[user.role] || 30;
        
        if (now - user.lastIncome >= minutes * 60 * 1000) {
            if (user.role === 'thief' && user.cooldowns.jail > 0) continue; 
            user.cash += amounts[user.role] || 0;
            user.lastIncome = now;
            userUpdated = true;
        }

        if (userUpdated) saveUser(jid); // Sync to Firebase
    }

    if (bankUpdated) saveBank();

}, 60 * 1000);

// --- MAIN BOT CONNECTION ---
async function startBot() {
    await loadData(); // Load Firebase Data First

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
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
            console.log('✅ BOT CONNECTED!');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const sender = jidNormalizedUser(msg.key.participant || from);
        const type = Object.keys(msg.message)[0];
        const body = (type === 'conversation') ? msg.message.conversation : 
                     (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : '';
        
        // --- PERFORMANCE FIX: IGNORE GROUP MESSAGES WITHOUT COMMANDS ---
        if (!body.startsWith('/') && !body.startsWith('@')) return;

        // Parse Command
        const args = body.trim().split(/ +/);
        let command = args[0].toLowerCase();
        
        // Handle @user/command parsing
        const isTagCommand = body.includes('/');
        let mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        
        if (isTagCommand && command.includes('@')) {
            const parts = command.split('/');
            if (parts.length > 1) {
                // Extracts 'rob' from '@user/rob123'
                command = '/' + parts[1].replace(/\d+/g, ''); 
            }
        }

        const pushName = msg.pushName || "User";
        if (localBanned.includes(sender)) return; // Ignored banned users
        const user = getUser(sender, pushName);
        const isAdmin = sender.includes(OWNER_NUMBER);

        // ============================================
        //            ALL 29 COMMAND KEYS
        // ============================================

        // --- 1. GENERAL COMMANDS ---

        // Key 1: /menu
        if (command === '/menu') {
            const menuText = txt(
                "📜 *GAME MENU*\n\n*General:*\n👮 /crlps (Police)\n🦹 /crltf (Thief)\n🤵 /crlbs (Businessman)\n🔍 /status (My Info)\n🗑️ /del (Delete Msg)\n💰 /ubank (Bank Balance)\n🏆 /toppolice (Top Cops)\n🤑 /richestman (Top Rich)\n\n*Thief:*\n🎯 /scantarget (200)\n🚔 /scanps (100)\n🕵️ @user/rob[ID] (100)\n⛓️ /jailtm (Jail Time)\n\n*Police:*\n📡 /scan (200)\n👮 @user/arrest[ID] (50)\n🚪 /leave (Resign Bodyguard)\n\n*Businessman:*\n💸 /invest[amount]\n📜 /investst (Active Invest)\n📉 /investpst (History)\n🤝 @user/hire (Hire Cop)\n🔥 /fire (Fire Cop)\n🏦 /loan[amount]",
                "📜 *INKHEL MENU*\n\n*General:*\n👮 /crlps (Police)\n🦹 /crltf (Rukru)\n🤵 /crlbs (Sumdawng)\n🔍 /status (Ka Chanchin)\n🗑️ /del (Delete Msg)\n💰 /ubank (Bank Balance)\n🏆 /toppolice (Police Tha)\n🤑 /richestman (Mi Hausa)\n\n*Rukru:*\n🎯 /scantarget (Man 200)\n🚔 /scanps (Man 100)\n🕵️ @user/rob[ID] (Man 100)\n⛓️ /jailtm (Jail Time)\n\n*Police:*\n📡 /scan (Man 200)\n👮 @user/arrest[ID] (Man 50)\n🚪 /leave (Bodyguard Bang)\n\n*Sumdawng:*\n💸 /invest[zat]\n📜 /investst (Active Invest)\n📉 /investpst (History)\n🤝 @user/hire (Hire Cop)\n🔥 /fire (Fire Cop)\n🏦 /loan[zat]"
            );
            await sock.sendMessage(from, { text: menuText });
        }

        // Keys 2, 3, 4: Role Selection
        if (['/crlps', '/crltf', '/crlbs'].includes(command)) {
            // Cooldown Logic
            if (!isAdmin && user.cooldowns.roleChangeCount >= 2 && Date.now() < user.cooldowns.roleChange) {
                const waitDays = Math.ceil((user.cooldowns.roleChange - Date.now()) / (1000 * 60 * 60 * 24));
                return sock.sendMessage(from, { text: txt(`Wait ${waitDays} days.`, `Ni ${waitDays} nghak rawh.`) });
            }

            let newRole = '';
            let msgEng = '', msgMiz = '';

            if (command === '/crlps') { newRole = 'police'; msgEng = 'Role: Police'; msgMiz = 'Nihna: Police'; }
            if (command === '/crltf') { newRole = 'thief'; msgEng = 'Role: Thief'; msgMiz = 'Nihna: Rukru'; }
            if (command === '/crlbs') { 
                newRole = 'businessman'; 
                msgEng = 'Role: Businessman'; msgMiz = 'Nihna: Sumdawng';
                if (user.role !== 'businessman') user.cash += 500000; // First time bonus logic simplified for stability
            }

            user.role = newRole;
            user.id = generateID(newRole);
            
            if (!isAdmin) {
                user.cooldowns.roleChangeCount++;
                if (user.cooldowns.roleChangeCount >= 2) {
                    user.cooldowns.roleChange = Date.now() + (2 * 24 * 60 * 60 * 1000); 
                }
            }
            await saveUser(sender);
            await sock.sendMessage(from, { text: txt(msgEng, msgMiz) });
        }

        // Key 5: @user/status (Public Check)
        if (command.includes('status') && mentionedJid) {
            const target = localUsers[mentionedJid];
            if (!target) return;
            
            // Thieves shown as Citizens
            let displayRole = target.role === 'thief' ? 'citizen' : target.role;
            // No ID displayed
            await sock.sendMessage(from, { text: `👤 @${target.name}\nRole: ${displayRole}\nWealth: ${formatMoney(target.cash)}` });
        }

        // Key 6: /status (Self Check)
        if (command === '/status') {
            let roleDisplay = user.role;
            let extraInfo = "";
            
            // Thief Disguise Check (Only show real role in DM or if asked)
            // Note: User said "if it's in dm it displays as thief". We assume current chat.
            const isGroup = from.endsWith('@g.us');
            if (isGroup && user.role === 'thief') roleDisplay = 'citizen';

            if (user.role === 'police') extraInfo = `\nCases Solved: ${user.casesSolved}`;
            
            await sock.sendMessage(from, { 
                text: txt(
                    `👤 Name: ${user.name}\nRole: ${roleDisplay}\nWealth: ${formatMoney(user.cash)}${extraInfo}`,
                    `👤 Hming: ${user.name}\nNihna: ${roleDisplay}\nHausakna: ${formatMoney(user.cash)}${extraInfo}`
                )
            });
        }

        // Key 7: /del
        if (command === '/del') {
            if (msg.key.fromMe) return; // Cannot delete self if not sent by bot
            // Bot needs admin rights in WA group to delete other's msgs.
            // We attempt to delete the command message.
            try {
                await sock.sendMessage(from, { delete: msg.key });
            } catch (e) { /* Ignore if not admin */ }
        }

        // Key 8: /ubank
        if (command === '/ubank') {
             await sock.sendMessage(from, { text: `🏦 Universal Bank: ${formatMoney(localBank.balance)}` });
        }

        // Key 9: /toppolice
        if (command === '/toppolice') {
            const sorted = Object.values(localUsers)
                .filter(u => u.role === 'police')
                .sort((a, b) => b.casesSolved - a.casesSolved)
                .slice(0, 50);
            let out = "🏆 *TOP POLICE*\n";
            sorted.forEach((u, i) => out += `${i+1}. ${u.name} - ${u.casesSolved}\n`);
            await sock.sendMessage(from, { text: out });
        }

        // Key 10: /richestman
        if (command === '/richestman') {
            const sorted = Object.values(localUsers)
                .sort((a, b) => b.cash - a.cash)
                .slice(0, 50);
            let out = "💰 *RICHEST CITIZENS*\n";
            sorted.forEach((u, i) => {
                let r = u.role === 'thief' ? 'citizen' : u.role;
                out += `${i+1}. ${u.name} (${r}) - ${formatMoney(u.cash)}\n`;
            });
            await sock.sendMessage(from, { text: out });
        }

        // --- 2. THIEF COMMANDS ---

        if (user.role === 'thief') {
            // Jail Check
            if (user.cooldowns.jail > Date.now()) {
                // Key 14 logic inside Jail check
                if (command === '/jailtm') {
                    const timeLeft = Math.ceil((user.cooldowns.jail - Date.now()) / 60000);
                    return sock.sendMessage(from, { text: `⛓️ Jail Time: ${timeLeft} mins` });
                }
                return sock.sendMessage(from, { text: "🚫 You are in JAIL!" });
            }

            // Key 11: /scantarget
            if (command === '/scantarget') {
                if (!isAdmin && user.cash < 200) return sock.sendMessage(from, { text: txt("Need 200 cash.", "Pawisa 200 a ngai.") });
                if (!isAdmin) user.cash -= 200;

                let out = "🎯 *TARGETS*\n";
                for (let k in localUsers) {
                    const u = localUsers[k];
                    if (u.role === 'citizen' || u.role === 'businessman') {
                        let idVis = "";
                        if (u.role === 'citizen') idVis = `${u.id.substring(0,2)}?`;
                        if (u.role === 'businessman') {
                            if (u.bodyguard) idVis = `${u.id.substring(0,2)}???? 🛡️`;
                            else idVis = `${u.id.substring(0,3)}???`;
                        }
                        out += `@${u.name} | ${formatMoney(u.cash)} | ID: ${idVis}\n`;
                    }
                }
                await saveUser(sender);
                await sock.sendMessage(from, { text: out });
            }

            // Key 12: /scanps
            if (command === '/scanps') {
                if (!isAdmin && user.cash < 100) return sock.sendMessage(from, { text: txt("Need 100 cash.", "Pawisa 100 a ngai.") });
                if (!isAdmin) user.cash -= 100;
                let out = "🚔 *POLICE*\n";
                for (let k in localUsers) {
                    if (localUsers[k].role === 'police') out += `@${localUsers[k].name} | Cases: ${localUsers[k].casesSolved}\n`;
                }
                await saveUser(sender);
                await sock.sendMessage(from, { text: out });
            }

            // Key 13: @user/rob[ID]
            if (command.includes('rob')) {
                const guessStr = body.match(/\d+$/);
                const guess = guessStr ? parseInt(guessStr[0]) : null;
                
                if (!mentionedJid || !guess) return sock.sendMessage(from, { text: "Usage: @user/rob[ID]" });
                if (!isAdmin && user.cash < 100) return sock.sendMessage(from, { text: "Need 100 cash." });
                if (!isAdmin) user.cash -= 100;

                const target = localUsers[mentionedJid];
                if (!target) return;

                // Rules
                if (target.robbedSuccessBy && target.robbedSuccessBy.includes(sender)) {
                    return sock.sendMessage(from, { text: "🚫 Already robbed this person!" });
                }
                if (user.cooldowns.robFail[mentionedJid] && Date.now() < user.cooldowns.robFail[mentionedJid]) {
                    return sock.sendMessage(from, { text: "🚫 Wait 30 mins to rob them again." });
                }

                const realID = parseInt(target.id);
                const diff = Math.abs(realID - guess);
                let percent = 0;

                if (diff === 0) percent = 0.10;
                else if (diff < 10) percent = 0.02;
                else if (diff < 50) percent = 0.01;

                if (percent > 0) {
                    const stolen = Math.floor(target.cash * percent);
                    target.cash -= stolen;
                    user.cash += stolen;
                    if (!target.robbedSuccessBy) target.robbedSuccessBy = [];
                    target.robbedSuccessBy.push(sender);
                    target.id = generateID(target.role); // New ID
                    await saveUser(mentionedJid);
                    await sock.sendMessage(from, { text: txt(`✅ SUCCESS! Stole ${formatMoney(stolen)}`, `✅ I HLAWHTLING! ${formatMoney(stolen)} i ru.`) });
                } else {
                    user.cooldowns.robFail[mentionedJid] = Date.now() + (30 * 60 * 1000);
                    await sock.sendMessage(from, { text: txt("❌ FAILED! Wrong ID.", "❌ I hlawhchham! ID dik lo.") });
                }
                await saveUser(sender);
            }

            // Key 14: /jailtm (Also handled above)
            if (command === '/jailtm') {
                await sock.sendMessage(from, { text: "✅ You are not in jail." });
            }
        }

        // --- 3. POLICE COMMANDS ---

        if (user.role === 'police') {
            // Key 15: /scan
            if (command === '/scan') {
                if (!isAdmin && user.cash < 200) return sock.sendMessage(from, { text: "Need 200 cash." });
                if (!isAdmin) user.cash -= 200;
                let out = "📡 *THIEF SCAN*\n";
                for (let k in localUsers) {
                    const t = localUsers[k];
                    if (t.role === 'thief') {
                        out += `🦹 @${t.name} | ID: ${t.id.substring(0,2)}? | Reward: ${formatMoney(Math.floor(t.cash * 0.03))}\n`;
                    }
                }
                await saveUser(sender);
                await sock.sendMessage(from, { text: out });
            }

            // Key 16: @user/arrest[ID]
            if (command.includes('arrest')) {
                const guessStr = body.match(/\d+$/);
                const guess = guessStr ? parseInt(guessStr[0]) : null;
                if (!mentionedJid || !guess) return;
                
                if (!isAdmin && user.cash < 50) return sock.sendMessage(from, { text: "Need 50 cash." });
                if (!isAdmin) user.cash -= 50;

                const thief = localUsers[mentionedJid];
                if (thief && thief.role === 'thief') {
                    if (parseInt(thief.id) === guess) {
                        const seized = Math.floor(thief.cash * 0.80);
                        const reward = Math.floor(thief.cash * 0.03); // 3% of total (User text said "3% of the thief total cash")
                        // Wait, text said: "thief will lose 80%... police will get 3% cash from the 80% cash". 
                        // Let's follow that exactly:
                        const policeShare = Math.floor(seized * 0.03);
                        const bankShare = seized - policeShare;

                        thief.cash -= seized;
                        user.cash += policeShare;
                        localBank.balance += bankShare;
                        user.casesSolved++;
                        
                        thief.cooldowns.jail = Date.now() + (5 * 60 * 1000);
                        thief.id = generateID('thief');

                        await saveUser(mentionedJid);
                        await saveBank();
                        await sock.sendMessage(from, { text: txt(`✅ ARRESTED! Reward: ${formatMoney(policeShare)}`, `✅ MAN A NI! Lawmman: ${formatMoney(policeShare)}`) });
                    } else {
                        await sock.sendMessage(from, { text: "❌ Wrong ID!" });
                    }
                } else {
                    await sock.sendMessage(from, { text: "Not a thief." });
                }
                await saveUser(sender);
            }

            // Key 17: /leave
            if (command === '/leave') {
                if (user.employer) {
                    const boss = localUsers[user.employer];
                    if (boss) { 
                        boss.bodyguard = null; 
                        await saveUser(user.employer);
                    }
                    user.employer = null;
                    await saveUser(sender);
                    await sock.sendMessage(from, { text: "✅ Resigned as Bodyguard." });
                } else {
                    await sock.sendMessage(from, { text: "You are not hired." });
                }
            }
        }
 // --- 4. BUSINESSMAN COMMANDS ---

        if (user.role === 'businessman') {
            // Key 18: /invest[amount]
            if (command.startsWith('/invest') && !command.includes('st')) {
                const amount = parseInt(command.replace(/\D/g, ''));
                if (!amount || user.cash < amount) return sock.sendMessage(from, { text: "Not enough cash." });

                user.cash -= amount;
                localInvestments.push({
                    jid: sender,
                    amount: amount,
                    endTime: isAdmin ? Date.now() + 1000 : Date.now() + (30 * 60 * 1000)
                });
                await saveUser(sender);
                await sock.sendMessage(from, { text: `✅ Invested ${formatMoney(amount)}` });
            }

            // Key 19: /investst (Current)
            if (command === '/investst') {
                const myInv = localInvestments.filter(i => i.jid === sender);
                if (myInv.length === 0) return sock.sendMessage(from, { text: "No active investments." });
                let out = "📜 *ACTIVE INVESTMENTS*\n";
                myInv.forEach(i => {
                    const mins = Math.ceil((i.endTime - Date.now()) / 60000);
                    out += `Amount: ${formatMoney(i.amount)} | Time: ${mins} mins\n`;
                });
                await sock.sendMessage(from, { text: out });
            }

            // Key 20: /investpst (History)
            if (command === '/investpst') {
                if (!user.pastInvestments || user.pastInvestments.length === 0) return sock.sendMessage(from, { text: "No history." });
                let out = "📉 *HISTORY*\n";
                user.pastInvestments.slice(-10).forEach(p => {
                    out += `📅 ${p.date}\nInvest: ${formatMoney(p.amount)} | ${p.result}: ${formatMoney(p.value)}\n\n`;
                });
                await sock.sendMessage(from, { text: out });
            }

            // Key 21: @user/hire
            if (command.includes('hire') && mentionedJid) {
                const cop = localUsers[mentionedJid];
                if (cop && cop.role === 'police' && !cop.employer) {
                    cop.employer = sender;
                    user.bodyguard = mentionedJid;
                    await saveUser(sender);
                    await saveUser(mentionedJid);
                    await sock.sendMessage(from, { text: txt("✅ Bodyguard Hired!", "✅ Bodyguard chhawr a ni!") });
                } else {
                    await sock.sendMessage(from, { text: "Cannot hire this person." });
                }
            }

            // Key 22: /fire
            if (command === '/fire') {
                if (user.bodyguard) {
                    const cop = localUsers[user.bodyguard];
                    if (cop) { 
                        cop.employer = null; 
                        await saveUser(user.bodyguard);
                    }
                    user.bodyguard = null;
                    await saveUser(sender);
                    await sock.sendMessage(from, { text: "✅ Bodyguard Fired." });
                } else {
                    await sock.sendMessage(from, { text: "No bodyguard to fire." });
                }
            }

            // Key 23: /loan[amount]
            if (command.startsWith('/loan')) {
                const amount = parseInt(command.replace(/\D/g, ''));
                if (amount) {
                    await sock.sendMessage(OWNER_NUMBER + "@s.whatsapp.net", { 
                        text: `🏦 *LOAN REQUEST*\nUser: @${user.name}\nAmount: ${amount}\n\nTo accept type:\n/grantloan @user ${amount}` 
                    });
                    await sock.sendMessage(from, { text: "✅ Loan request sent to Admin." });
                }
            }
        }

        // --- 5. ADMIN COMMANDS (Owner Only) ---

        if (isAdmin) {
            // Key 24: @user/edit
            if (command.includes('edit') && !command.includes('id') && !command.includes('status')) {
                // Manual edit logic - simplified for command parsing
                // Usage: @user/edit cash 50000
                if (mentionedJid) {
                    const target = localUsers[mentionedJid];
                    if (body.includes('cash')) target.cash = parseInt(body.match(/\d+$/)[0]);
                    if (body.includes('cases')) target.casesSolved = parseInt(body.match(/\d+$/)[0]);
                    await saveUser(mentionedJid);
                    await sock.sendMessage(from, { text: "✅ User Edited." });
                }
            }

            // Key 25: @user/band
            if (command.includes('band') && mentionedJid) {
                localBanned.push(mentionedJid);
                await saveBanned();
                await sock.sendMessage(from, { text: "🚫 User Banned." });
            }

            // Key 26: /editstatus
            if (command === '/editstatus') {
                // Sets admin stats to max
                user.cash = 999999999;
                user.casesSolved = 999;
                await saveUser(sender);
                await sock.sendMessage(from, { text: "✅ Admin Status Updated." });
            }

            // Key 27: /admenu
            if (command === '/admenu') {
                await sock.sendMessage(from, { text: "👑 *ADMIN MENU*\n@user/edit [prop] [val]\n@user/band\n/editstatus\n@user/id\n@user/editid [newID]\n/grantloan @user [amount]" });
            }

            // Key 28: @user/id
            if (command.includes('id') && !command.includes('edit') && mentionedJid) {
                await sock.sendMessage(from, { text: `🕵️ Real ID: ${localUsers[mentionedJid].id}` });
            }

            // Key 29: @user/editid
            if (command.includes('editid') && mentionedJid) {
                const newID = body.match(/\d+$/);
                if (newID) {
                    localUsers[mentionedJid].id = newID[0];
                    await saveUser(mentionedJid);
                    await sock.sendMessage(from, { text: "✅ ID Updated." });
                }
            }

            // Bonus: Grant Loan Helper
            if (command === '/grantloan' && mentionedJid) {
                const amount = parseInt(args[2]);
                if (amount) {
                    localBank.balance -= amount;
                    localUsers[mentionedJid].cash += amount;
                    localUsers[mentionedJid].loanRepayCount += 10;
                    await saveUser(mentionedJid);
                    await saveBank();
                    await sock.sendMessage(from, { text: "✅ Loan Granted." });
                }
            }
        }
    });
}
// Start the Web Server first, then the Bot
keepAlive();
startBot();
// --- ANTI-CRASH HANDLERS (Paste at bottom of index.js) ---

process.on('uncaughtException', (err) => {
    console.error('❌ CRASH PREVENTED (Uncaught Exception):', err);
    // Bot stays alive
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ CRASH PREVENTED (Unhandled Rejection):', reason);
    // Bot stays alive
});

console.log("🛡️ Anti-Crash Shield Activated!");