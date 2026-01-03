// ==========================================
// MIZO ROLEPLAY BOT — FINAL PROTOCOL-SAFE VERSION
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

let pairingRequested = false;
let sock;

// ================== KEEPALIVE ==================
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

const db = getDatabase(initializeApp(firebaseConfig));

// ================== UTILS ==================
function generateId(len) {
  return Array.from({ length: len }, () =>
    Math.floor(Math.random() * 10)
  ).join("");
}

// ================== START BOT ==================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["MizoRP", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  // ====== PAIRING (PROTOCOL CORRECT) ======
  if (!state.creds.registered && !pairingRequested) {
    pairingRequested = true;
    const phoneNumber = "919233137736";

    (async () => {
      try {
        await sock.waitForConnectionUpdate(
          (u) => u.connection === "open"
        );

        const code = await sock.requestPairingCode(phoneNumber);

        console.log("\n====================================");
        console.log("🚨 PAIRING CODE 🚨");
        console.log("CODE:", code);
        console.log("====================================\n");
      } catch (e) {
        console.error("Pairing failed:", e);
      }
    })();
  }

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("✅ WhatsApp connected");
    }

    if (connection === "close") {
      console.log(
        "❌ Connection closed:",
        lastDisconnect?.error?.output?.statusCode
      );
      if (
        lastDisconnect?.error?.output?.statusCode ===
        DisconnectReason.loggedOut
      ) {
        console.log("Delete auth_info_baileys and restart.");
      }
    }
  });

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
        specialId: generateId(3)
      };
      await set(userRef, user);
    }

    if (text.toLowerCase() === "/status") {
      await sock.sendMessage(from, {
        text: `Role: ${user.role}\nCash: ${user.cash}`
      });
    }
  });
}

startBot();