{
  "name": "mizo-city-rpg",
  "version": "2.0.0",
  "description": "City RPG Bot for My Lord",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.6.0",
    "pino": "^8.0.0",
    "express": "^4.18.2",
    "firebase": "^10.7.1"
  }
}
module.exports = {
    // --- CONNECTIVITY ---
    // Your number (The Owner/Admin)
    adminNumber: "919233137736@s.whatsapp.net", 
    
    // The Bot's number (Used for identification)
    botNumber: "919233137736", 

    // --- FIREBASE KEYS (DO NOT TOUCH) ---
    firebaseConfig: {
        apiKey: "AIzaSyAtbA4OsuRr5qmVSwbIo-M03uCGJ-wbxCM",
        authDomain: "j-bo-a567a.firebaseapp.com",
        databaseURL: "https://j-bo-a567a-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "j-bo-a567a",
        storageBucket: "j-bo-a567a.firebasestorage.app",
        messagingSenderId: "1029278826614",
        appId: "1:1029278826614:web:b608af7356752ff2e9df57"
    },

    // --- GAME ECONOMY RULES ---
    
    // Starting Cash
    startingCash: 10000,
    businessmanSignupBonus: 500000,

    // Passive Income (Amount & Time in Minutes)
    citizenIncome: 400,
    citizenIncomeTime: 30, 
    
    thiefIncome: 50,
    thiefIncomeTime: 20, 
    
    policeIncome: 450,
    policeIncomeTime: 30, 
    
    businessmanIncome: 1000,
    businessmanIncomeTime: 30, 

    // Costs to Run Commands
    costScanTarget: 200,   // Thief scans citizens
    costScanPolice: 100,   // Thief scans police
    costRob: 100,          // Thief attempts robbery
    costPoliceScan: 200,   // Police scans thieves
    costArrest: 50,        // Police attempts arrest

    // Investment Math
    investSuccessRate: 0.40, // 40% Chance to win
    investFailRate: 0.60,    // 60% Chance to lose
    
    // Time Limits (in Milliseconds)
    // 30 mins = 30 * 60 * 1000
    robberyCooldown: 30 * 60 * 1000, 
    jailTime: 5 * 60 * 1000, // 5 Minutes
    roleChangeCooldown: 2 * 24 * 60 * 60 * 1000, // 2 Days
    investmentWaitTime: 30 * 60 * 1000 // 30 Minutes
};
const translations = {
    // --- GENERAL ---
    welcome: {
        en: "Welcome! You are now a Citizen. Cash: 10,000",
        mz: "Lo leng rawh! Citizen i ni ta. Pawisa: 10,000"
    },
    not_enough_cash: {
        en: "You don't have enough cash to perform this action!",
        mz: "He thil ti tur hian pawisa i nei tawk lo!"
    },
    cooldown_active: {
        en: "You must wait before doing this again.",
        mz: "I tih nawn hma in i nghah rih a ngai."
    },
    jail_active: {
        en: "You are in JAIL! You cannot do anything.",
        mz: "JAIL-ah i tang! Engmah i ti thei lo."
    },
    
    // --- ROLES ---
    role_changed: {
        en: "Role changed successfully to:",
        mz: "Nihna thlak a ni ta:"
    },
    role_limit_reached: {
        en: "You have changed roles too many times. Wait 2 days.",
        mz: "Nihna i thlak ngun lutuk. Ni 2 nghak rawh."
    },
    
    // --- THIEF MESSAGES ---
    scan_header: {
        en: "--- 📡 TARGET SCAN RESULT 📡 ---",
        mz: "--- 📡 MI ZAWNNA HLAWHTLING 📡 ---"
    },
    rob_success: {
        en: "✅ Robbery Successful! You stole:",
        mz: "✅ Rawk a hlawhtling! I ruk zat:"
    },
    rob_failed_close: {
        en: "⚠️ Wrong ID but close! You got 2% of the cash.",
        mz: "⚠️ ID diklo mahse a hnai! Pawisa 2% i hmu."
    },
    rob_failed_far: {
        en: "❌ Wrong ID! You got 1% of the cash.",
        mz: "❌ ID diklo! Pawisa 1% i hmu."
    },
    already_robbed: {
        en: "You already robbed this person! Wait 30 mins.",
        mz: "He mi hi i rawk tawh! Minute 30 nghak rawh."
    },

    // --- POLICE MESSAGES ---
    scan_police_header: {
        en: "--- 👮 THIEF SCAN RESULT 👮 ---",
        mz: "--- 👮 RUKRU ZAWNNA 👮 ---"
    },
    arrest_success: {
        en: "⚖️ ARREST SUCCESSFUL! Thief lost 80%. Reward:",
        mz: "⚖️ MAN A NI TA! Rukru in 80% a hloh. Lawmman:"
    },
    arrest_failed: {
        en: "💨 Wrong ID! The thief escaped.",
        mz: "💨 ID diklo! Rukru a tlanbo."
    },

    // --- BUSINESSMAN ---
    invest_start: {
        en: "📉 Investment started. Wait 30 mins for results.",
        mz: "📉 Sum dawnna tan a ni. Minute 30 nghak rawh."
    },
    invest_win: {
        en: "📈 Investment PROFIT! You earned:",
        mz: "📈 Sumdawnna a HLAWK! I hmuh zat:"
    },
    invest_loss: {
        en: "📉 Investment LOST! You lost:",
        mz: "📉 Sumdawnna a HLAWHCHHAM! I hloh zat:"
    },
    loan_sent: {
        en: "Loan request sent to Admin.",
        mz: "Loan dilna Admin hnenah thawn a ni."
    },
    hired: {
        en: "You have hired a Bodyguard!",
        mz: "Bodyguard i ruai ta!"
    },
    fired: {
        en: "You have fired your Bodyguard.",
        mz: "I Bodyguard i ban ta."
    },

    // --- ADMIN ---
    banned: {
        en: "🚫 You have been BANNED from the game.",
        mz: "🚫 Game atang hian BAN i ni."
    },
    admin_action: {
        en: "Admin used special power.",
        mz: "Admin in thil tihtheihna bik a hmang."
    }
};

