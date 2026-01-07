const keepAlive = require('./keep_alive');
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

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// --- GAME CONFIGURATION ---
const OWNER_NUMBER = "919233137736"; 
const MY_NUMBER = "919233137736";   

// --- LOCAL CACHE ---
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
        const usersSnap = await db.collection('users').get();
        usersSnap.forEach(doc => { localUsers[doc.id] = doc.data(); });
        
        const bankSnap = await db.collection('global').doc('bank').get();
        if (bankSnap.exists) localBank = bankSnap.data();
        else await db.collection('global').doc('bank').set({ balance: 0 });

        const invSnap = await db.collection('investments').get();
        invSnap.forEach(doc => { localInvestments.push(doc.data()); });

        const banSnap = await db.collection('global').doc('banned').get();
        if (banSnap.exists) localBanned = banSnap.data().list || [];
        console.log("✅ Data Loaded Successfully.");
    } catch (e) { console.error("❌ Error loading data:", e); }
}

async function saveUser(jid) { if (localUsers[jid]) await db.collection('users').doc(jid).set(localUsers[jid]); }
async function saveBank() { await db.collection('global').doc('bank').set(localBank); }
async function saveBanned() { await db.collection('global').doc('banned').set({ list: localBanned }); }

// --- GET USER (IDENTITY FIX) ---
const getUser = (jid, name) => {
    if (!localUsers[jid]) {
        localUsers[jid] = {
            id: generateID('citizen'),
            role: 'citizen',
            cash: 10000,
            name: name || 'User',
            lastIncome: getTimestamp(),
            casesSolved: 0,
            bodyguard: null, 
            employer: null, 
            loanRepayCount: 0, 
            robbedSuccessBy: [],    
            pastInvestments: [],
            cooldowns: { roleChange: 0, roleChangeCount: 0, jail: 0, robFail: {} }
        };
        saveUser(jid);
    }
    // FIX: Update name every time they speak
    if (name && localUsers[jid].name !== name) {
        localUsers[jid].name = name;
        saveUser(jid);
    }
    return localUsers[jid];
};

