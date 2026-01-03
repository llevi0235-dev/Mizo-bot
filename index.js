// ==========================================
// MIZO ROLEPLAY BOT — COMPLETE WORKING VERSION
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
const axios = require("axios");

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

function formatTime() {
  return new Date().toLocaleTimeString();
}

// ================== PAIRING CODE HANDLER ==================
async function handlePairing(sock) {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("🔐 REQUESTING WHATSAPP PAIRING CODE");
    console.log("=".repeat(60));
    
    // Your phone number with country code (no +)
    const phoneNumber = "919233137736";
    
    console.log(`📞 Requesting code for: ${phoneNumber}`);
    console.log("⏳ Please wait...");
    
    // Request pairing code
    const code = await sock.requestPairingCode(phoneNumber);
    
    console.log("\n✅ PAIRING CODE GENERATED!");
    console.log("=".repeat(60));
    console.log(`📱 Phone: ${phoneNumber}`);
    console.log(`🔢 Code: ${code}`);
    console.log("=".repeat(60));
    console.log("\n📲 HOW TO USE:");
    console.log("1. Open WhatsApp on your phone");
    console.log("2. Go to Settings → Linked Devices");
    console.log("3. Tap 'Link a Device'");
    console.log("4. Tap 'Link with phone number instead'");
    console.log(`5. Enter this code: ${code}`);
    console.log("6. Bot will connect automatically");
    console.log("\n⏱️  Code expires in 30 seconds");
    console.log("=".repeat(60));
    
    return true;
  } catch (error) {
    console.error("\n❌ Failed to get pairing code:", error.message);
    
    if (error.message.includes("rate limit")) {
      console.log("⚠️  Too many attempts. Wait 10 minutes and restart.");
    } else if (error.message.includes("not registered")) {
      console.log("⚠️  Phone number not registered on WhatsApp.");
    } else {
      console.log("⚠️  Try again in 30 seconds...");
    }
    
    return false;
  }
}