// Function to format the text
module.exports = (key) => {
    const t = translations[key];
    if (!t) return `[Missing Text: ${key}]`;
    return `🇬🇧 ${t.en}\n---------------\n🇲🇿 ${t.mz}`;
};
const { initializeApp } = require("firebase/app");
const { 
    getFirestore, doc, getDoc, setDoc, updateDoc, increment 
} = require("firebase/firestore");
const config = require('./config');

// Initialize Firebase
const app = initializeApp(config.firebaseConfig);
const db = getFirestore(app);

// --- HELPER 1: GET USER (OR CREATE NEW) ---
async function getUser(phoneNumber) {
    const userRef = doc(db, "users", phoneNumber);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
        return snap.data();
    } else {
        // New Player -> Create as Citizen
        const newUser = {
            id: phoneNumber,
            role: 'citizen',
            wealth: config.startingCash,
            // 3 Digit Random ID for Citizen
            special_id: Math.floor(100 + Math.random() * 900), 
            last_income_time: Date.now(),
            role_change_count: 0,
            last_role_change: 0,
            cases_solved: 0,
            jail_release_time: 0,
            employee: null, // For Businessman (Bodyguard ID)
            employer: null  // For Police (Businessman ID)
        };
        await setDoc(userRef, newUser);
        return newUser;
    }
}

// --- HELPER 2: UNIVERSAL BANK ---
async function addToBank(amount) {
    if (amount <= 0) return;
    const bankRef = doc(db, "universal_bank", "main");
    // Use 'merge: true' to create the bank if it doesn't exist
    await setDoc(bankRef, { balance: increment(amount) }, { merge: true });
}

module.exports = { db, getUser, addToBank };
const { 
    doc, updateDoc, increment, query, collection, 
    orderBy, limit, getDocs, where 
} = require("firebase/firestore");
const { db } = require('./db');
const config = require('./config');
const getText = require('./language');

