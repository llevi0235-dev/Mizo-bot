// ==========================================
// MIZO ROLEPLAY BOT - RENDER VERSION (FIXED)
// ==========================================

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  delay
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get, set, update } = require("firebase/database");
const express = require("express");

// ================== GLOBAL FLAGS ==================
let pairingRequested = false;

// ================== RENDER KEEPALIVE ==================
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Mizo RP Bot is Active!"));
app.listen(port, () => console.log(`Server listening on port ${port}`));

// ================== FIREBASE ==================
const firebaseConfig = {
  apiKey: "AIzaSyAtbA4OsuRr5qmVSwbIo-M03uCGJ-wbxCM",
  authDomain: "j-bo-a567a.firebaseapp.com",
  databaseURL: "https://j-bo-a567a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "j-bo-a567a",
  storageBucket: "j-bo-a567a.firebasestorage.app",
  messagingSenderId: "1029278826614",
  appId: "1:1029278826614:web:b608af7356752ff2e9df57"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// ================== UTILS ==================
function generateId(length) {
  let result = "";
  const chars = "0123456789";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ================== BOT START ==================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    browser: ["MizoRP", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  // ================== CONNECTION ==================
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("✅ BOT CONNECTED SUCCESSFULLY!");

      if (!sock.authState.creds.registered && !pairingRequested) {
        pairingRequested = true;

        const phoneNumber = "919233137736"; // YOUR NUMBER

        await delay(3000); // allow socket to stabilize

        try {
          const code = await sock.requestPairingCode(phoneNumber);
          console.log("\n============================================");
          console.log("🚨 PAIRING CODE GENERATED 🚨");
          console.log(`CODE: ${code}`);
          console.log("============================================\n");
        } catch (err) {
          console.error("❌ Pairing failed:", err);
        }
      }
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log("Connection closed, reconnecting...", shouldReconnect);

      if (shouldReconnect) {
        startBot();
      }
    }
  });

  // ================== MESSAGE HANDLER ==================
  sock.ev.on("messages.upsert", async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid;
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      if (!text.trim()) return;

      const senderId = from.split("@")[0];
      const lowerText = text.toLowerCase();

      const userRef = ref(db, "users/" + senderId);
      const snap = await get(userRef);
      let user = snap.val();

      if (!user) {
        user = {
          role: "citizen",
          cash: 10000,
          specialId: generateId(3),
          joinedAt: Date.now()
        };
        await set(userRef, user);
      }

      // ================== COMMANDS ==================
      if (lowerText === "/menu") {
        return sock.sendMessage(from, {
          text:
            "📜 *GAME MENU* 📜\n\n" +
            "1️⃣ /status - Stats\n" +
            "2️⃣ /crlps - Police\n" +
            "3️⃣ /crltf - Thief\n" +
            "4️⃣ /crlbs - Businessman\n" +
            "5️⃣ /ubank - Universal Bank"
        });
      }

      if (lowerText === "/status" || lowerText === "/stats") {
        let displayId = "N/A";

        if (user.role === "citizen")
          displayId = (user.specialId || "000").slice(0, 2) + "?";

        if (user.role === "businessman")
          displayId = (user.specialId || "000").slice(0, 3) + "???";

        if (user.role === "police") displayId = "No ID";

        return sock.sendMessage(from, {
          text:
            `📊 *STATUS*\n` +
            `👤 Role: ${user.role.toUpperCase()}\n` +
            `💰 Cash: ${user.cash}\n` +
            `🆔 ID: ${displayId}`
        });
      }

      if (lowerText === "/crlps")
        return sock.sendMessage(from, {
          text: await changeRole(senderId, user, "police")
        });

      if (lowerText === "/crltf")
        return sock.sendMessage(from, {
          text: await changeRole(senderId, user, "thief")
        });

      if (lowerText === "/crlbs")
        return sock.sendMessage(from, {
          text: await changeRole(senderId, user, "businessman")
        });
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });
}

// ================== GAME LOGIC ==================
async function changeRole(uid, currentUser, newRole) {
  const now = Date.now();

  if (
    currentUser.lastRoleChange &&
    now - currentUser.lastRoleChange < 172800000
  ) {
    return "❌ FAILED: You must wait 2 days to change roles.";
  }

  const updates = {
    role: newRole,
    lastRoleChange: now
  };

  if (newRole === "businessman") {
    updates.specialId = generateId(6);
    if (!currentUser.wasBusinessman) {
      updates.cash = (currentUser.cash || 0) + 500000;
      updates.wasBusinessman = true;
    }
  } else if (newRole === "citizen" || newRole === "thief") {
    updates.specialId = generateId(3);
  } else if (newRole === "police") {
    updates.specialId = null;
  }

  await update(ref(db, "users/" + uid), updates);
  return `✅ SUCCESS: Role changed to ${newRole.toUpperCase()}.`;
}

// ================== INCOME LOOP ==================
setInterval(async () => {
  const snap = await get(ref(db, "users"));
  if (!snap.exists()) return;

  const updates = {};
  const users = snap.val();

  for (const uid in users) {
    const user = users[uid];
    let income = 0;

    if (user.role === "citizen") income = 400;
    if (user.role === "police") income = 450;
    if (user.role === "businessman") income = 1000;

    if (income > 0) {
      updates[`users/${uid}/cash`] = (user.cash || 0) + income;
    }
  }

  if (Object.keys(updates).length > 0) {
    await update(ref(db), updates);
  }
}, 30 * 60 * 1000);

// ================== START ==================
startBot();