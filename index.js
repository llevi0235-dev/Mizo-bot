const {
    default: makeWASocket,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    initAuthCreds,
    BufferJSON
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const { initializeApp, getApps, getApp } = require("firebase/app");
const { getFirestore, doc, getDoc, setDoc, deleteDoc } = require("firebase/firestore");

// --- LOAD YOUR FILES ---
const config = require('./config');
const GameEngine = require('./gameEngine'); 

// --- 1. INITIALIZE DATABASE ---
let app;
if (getApps().length === 0) {
    app = initializeApp(config.firebaseConfig);
} else {
    app = getApp();
}
const db = getFirestore(app);

// --- 2. SERVER (Keeps Bot Awake) ---
const server = express();
const port = process.env.PORT || 3000;
server.get("/", (req, res) => res.send("City RPG Bot is ALIVE."));
server.listen(port, () => console.log(`Server on port ${port}`));

// --- 3. AUTHENTICATION ---
const useFirestoreAuthState = async (collectionName) => {
    const credsRef = doc(db, collectionName, "creds");
    const credsSnap = await getDoc(credsRef);
    const creds = credsSnap.exists() 
        ? JSON.parse(credsSnap.data().value, BufferJSON.reviver) 
        : initAuthCreds();

    const keys = async (type, ids) => {
        const data = {};
        await Promise.all(ids.map(async (id) => {
            const docRef = doc(db, collectionName, `${type}-${id}`);
            const snap = await getDoc(docRef);
            if (snap.exists()) data[id] = JSON.parse(snap.data().value, BufferJSON.reviver);
        }));
        return data;
    };

    const saveCreds = async () => {
        await setDoc(credsRef, { value: JSON.stringify(creds, BufferJSON.replacer) }, { merge: true });
    };

    return {
        state: { creds, keys: { get: keys, set: async (data) => {
            const tasks = [];
            for (const category in data) {
                for (const id in data[category]) {
                    const value = data[category][id];
                    const docRef = doc(db, collectionName, `${category}-${id}`);
                    if (value) tasks.push(setDoc(docRef, { value: JSON.stringify(value, BufferJSON.replacer) }, { merge: true }));
                    else tasks.push(deleteDoc(docRef));
                }
            }
            await Promise.all(tasks);
        }}},
        saveCreds
    };
};

// --- 4. START BOT ---
async function startBot() {
    const { state, saveCreds } = await useFirestoreAuthState("auth_baileys");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(config.botNumber);
                console.log(`\n\n[ PAIRING CODE ] : ${code.match(/.{1,4}/g)?.join("-")}\n\n`);
            } catch (e) { console.log("Pairing Error:", e); }
        }, 4000);
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("❌ Connection closed. Reconnecting in 5 seconds...");
            
            // --- THE FIX: WAIT 5 SECONDS BEFORE RESTARTING ---
            if (shouldReconnect) {
                setTimeout(() => startBot(), 5000);
            }
        } else if (connection === "open") {
            console.log("✅ Connected successfully, My Lord.");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const msgType = Object.keys(m.message)[0];
        const text = msgType === "conversation" ? m.message.conversation : 
                     msgType === "extendedTextMessage" ? m.message.extendedTextMessage.text : "";
        
        if (!text) return;
        const sender = m.key.remoteJid;

        try {
            await GameEngine.processCommand(sock, m, text, sender);
        } catch (err) {
            console.log("Game Error:", err);
        }
    });
}

startBot();