// --- 1. PASSIVE INCOME SYSTEM ---
async function checkIncome(user) {
    const now = Date.now();
    let income = 0;
    let interval = 0;

    // Determine Income Rate based on Role
    if (user.role === 'citizen') { 
        income = config.citizenIncome; 
        interval = config.citizenIncomeTime * 60 * 1000; 
    }
    else if (user.role === 'thief') { 
        income = config.thiefIncome; 
        interval = config.thiefIncomeTime * 60 * 1000; 
    }
    else if (user.role === 'police') { 
        income = config.policeIncome; 
        interval = config.policeIncomeTime * 60 * 1000; 
    }
    else if (user.role === 'businessman') { 
        income = config.businessmanIncome; 
        interval = config.businessmanIncomeTime * 60 * 1000; 
    }

    // Calculate how many cycles passed
    const timePassed = now - user.last_income_time;
    
    if (timePassed >= interval) {
        const cycles = Math.floor(timePassed / interval);
        const totalIncome = income * cycles;
        
        // Update Database (Money + Reset Timer)
        const userRef = doc(db, "users", user.id);
        await updateDoc(userRef, {
            wealth: increment(totalIncome),
            last_income_time: now 
        });
        return totalIncome; // Return amount for logging if needed
    }
    return 0;
}

// --- 2. ROLE CHANGING ---
async function changeRole(user, newRole, sock, msg) {
    // Admin Override (Admins don't wait)
    const isAdmin = user.id.includes(config.botNumber);

    if (!isAdmin) {
        // Check Limit (Max 2 changes)
        if (user.role_change_count >= config.maxRoleChanges) {
            // Check Cooldown (2 Days)
            const timeSinceLastChange = Date.now() - user.last_role_change;
            if (timeSinceLastChange < config.roleChangeCooldown) {
                return sock.sendMessage(msg.key.remoteJid, { text: getText('role_limit_reached') }, { quoted: msg });
            } else {
                // Reset count after 2 days
                await updateDoc(doc(db, "users", user.id), { role_change_count: 0 });
            }
        }
    }

    // Generate ID based on Role
    let newId = 0;
    let bonus = 0;

    if (newRole === 'citizen') newId = Math.floor(100 + Math.random() * 900); // 3 Digits
    if (newRole === 'thief') newId = Math.floor(100 + Math.random() * 900); // 3 Digits
    if (newRole === 'businessman') {
        newId = Math.floor(100000 + Math.random() * 900000); // 6 Digits
        // First time bonus logic could go here, but keeping it simple for now
    }
    // Police have "No ID" (0)

    // Update DB
    await updateDoc(doc(db, "users", user.id), {
        role: newRole,
        special_id: newId,
        role_change_count: increment(1),
        last_role_change: Date.now()
    });

    await sock.sendMessage(msg.key.remoteJid, { text: `${getText('role_changed')} ${newRole.toUpperCase()}` }, { quoted: msg });
}

// --- 3. STATUS DISPLAY ---
async function showStatus(user, sock, msg) {
    let output = `👤 *User:* @${user.id.split('@')[0]}\n🎭 *Role:* ${user.role.toUpperCase()}\n💰 *Wealth:* ${user.wealth}`;
    
    if (user.role === 'police') {
        output += `\n🎖 *Cases Solved:* ${user.cases_solved}`;
    }
    // Note: ID is NOT displayed in /status as per rules
    
    await sock.sendMessage(msg.key.remoteJid, { text: output, mentions: [user.id] }, { quoted: msg });
}

// --- 4. LEADERBOARDS ---
async function showLeaderboard(type, sock, msg) {
    let q;
    let title = "";

    if (type === 'police') {
        title = "👮 TOP 50 POLICE (Cases Solved)";
        q = query(collection(db, "users"), where("role", "==", "police"), orderBy("cases_solved", "desc"), limit(50));
    } else {
        title = "💰 TOP 50 RICHEST (Total Wealth)";
        q = query(collection(db, "users"), orderBy("wealth", "desc"), limit(50));
    }

    const querySnapshot = await getDocs(q);
    let text = `*${title}*\n`;
    let rank = 1;

    querySnapshot.forEach((doc) => {
        const u = doc.data();
        // Even thieves are displayed as citizens in Richest list (Rules)
        let displayRole = u.role;
        if (type === 'wealth' && u.role === 'thief') displayRole = 'citizen';

        if (type === 'police') {
            text += `\n${rank}. @${u.id.split('@')[0]} - Cases: ${u.cases_solved}`;
        } else {
            text += `\n${rank}. @${u.id.split('@')[0]} (${displayRole}) - ${u.wealth}`;
        }
        rank++;
    });

    await sock.sendMessage(msg.key.remoteJid, { text: text }, { quoted: msg });
}

