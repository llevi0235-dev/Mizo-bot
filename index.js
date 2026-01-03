// ==========================================
// MIZO ROLEPLAY BOT — QR CODE FIXED VERSION
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

// ================== QR CODE GENERATOR ==================
function generateQRCode(qr) {
  console.log("\n" + "=".repeat(60));
  console.log("📱 WHATSAPP QR CODE FOR PAIRING");
  console.log("=".repeat(60));
  console.log("\nINSTRUCTIONS:");
  console.log("1. Open WhatsApp on your phone");
  console.log("2. Go to Settings → Linked Devices → Link a Device");
  console.log("3. Point your camera at the QR code below");
  console.log("\nQR CODE URL:");
  console.log("https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(qr));
  console.log("\nOR scan this simplified code:");
  
  // Create a simple text-based QR for terminals
  const smallQR = qr.replace(/[^0-9]/g, '').substring(0, 20);
  console.log("\nScan code from: " + smallQR);
  console.log("\n" + "=".repeat(60));
}

// ================== BOT CONNECTION ==================
async function connectToWhatsApp() {
  console.log("🔄 Initializing WhatsApp connection...");
  
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  
  // Check if already logged in
  if (state.creds.registered) {
    console.log("✅ Already authenticated with WhatsApp");
    console.log("📱 Connected as: " + (state.creds.me?.id || "Unknown"));
  } else {
    console.log("⚠️ Not authenticated. Waiting for QR code...");
  }

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }), // No logs to avoid clutter
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    version: [2, 2413, 1],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 20000,
    emitOwnEvents: true,
    defaultQueryTimeoutMs: 0,
    maxRetries: 3,
    retryDelayMs: 1000,
    fireInitQueries: true,
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  // Save credentials
  sock.ev.on("creds.update", saveCreds);

  // Connection updates handler
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    // Handle QR code - SIMPLIFIED VERSION
    if (qr) {
      console.log("\n" + "=".repeat(60));
      console.log("📱 WHATSAPP QR CODE GENERATED");
      console.log("=".repeat(60));
      console.log("\nTO SCAN:");
      console.log("1. Open WhatsApp → Settings → Linked Devices → Link a Device");
      console.log("2. Use this URL to get QR code:");
      console.log("\nhttps://qrcode.tec-it.com/API/QRCode?data=" + encodeURIComponent(qr));
      console.log("\nOr copy this code and use any QR generator:");
      console.log("\nCODE: " + qr.substring(0, 100) + "...");
      console.log("\n" + "=".repeat(60));
      
      // Alternative: Save QR to a file (for debugging)
      console.log("\n💡 TIP: Copy the QR code data above and use:");
      console.log("https://qr.io/ to generate a scannable QR code");
    }

    if (connection === "open") {
      console.log("\n✅ WhatsApp connected successfully!");
      console.log("🤖 Bot is now online and ready!");
      
      // Send welcome message to owner
      try {
        await sock.sendMessage("919233137736@s.whatsapp.net", {
          text: "🤖 Mizo RP Bot is now online!\n\nType /help to see commands."
        });
        console.log("📨 Startup message sent to owner");
      } catch (e) {
        console.log("Note: Could not send startup message");
      }
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log(`❌ Connection closed: ${statusCode}`);
      
      if (statusCode === DisconnectReason.loggedOut) {
        console.log("🚨 Logged out from WhatsApp. Delete auth_info_baileys folder and restart.");
        process.exit(0);
      } else if (statusCode === 405) {
        console.log("⚠️  WhatsApp rejected connection (405). This usually means:");
        console.log("   - Your IP is temporarily blocked");
        console.log("   - Too many connection attempts");
        console.log("   - WhatsApp server issue");
        console.log("🕐 Waiting 60 seconds before retry...");
        await delay(60000);
      }
      
      // Reconnect
      console.log("🔄 Attempting to reconnect...");
      await delay(15000);
      connectToWhatsApp();
    }

    if (connection === "connecting") {
      console.log("🔗 Connecting to WhatsApp servers...");
    }
  });

  // Message handling
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

      const uid = from.split("@")[0];
      const userRef = ref(db, "users/" + uid);
      let user = (await get(userRef)).val();

      // Initialize new user
      if (!user) {
        user = {
          role: "citizen",
          cash: 10000,
          specialId: generateId(3),
          joined: new Date().toISOString()
        };
        await set(userRef, user);
      }

      const lowerText = text.toLowerCase().trim();

      // Command handling
      if (lowerText === "/status" || lowerText === "!status") {
        await sock.sendMessage(from, {
          text: `👤 *MIZO RP PROFILE*\n\n` +
                `🏷️ Role: ${user.role}\n` +
                `💰 Cash: $${user.cash.toLocaleString()}\n` +
                `🆔 Special ID: ${user.specialId}\n\n` +
                `_Type /help for commands_`
        });
      }
      
      else if (lowerText === "/help" || lowerText === "!help") {
        await sock.sendMessage(from, {
          text: `📋 *MIZO RP COMMANDS*\n\n` +
                `/status - Check your profile\n` +
                `/work - Earn money (100-600)\n` +
                `/crime - Risk for bigger cash\n` +
                `/daily - Get daily reward\n` +
                `/rob @user - Steal from others\n\n` +
                `⚠️ More features coming soon!`
        });
      }
      
      else if (lowerText === "/work" || lowerText === "!work") {
        const earnings = Math.floor(Math.random() * 500) + 100;
        user.cash += earnings;
        await update(userRef, { cash: user.cash });
        
        await sock.sendMessage(from, {
          text: `💼 You worked and earned: *$${earnings}*\n` +
                `💰 New balance: *$${user.cash.toLocaleString()}*`
        });
      }
      
      else if (lowerText === "/daily" || lowerText === "!daily") {
        const dailyReward = 1000;
        user.cash += dailyReward;
        await update(userRef, { cash: user.cash });
        
        await sock.sendMessage(from, {
          text: `🎁 Daily reward claimed!\n` +
                `💰 +$${dailyReward} added to your account\n` +
                `📈 Total: *$${user.cash.toLocaleString()}*`
        });
      }
      
      else if (lowerText === "/ping" || lowerText === "!ping") {
        await sock.sendMessage(from, {
          text: `🏓 Pong!\n` +
                `🌐 Bot is online and working!`
        });
      }

    } catch (error) {
      console.error("Error processing message:", error.message);
    }
  });

  return sock;
}

// ================== STARTUP ==================
async function startBot() {
  console.log("🚀 Starting Mizo Roleplay Bot...");
  console.log("📅 " + new Date().toLocaleString());
  console.log("🔧 Node version: " + process.version);
  console.log("\n" + "=".repeat(60));
  console.log("IMPORTANT: If you see 405 error, wait 5-10 minutes");
  console.log("then restart the bot from Render dashboard.");
  console.log("=".repeat(60) + "\n");
  
  try {
    await connectToWhatsApp();
  } catch (error) {
    console.error("🔥 Bot startup failed:", error.message);
    console.log("🔄 Restarting in 30 seconds...");
    await delay(30000);
    startBot();
  }
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
startBot();