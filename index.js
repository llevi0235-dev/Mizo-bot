const {
    default: makeWASocket,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    initAuthCreds,
    BufferJSON
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const { initializeApp, getApps, getApp } = require("firebase/app");
const { 
    getFirestore, doc, getDoc, setDoc, updateDoc, 
    deleteDoc, increment, collection, query, 
    where, orderBy, limit, getDocs, addDoc 
} = require("firebase/firestore");

const config = require('./config');

// --- INITIALIZE FIREBASE ---
let app;
if (getApps().length === 0) {
    app = initializeApp(config.firebaseConfig);
} else {
    app = getApp();
}
const db = getFirestore(app);

// --- SERVER (Keeps Bot Alive) ---
const server = express();
const port = process.env.PORT || 3000;
server.get("/", (req, res) => res.send("Mizo City RPG is Running..."));
server.listen(port, () => console.log(`Server on port ${port}`));
// --- AUTH ADAPTER ---
const useFirestoreAuthState = async (collectionName) => {
    const credsRef = doc(db, collectionName, "creds");
    const credsSnap = await getDoc(credsRef);
    const creds = credsSnap.exists() 
        ? JSON.parse(credsSnap.data().value, BufferJSON.reviver) 
        : initAuthCreds();

    const keys = async (type, ids) => {
        const data = {};
        await Promise.all(ids.map(async (id) => {
            const docRef = doc(db, collectionName, `${type}-${id}`);
            const snap = await getDoc(docRef);
            if (snap.exists()) data[id] = JSON.parse(snap.data().value, BufferJSON.reviver);
        }));
        return data;
    };

    const saveCreds = async () => {
        await setDoc(credsRef, { value: JSON.stringify(creds, BufferJSON.replacer) }, { merge: true });
    };

    return {
        state: {
            creds,
            keys: {
                get: keys,
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const docRef = doc(db, collectionName, `${category}-${id}`);
                            if (value) tasks.push(setDoc(docRef, { value: JSON.stringify(value, BufferJSON.replacer) }, { merge: true }));
                            else tasks.push(deleteDoc(docRef));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds
    };
};
// --- MAIN BOT FUNCTION ---
async function startBot() {
    // We use a NEW folder name to ensure fresh login
    const { state, saveCreds } = await useFirestoreAuthState("auth_baileys_final_v3");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- PAIRING CODE GENERATION ---
    if (!sock.authState.creds.registered) {
        console.log("⚠️ Waiting for Pairing Code...");
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(config.botNumber);
                console.log(`\n\n[ PAIRING CODE ] : ${code.match(/.{1,4}/g)?.join("-")}\n\n`);
            } catch (e) { console.log("Pairing Error:", e); }
        }, 6000);
    }
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(() => startBot(), 5000);
        } else if (connection === "open") {
            console.log("✅ Mizo Bot Connected!");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // --- TRANSLATIONS (English & Mizo) ---
    const getText = (key) => {
        const lang = {
            welcome: { en: "Welcome! Cash: 10,000", mz: "Lo leng rawh! Pawisa: 10,000" },
            no_cash: { en: "Not enough cash!", mz: "Pawisa i nei tawk lo!" },
            jail: { en: "You are in JAIL!", mz: "JAIL-ah i tang!" },
            role_limit: { en: "Role limit reached. Wait 2 days.", mz: "Nihna thlak a theih rih loh. Ni 2 nghak rawh." },
            rob_success: { en: "✅ Robbery Successful!", mz: "✅ Rawk a hlawhtling!" },
            rob_fail: { en: "❌ Robbery Failed!", mz: "❌ Rawk a hlawhchham!" },
            arrest_win: { en: "⚖️ Arrest Successful!", mz: "⚖️ Man a ni ta!" },
            arrest_fail: { en: "💨 Wrong ID! Thief escaped.", mz: "💨 ID diklo! Rukru a tlanbo." },
            invest_start: { en: "📉 Invested. Wait 30 mins.", mz: "📉 Sum dawnna tan a ni. Minute 30 nghak rawh." },
            banned: { en: "🚫 You are BANNED.", mz: "🚫 Game atang hian BAN i ni." }
        };
        const t = lang[key];
        if (!t) return key;
        return `🇬🇧 ${t.en}\n🇲🇿 ${t.mz}`;
    };
    // --- HELPER: GET OR CREATE USER ---
    async function getUser(id) {
        if (!id) return null;
        const ref = doc(db, "users", id);
        const snap = await getDoc(ref);
        if (snap.exists()) return snap.data();
        
        // NEW USER DEFAULTS
        const newUser = {
            id: id,
            role: 'citizen',
            wealth: 10000,
            special_id: Math.floor(100 + Math.random() * 900), // 3 Digits
            last_income: Date.now(),
            role_changes: 0,
            last_role_change: 0,
            cases_solved: 0,
            jail_release: 0,
            employer: null, // For Police
            employee: null, // For Businessman
            loan_repay: 0
        };
        await setDoc(ref, newUser);
        return newUser;
    }

    // --- HELPER: UNIVERSAL BANK ---
    async function addToBank(amount) {
        if (amount <= 0) return;
        await setDoc(doc(db, "ubank", "main"), { balance: increment(amount) }, { merge: true });
    }
    // --- LOGIC: CHECK INCOME ---
    async function checkIncome(user) {
        const now = Date.now();
        let amount = 0; 
        let time = 30; // Minutes

        if (user.role === 'citizen') { amount = 400; time = 30; }
        if (user.role === 'thief') { amount = 50; time = 20; }
        if (user.role === 'police') { amount = 450; time = 30; }
        if (user.role === 'businessman') { amount = 1000; time = 30; }

        const interval = time * 60 * 1000;
        const elapsed = now - user.last_income;

        if (elapsed >= interval) {
            const cycles = Math.floor(elapsed / interval);
            const total = amount * cycles;
            await updateDoc(doc(db, "users", user.id), {
                wealth: increment(total),
                last_income: now
            });
        }
    }
    // --- COMMAND: CHANGE ROLE ---
    async function cmdChangeRole(user, newRole, msg) {
        // Admin Bypass
        const isAdmin = user.id.includes(config.adminNumber.replace('@s.whatsapp.net',''));
        
        if (!isAdmin) {
            if (user.role_changes >= 2) {
                const cooldown = 2 * 24 * 60 * 60 * 1000; // 2 Days
                if (Date.now() - user.last_role_change < cooldown) {
                    return sock.sendMessage(user.id, { text: getText('role_limit') });
                } else {
                    await updateDoc(doc(db, "users", user.id), { role_changes: 0 });
                }
            }
        }

        let newId = Math.floor(100 + Math.random() * 900); // Default 3 digits
        let bonus = 0;
        if (newRole === 'businessman') {
            newId = Math.floor(100000 + Math.random() * 900000); // 6 Digits
            if (user.role === 'citizen') bonus = 500000; // First time bonus logic simplified
        }
        
        await updateDoc(doc(db, "users", user.id), {
            role: newRole,
            special_id: newId,
            role_changes: increment(1),
            last_role_change: Date.now(),
            wealth: increment(bonus)
        });
        await sock.sendMessage(user.id, { text: `Role changed to: ${newRole.toUpperCase()}\nBonus: ${bonus}` });
    }
    // --- COMMAND: THIEF ACTIONS ---
    async function cmdThief(user, cmd, text, targetJid) {
        if (user.role !== 'thief') return;
        if (user.jail_release > Date.now()) return sock.sendMessage(user.id, { text: getText('jail') });

        // SCAN TARGETS
        if (cmd === '/scantarget') {
            if (user.wealth < 200) return sock.sendMessage(user.id, { text: getText('no_cash') });
            await updateDoc(doc(db, "users", user.id), { wealth: increment(-200) });
            
            const q = query(collection(db, "users"), where("role", "in", ["citizen", "businessman"]), limit(10));
            const snaps = await getDocs(q);
            let msg = "📡 TARGETS:\n";
            snaps.forEach(d => {
                const u = d.data();
                let mask = u.role === 'citizen' ? `${String(u.special_id).slice(0,2)}?` :
                           u.employee ? `${String(u.special_id).slice(0,2)}????` : `${String(u.special_id).slice(0,3)}???`;
                msg += `\n👤 @${u.id.split('@')[0]} (${u.role})\n💰 ${u.wealth}\n🆔 ${mask}\n`;
            });
            await sock.sendMessage(user.id, { text: msg });
        }

        // ROB
        if (cmd === '/rob' && targetJid) {
            const guess = text.match(/\d+$/)?.[0];
            if (!guess) return;
            if (user.wealth < 100) return sock.sendMessage(user.id, { text: getText('no_cash') });
            await updateDoc(doc(db, "users", user.id), { wealth: increment(-100) });

            const target = await getUser(targetJid);
            const realId = String(target.special_id);
            let percent = 0;

            if (guess === realId) percent = 0.10; // Exact
            else if (Math.abs(parseInt(guess) - parseInt(realId)) <= 50) percent = 0.02; // Close
            else percent = 0.01; // Far

            const stolen = Math.floor(target.wealth * percent);
            await updateDoc(doc(db, "users", targetJid), { wealth: increment(-stolen) });
            await updateDoc(doc(db, "users", user.id), { wealth: increment(stolen) });
            await sock.sendMessage(user.id, { text: `${getText('rob_success')} +${stolen}` });
        }
    }
    // --- COMMAND: POLICE ACTIONS ---
    async function cmdPolice(user, cmd, text, targetJid) {
        if (user.role !== 'police') return;

        // SCAN THIEVES
        if (cmd === '/scan') {
            if (user.wealth < 200) return sock.sendMessage(user.id, { text: getText('no_cash') });
            await updateDoc(doc(db, "users", user.id), { wealth: increment(-200) });

            const q = query(collection(db, "users"), where("role", "==", "thief"), limit(10));
            const snaps = await getDocs(q);
            let msg = "👮 THIEVES:\n";
            snaps.forEach(d => {
                const u = d.data();
                msg += `\n🦹 @${u.id.split('@')[0]}\n💰 Reward: ${Math.floor(u.wealth * 0.03)}\n🆔 ${String(u.special_id).slice(0,2)}?\n`;
            });
            await sock.sendMessage(user.id, { text: msg });
        }

        // ARREST
        if (cmd === '/arrest' && targetJid) {
            const guess = text.match(/\d+$/)?.[0];
            if (!guess) return;
            if (user.wealth < 50) return sock.sendMessage(user.id, { text: getText('no_cash') });
            await updateDoc(doc(db, "users", user.id), { wealth: increment(-50) });

            const thief = await getUser(targetJid);
            if (guess === String(thief.special_id)) {
                const penalty = Math.floor(thief.wealth * 0.80);
                const reward = Math.floor(penalty * 0.03);
                await addToBank(penalty - reward);
                
                await updateDoc(doc(db, "users", targetJid), { 
                    wealth: increment(-penalty), 
                    jail_release: Date.now() + (5*60*1000),
                    special_id: Math.floor(100 + Math.random() * 900)
                });
                await updateDoc(doc(db, "users", user.id), { wealth: increment(reward), cases_solved: increment(1) });
                await sock.sendMessage(user.id, { text: `${getText('arrest_win')} +${reward}` });
            } else {
                await sock.sendMessage(user.id, { text: getText('arrest_fail') });
            }
        }
    }
    // --- COMMAND: BUSINESS ACTIONS ---
    async function cmdBusiness(user, cmd, text, targetJid) {
        if (user.role !== 'businessman') return;

        // INVEST
        if (cmd.startsWith('/invest')) {
            const amount = parseInt(text.replace('/invest', ''));
            if (!amount) return;
            if (user.wealth < amount) return sock.sendMessage(user.id, { text: getText('no_cash') });
            
            await updateDoc(doc(db, "users", user.id), { wealth: increment(-amount) });
            await addDoc(collection(db, "investments"), {
                userId: user.id,
                amount: amount,
                startTime: Date.now(),
                status: 'active'
            });
            await sock.sendMessage(user.id, { text: getText('invest_start') });
        }

        // CHECK INVEST STATUS
        if (cmd === '/investst') {
            const q = query(collection(db, "investments"), where("userId", "==", user.id), where("status", "==", "active"));
            const snaps = await getDocs(q);
            let msg = "📊 INVESTMENTS:\n";
            snaps.forEach(d => {
                const i = d.data();
                const passed = Date.now() - i.startTime;
                if (passed >= 30*60*1000) {
                    // RESOLVE
                    const win = Math.random() < 0.4;
                    let result = 0;
                    if (win) {
                        result = Math.floor(i.amount * ((Math.random()*4)+1));
                        if(user.loan_repay > 0) { // Loan Tax
                            const tax = Math.floor((result - i.amount) * 0.09);
                            result -= tax;
                            addToBank(tax);
                            updateDoc(doc(db, "users", user.id), { loan_repay: increment(-1) });
                        }
                    } else {
                        result = Math.floor(i.amount * (1 - Math.random()));
                        addToBank(i.amount - result);
                    }
                    updateDoc(doc(db, "investments", d.id), { status: 'done' });
                    updateDoc(doc(db, "users", user.id), { wealth: increment(result) });
                    msg += `\nResult: ${win ? "WIN" : "LOSS"} -> ${result}`;
                } else {
                    msg += `\nWait: ${Math.ceil((30*60000 - passed)/60000)}m`;
                }
            });
            await sock.sendMessage(user.id, { text: msg });
        }
    }
    // --- BUSINESS LOAN & HIRE ---
    async function cmdBusinessExtras(user, cmd, text, targetJid) {
        if (user.role !== 'businessman') return;

        // LOAN
        if (cmd.startsWith('/loan')) {
            const amount = parseInt(text.replace('/loan', ''));
            const adminId = config.adminNumber + "@s.whatsapp.net";
            await sock.sendMessage(adminId, { 
                text: `📢 LOAN REQUEST\nUser: @${user.id.split('@')[0]}\nAmount: ${amount}\n\nApprove: /approve @user ${amount}`,
                mentions: [user.id]
            });
            await sock.sendMessage(user.id, { text: "Loan request sent." });
        }

        // HIRE
        if (cmd === '/hire' && targetJid) {
            const target = await getUser(targetJid);
            if (target.role === 'police' && !target.employer) {
                await updateDoc(doc(db, "users", user.id), { employee: targetJid });
                await updateDoc(doc(db, "users", targetJid), { employer: user.id });
                await sock.sendMessage(user.id, { text: "Bodyguard Hired!" });
            }
        }
        
        // FIRE
        if (cmd === '/fire' && user.employee) {
            await updateDoc(doc(db, "users", user.employee), { employer: null });
            await updateDoc(doc(db, "users", user.id), { employee: null });
            await sock.sendMessage(user.id, { text: "Bodyguard Fired!" });
        }
    }
    // --- LEADERBOARDS ---
    async function cmdLeaderboard(user, cmd) {
        let q, title;
        if (cmd === '/toppolice') {
            title = "👮 TOP POLICE";
            q = query(collection(db, "users"), where("role", "==", "police"), orderBy("cases_solved", "desc"), limit(50));
        } else if (cmd === '/richestman') {
            title = "💰 RICHEST";
            q = query(collection(db, "users"), orderBy("wealth", "desc"), limit(50));
        }
        
        if (q) {
            const snaps = await getDocs(q);
            let msg = `*${title}*\n`;
            let i = 1;
            snaps.forEach(d => {
                const u = d.data();
                const role = (cmd === '/richestman' && u.role === 'thief') ? 'citizen' : u.role;
                msg += `\n${i}. @${u.id.split('@')[0]} (${role}) - ${cmd === '/toppolice' ? u.cases_solved : u.wealth}`;
                i++;
            });
            await sock.sendMessage(user.id, { text: msg });
        }
    }

    // --- ADMIN ---
    async function cmdAdmin(user, cmd, text, targetJid) {
        if (!user.id.includes(config.adminNumber.replace('@s.whatsapp.net',''))) return;

        if (cmd === '/approve' && targetJid) {
            const amount = parseInt(text.split(' ')[2]);
            await updateDoc(doc(db, "users", targetJid), { wealth: increment(amount), loan_repay: increment(10) });
            await addToBank(-amount);
            await sock.sendMessage(user.id, { text: "Loan Approved" });
        }
        if (text.includes('/band') && targetJid) {
            await updateDoc(doc(db, "users", targetJid), { banned: true });
            await sock.sendMessage(user.id, { text: "User Banned" });
        }
        if (text.includes('/edit') && targetJid) {
            // Usage: /edit @user wealth 500000
            const args = text.split(' ');
            if (args[2] === 'wealth') await updateDoc(doc(db, "users", targetJid), { wealth: parseInt(args[3]) });
            await sock.sendMessage(user.id, { text: "Updated" });
        }
        if (text.includes('/id') && targetJid) {
            const t = await getUser(targetJid);
            await sock.sendMessage(user.id, { text: `Real ID: ${t.special_id}` });
        }
    }
    // --- MAIN MESSAGE LISTENER ---
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const msgType = Object.keys(m.message)[0];
        const text = msgType === "conversation" ? m.message.conversation : 
                     msgType === "extendedTextMessage" ? m.message.extendedTextMessage.text : "";
        
        if (!text) return;

        const sender = m.key.remoteJid;
        const user = await getUser(sender);
        
        // Income Tick
        await checkIncome(user);

        if (user.banned) return;

        const args = text.trim().split(/ +/);
        const cmd = args[0].toLowerCase();
        const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                             (args[1] ? args[1].replace('@', '') + "@s.whatsapp.net" : null);

        console.log(`Command: ${cmd} from ${sender}`);
        // --- ROUTING ---
        if (cmd === '/menu') {
            const menu = `📜 *MIZO CITY RPG MENU* 📜\n
👤 /status, /ubank, /toppolice, /richestman, /del
🎭 /crlps (Police), /crltf (Thief), /crlbs (Businessman)
\n👮 /scan, /arrest @user [id], /leave
🦹 /scantarget, /scanps, /rob @user [id], /jailtm
💼 /invest [amount], /investst, /loan [amount], /hire @user, /fire
\n👑 Owner: 919233137736`;
            await sock.sendMessage(sender, { text: menu });
        }

        // Status
        else if (cmd === '/status' || text.includes('/status')) {
            const target = mentionedJid ? await getUser(mentionedJid) : user;
            const roleDisplay = (user.role !== 'dm' && target.role === 'thief') ? 'citizen' : target.role;
            let msg = `👤 @${target.id.split('@')[0]}\n🎭 ${roleDisplay}\n💰 ${target.wealth}`;
            if (target.role === 'police') msg += `\n🎖 Cases: ${target.cases_solved}`;
            await sock.sendMessage(sender, { text: msg, mentions: [target.id] });
        }

        // Roles
        else if (['/crlps', '/crltf', '/crlbs'].includes(cmd)) await cmdChangeRole(user, cmd.replace('/crl','').replace('ps','police').replace('tf','thief').replace('bs','businessman'), m);
        
        // Thief
        else if (['/scantarget', '/rob'].includes(cmd) || text.includes('/rob')) await cmdThief(user, cmd, text, mentionedJid);
        else if (cmd === '/scanps') { /* reuse logic */ } 
        else if (cmd === '/jailtm') {
            const left = Math.ceil((user.jail_release - Date.now())/60000);
            await sock.sendMessage(sender, { text: left > 0 ? `⏳ Jail: ${left}m` : "✅ Free" });
        }
        // Police
        else if (['/scan', '/arrest'].includes(cmd) || text.includes('/arrest')) await cmdPolice(user, cmd, text, mentionedJid);

        // Business
        else if (cmd.startsWith('/invest') || cmd === '/investst') await cmdBusiness(user, cmd, text, mentionedJid);
        else if (cmd.startsWith('/loan') || cmd === '/hire' || cmd === '/fire') await cmdBusinessExtras(user, cmd, text, mentionedJid);

        // Leaderboard & Admin
        else if (['/toppolice', '/richestman'].includes(cmd)) await cmdLeaderboard(user, cmd);
        else if (cmd === '/ubank') {
            const b = await getDoc(doc(db, "ubank", "main"));
            await sock.sendMessage(sender, { text: `🏛 Universal Bank: ${b.data()?.balance || 0}` });
        }
        
        // Admin Trigger
        await cmdAdmin(user, cmd, text, mentionedJid);
    });
}

// START THE BOT
startBot();