module.exports = { checkIncome, changeRole, showStatus, showLeaderboard };
const { 
    doc, updateDoc, increment, getDocs, query, 
    collection, where, limit, getDoc, setDoc 
} = require("firebase/firestore");
const { db, addToBank, getUser } = require('./db');
const config = require('./config');
const getText = require('./language');

// --- 1. THIEF: SCAN TARGETS ---
async function scanTargets(user, sock, msg) {
    // 1. Check Cost
    if (user.wealth < config.costScanTarget) {
        return sock.sendMessage(msg.key.remoteJid, { text: getText('not_enough_cash') }, { quoted: msg });
    }

    // 2. Deduct Cash
    await updateDoc(doc(db, "users", user.id), { wealth: increment(-config.costScanTarget) });
    await addToBank(config.costScanTarget);

    // 3. Find Citizens & Businessmen
    // Firestore "IN" query is limited to 10, so we just query Citizens first then Businessmen
    // For simplicity in this bot, we will just query a mix or limit to 10 total
    const q = query(collection(db, "users"), where("role", "in", ["citizen", "businessman"]), limit(15));
    const snaps = await getDocs(q);

    let output = getText('scan_header') + "\n";
    
    snaps.forEach((d) => {
        const t = d.data();
        let maskedID = "???";

        if (t.role === 'citizen') {
            // Citizen: 123 -> 12?
            maskedID = t.special_id.toString().substring(0, 2) + "?";
        } 
        else if (t.role === 'businessman') {
            if (t.employee) {
                // Has Bodyguard: 123456 -> 12????
                maskedID = t.special_id.toString().substring(0, 2) + "????";
            } else {
                // No Bodyguard: 123456 -> 123???
                maskedID = t.special_id.toString().substring(0, 3) + "???";
            }
        }
        
        output += `\n👤 @${t.id.split('@')[0]} (${t.role.toUpperCase()})\n💰 ${t.wealth}\n🆔 ${maskedID}\n`;
    });

    await sock.sendMessage(msg.key.remoteJid, { text: output }, { quoted: msg });
}

// --- 2. THIEF: ROBBERY ---
async function robUser(thief, targetPhone, guess, sock, msg) {
    // Check Jail
    if (thief.jail_release_time > Date.now()) {
        return sock.sendMessage(msg.key.remoteJid, { text: getText('jail_active') }, { quoted: msg });
    }

    // Check Cost
    if (thief.wealth < config.costRob) {
        return sock.sendMessage(msg.key.remoteJid, { text: getText('not_enough_cash') }, { quoted: msg });
    }

    // Deduct Cost
    await updateDoc(doc(db, "users", thief.id), { wealth: increment(-config.costRob) });

    // Get Target
    const target = await getUser(targetPhone);
    const realID = target.special_id.toString();
    const numericGuess = parseInt(guess);
    const numericReal = parseInt(realID);

    // Math Logic
    let stolenPercent = 0;
    let messageKey = '';
    let success = false;

    if (guess === realID) {
        // EXACT MATCH (10%)
        stolenPercent = 0.10;
        messageKey = 'rob_success';
        success = true;
    } 
    else if (Math.abs(numericGuess - numericReal) <= 50) {
        // CLOSE MATCH (2%) - "Close to it" logic
        stolenPercent = 0.02;
        messageKey = 'rob_failed_close';
    } 
    else {
        // BAD MATCH (1%)
        stolenPercent = 0.01;
        messageKey = 'rob_failed_far';
    }

    const stolenAmount = Math.floor(target.wealth * stolenPercent);

    if (stolenAmount > 0) {
        // Transfer Money
        await updateDoc(doc(db, "users", targetPhone), { wealth: increment(-stolenAmount) });
        await updateDoc(doc(db, "users", thief.id), { wealth: increment(stolenAmount) });

        // If Exact Match -> Target gets NEW ID
        if (success) {
            let newId = Math.floor(100 + Math.random() * 900); // Default Citizen
            if (target.role === 'businessman') newId = Math.floor(100000 + Math.random() * 900000);
            await updateDoc(doc(db, "users", targetPhone), { special_id: newId });
        }

        await sock.sendMessage(msg.key.remoteJid, { text: `${getText(messageKey)} ${stolenAmount}` }, { quoted: msg });
    } else {
        await sock.sendMessage(msg.key.remoteJid, { text: getText(messageKey) }, { quoted: msg });
    }
}

