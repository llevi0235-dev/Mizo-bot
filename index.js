// ==========================================
// MIZO ROLEPLAY BOT — WORKING VERSION
// ==========================================

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  delay,
  fetchLatestBaileysVersion,
  Browsers
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
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

// ================== BOT CONNECTION ==================
async function connectToWhatsApp() {
  console.log("🔄 Initializing WhatsApp connection...");
  
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  
  // Check if already logged in
  if (state.creds.registered) {
    console.log("✅ Already authenticated with WhatsApp");
  } else {
    console.log("⚠️ Not authenticated. QR code will be shown...");
  }

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "fatal" }), // Minimal logging
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
    
    // Handle QR code
    if (qr) {
      console.log("\n" + "=".repeat(50));
      console.log("📱 SCAN THIS QR CODE WITH YOUR PHONE");
      console.log("WhatsApp → Linked Devices → Link a Device");
      console.log("=".repeat(50));
      qrcode.generate(qr, { small: true });
      console.log("\nWaiting for scan...");
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connected successfully!");
      
      // Send welcome message to owner
      try {
        await sock.sendMessage("919233137736@s.whatsapp.net", {
          text: "🤖 Mizo RP Bot is now online and ready!"
        });
        console.log("📨 Startup message sent to owner");
      } catch (e) {
        console.log("Note: Could not send startup message");
      }
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.output?.payload?.error || "Unknown";
      console.log(`❌ Connection closed: ${statusCode} (${reason})`);
      
      // Handle specific disconnect reasons
      if (statusCode === DisconnectReason.loggedOut) {
        console.log("🚨 Logged out from WhatsApp. Please delete auth_info_baileys folder.");
        process.exit(0);
      } else if (statusCode === 405) {
        console.log("⚠️  WhatsApp rejected connection (405). Possible temporary block.");
        console.log("🕐 Waiting 30 seconds before retry...");
        await delay(30000);
      } else if (statusCode === 429) {
        console.log("⚠️  Rate limited. Waiting 60 seconds...");
        await delay(60000);
      }
      
      // Reconnect after delay
      console.log("🔄 Attempting to reconnect...");
      await delay(10000);
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
      
      else if (lowerText.startsWith("/addcash") && from === "919233137736@s.whatsapp.net") {
        const parts = text.split(" ");
        if (parts.length >= 3) {
          const target = parts[1].replace("@s.whatsapp.net", "");
          const amount = parseInt(parts[2]);
          
          if (!isNaN(amount)) {
            const targetRef = ref(db, "users/" + target);
            const targetUser = (await get(targetRef)).val() || { cash: 0, role: "citizen" };
            targetUser.cash = (targetUser.cash || 0) + amount;
            await set(targetRef, targetUser);
            
            await sock.sendMessage(from, {
              text: `✅ Added $${amount} to user ${target}\n` +
                    `💰 New balance: $${targetUser.cash}`
            });
          }
        }
      }
      
      else if (lowerText.startsWith("/setrole") && from === "919233137736@s.whatsapp.net") {
        const parts = text.split(" ");
        if (parts.length >= 3) {
          const target = parts[1].replace("@s.whatsapp.net", "");
          const role = parts[2];
          
          const targetRef = ref(db, "users/" + target);
          const targetUser = (await get(targetRef)).val() || { cash: 10000, role: "citizen" };
          targetUser.role = role;
          await set(targetRef, targetUser);
          
          await sock.sendMessage(from, {
            text: `✅ Set role of ${target} to: ${role}`
          });
        }
      }

    } catch (error) {
      console.error("Error processing message:", error.message);
    }
  });

  return sock;
}

// ================== STARTUP ==================
async function startBot() {
  try {
    console.log("🚀 Starting Mizo Roleplay Bot...");
    console.log("📅 " + new Date().toLocaleString());
    console.log("🔧 Node version: " + process.version);
    await connectToWhatsApp();
  } catch (error) {
    console.error("🔥 Bot startup failed:", error.message);
    console.log("🔄 Restarting in 10 seconds...");
    await delay(10000);
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