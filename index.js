// ==========================================
// MIZO RP BOT — WORKING VERSION
// ==========================================

const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const express = require("express");

// ================== KEEPALIVE ==================
const app = express();
const port = process.env.PORT || 10000;
app.get("/", (_, res) => res.send("Mizo Bot Active"));
app.listen(port, () => console.log(`✅ Server running on port ${port}`));

// ================== FIREBASE ==================
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get, set } = require("firebase/database");

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
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("");
}

// ================== BOT ==================
async function startBot() {
    console.log("🚀 Starting Mizo Bot...");
    
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        connectTimeoutMs: 30000
    });

    sock.ev.on("creds.update", saveCreds);
    
    sock.ev.on("connection.update", (update) => {
        const { connection } = update;
        
        if (connection === "open") {
            console.log("✅ WhatsApp Connected!");
            
            // Send welcome message
            try {
                sock.sendMessage("919233137736@s.whatsapp.net", {
                    text: "🤖 *Mizo Bot Connected!*\n\nSend /menu to see commands!"
                });
            } catch (e) {
                console.log("Could not send message");
            }
        }
        
        if (connection === "close") {
            console.log("❌ Disconnected. Restarting...");
            setTimeout(() => startBot(), 5000);
        }
    });
    
    // ================== MESSAGE HANDLER ==================
    sock.ev.on("messages.upsert", async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg?.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            
            if (!text.trim()) return;
            
            console.log(`📨 Message from ${from}: ${text}`);
            
            // Get user from Firebase
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
            
            const cmd = text.trim().toLowerCase();
            
            // ========== COMMANDS ==========
            
            // MENU
            if (cmd === "/menu" || cmd === "/start" || cmd === "menu") {
                await sock.sendMessage(from, {
                    text: `🤖 *MIZO BOT MENU* 🤖\n\n` +
                          `💰 Balance: $${user.cash}\n\n` +
                          `📋 Commands:\n` +
                          `• /work - Earn money\n` +
                          `• /daily - Daily $1000\n` +
                          `• /status - Your profile\n` +
                          `• /crime - Risk crime\n` +
                          `• /rob @user - Steal money\n\n` +
                          `Type /help for more info`
                });
            }
            
            // HELP
            else if (cmd === "/help") {
                await sock.sendMessage(from, {
                    text: `📖 *HELP GUIDE* 📖\n\n` +
                          `/menu - Show main menu\n` +
                          `/work - Work for money (100-600)\n` +
                          `/daily - Daily reward ($1000)\n` +
                          `/status - View your profile\n` +
                          `/crime - Risk crime for cash\n` +
                          `/rob @user - Rob another player\n\n` +
                          `🎮 Games:\n` +
                          `/flip <amount> - Coin flip\n` +
                          `/dice <amount> - Roll dice\n\n` +
                          `Need help? Contact owner.`
                });
            }
            
            // WORK
            else if (cmd === "/work") {
                const earn = Math.floor(Math.random() * 500) + 100;
                user.cash += earn;
                await set(userRef, user);
                
                await sock.sendMessage(from, {
                    text: `💼 *WORK COMPLETED*\n\n` +
                          `💰 Earned: $${earn}\n` +
                          `💎 Total: $${user.cash}\n\n` +
                          `⏰ Come back in 1 hour!`
                });
            }
            
            // DAILY
            else if (cmd === "/daily") {
                user.cash += 1000;
                await set(userRef, user);
                
                await sock.sendMessage(from, {
                    text: `🎁 *DAILY REWARD*\n\n` +
                          `💰 +$1000\n` +
                          `💎 Total: $${user.cash}\n\n` +
                          `📅 Come back tomorrow!`
                });
            }
            
            // STATUS
            else if (cmd === "/status" || cmd === "/profile") {
                await sock.sendMessage(from, {
                    text: `👤 *YOUR PROFILE* 👤\n\n` +
                          `🆔 ID: ${user.specialId}\n` +
                          `💰 Cash: $${user.cash}\n` +
                          `🏷️ Role: ${user.role}\n` +
                          `📅 Joined: ${new Date(user.joined).toLocaleDateString()}\n\n` +
                          `💎 Type /menu for commands`
                });
            }
            
            // CRIME
            else if (cmd === "/crime") {
                const success = Math.random() > 0.4;
                const amount = success ? 
                    Math.floor(Math.random() * 2000) + 500 : 
                    Math.floor(Math.random() * 800) + 200;
                
                if (success) {
                    user.cash += amount;
                    await set(userRef, user);
                    
                    await sock.sendMessage(from, {
                        text: `🔫 *CRIME SUCCESS!*\n\n` +
                              `💰 Stole: $${amount}\n` +
                              `💎 Total: $${user.cash}\n\n` +
                              `⚠️ Be careful next time!`
                    });
                } else {
                    const loss = Math.min(amount, user.cash);
                    user.cash -= loss;
                    await set(userRef, user);
                    
                    await sock.sendMessage(from, {
                        text: `🚨 *CRIME FAILED!*\n\n` +
                              `💸 Fine: $${loss}\n` +
                              `📉 Total: $${user.cash}\n\n` +
                              `😔 Better luck next time!`
                    });
                }
            }
            
            // UNKNOWN COMMAND
            else if (text.startsWith("/")) {
                await sock.sendMessage(from, {
                    text: `❓ Unknown command: "${text.split(' ')[0]}"\n\n` +
                          `Type /menu to see all commands.`
                });
            }
            
            // GREETINGS
            else if (cmd === "hi" || cmd === "hello" || cmd === "hey") {
                await sock.sendMessage(from, {
                    text: `👋 Hello! Welcome to Mizo Bot!\n\n` +
                          `Type /menu to see commands.\n` +
                          `💰 Your balance: $${user.cash}`
                });
            }
            
        } catch (error) {
            console.error("Error:", error.message);
        }
    });
}

// Start bot
startBot();

// Handle errors
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err);
});