// --- 3. POLICE: SCAN THIEVES ---
async function scanThieves(police, sock, msg) {
    if (police.wealth < config.costPoliceScan) {
        return sock.sendMessage(msg.key.remoteJid, { text: getText('not_enough_cash') }, { quoted: msg });
    }

    await updateDoc(doc(db, "users", police.id), { wealth: increment(-config.costPoliceScan) });
    await addToBank(config.costPoliceScan);

    const q = query(collection(db, "users"), where("role", "==", "thief"), limit(15));
    const snaps = await getDocs(q);

    let output = getText('scan_police_header') + "\n";
    snaps.forEach((d) => {
        const t = d.data();
        // Thief ID: 123 -> 12?
        const maskedID = t.special_id.toString().substring(0, 2) + "?";
        const bounty = Math.floor(t.wealth * 0.03); // 3% of Total Cash
        output += `\n🦹 @${t.id.split('@')[0]}\n💰 Reward: ${bounty}\n🆔 ${maskedID}\n`;
    });

    await sock.sendMessage(msg.key.remoteJid, { text: output }, { quoted: msg });
}

// --- 4. POLICE: ARREST ---
async function arrestThief(police, targetPhone, guess, sock, msg) {
    if (police.wealth < config.costArrest) {
        return sock.sendMessage(msg.key.remoteJid, { text: getText('not_enough_cash') }, { quoted: msg });
    }
    
    await updateDoc(doc(db, "users", police.id), { wealth: increment(-config.costArrest) });

    const thief = await getUser(targetPhone);
    
    if (thief.role !== 'thief') return; // Can't arrest innocent

    if (guess === thief.special_id.toString()) {
        // SUCCESS
        const penalty = Math.floor(thief.wealth * 0.80); // Thief loses 80%
        const policeReward = Math.floor(penalty * 0.03); // Police gets 3% of penalty
        const bankTake = penalty - policeReward; // Rest to bank

        // Update Thief (Jail + New ID + Wealth Cut)
        const newThiefId = Math.floor(100 + Math.random() * 900);
        await updateDoc(doc(db, "users", targetPhone), {
            wealth: increment(-penalty),
            jail_release_time: Date.now() + config.jailTime,
            special_id: newThiefId
        });

        // Update Police
        await updateDoc(doc(db, "users", police.id), {
            wealth: increment(policeReward),
            cases_solved: increment(1)
        });

        await addToBank(bankTake);

        await sock.sendMessage(msg.key.remoteJid, { text: `${getText('arrest_success')} ${policeReward}` }, { quoted: msg });
    } else {
        await sock.sendMessage(msg.key.remoteJid, { text: getText('arrest_failed') }, { quoted: msg });
    }
}

module.exports = { scanTargets, robUser, scanThieves, arrestThief };
const { 
    doc, updateDoc, increment, addDoc, collection, 
    query, where, getDocs, orderBy, getDoc, setDoc 
} = require("firebase/firestore");
const { db, addToBank, getUser } = require('./db');
const config = require('./config');
const getText = require('./language');

// --- 1. INVESTMENT SYSTEM ---

async function startInvest(user, amount, sock, msg) {
    if (user.role !== 'businessman') return; // Only Businessmen
    
    // Check Cash
    if (user.wealth < amount) {
        return sock.sendMessage(msg.key.remoteJid, { text: getText('not_enough_cash') }, { quoted: msg });
    }

    // Deduct Cash
    await updateDoc(doc(db, "users", user.id), { wealth: increment(-amount) });

    // Create Investment Record
    await addDoc(collection(db, "investments"), {
        userId: user.id,
        amount: parseInt(amount),
        startTime: Date.now(),
        status: 'active',
        result: null
    });

    await sock.sendMessage(msg.key.remoteJid, { text: getText('invest_start') }, { quoted: msg });
}

