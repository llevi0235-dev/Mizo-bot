const { initializeApp } = require("firebase/app");
const { 
    getFirestore, doc, getDoc, setDoc, updateDoc, 
    increment, collection, getDocs, query, where, 
    orderBy, limit, runTransaction 
} = require("firebase/firestore");

const config = require('./config');
const getText = require('./language');

// --- FIREBASE INIT ---
const app = initializeApp(config.firebaseConfig);
const db = getFirestore(app);

// --- HELPER FUNCTIONS ---

// 1. Get User or Create New One
async function getUser(phoneNumber) {
    const userRef = doc(db, "users", phoneNumber);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
        return snap.data();
    } else {
        // New Player -> Citizen
        const newUser = {
            id: phoneNumber,
            role: 'citizen',
            wealth: config.startingCash,
            special_id: Math.floor(100 + Math.random() * 900), // 3 Digit ID
            last_income_time: Date.now(),
            role_change_count: 0,
            cases_solved: 0,
            jail_release_time: 0
        };
        await setDoc(userRef, newUser);
        return newUser;
    }
}

// 2. Passive Income Logic (The "Lazy" Timer)
async function checkIncome(user) {
    const now = Date.now();
    let income = 0;
    let interval = 0;

    if (user.role === 'citizen') { income = config.citizenIncome; interval = config.citizenIncomeTime; }
    else if (user.role === 'thief') { income = config.thiefIncome; interval = config.thiefIncomeTime; }
    else if (user.role === 'police') { income = config.policeIncome; interval = config.policeIncomeTime; }
    else if (user.role === 'businessman') { income = config.businessmanIncome; interval = config.businessmanIncomeTime; }

    const minutesPassed = (now - user.last_income_time) / (1000 * 60);

    if (minutesPassed >= interval) {
        const cycles = Math.floor(minutesPassed / interval);
        const totalIncome = income * cycles;
        
        // Update DB
        const userRef = doc(db, "users", user.id);
        await updateDoc(userRef, {
            wealth: increment(totalIncome),
            last_income_time: now // Reset timer
        });
        return totalIncome;
    }
    return 0;
}

// 3. Universal Bank Logger
async function addToBank(amount) {
    const bankRef = doc(db, "universal_bank", "main");
    await setDoc(bankRef, { balance: increment(amount) }, { merge: true });
}

