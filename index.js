// ==========================================
// MIZO ROLEPLAY BOT — QR CODE VERSION
// ==========================================

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  delay,
  Browsers
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const pino = require("pino");
const express = require("express");

// ================== KEEPALIVE ==================
const app = express();
const port = process.env.PORT || 10000;
app.get("/", (_, res) => res.send("Mizo RP Bot is Active"));
app.get("/health", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));
app.listen(port, () => console.log(`✅ Server listening on port ${port}`));

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

// ================== QR CODE DISPLAY ==================
function displayQR(qr) {
  console.log("\n" + "=".repeat(60));
  console.log("📱 WHATSAPP QR CODE");
  console.log("=".repeat(60));
  console.log("\nSCAN WITH YOUR PHONE:");
  console.log("1. Open WhatsApp");
  console.log("2. Tap Settings → Linked Devices");
  console.log("3. Tap Link a Device");
  console.log("4. Point camera at QR code below");
  console.log("\nQR CODE:");
  console.log("=".repeat(60));
  
  // Generate clean QR code
  qrcode.generate(qr, { small: true }, function (qrcode) {
    console.log(qrcode);
  });
  
  console.log("=".repeat(60));
  console.log("\nIf QR doesn't scan, use this URL:");
  console.log(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`);
  console.log("=".repeat(60));
}

// ================== BOT CONNECTION ==================
async function connectToWhatsApp() {
  console.log(`\n🔄 Initializing WhatsApp connection...`);
  
  // Use auth state
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  
  // Check if already authenticated
  const isAuthenticated = state.creds.registered;
  
  if (isAuthenticated) {
    console.log(`✅ Already logged in as: ${state.creds.me?.id || "Unknown"}`);
  } else {
    console.log(`⚠️ Not authenticated. QR code will be shown.`);
  }

  // Create socket
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "fatal" }),
    printQRInTerminal: false, // We'll handle QR ourselves
    browser: Browsers.ubuntu("Chrome"),
    version: [2, 2413, 1],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    emitOwnEvents: true,
    defaultQueryTimeoutMs: 0,
    maxRetries: 3,
    retryDelayMs: 2000,
    fireInitQueries: true,
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  // Save credentials when updated
  sock.ev.on("creds.update", saveCreds);

  // Handle connection updates
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    // Display QR code
    if (qr) {
      displayQR(qr);
    }
    
    if (connection === "open") {
      console.log(`\n✅ WHATSAPP CONNECTED SUCCESSFULLY!`);
      console.log(`🤖 Bot is now online and ready!`);
      
      // Send welcome message to owner
      try {
        await sock.sendMessage("919233137736@s.whatsapp.net", {
          text: "🤖 *Mizo RP Bot* is now online!\n\nType /help to see available commands."
        });
        console.log(`📨 Startup message sent to owner`);
      } catch (e) {
        console.log(`Note: Could not send startup message`);
      }
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      
      console.log(`\n❌ Connection closed: ${statusCode}`);
      
      if (statusCode === DisconnectReason.loggedOut) {
        console.log(`🚨 Logged out. Delete auth_info_baileys folder and restart.`);
        process.exit(0);
      } else if (statusCode === 405) {
        console.log(`⚠️  WhatsApp rejected connection (405).`);
        console.log(`⏳ Waiting 60 seconds...`);
        await delay(60000);
      }
      
      // Auto-reconnect with delay
      console.log(`🔄 Attempting to reconnect in 10 seconds...`);
      await delay(10000);
      connectToWhatsApp();
    }

    if (connection === "connecting") {
      console.log(`🔗 Connecting to WhatsApp...`);
    }
  });

  // ================== MESSAGE HANDLING ==================
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

      console.log(`📨 Message from ${from.split("@")[0]}: ${text.substring(0, 50)}...`);

      const uid = from.split("@")[0];
      const userRef = ref(db, "users/" + uid);
      let user = (await get(userRef)).val();

      // Initialize new user
      if (!user) {
        user = {
          role: "citizen",
          cash: 10000,
          specialId: generateId(3),
          joined: new Date().toISOString(),
          level: 1,
          xp: 0
        };
        await set(userRef, user);
        console.log(`👤 New user registered: ${uid}`);
      }

      const lowerText = text.toLowerCase().trim();

      // ========== COMMAND HANDLERS ==========
      
      // Status command
      if (lowerText === "/status" || lowerText === "!status") {
        await sock.sendMessage(from, {
          text: `👤 *MIZO RP PROFILE*\n\n` +
                `🏷️ Role: ${user.role}\n` +
                `💰 Cash: $${user.cash.toLocaleString()}\n` +
                `🆔 ID: ${user.specialId}\n` +
                `📊 Level: ${user.level}\n` +
                `⭐ XP: ${user.xp}\n\n` +
                `📅 Joined: ${new Date(user.joined).toLocaleDateString()}\n\n` +
                `_Type /help for commands_`
        });
      }
      
      // Help command
      else if (lowerText === "/help" || lowerText === "!help") {
        await sock.sendMessage(from, {
          text: `📋 *MIZO RP COMMANDS*\n\n` +
                `👤 Profile:\n` +
                `/status - Check your profile\n\n` +
                `💰 Economy:\n` +
                `/work - Earn money (100-600)\n` +
                `/daily - Get daily reward (1000)\n` +
                `/crime - Risk for big cash\n` +
                `/rob @user - Steal from others\n\n` +
                `🛒 Shop:\n` +
                `/shop - View shop items\n` +
                `/buy <item> - Purchase item\n\n` +
                `🎮 Game:\n` +
                `/flip <heads/tails> <amount> - Coin flip\n` +
                `/dice <amount> - Roll dice\n\n` +
                `⚙️ Admin (Owner only):\n` +
                `/addcash @user amount\n` +
                `/setrole @user role`
        });
      }
      
      // Work command
      else if (lowerText === "/work" || lowerText === "!work") {
        const earnings = Math.floor(Math.random() * 500) + 100;
        const xpGain = Math.floor(Math.random() * 10) + 5;
        
        user.cash += earnings;
        user.xp += xpGain;
        
        // Level up check
        if (user.xp >= user.level * 100) {
          user.level += 1;
          user.xp = 0;
        }
        
        await update(userRef, { 
          cash: user.cash, 
          xp: user.xp, 
          level: user.level 
        });
        
        let levelMsg = "";
        if (user.xp === 0) {
          levelMsg = `\n🎉 Level Up! You're now level ${user.level}!`;
        }
        
        await sock.sendMessage(from, {
          text: `💼 *Work Completed*\n\n` +
                `💰 Earned: $${earnings}\n` +
                `⭐ XP: +${xpGain}\n` +
                `📈 Balance: $${user.cash.toLocaleString()}\n` +
                `🏆 Level: ${user.level} (${user.xp}/100)${levelMsg}`
        });
      }
      
      // Daily reward
      else if (lowerText === "/daily" || lowerText === "!daily") {
        const dailyReward = 1000;
        user.cash += dailyReward;
        await update(userRef, { cash: user.cash });
        
        await sock.sendMessage(from, {
          text: `🎁 *Daily Reward Claimed!*\n\n` +
                `💰 +$${dailyReward} added\n` +
                `📈 Total: $${user.cash.toLocaleString()}\n\n` +
                `⏰ Come back tomorrow for more!`
        });
      }
      
      // Ping command
      else if (lowerText === "/ping" || lowerText === "!ping") {
        await sock.sendMessage(from, {
          text: `🏓 Pong!\n` +
                `🤖 Bot is online and working!\n` +
                `⏱️ Uptime: ${process.uptime().toFixed(0)} seconds`
        });
      }

    } catch (error) {
      console.error(`Error processing message:`, error.message);
    }
  });

  return sock;
}

// ================== STARTUP ==================
async function startBot() {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 STARTING MIZO ROLEPLAY BOT");
  console.log("=".repeat(60));
  console.log(`📅 Date: ${new Date().toLocaleString()}`);
  console.log(`🔧 Node: ${process.version}`);
  console.log(`🌐 Port: ${port}`);
  console.log("=".repeat(60));
  
  try {
    await connectToWhatsApp();
  } catch (error) {
    console.error(`❌ Bot startup failed:`, error.message);
    console.log(`🔄 Restarting in 30 seconds...`);
    await delay(30000);
    startBot();
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log(`\n👋 Shutting down gracefully...`);
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log(`\n👋 Received SIGTERM, shutting down...`);
  process.exit(0);
});

// Start the bot
startBot();