async function checkInvestmentStatus(user, sock, msg) {
    // 1. Find ACTIVE investments
    const q = query(collection(db, "investments"), where("userId", "==", user.id), where("status", "==", "active"));
    const snaps = await getDocs(q);

    let output = "📊 *ACTIVE INVESTMENTS* 📊\n";
    let processedAny = false;

    for (const d of snaps.docs) {
        const inv = d.data();
        const timePassed = Date.now() - inv.startTime;
        const timeLeft = config.investmentWaitTime - timePassed;

        if (timeLeft <= 0) {
            // --- RESOLVE INVESTMENT (Time is up) ---
            processedAny = true;
            const isWin = Math.random() < config.investSuccessRate; // 40% Win rate
            
            let finalAmount = 0;
            let profit = 0;
            let textKey = '';

            if (isWin) {
                // Win: 1x to 5x
                const multiplier = (Math.random() * 4) + 1; // 1.0 to 5.0
                finalAmount = Math.floor(inv.amount * multiplier);
                profit = finalAmount - inv.amount;
                textKey = 'invest_win';

                // ** Loan Repayment Logic **
                if (user.loan_repayments_remaining > 0) {
                    const deduction = Math.floor(profit * 0.09); // 9% tax
                    finalAmount -= deduction;
                    await addToBank(deduction);
                    await updateDoc(doc(db, "users", user.id), { loan_repayments_remaining: increment(-1) });
                }
            } else {
                // Lose: Lose 1% to 100%
                const lossPercent = Math.random(); // 0.0 to 1.0
                const lossAmount = Math.floor(inv.amount * lossPercent);
                finalAmount = inv.amount - lossAmount; // You get back the remainder
                await addToBank(lossAmount); // Lost money goes to Bank
                textKey = 'invest_loss';
            }

            // Update User Wallet
            await updateDoc(doc(db, "users", user.id), { wealth: increment(finalAmount) });
            
            // Update Investment Record
            await updateDoc(doc(db, "investments", d.id), {
                status: 'completed',
                result: isWin ? 'win' : 'loss',
                finalAmount: finalAmount,
                profit: isWin ? profit : (inv.amount - finalAmount) * -1
            });

            // Notify
            const amountStr = isWin ? profit : (inv.amount - finalAmount);
            await sock.sendMessage(msg.key.remoteJid, { text: `${getText(textKey)} ${Math.abs(amountStr)}` }, { quoted: msg });

        } else {
            // Still Waiting
            const minutesLeft = Math.ceil(timeLeft / 60000);
            output += `\n🕒 Invested: ${inv.amount} | Wait: ${minutesLeft} mins`;
        }
    }

    if (!processedAny && snaps.empty) output += "\n(No active investments)";
    if (!processedAny) await sock.sendMessage(msg.key.remoteJid, { text: output }, { quoted: msg });
}

// --- 2. LOAN SYSTEM ---

async function requestLoan(user, amount, sock, msg) {
    if (user.role !== 'businessman') return;

    // Send Request to ADMIN (My Lord)
    const adminJid = config.adminNumber; 
    
    const requestMsg = `📢 *LOAN REQUEST* 📢\nUser: @${user.id.split('@')[0]}\nWealth: ${user.wealth}\nRequest: ${amount}\n\nTo Approve:\n/approve @${user.id.split('@')[0]} ${amount}`;
    
    // Notify Admin
    await sock.sendMessage(adminJid, { text: requestMsg, mentions: [user.id] });
    
    // Notify User
    await sock.sendMessage(msg.key.remoteJid, { text: getText('loan_sent') }, { quoted: msg });
}

async function approveLoan(adminUser, targetPhone, amount, sock, msg) {
    // Verify Admin
    if (!adminUser.id.includes(config.botNumber)) return;

    const loanAmount = parseInt(amount);
    
    // Transfer from Bank
    await addToBank(-loanAmount); // Bank loses money
    
    // Give to User & Set Repayment Counter
    await updateDoc(doc(db, "users", targetPhone), { 
        wealth: increment(loanAmount),
        loan_repayments_remaining: increment(10) // 9% tax on next 10 wins
    });

    await sock.sendMessage(msg.key.remoteJid, { text: "✅ Loan Approved!" }, { quoted: msg });
    await sock.sendMessage(targetPhone, { text: `✅ Your Loan of ${loanAmount} has been approved!` });
}

