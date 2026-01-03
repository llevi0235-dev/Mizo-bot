// ==========================================
// MIZO ROLEPLAY BOT - PHASE 1 + PAIRING
// ==========================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get, set, update } = require("firebase/database");

// --- 1. FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyAtbA4OsuRr5qmVSwbIo-M03uCGJ-wbxCM",
  authDomain: "j-bo-a567a.firebaseapp.com",
  databaseURL: "https://j-bo-a567a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "j-bo-a567a",
  storageBucket: "j-bo-a567a.firebasestorage.app",
  messagingSenderId: "1029278826614",
  appId: "1:1029278826614:web:b608af7356752ff2e9df57"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 2. GAME UTILS ---
function generateId(length) {
  let result = '';
  const chars = '0123456789';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const question = (text) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(text, (answer) => { rl.close(); resolve(answer); }));
};

// --- 3. WHATSAPP CONNECTION LOGIC ---
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false, // We use Pairing Code, not QR
    auth: state,
    browser: ["MizoRP", "Chrome", "1.0.0"],
  });

  // --- PAIRING CODE GENERATION ---
  if (!sock.authState.creds.registered) {
    console.log("\n============================================");
    const phoneNumber = await question("Enter your Bot Phone Number (e.g., 919876543210): ");
    const code = await sock.requestPairingCode(phoneNumber);
    console.log(`\nYOUR PAIRING CODE: ${code}`);
    console.log("============================================\n");
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("Connection closed due to ", lastDisconnect.error, ", reconnecting ", shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === "open") {
      console.log("✅ BOT CONNECTED SUCCESSFULLY!");
    }
  });

  // --- 4. MESSAGE HANDLER ---
  sock.ev.on("messages.upsert", async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid;
      // Get text content (handle different message types)
      const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
      if (!text) return; // Ignore non-text messages
      
      const senderId = from.split('@')[0]; // The phone number
      const lowerText = text.toLowerCase();

      // --- GAME DATABASE CHECK ---
      const userRef = ref(db, 'users/' + senderId);
      const snap = await get(userRef);
      let user = snap.val();

      // AUTO-REGISTER NEW USERS AS CITIZENS
      if (!user) {
        user = {
          role: 'citizen',
          cash: 10000,
          specialId: generateId(3),
          joinedAt: Date.now()
        };
        await set(userRef, user);
        // Optional: Welcome message
        // await sock.sendMessage(from, { text: "Welcome! You are now a Citizen. / Citizen i ni ta." });
      }

      // --- COMMANDS ---

      // --- /menu ---
      if (lowerText === '/menu') {
        const menuMsg = `
📜 *GAME MENU* 📜

1️⃣ */status* - Show your stats (Role, Money, ID)
   - I chanchin, pawisa leh ID enna.

2️⃣ */crlps*
   - Join the Police Force
   - Police ah inthlakna.

3️⃣ */crltf*
   - Become a Thief
   - Rukru (Thief) ah inthlakna.

4️⃣ */crlbs*
   - Become a Businessman
   - Sumdawng (Businessman) ah inthlakna.

5️⃣ */ubank*
   - Check Universal Bank Balance.
   - Bank pui ber sum enna.

-------------------------
_Type the command to use it._
_Command hmang turin a hming chhu rawh._
        `;
        await sock.sendMessage(from, { text: menuMsg });
        return;
      }

      // --- /status ---
      if (lowerText === '/status' || lowerText === '/stats') {
         let displayId = "N/A";
         if (user.role === 'citizen') displayId = user.specialId.toString().substring(0, 2) + "?";
         if (user.role === 'businessman') displayId = user.specialId.toString().substring(0, 3) + "???"; 
         if (user.role === 'police') displayId = "No ID / ID a awmlo";
         
         const statusMsg = `
📊 *STATUS / DINHMUN*
👤 *Role:* ${user.role.toUpperCase()}
💰 *Cash:* ${user.cash}
🆔 *ID:* ${displayId}
         `;
         await sock.sendMessage(from, { text: statusMsg });
         return;
      }

      // --- /crlps (Police) ---
      if (lowerText === '/crlps') {
         const res = await changeRole(senderId, user, 'police');
         await sock.sendMessage(from, { text: res });
         return;
      }

      // --- /crltf (Thief) ---
      if (lowerText === '/crltf') {
         const res = await changeRole(senderId, user, 'thief');
         await sock.sendMessage(from, { text: res });
         return;
      }

      // --- /crlbs (Businessman) ---
      if (lowerText === '/crlbs') {
         const res = await changeRole(senderId, user, 'businessman');
         await sock.sendMessage(from, { text: res });
         return;
      }

    } catch (err) {
      console.error("Error processing message:", err);
    }
  });
}

// --- 5. GAME FUNCTIONS ---

async function changeRole(uid, currentUser, newRole) {
  const now = Date.now();
  // Check Cooldown (2 Days)
  if (currentUser.lastRoleChange && (now - currentUser.lastRoleChange < 172800000)) {
    return `❌ *FAILED / THEILOH*
    
You must wait 2 days to change roles.
Role thlak turin ni 2 i nghah a ngai.`;
  }

  const updates = {
    role: newRole,
    lastRoleChange: now
  };

  if (newRole === 'businessman') {
    updates.specialId = generateId(6);
    if (!currentUser.wasBusinessman) {
      updates.cash = (currentUser.cash || 0) + 500000;
      updates.wasBusinessman = true;
    }
  } else if (newRole === 'citizen' || newRole === 'thief') {
    updates.specialId = generateId(3);
  } else if (newRole === 'police') {
    updates.specialId = null; 
  }

  await update(ref(db, 'users/' + uid), updates);
  
  return `✅ *SUCCESS / HLOWHTLING*
  
Role changed to: *${newRole.toUpperCase()}*
Nihna thlak a ni: *${newRole.toUpperCase()}*`;
}

// --- 6. INCOME LOOPS ---
setInterval(async () => {
  // 30 min income
  const usersRef = ref(db, 'users');
  const snap = await get(usersRef);
  if (!snap.exists()) return;

  const updates = {};
  Object.keys(snap.val()).forEach(uid => {
    const user = snap.val()[uid];
    let income = 0;
    if (user.role === 'citizen') income = 400;
    if (user.role === 'police') income = 450;
    if (user.role === 'businessman') income = 1000;
    
    if (income > 0) updates[`users/${uid}/cash`] = (user.cash || 0) + income;
  });
  if (Object.keys(updates).length > 0) await update(ref(db), updates);
}, 30 * 60 * 1000);

// START EVERYTHING
startBot();
