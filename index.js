// ==========================================
// MIZO ROLEPLAY BOT — FINAL STABLE VERSION
// ==========================================

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const express = require("express");
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get, set, update } = require("firebase/database");

// ================== GLOBAL STATE ==================
let sock;
let pairingRequested = false;

// ================== RENDER KEEPALIVE ==================
const app = express();
const port = process.env.PORT || 10000;

app.get("/", (_, res) => res.send("Mizo RP Bot is Active"));
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
  const chars = "0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// ================== START BOT ==================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    browser: ["MizoRP", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  // ========== PAIRING (ONLY ONCE, NO LOOP) ==========
  if (!state.creds.registered && !pairingRequested) {
    pairingRequested = true;
    const phoneNumber = "919233137736";

    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log("\n====================================");
        console.log("🚨 PAIRING CODE 🚨");
        console.log("CODE:", code);
        console.log("====================================\n");
      } catch (e) {
        console.error("❌ Pairing error:", e);
      }
    }, 5000);
  }

  // ========== CONNECTION STATUS ==========
  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("✅ WhatsApp connected");
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log("❌ Connection closed. Reason:", reason);

      if (reason === DisconnectReason.loggedOut) {
        console.log("❌ Logged out. Delete auth_info_baileys and restart.");
      }
      // ❗ NO RECURSION — Baileys handles reconnect
    }
  });

  // ========== MESSAGE HANDLER ==========
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg?.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid;
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      if (!text.trim()) return;

      const senderId = from.split("@")[0];
      const lower = text.toLowerCase();

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

      if (lower === "/menu") {
        return sock.sendMessage(from, {
          text:
            "📜 GAME MENU\n\n" +
            "/status\n" +
            "/crlps\n" +
            "/crltf\n" +
            "/crlbs"
        });
      }

      if (lower === "/status") {
        return sock.sendMessage(from, {
          text:
            `👤 Role: ${user.role}\n` +
            `💰 Cash: ${user.cash}\n` +
            `🆔 ID: ${user.specialId || "N/A"}`
        });
      }

      if (lower === "/crlps")
        return sock.sendMessage(from, {
          text: await changeRole(senderId, user, "police")
        });

      if (lower === "/crltf")
        return sock.sendMessage(from, {
          text: await changeRole(senderId, user, "thief")
        });

      if (lower === "/crlbs")
        return sock.sendMessage(from, {
          text: await changeRole(senderId, user, "businessman")
        });
    } catch (err) {
      console.error("Message error:", err);
    }
  });
}

// ================== ROLE LOGIC ==================
async function changeRole(uid, user, role) {
  const now = Date.now();
  if (user.lastRoleChange && now - user.lastRoleChange < 172800000) {
    return "❌ Wait 2 days before changing role.";
  }

  const updates = { role, lastRoleChange: now };

  if (role === "businessman") {
    updates.specialId = generateId(6);
    if (!user.wasBusinessman) {
      updates.cash = (user.cash || 0) + 500000;
      updates.wasBusinessman = true;
    }
  } else if (role === "police") {
    updates.specialId = null;
  } else {
    updates.specialId = generateId(3);
  }

  await update(ref(db, "users/" + uid), updates);
  return `✅ Role changed to ${role.toUpperCase()}`;
}

// ================== INCOME LOOP ==================
setInterval(async () => {
  const snap = await get(ref(db, "users"));
  if (!snap.exists()) return;

  const updates = {};
  for (const [uid, user] of Object.entries(snap.val())) {
    let income = 0;
    if (user.role === "citizen") income = 400;
    if (user.role === "police") income = 450;
    if (user.role === "businessman") income = 1000;
    if (income > 0)
      updates[`users/${uid}/cash`] = (user.cash || 0) + income;
  }

  if (Object.keys(updates).length) {
    await update(ref(db), updates);
  }
}, 30 * 60 * 1000);

// ================== START ==================
startBot();