// --- MAIN COMMAND PROCESSOR ---
async function processCommand(sock, msg, text, sender) {
    const user = await getUser(sender);
    
    // Check Jail
    if (user.jail_release_time > Date.now()) {
        await sock.sendMessage(msg.key.remoteJid, { text: getText('cooldown_active') }, { quoted: msg });
        return;
    }

    // Apply Passive Income automatically
    await checkIncome(user);

    const cmd = text.split(' ')[0].toLowerCase();
    const args = text.split(' ').slice(1);

    // --- 1. GENERAL COMMANDS ---
    
    if (cmd === '/menu') {
        const menuText = `
*--- 🏛 CITY RPG MENU 🏛 ---*
/status - My Info
/ubank - Universal Bank
/crlps - Join Police
/crltf - Join Thief
/crlbs - Join Businessman
---------------------------
*👮 Police:* /scan, @user/arrest
*🦹 Thief:* /scantarget, @user/rob
*💼 Business:* /invest, /loan
---------------------------
*Dev:* My Lord`;
        await sock.sendMessage(msg.key.remoteJid, { text: menuText }, { quoted: msg });
    }

    else if (cmd === '/status') {
        let statusMsg = `👤 *Role:* ${user.role.toUpperCase()}\n💰 *Wealth:* ${user.wealth}\n`;
        if(user.role === 'police') statusMsg += `🎖 *Cases:* ${user.cases_solved}`;
        await sock.sendMessage(msg.key.remoteJid, { text: statusMsg }, { quoted: msg });
    }

    else if (cmd === '/ubank') {
        const bankSnap = await getDoc(doc(db, "universal_bank", "main"));
        const balance = bankSnap.exists() ? bankSnap.data().balance : 0;
        await sock.sendMessage(msg.key.remoteJid, { text: `🏛 *Universal Bank:* ${balance}` }, { quoted: msg });
    }

    // --- 2. ROLE CHANGES ---
    
    else if (['/crlps', '/crltf', '/crlbs'].includes(cmd)) {
        // Check cooldown logic here (omitted for brevity, but can add)
        let newRole = '';
        let newId = 0;
        
        if (cmd === '/crlps') { newRole = 'police'; }
        if (cmd === '/crltf') { newRole = 'thief'; newId = Math.floor(100 + Math.random() * 900); }
        if (cmd === '/crlbs') { newRole = 'businessman'; newId = Math.floor(100000 + Math.random() * 900000); } // 6 digits

        await updateDoc(doc(db, "users", sender), { role: newRole, special_id: newId });
        await sock.sendMessage(msg.key.remoteJid, { text: getText('role_changed') + " " + newRole }, { quoted: msg });
    }

    // --- 3. THIEF COMMANDS ---

    else if (cmd === '/scantarget') {
        if (user.role !== 'thief') return;
        if (user.wealth < config.costScanTarget) return sock.sendMessage(msg.key.remoteJid, { text: getText('not_enough_cash') });

        // Deduct cost
        await updateDoc(doc(db, "users", sender), { wealth: increment(-config.costScanTarget) });
        await addToBank(config.costScanTarget);

        // Fetch targets (Citizens & Businessmen)
        const q = query(collection(db, "users"), where("role", "in", ["citizen", "businessman"]), limit(10));
        const querySnapshot = await getDocs(q);
        
        let output = getText('target_scan_header') + "\n";
        querySnapshot.forEach((doc) => {
            const t = doc.data();
            let maskedID = "";
            
            if (t.role === 'citizen') {
                // Citizen: 123 -> 12?
                maskedID = t.special_id.toString().substring(0, 2) + "?";
            } else if (t.role === 'businessman') {
                // Businessman logic
                if (t.employee) { // Has bodyguard
                    // 123456 -> 12????
                    maskedID = t.special_id.toString().substring(0, 2) + "????";
                } else {
                    // 123456 -> 123???
                    maskedID = t.special_id.toString().substring(0, 3) + "???";
                }
            }
            output += `\n@${t.id.split('@')[0]} | ${t.role} | 💰 ${t.wealth}\n🆔 ${maskedID}\n`;
        });
        await sock.sendMessage(msg.key.remoteJid, { text: output }, { quoted: msg });
    }

    // --- 4. ROBBERY LOGIC ---
    else if (text.includes('/rob')) {
        if (user.role !== 'thief') return;
        
        // Parse: @user/rob123456
        // This is tricky in WhatsApp. Usually we look for mentions.
        // Simplified approach: user must reply to a message or type number
        // Let's assume text format: /rob @user 123456
        
        const targetNumber = args[0]?.replace('@', '') + "@s.whatsapp.net";
        const guess = args[1];

        if (!guess || !targetNumber) return;

        // Deduct Rob Cost
        if (user.wealth < config.costRob) return sock.sendMessage(msg.key.remoteJid, { text: getText('not_enough_cash') });
        await updateDoc(doc(db, "users", sender), { wealth: increment(-config.costRob) });

        const targetUser = await getUser(targetNumber);
        
        // Logic
        const realID = targetUser.special_id.toString();
        let stolenPercent = 0;

        if (guess === realID) {
            stolenPercent = 0.10; // 10%
        } else if (Math.abs(parseInt(guess) - parseInt(realID)) < 50) {
             stolenPercent = 0.02; // Close
        } else {
             stolenPercent = 0.01; // Failed but tiny reward
        }

        const stolenAmount = Math.floor(targetUser.wealth * stolenPercent);
        
        // Transaction
        if (stolenAmount > 0) {
            await updateDoc(doc(db, "users", targetNumber), { wealth: increment(-stolenAmount), special_id: Math.floor(100000 + Math.random() * 900000) }); // Reset Victim ID
            await updateDoc(doc(db, "users", sender), { wealth: increment(stolenAmount) });
            await sock.sendMessage(msg.key.remoteJid, { text: `${getText('rob_success')} ${stolenAmount}` }, { quoted: msg });
        } else {
            await sock.sendMessage(msg.key.remoteJid, { text: getText('rob_failed_far') }, { quoted: msg });
        }
    }

    // --- 5. POLICE COMMANDS ---
    else if (cmd === '/scan') {
        if (user.role !== 'police') return;
        if (user.wealth < config.costPoliceScan) return sock.sendMessage(msg.key.remoteJid, { text: getText('not_enough_cash') });

        await updateDoc(doc(db, "users", sender), { wealth: increment(-config.costPoliceScan) });
        await addToBank(config.costPoliceScan);

        const q = query(collection(db, "users"), where("role", "==", "thief"), limit(10));
        const snaps = await getDocs(q);
        
        let output = getText('scan_result') + "\n";
        snaps.forEach((doc) => {
            const t = doc.data();
            // Thief: 123 -> 12?
            const maskedID = t.special_id.toString().substring(0, 2) + "?";
            const bounty = Math.floor(t.wealth * 0.03);
            output += `\n@${t.id.split('@')[0]} | Reward: ${bounty}\n🆔 ${maskedID}\n`;
        });
        await sock.sendMessage(msg.key.remoteJid, { text: output }, { quoted: msg });
    }

    else if (text.includes('/arrest')) {
        // Format: /arrest @user 123
        if (user.role !== 'police') return;
        const targetNumber = args[0]?.replace('@', '') + "@s.whatsapp.net";
        const guess = args[1];

        // Cost
        if (user.wealth < config.costArrest) return sock.sendMessage(msg.key.remoteJid, { text: getText('not_enough_cash') });
        await updateDoc(doc(db, "users", sender), { wealth: increment(-config.costArrest) });

        const thief = await getUser(targetNumber);
        if (thief.role !== 'thief') return;

        if (guess === thief.special_id.toString()) {
            // SUCCESS
            const totalCash = thief.wealth;
            const policeReward = Math.floor(totalCash * 0.80 * 0.03); // 3% of the 80% penalty
            const bankTake = Math.floor(totalCash * 0.80 * 0.97); // Rest to bank
            
            await updateDoc(doc(db, "users", targetNumber), { 
                wealth: Math.floor(totalCash * 0.20), // Left with 20%
                jail_release_time: Date.now() + config.thiefJailTime,
                special_id: Math.floor(100 + Math.random() * 900) // New ID
            });
            
            await updateDoc(doc(db, "users", sender), { 
                wealth: increment(policeReward),
                cases_solved: increment(1)
            });
            await addToBank(bankTake);
            
            await sock.sendMessage(msg.key.remoteJid, { text: `${getText('arrest_success')} ${policeReward}` }, { quoted: msg });
        } else {
            await sock.sendMessage(msg.key.remoteJid, { text: getText('arrest_failed') }, { quoted: msg });
        }
    }
}

module.exports = { processCommand };
