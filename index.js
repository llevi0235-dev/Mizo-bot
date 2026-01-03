// ==========================================
// MIZO ROLEPLAY BOT — STABLE VERSION
// ==========================================

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  delay,
  Browsers
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const express = require("express");

// ================== KEEPALIVE ==================
const app = express();
const port = process.env.PORT || 10000;
app.get("/", (_, res) => res.send("Mizo RP Bot is Active"));
app.listen(port, () => console.log(`Server listening on port ${port}`));

// ================== FIREBASE ==================
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get, set, update } = require("firebase/database");

const firebaseConfig = {
  apiKey: "AIzaSyAtbA4OsuRr5qmVSwbIo-M03uCGJ-wbxCM",
  authDomain: "j-bo-a567a.firebaseapp.com",
  databaseURL: "https://j-bo-a567a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "j-bo-a567a",
  storageBucket: "j-bo-a567a.firebasestorage.app",
  messagingSenderId: "1029278826614",
  appId: "1:1029278826614:web:b608af7356752ff2e9df57"
};

const db = getDatabase(initializeApp(firebaseConfig));

// ================== UTILS ==================
function generateId(len) {
  return Array.from({ length: len }, () =>
    Math.floor(Math.random() * 10)
  ).join("");
}

// ================== BOT SETUP ==================
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  
  // Check if already authenticated
  if (state.creds.registered) {
    console.log("✅ Already authenticated with WhatsApp");
  }

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "warn" }), // Changed from silent to warn for better debugging
    printQRInTerminal: true, // Always show QR in Render logs
    browser: Browsers.ubuntu("Chrome"), // Use standard browser identifier
    version: [2, 2413, 1], // Stable WhatsApp version
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
    emitOwnEvents: true,
    defaultQueryTimeoutMs: 0,
    retryRequestDelayMs: 250,
    fireInitQueries: true,
    markOnlineOnConnect: false, // Start offline to avoid spam detection
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    patchMessageBeforeSending: (message) => {
      const requiresPatches = {};
      return requiresPatches;
    },
  });

  // Save credentials
  sock.ev.on("creds.update", saveCreds);

  // Connection updates
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log("\n====================================");
      console.log("📱 SCAN THIS QR CODE WITH YOUR PHONE");
      console.log("====================================\n");
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connected successfully");
      // Mark online after successful connection
      await sock.sendPresenceUpdate('available');
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log(`❌ Connection closed: ${statusCode}`);
      
      if (statusCode === DisconnectReason.loggedOut) {
        console.log("🚨 Logged out from WhatsApp. Delete auth_info_baileys folder and restart.");
        process.exit(1);
      } else if (statusCode === 405) {
        console.log("⚠️  WhatsApp rejected connection (405). Waiting before retry...");
        await delay(30000); // Wait 30 seconds before retry
      } else if (statusCode === 429) {
        console.log("⚠️  Rate limited. Waiting 60 seconds...");
        await delay(60000);
      }
      
      // Auto-reconnect with delay
      console.log("🔄 Reconnecting...");
      await delay(10000);
      connectToWhatsApp();
    }

    if (connection === "connecting") {
      console.log("🔄 Connecting to WhatsApp...");
    }
  });

  // Message handling
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    if (!text) return;

    const uid = from.split("@")[0];
    const userRef = ref(db, "users/" + uid);
    let user = (await get(userRef)).val();

    if (!user) {
      user = {
        role: "citizen",
        cash: 10000,
        specialId: generateId(3),
        joined: new Date().toISOString()
      };
      await set(userRef, user);
    }

    const lowerText = text.toLowerCase();
    
    if (lowerText === "/status") {
      await sock.sendMessage(from, {
        text: `👤 *MIZO RP PROFILE*\n\n` +
              `🏷️ Role: ${user.role}\n` +
              `💰 Cash: $${user.cash}\n` +
              `🆔 Special ID: ${user.specialId}\n\n` +
              `_Use /help for commands_`
      });
    }
    
    if (lowerText === "/help" || lowerText === "/commands") {
      await sock.sendMessage(from, {
        text: `📋 *MIZO RP COMMANDS*\n\n` +
              `/status - Check your profile\n` +
              `/work - Earn money\n` +
              `/crime - Risk for cash\n` +
              `/rob @user - Steal from others\n` +
              `/daily - Get daily reward\n\n` +
              `⚠️ More features coming soon!`
      });
    }
    
    if (lowerText === "/work") {
      const earnings = Math.floor(Math.random() * 500) + 100;
      user.cash += earnings;
      await update(userRef, { cash: user.cash });
      
      await sock.sendMessage(from, {
        text: `💼 You worked and earned: *$${earnings}*\n` +
              `💰 New balance: *$${user.cash}*`
      });
    }
  });

  // Handle pairing/code requests via message
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message) return;
    
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    
    // Only process pairing requests from bot owner
    if (text.startsWith("/pair") && from === "919233137736@s.whatsapp.net") {
      const phone = text.split(" ")[1];
      if (phone) {
        try {
          const code = await sock.requestPairingCode(phone.replace(/\D/g, ''));
          await sock.sendMessage(from, {
            text: `📱 Pairing code for ${phone}:\n\n*${code}*\n\nThis code expires in 30 seconds.`
          });
        } catch (error) {
          await sock.sendMessage(from, {
            text: `❌ Failed to get pairing code: ${error.message}`
          });
        }
      }
    }
  });

  return sock;
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n👋 Received SIGTERM, shutting down...");
  process.exit(0);
});

// Start the bot
(async () => {
  try {
    console.log("🚀 Starting Mizo Roleplay Bot...");
    await connectToWhatsApp();
  } catch (error) {
    console.error("🔥 Failed to start bot:", error);
    console.log("🔄 Restarting in 10 seconds...");
    setTimeout(() => {
      connectToWhatsApp();
    }, 10000);
  }
})();