// --- 3. BODYGUARD SYSTEM ---

async function hireBodyguard(businessman, policePhone, sock, msg) {
    if (businessman.role !== 'businessman') return;

    const police = await getUser(policePhone);
    if (police.role !== 'police') return sock.sendMessage(msg.key.remoteJid, { text: "User is not Police!" }, { quoted: msg });
    if (police.employer) return sock.sendMessage(msg.key.remoteJid, { text: "Police already hired!" }, { quoted: msg });

    // Link them
    await updateDoc(doc(db, "users", businessman.id), { employee: policePhone });
    await updateDoc(doc(db, "users", policePhone), { employer: businessman.id });

    await sock.sendMessage(msg.key.remoteJid, { text: getText('hired') }, { quoted: msg });
}

async function fireBodyguard(businessman, sock, msg) {
    if (!businessman.employee) return;
    
    const policePhone = businessman.employee;
    
    // Unlink
    await updateDoc(doc(db, "users", businessman.id), { employee: null });
    await updateDoc(doc(db, "users", policePhone), { employer: null });

    await sock.sendMessage(msg.key.remoteJid, { text: getText('fired') }, { quoted: msg });
}

module.exports = { startInvest, checkInvestmentStatus, requestLoan, approveLoan, hireBodyguard, fireBodyguard };
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
const { 
    getFirestore, doc, getDoc, setDoc, deleteDoc, updateDoc 
} = require("firebase/firestore");

// --- IMPORTS ---
const config = require('./config');
const { db, getUser } = require('./db');
const getText = require('./language');

// Game Modules
const RoleEngine = require('./roles');
const ActionEngine = require('./actions');
const BusinessEngine = require('./business');

// --- SERVER (Keep Alive) ---
const app = express();
const port = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("City RPG Bot is ALIVE."));
app.listen(port, () => console.log(`Server on port ${port}`));

// --- FIRESTORE AUTH ADAPTER (Persistence) ---
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