// --- INCOME LOOP ---
setInterval(() => {
    const now = getTimestamp();
    let bankUpdated = false;
    const active = [];
    
    localInvestments.forEach(async (inv) => {
        if (now >= inv.endTime) {
            const user = localUsers[inv.jid];
            if (user) {
                const isSuccess = Math.random() < 0.4;
                let profit = 0, loss = 0, resultText = "";
                if (isSuccess) {
                    const multiplier = Math.floor(Math.random() * 5) + 1; 
                    profit = inv.amount * multiplier;
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
                    user.cash += (inv.amount - loss);
                    localBank.balance += loss;
                    bankUpdated = true;
                    resultText = "Loss";
                }
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
    
    if (localInvestments.length !== active.length) localInvestments = active;

    for (let jid in localUsers) {
        const user = localUsers[jid];
        let userUpdated = false;
        if (user.role === 'thief' && user.cooldowns.jail > 0 && now > user.cooldowns.jail) {
            user.cooldowns.jail = 0;
            user.id = generateID('thief'); 
            userUpdated = true;
        }
        const limits = { citizen: 30, thief: 20, police: 30, businessman: 30 };
        const amounts = { citizen: 400, thief: 50, police: 450, businessman: 1000 };
        if (now - user.lastIncome >= (limits[user.role] || 30) * 60 * 1000) {
            if (user.role === 'thief' && user.cooldowns.jail > 0) continue; 
            user.cash += amounts[user.role] || 0;
            user.lastIncome = now;
            userUpdated = true;
        }
        if (userUpdated) saveUser(jid);
    }
    if (bankUpdated) saveBank();
}, 60 * 1000);
// --- MAIN BOT CONNECTION ---
async function startBot() {
    await loadData();
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000
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
        } else if (connection === 'open') console.log('✅ BOT CONNECTED!');
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        // --- IDENTITY FIX: SEPARATE WIFE FROM HUSBAND ---
        const sender = isGroup ? (msg.key.participant || from) : from;
        const normalizedSender = jidNormalizedUser(sender);

        const type = Object.keys(msg.message)[0];
        const body = (type === 'conversation') ? msg.message.conversation : 
                     (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : '';
        
        // --- LAG FIX: IGNORE CHATTER ---
        if (isGroup && !body.startsWith('/') && !body.startsWith('@')) return;

        const args = body.trim().split(/ +/);
        let command = args[0].toLowerCase();
        
        let mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (body.includes('/') && command.includes('@')) {
            const parts = command.split('/');
            if (parts.length > 1) command = '/' + parts[1].replace(/\d+/g, ''); 
        }

        const pushName = msg.pushName || "User";
        if (localBanned.includes(normalizedSender)) return;
        const user = getUser(normalizedSender, pushName);
        const isAdmin = normalizedSender.includes(OWNER_NUMBER);

        // --- 1. GENERAL COMMANDS ---
        if (command === '/menu') {
            const menuText = txt(
                "📜 *GAME MENU*\n\n*General:*\n👮 /crlps (Police)\n🦹 /crltf (Thief)\n🤵 /crlbs (Businessman)\n🔍 /status (My Info)\n🗑️ /del (Delete Msg)\n💰 /ubank (Bank Balance)\n🏆 /toppolice (Top Cops)\n🤑 /richestman (Top Rich)\n\n*Thief:*\n🎯 /scantarget (200)\n🚔 /scanps (100)\n🕵️ @user/rob[ID] (100)\n⛓️ /jailtm (Jail Time)\n\n*Police:*\n📡 /scan (200)\n👮 @user/arrest[ID] (50)\n🚪 /leave (Resign Bodyguard)\n\n*Businessman:*\n💸 /invest[amount]\n📜 /investst (Active Invest)\n📉 /investpst (History)\n🤝 @user/hire (Hire Cop)\n🔥 /fire (Fire Cop)\n🏦 /loan[amount]",
                "📜 *INKHEL MENU*\n\n*General:*\n👮 /crlps (Police)\n🦹 /crltf (Rukru)\n🤵 /crlbs (Sumdawng)\n🔍 /status (Ka Chanchin)\n🗑️ /del (Delete Msg)\n💰 /ubank (Bank Balance)\n🏆 /toppolice (Police Tha)\n🤑 /richestman (Mi Hausa)\n\n*Rukru:*\n🎯 /scantarget (Man 200)\n🚔 /scanps (Man 100)\n🕵️ @user/rob[ID] (Man 100)\n⛓️ /jailtm (Jail Time)\n\n*Police:*\n📡 /scan (Man 200)\n👮 @user/arrest[ID] (Man 50)\n🚪 /leave (Bodyguard Bang)\n\n*Sumdawng:*\n💸 /invest[zat]\n📜 /investst (Active Invest)\n📉 /investpst (History)\n🤝 @user/hire (Hire Cop)\n🔥 /fire (Fire Cop)\n🏦 /loan[zat]"
            );
            await sock.sendMessage(from, { text: menuText });
        }

        if (['/crlps', '/crltf', '/crlbs'].includes(command)) {
            if (!isAdmin && user.cooldowns.roleChangeCount >= 2 && Date.now() < user.cooldowns.roleChange) {
                const waitDays = Math.ceil((user.cooldowns.roleChange - Date.now()) / (1000 * 60 * 60 * 24));
                return sock.sendMessage(from, { text: txt(`Wait ${waitDays} days.`, `Ni ${waitDays} nghak rawh.`) });
            }
            let newRole = '';
            if (command === '/crlps') newRole = 'police';
            if (command === '/crltf') newRole = 'thief';
            if (command === '/crlbs') { 
                newRole = 'businessman'; 
                if (user.role !== 'businessman') user.cash += 500000;
            }
            user.role = newRole;
            user.id = generateID(newRole);
            if (!isAdmin) {
                user.cooldowns.roleChangeCount++;
                if (user.cooldowns.roleChangeCount >= 2) user.cooldowns.roleChange = Date.now() + (2 * 24 * 60 * 60 * 1000); 
            }
            await saveUser(normalizedSender);
            await sock.sendMessage(from, { text: `✅ Role: ${newRole}` });
        }

        if (command === '/status') {
            let roleDisplay = user.role;
            if (isGroup && user.role === 'thief') roleDisplay = 'citizen';
            let extra = user.role === 'police' ? `\nCases Solved: ${user.casesSolved}` : "";
            await sock.sendMessage(from, { text: `👤 Name: ${user.name}\nRole: ${roleDisplay}\nWealth: ${formatMoney(user.cash)}${extra}` });
        }
        if (command.includes('status') && mentionedJid) {
            const t = localUsers[mentionedJid];
            if (t) {
                let r = t.role === 'thief' ? 'citizen' : t.role;
                await sock.sendMessage(from, { text: `👤 @${t.name}\nRole: ${r}\nWealth: ${formatMoney(t.cash)}` });
            }
        }

        if (command === '/del') {
            try { await sock.sendMessage(from, { delete: msg.key }); } 
            catch (e) { await sock.sendMessage(from, { text: "⚠️ I need Admin to delete." }); }
        }

        if (command === '/ubank') await sock.sendMessage(from, { text: `🏦 Bank: ${formatMoney(localBank.balance)}` });
        if (command === '/toppolice') {
            const sorted = Object.values(localUsers).filter(u => u.role === 'police').sort((a,b) => b.casesSolved - a.casesSolved).slice(0, 50);
            let out = "🏆 *TOP POLICE*\n";
            sorted.forEach((u,i) => out += `${i+1}. ${u.name} - ${u.casesSolved}\n`);
            await sock.sendMessage(from, { text: out });
        }
        if (command === '/richestman') {
            const sorted = Object.values(localUsers).sort((a,b) => b.cash - a.cash).slice(0, 50);
            let out = "💰 *RICHEST*\n";
            sorted.forEach((u,i) => out += `${i+1}. ${u.name} (${u.role === 'thief' ? 'citizen' : u.role}) - ${formatMoney(u.cash)}\n`);
            await sock.sendMessage(from, { text: out });
        }

        // --- 2. THIEF COMMANDS ---
        if (user.role === 'thief') {
            if (user.cooldowns.jail > Date.now()) {
                if (command === '/jailtm') {
                    const t = Math.ceil((user.cooldowns.jail - Date.now()) / 60000);
                    return sock.sendMessage(from, { text: `⛓️ Jail: ${t} mins` });
                }
                return sock.sendMessage(from, { text: "🚫 In Jail!" });
            }
            if (command === '/scantarget') {
                if (user.cash < 200) return sock.sendMessage(from, { text: "Need 200." });
                user.cash -= 200;
                let out = "🎯 *TARGETS*\n";
                for (let k in localUsers) {
                    const u = localUsers[k];
                    if (u.role === 'citizen' || u.role === 'businessman') {
                        let idVis = u.role === 'citizen' ? `${u.id.substring(0,2)}?` : (u.bodyguard ? `${u.id.substring(0,2)}????` : `${u.id.substring(0,3)}???`);
                        out += `@${u.name} | ${formatMoney(u.cash)} | ID: ${idVis}\n`;
                    }
                }
                await saveUser(normalizedSender);
                await sock.sendMessage(from, { text: out });
            }
            if (command === '/scanps') {
                if (user.cash < 100) return sock.sendMessage(from, { text: "Need 100." });
                user.cash -= 100;
                let out = "🚔 *POLICE*\n";
                for (let k in localUsers) if(localUsers[k].role === 'police') out += `@${localUsers[k].name} | Cases: ${localUsers[k].casesSolved}\n`;
                await saveUser(normalizedSender);
                await sock.sendMessage(from, { text: out });
            }
            if (command.includes('rob')) {
                const guessStr = body.match(/\d+$/);
                const guess = guessStr ? parseInt(guessStr[0]) : null;
                if (!mentionedJid || !guess) return sock.sendMessage(from, { text: "Usage: @user/rob[ID]" });
                if (user.cash < 100) return sock.sendMessage(from, { text: "Need 100." });
                user.cash -= 100;
                const target = localUsers[mentionedJid];
                if (!target) return;
                
                if (target.robbedSuccessBy && target.robbedSuccessBy.includes(normalizedSender)) return sock.sendMessage(from, { text: "Already robbed." });
                if (user.cooldowns.robFail[mentionedJid] && Date.now() < user.cooldowns.robFail[mentionedJid]) return sock.sendMessage(from, { text: "Wait 30 mins." });

                const diff = Math.abs(parseInt(target.id) - guess);
                let percent = 0;
                if (diff === 0) percent = 0.10;
                else if (diff < 10) percent = 0.02;
                else if (diff < 50) percent = 0.01;

                if (percent > 0) {
                    const stolen = Math.floor(target.cash * percent);
                    target.cash -= stolen;
                    user.cash += stolen;
                    if (!target.robbedSuccessBy) target.robbedSuccessBy = [];
                    target.robbedSuccessBy.push(normalizedSender);
                    target.id = generateID(target.role);
                    await saveUser(mentionedJid);
                    await sock.sendMessage(from, { text: `✅ Stole ${formatMoney(stolen)}` });
                } else {
                    user.cooldowns.robFail[mentionedJid] = Date.now() + (30*60*1000);
                    await sock.sendMessage(from, { text: "❌ Failed." });
                }
                await saveUser(normalizedSender);
            }
            if (command === '/jailtm') await sock.sendMessage(from, { text: "✅ Not in jail." });
        }

        // --- 3. POLICE COMMANDS ---
        if (user.role === 'police') {
            if (command === '/scan') {
                if (user.cash < 200) return sock.sendMessage(from, { text: "Need 200." });
                user.cash -= 200;
                let out = "📡 *THIEVES*\n";
                for (let k in localUsers) if (localUsers[k].role === 'thief') out += `@${localUsers[k].name} | ID: ${localUsers[k].id.substring(0,2)}? | Reward: ${formatMoney(Math.floor(localUsers[k].cash * 0.03))}\n`;
                await saveUser(normalizedSender);
                await sock.sendMessage(from, { text: out });
            }
            if (command.includes('arrest')) {
                const guessStr = body.match(/\d+$/);
                const guess = guessStr ? parseInt(guessStr[0]) : null;
                if (!mentionedJid || !guess) return;
                if (user.cash < 50) return sock.sendMessage(from, { text: "Need 50." });
                user.cash -= 50;
                const thief = localUsers[mentionedJid];
                if (thief && thief.role === 'thief') {
                    if (parseInt(thief.id) === guess) {
                        const seized = Math.floor(thief.cash * 0.80);
                        const reward = Math.floor(seized * 0.03);
                        const bankShare = seized - reward;
                        thief.cash -= seized;
                        user.cash += reward;
                        localBank.balance += bankShare;
                        user.casesSolved++;
                        thief.cooldowns.jail = Date.now() + (5*60*1000);
                        thief.id = generateID('thief');
                        await saveUser(mentionedJid);
                        await saveBank();
                        await sock.sendMessage(from, { text: `✅ Arrested! Reward: ${formatMoney(reward)}` });
                    } else {
                        await sock.sendMessage(from, { text: "❌ Wrong ID." });
                    }
                } else { await sock.sendMessage(from, { text: "Not a thief." }); }
                await saveUser(normalizedSender);
            }
            if (command === '/leave') {
                if (user.employer) {
                    if (localUsers[user.employer]) { localUsers[user.employer].bodyguard = null; await saveUser(user.employer); }
                    user.employer = null;
                    await saveUser(normalizedSender);
                    await sock.sendMessage(from, { text: "✅ Resigned." });
                }
            }
        }

        // --- 4. BUSINESSMAN COMMANDS ---
        if (user.role === 'businessman') {
            // FIX: /invest 1000 or /invest1000 parsing
            if (command.startsWith('/invest') && !command.includes('st')) {
                const amountStr = body.match(/\d+/);
                const amount = amountStr ? parseInt(amountStr[0]) : 0;
                if (amount <= 0 || user.cash < amount) return sock.sendMessage(from, { text: "Not enough cash." });
                user.cash -= amount;
                localInvestments.push({
                    jid: normalizedSender,
                    amount: amount,
                    endTime: isAdmin ? Date.now() + 1000 : Date.now() + (30*60*1000)
                });
                await saveUser(normalizedSender);
                await sock.sendMessage(from, { text: `✅ Invested ${formatMoney(amount)}` });
            }
            if (command === '/investst') {
                const my = localInvestments.filter(i => i.jid === normalizedSender);
                let out = "📜 *ACTIVE*\n";
                my.forEach(i => out += `${formatMoney(i.amount)} (${Math.ceil((i.endTime-Date.now())/60000)}m)\n`);
                await sock.sendMessage(from, { text: out || "None." });
            }
            if (command === '/investpst') {
                let out = "📉 *HISTORY*\n";
                (user.pastInvestments || []).slice(-10).forEach(p => out += `${p.date}: ${p.result} ${formatMoney(p.value)}\n`);
                await sock.sendMessage(from, { text: out });
            }
            if (command.includes('hire') && mentionedJid) {
                const cop = localUsers[mentionedJid];
                if (cop && cop.role === 'police' && !cop.employer) {
                    cop.employer = normalizedSender;
                    user.bodyguard = mentionedJid;
                    await saveUser(normalizedSender);
                    await saveUser(mentionedJid);
                    await sock.sendMessage(from, { text: "✅ Hired." });
                }
            }
            if (command === '/fire') {
                if (user.bodyguard) {
                    if (localUsers[user.bodyguard]) { localUsers[user.bodyguard].employer = null; await saveUser(user.bodyguard); }
                    user.bodyguard = null;
                    await saveUser(normalizedSender);
                    await sock.sendMessage(from, { text: "✅ Fired." });
                }
            }
            if (command.startsWith('/loan')) {
                const amt = body.match(/\d+/);
                if (amt) {
                    await sock.sendMessage(OWNER_NUMBER + "@s.whatsapp.net", { text: `LOAN: @${user.name} wants ${amt[0]}` });
                    await sock.sendMessage(from, { text: "✅ Request Sent." });
                }
            }
        }

        // --- 5. ADMIN COMMANDS ---
        if (isAdmin) {
            if (command === '/admenu') await sock.sendMessage(from, { text: "👑 ADMIN: @/edit @/band /editstatus @/id @/editid /grantloan" });
            if (command.includes('edit') && mentionedJid && !command.includes('id') && !command.includes('status')) {
                const t = localUsers[mentionedJid];
                if (body.includes('cash')) t.cash = parseInt(body.match(/\d+/)[0]);
                if (body.includes('cases')) t.casesSolved = parseInt(body.match(/\d+/)[0]);
                await saveUser(mentionedJid);
                await sock.sendMessage(from, { text: "✅ Updated." });
            }
            if (command === '/grantloan' && mentionedJid) {
                const amt = parseInt(body.match(/\d+/)[0]);
                localBank.balance -= amt;
                localUsers[mentionedJid].cash += amt;
                localUsers[mentionedJid].loanRepayCount += 10;
                await saveUser(mentionedJid);
                await saveBank();
                await sock.sendMessage(from, { text: "✅ Granted." });
            }
            if (command === '/editstatus') {
                user.cash = 999999999;
                user.casesSolved = 999;
                await saveUser(normalizedSender);
                await sock.sendMessage(from, { text: "✅ Admin Stats Maxed." });
            }
            if (command.includes('band') && mentionedJid) {
                localBanned.push(mentionedJid);
                await saveBanned();
                await sock.sendMessage(from, { text: "🚫 Banned." });
            }
            if (command.includes('id') && mentionedJid) {
                await sock.sendMessage(from, { text: `ID: ${localUsers[mentionedJid].id}` });
            }
            if (command.includes('editid') && mentionedJid) {
                const newID = body.match(/\d+/);
                if (newID) {
                    localUsers[mentionedJid].id = newID[0];
                    await saveUser(mentionedJid);
                    await sock.sendMessage(from, { text: "✅ ID Updated." });
                }
            }
        }
    });
}
keepAlive();
startBot();

process.on('uncaughtException', (err) => { console.error('❌ CRASH PREVENTED:', err); });
process.on('unhandledRejection', (reason, promise) => { console.error('❌ CRASH PREVENTED:', reason); });
