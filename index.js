// ==========================================
// MIZO RP BOT — NO QR CODE VERSION
// ==========================================

const fs = require('fs');
const { 
    default: makeWASocket, 
    useMultiFileAuthState,
    DisconnectReason,
    delay 
} = require("@whiskeysockets/baileys");
const express = require("express");

// ================== KEEPALIVE ==================
const app = express();
const port = process.env.PORT || 10000;
app.get("/", (_, res) => res.send("Mizo RP Bot is Active"));
app.listen(port, () => console.log(`✅ Server on port ${port}`));

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
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("");
}

// ================== SIMPLE BOT ==================
async function startBot() {
    console.log("🚀 Starting Mizo Bot...");
    
    const { state, saveCreds } = await useMultiFileAuthState("session");
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        connectTimeoutMs: 60000
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "open") {
            console.log("✅ WhatsApp Connected!");
            
            // Send welcome message
            try {
                await sock.sendMessage("919233137736@s.whatsapp.net", {
                    text: "🤖 *Mizo Bot is Online!*\n\nCommands:\n• /menu - Main menu\n• /work - Earn money\n• /daily - Daily reward\n• /status - Your profile"
                });
            } catch (e) {}
        }
        
        if (connection === "close") {
            console.log("❌ Disconnected. Reconnecting...");
            await delay(5000);
            startBot();
        }
    });

    // ================== COMMAND HANDLER ==================
    sock.ev.on("messages.upsert", async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg?.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            
            if (!text.trim()) return;
            
            console.log(`📨 ${from.split('@')[0]}: ${text}`);
            
            const uid = from.split("@")[0];
            const userRef = ref(db, "users/" + uid);
            let user = (await get(userRef)).val() || {
                role: "citizen",
                cash: 10000,
                specialId: generateId(3),
                joined: new Date().toISOString()
            };
            
            const cmd = text.trim().toLowerCase();
            
            // MENU COMMAND
            if (cmd === "/menu" || cmd === "menu" || cmd === "/start") {
                await sock.sendMessage(from, {
                    text: `🤖 *MIZO BOT MENU*\n\n` +
                          `💰 Balance: $${user.cash.toLocaleString()}\n\n` +
                          `📋 Commands:\n` +
                          `• /work - Earn money\n` +
                          `• /daily - Daily reward\n` +
                          `• /status - Your profile\n` +
                          `• /crime - Risk crime\n` +
                          `• /rob @user - Rob player\n\n` +
                          `🎮 Games:\n` +
                          `• /flip <amount>\n` +
                          `• /dice <amount>\n\n` +
                          `Type /help for details`
                });
            }
            
            // HELP COMMAND
            else if (cmd === "/help") {
                await sock.sendMessage(from, {
                    text: `📖 *HELP*\n\n` +
                          `/menu - Show menu\n` +
                          `/work - Work for money\n` +
                          `/daily - Daily $1000\n` +
                          `/status - Your stats\n` +
                          `/crime - Risk for cash\n` +
                          `/rob @user - Steal money\n` +
                          `/flip 100 - Coin flip\n` +
                          `/dice 100 - Roll dice`
                });
            }
            
            // WORK COMMAND
            else if (cmd === "/work") {
                const earn = Math.floor(Math.random() * 500) + 100;
                user.cash += earn;
                await set(userRef, user);
                
                await sock.sendMessage(from, {
                    text: `💼 You earned $${earn}\n💰 Total: $${user.cash.toLocaleString()}`
                });
            }
            
            // DAILY COMMAND
            else if (cmd === "/daily") {
                user.cash += 1000;
                await set(userRef, user);
                
                await sock.sendMessage(from, {
                    text: `🎁 Daily reward: $1000\n💰 Total: $${user.cash.toLocaleString()}`
                });
            }
            
            // STATUS COMMAND
            else if (cmd === "/status" || cmd === "/profile") {
                await sock.sendMessage(from, {
                    text: `👤 *PROFILE*\n\n` +
                          `🆔 ID: ${user.specialId}\n` +
                          `💰 Cash: $${user.cash.toLocaleString()}\n` +
                          `🏷️ Role: ${user.role}\n` +
                          `📅 Joined: ${new Date(user.joined).toLocaleDateString()}`
                });
            }
            
            // UNKNOWN COMMAND
            else if (text.startsWith("/")) {
                await sock.sendMessage(from, {
                    text: `❓ Unknown command. Type /menu for commands.`
                });
            }
            
            // GREETINGS
            else if (cmd === "hi" || cmd === "hello" || cmd === "hey") {
                await sock.sendMessage(from, {
                    text: `👋 Hello! Type /menu to start!`
                });
            }
            
        } catch (error) {
            console.error("Error:", error.message);
        }
    });
}

// Start bot
startBot();