// --- MAIN LOGIC ---
async function startBot() {
    const { state, saveCreds } = await useFirestoreAuthState("auth_baileys");
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

    // PAIRING CODE
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(config.botNumber);
                console.log(`\n\n[ PAIRING CODE ] : ${code.match(/.{1,4}/g)?.join("-")}\n\n`);
            } catch (e) { console.log("Pairing Error:", e); }
        }, 4000);
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("Connected successfully, My Lord.");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // --- MESSAGE HANDLER ---
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const msgType = Object.keys(m.message)[0];
        const text = msgType === "conversation" ? m.message.conversation : 
                     msgType === "extendedTextMessage" ? m.message.extendedTextMessage.text : "";
        
        if (!text) return;

        const sender = m.key.remoteJid;
        const isAdmin = sender.includes(config.adminNumber.split('@')[0]); // Check against config admin

        // 1. Get/Create User & Check Income
        const user = await getUser(sender);
        await RoleEngine.checkIncome(user);

        // 2. Check Ban
        if (user.banned && !isAdmin) return sock.sendMessage(sender, { text: getText('banned') });

        // 3. Parse Command
        const args = text.trim().split(/ +/);
        const cmd = args[0].toLowerCase();
        
        // Helper to extract mentioned JID
        const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                             (args[1] ? args[1].replace('@', '') + "@s.whatsapp.net" : null);

        // --- COMMAND ROUTING ---

        // General
        if (cmd === '/menu') {
            const menu = `📜 *CITY RPG COMMANDS* 📜\n
👤 *General:* /status, /ubank, /toppolice, /richestman, /del
🎭 *Roles:* /crlps (Police), /crltf (Thief), /crlbs (Businessman)
\n👮 *Police:* /scan, /arrest @user [id], /leave
🦹 *Thief:* /scantarget, /scanps, /rob @user [id], /jailtm
💼 *Business:* /invest [amount], /investst, /loan [amount], /hire @user, /fire
\n👑 *Dev:* My Lord (919233137736)`;
            await sock.sendMessage(sender, { text: menu }, { quoted: m });
        }
        else if (cmd === '/status') await RoleEngine.showStatus(user, sock, m);
        else if (cmd.includes('/status') && mentionedJid) { // @user/status
             const target = await getUser(mentionedJid);
             await RoleEngine.showStatus(target, sock, m);
        }
        else if (cmd === '/ubank') await sock.sendMessage(sender, { text: `🏛 Bank: ${(await getDoc(doc(db, "universal_bank", "main"))).data()?.balance || 0}` });
        else if (cmd === '/toppolice') await RoleEngine.showLeaderboard('police', sock, m);
        else if (cmd === '/richestman') await RoleEngine.showLeaderboard('wealth', sock, m);

        // Role Changes
        else if (['/crlps', '/crltf', '/crlbs'].includes(cmd)) {
            const map = {'/crlps':'police', '/crltf':'thief', '/crlbs':'businessman'};
            await RoleEngine.changeRole(user, map[cmd], sock, m);
        }

        // Thief Actions
        else if (cmd === '/scantarget') await ActionEngine.scanTargets(user, sock, m);
        else if (cmd === '/scanps') await ActionEngine.scanThieves(user, sock, m); 
        else if (cmd === '/rob' || text.includes('/rob')) {
            const guess = text.match(/\d+$/)?.[0]; // Extract numbers at end
            if (mentionedJid && guess) await ActionEngine.robUser(user, mentionedJid, guess, sock, m);
        }
        else if (cmd === '/jailtm') {
             const left = user.jail_release_time - Date.now();
             const msg = left > 0 ? `⏳ Jail Time: ${Math.ceil(left/60000)} mins` : "✅ You are free.";
             await sock.sendMessage(sender, { text: msg }, { quoted: m });
        }

        // Police Actions
        else if (cmd === '/scan') await ActionEngine.scanThieves(user, sock, m);
        else if (cmd === '/arrest' || text.includes('/arrest')) {
            const guess = text.match(/\d+$/)?.[0];
            if (mentionedJid && guess) await ActionEngine.arrestThief(user, mentionedJid, guess, sock, m);
        }
        else if (cmd === '/leave') {
             // Resign from Bodyguard
             if(user.employer) {
                 await updateDoc(doc(db, "users", user.employer), { employee: null });
                 await updateDoc(doc(db, "users", sender), { employer: null });
                 await sock.sendMessage(sender, {text: "Resigned from Bodyguard duty."});
             }
        }

        // Business Actions
        else if (cmd.startsWith('/invest') && !isNaN(args[0].replace('/invest',''))) {
            const amount = parseInt(args[0].replace('/invest','')); // Handle /invest1000 format
            await BusinessEngine.startInvest(user, amount, sock, m);
        }
        else if (cmd === '/invest' && args[1]) await BusinessEngine.startInvest(user, args[1], sock, m);
        else if (cmd === '/investst') await BusinessEngine.checkInvestmentStatus(user, sock, m);
        else if (cmd.startsWith('/loan')) {
             const amount = parseInt(text.match(/\d+/)?.[0]);
             if(amount) await BusinessEngine.requestLoan(user, amount, sock, m);
        }
        else if (cmd === '/hire' && mentionedJid) await BusinessEngine.hireBodyguard(user, mentionedJid, sock, m);
        else if (cmd === '/fire') await BusinessEngine.fireBodyguard(user, sock, m);

        // --- ADMIN COMMANDS ---
        if (isAdmin) {
            if (cmd === '/approve' && mentionedJid && args[2]) {
                await BusinessEngine.approveLoan(user, mentionedJid, args[2], sock, m);
            }
            else if (text.includes('/band') && mentionedJid) {
                await updateDoc(doc(db, "users", mentionedJid), { banned: true });
                await sock.sendMessage(sender, { text: "🚫 User Banned." });
            }
            else if (text.includes('/edit') && mentionedJid) {
                // Quick Edit: /edit @user wealth 500000
                if(args[2] === 'wealth' && args[3]) {
                    await updateDoc(doc(db, "users", mentionedJid), { wealth: parseInt(args[3]) });
                    await sock.sendMessage(sender, { text: "✅ Wealth Updated." });
                }
            }
            else if (text.includes('/id') && mentionedJid) {
                const target = await getUser(mentionedJid);
                await sock.sendMessage(sender, { text: `🆔 Real ID: ${target.special_id}` });
            }
        }
    });
}

startBot();