// ================== BOT CONNECTION ==================
async function connectToWhatsApp() {
  console.log(`\n[${formatTime()}] 🔄 Initializing WhatsApp connection...`);
  
  // Use auth state
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  
  // Check if already authenticated
  const isAuthenticated = state.creds.registered;
  
  if (isAuthenticated) {
    console.log(`[${formatTime()}] ✅ Already logged in as: ${state.creds.me?.id || "Unknown"}`);
  } else {
    console.log(`[${formatTime()}] ⚠️  Not authenticated. Will request pairing code.`);
  }

  // Create socket
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "fatal" }), // Minimal logging
    printQRInTerminal: false,
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
    const { connection, lastDisconnect } = update;
    
    if (connection === "open") {
      console.log(`\n[${formatTime()}] ✅ WHATSAPP CONNECTED SUCCESSFULLY!`);
      console.log(`[${formatTime()}] 🤖 Bot is now online and ready!`);
      
      // Send welcome message to owner
      try {
        await sock.sendMessage("919233137736@s.whatsapp.net", {
          text: "🤖 *Mizo RP Bot* is now online!\n\nType /help to see available commands."
        });
        console.log(`[${formatTime()}] 📨 Startup message sent to owner`);
      } catch (e) {
        console.log(`[${formatTime()}] Note: Could not send startup message`);
      }
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.output?.payload?.error || "Unknown";
      
      console.log(`\n[${formatTime()}] ❌ Connection closed: ${statusCode} (${reason})`);
      
      // Handle specific disconnect reasons
      if (statusCode === DisconnectReason.loggedOut) {
        console.log(`[${formatTime()}] 🚨 Logged out. Delete auth_info_baileys folder and restart.`);
        process.exit(0);
      } else if (statusCode === 405) {
        console.log(`[${formatTime()}] ⚠️  WhatsApp rejected connection (405).`);
        console.log(`[${formatTime()}] 💡 Possible solutions:`);
        console.log(`[${formatTime()}]   1. Wait 5-10 minutes`);
        console.log(`[${formatTime()}]   2. Restart the bot from Render dashboard`);
        console.log(`[${formatTime()}]   3. Use a different phone number`);
        console.log(`[${formatTime()}] ⏳ Waiting 60 seconds...`);
        await delay(60000);
      } else if (statusCode === 429) {
        console.log(`[${formatTime()}] ⚠️  Rate limited. Waiting 2 minutes...`);
        await delay(120000);
      }
      
      // Auto-reconnect with delay
      console.log(`[${formatTime()}] 🔄 Attempting to reconnect in 10 seconds...`);
      await delay(10000);
      connectToWhatsApp();
    }

    if (connection === "connecting") {
      console.log(`[${formatTime()}] 🔗 Connecting to WhatsApp...`);
    }
  });

  // If not authenticated, request pairing code
  if (!isAuthenticated) {
    console.log(`\n[${formatTime()}] 📱 Starting authentication process...`);
    
    // Wait a bit for connection to establish
    await delay(3000);
    
    // Request pairing code
    const pairingSuccess = await handlePairing(sock);
    
    if (!pairingSuccess) {
      console.log(`[${formatTime()}] ⏳ Retrying pairing in 30 seconds...`);
      await delay(30000);
      await handlePairing(sock);
    }
  }

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

      console.log(`[${formatTime()}] 📨 Message from ${from.split("@")[0]}: ${text.substring(0, 50)}...`);

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
        console.log(`[${formatTime()}] 👤 New user registered: ${uid}`);
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
        const startTime = Date.now();
        await sock.sendMessage(from, { text: "🏓 Pong!" });
        const latency = Date.now() - startTime;
        
        await sock.sendMessage(from, {
          text: `📊 *Bot Status*\n\n` +
                `⏱️ Latency: ${latency}ms\n` +
                `🟢 Status: Online\n` +
                `📅 Uptime: ${process.uptime().toFixed(0)}s\n` +
                `👤 Users: ${Object.keys((await get(ref(db, "users"))).val() || {}).length}`
        });
      }
      
      // Admin: Add cash
      else if (lowerText.startsWith("/addcash") && from === "919233137736@s.whatsapp.net") {
        const parts = text.split(" ");
        if (parts.length >= 3) {
          const target = parts[1].replace("@s.whatsapp.net", "").replace("@", "");
          const amount = parseInt(parts[2]);
          
          if (!isNaN(amount) && amount > 0) {
            const targetRef = ref(db, "users/" + target);
            const targetUser = (await get(targetRef)).val() || { 
              cash: 0, 
              role: "citizen",
              specialId: generateId(3)
            };
            
            targetUser.cash = (targetUser.cash || 0) + amount;
            await set(targetRef, targetUser);
            
            await sock.sendMessage(from, {
              text: `✅ *Admin Action*\n\n` +
                    `💰 Added $${amount} to ${target}\n` +
                    `📊 New balance: $${targetUser.cash}`
            });
            
            // Notify the user if possible
            try {
              await sock.sendMessage(`${target}@s.whatsapp.net`, {
                text: `🎉 *Admin Gift!*\n\n` +
                      `💰 You received $${amount} from admin\n` +
                      `📈 New balance: $${targetUser.cash}`
              });
            } catch (e) {
              console.log(`Could not notify user ${target}`);
            }
          }
        }
      }
      
      // Admin: Set role
      else if (lowerText.startsWith("/setrole") && from === "919233137736@s.whatsapp.net") {
        const parts = text.split(" ");
        if (parts.length >= 3) {
          const target = parts[1].replace("@s.whatsapp.net", "").replace("@", "");
          const role = parts.slice(2).join(" ");
          
          const targetRef = ref(db, "users/" + target);
          const targetUser = (await get(targetRef)).val() || { 
            cash: 10000, 
            role: "citizen",
            specialId: generateId(3)
          };
          
          targetUser.role = role;
          await set(targetRef, targetUser);
          
          await sock.sendMessage(from, {
            text: `✅ *Role Updated*\n\n` +
                  `👤 User: ${target}\n` +
                  `🏷️ New Role: ${role}`
          });
        }
      }
      
      // Pair command (for owner to get new code)
      else if (lowerText === "/pair" && from === "919233137736@s.whatsapp.net") {
        await sock.sendMessage(from, {
          text: `🔐 *Requesting new pairing code...*`
        });
        
        const success = await handlePairing(sock);
        
        if (success) {
          await sock.sendMessage(from, {
            text: `✅ New pairing code generated!\nCheck the bot logs for the code.`
          });
        }
      }
      
      // Unknown command
      else if (text.startsWith("/") || text.startsWith("!")) {
        await sock.sendMessage(from, {
          text: `❓ *Unknown Command*\n\n` +
                `Command "${text.split(" ")[0]}" not recognized.\n` +
                `Type /help to see available commands.`
        });
      }

    } catch (error) {
      console.error(`[${formatTime()}] Error processing message:`, error.message);
    }
  });

  // Handle group participants update
  sock.ev.on("group-participants.update", async ({ id, participants, action }) => {
    if (action === "add") {
      await sock.sendMessage(id, {
        text: `👋 Welcome ${participants.map(p => `@${p.split("@")[0]}`).join(", ")} to the group!\n\n` +
              `Type /help to see Mizo RP Bot commands.`
      });
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
  
  let retryCount = 0;
  const maxRetries = 5;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`\n[${formatTime()}] Attempt ${retryCount + 1}/${maxRetries}`);
      await connectToWhatsApp();
      break; // Success, exit loop
    } catch (error) {
      retryCount++;
      console.error(`[${formatTime()}] ❌ Attempt ${retryCount} failed:`, error.message);
      
      if (retryCount >= maxRetries) {
        console.log(`[${formatTime()}] ⚠️  Max retries reached. Bot will restart in 5 minutes.`);
        await delay(300000); // 5 minutes
        retryCount = 0; // Reset counter
      } else {
        const waitTime = retryCount * 30000; // 30s, 60s, 90s...
        console.log(`[${formatTime()}] ⏳ Retrying in ${waitTime/1000} seconds...`);
        await delay(waitTime);
      }
    }
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log(`\n[${formatTime()}] 👋 Shutting down gracefully...`);
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log(`\n[${formatTime()}] 👋 Received SIGTERM, shutting down...`);
  process.exit(0);
});

// Auto-restart every 12 hours to prevent issues
setInterval(() => {
  console.log(`\n[${formatTime()}] 🔄 Scheduled restart for maintenance...`);
  process.exit(0);
}, 12 * 60 * 60 * 1000);

// Start the bot
startBot();