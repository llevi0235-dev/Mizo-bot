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
const { initializeApp } = require("firebase/app");
const { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    deleteDoc 
} = require("firebase/firestore");

// --- CONFIGURATION ---
const app = express();
const port = process.env.PORT || 3000;

const firebaseConfig = {
  apiKey: "AIzaSyAtbA4OsuRr5qmVSwbIo-M03uCGJ-wbxCM",
  authDomain: "j-bo-a567a.firebaseapp.com",
  databaseURL: "https://j-bo-a567a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "j-bo-a567a",
  storageBucket: "j-bo-a567a.firebasestorage.app",
  messagingSenderId: "1029278826614",
  appId: "1:1029278826614:web:b608af7356752ff2e9df57"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const COLLECTION_NAME = "auth_info_baileys";

// --- CUSTOM FIRESTORE AUTH ADAPTER ---
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
            if (snap.exists()) {
                data[id] = JSON.parse(snap.data().value, BufferJSON.reviver);
            }
        }));
        return data;
    };

    const saveCreds = async () => {
        await setDoc(credsRef, { value: JSON.stringify(creds, BufferJSON.replacer) }, { merge: true });
    };

    return {
        state: {
            creds,
            keys: {
                get: keys,
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const docRef = doc(db, collectionName, `${category}-${id}`);
                            if (value) {
                                tasks.push(setDoc(docRef, { value: JSON.stringify(value, BufferJSON.replacer) }, { merge: true }));
                            } else {
                                tasks.push(deleteDoc(docRef));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds
    };
};

// --- SERVER ---
app.get("/", (req, res) => {
    res.send("I am alive, My Lord. Monitoring WhatsApp...");
});
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// --- MAIN BOT LOGIC ---
async function connectToWhatsApp() {
    const { state, saveCreds } = await useFirestoreAuthState(COLLECTION_NAME);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        generateHighQualityLinkPreview: true,
    });

    // --- PAIRING CODE ---
    if (!sock.authState.creds.registered) {
        const phoneNumber = "919233137736";
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n\n[ PAIRING CODE ] : ${code}\n\n`);
            } catch (err) {
                console.log("Error requesting pairing code: ", err);
            }
        }, 3000);
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === "open") {
            console.log("Connected successfully, My Lord.");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const msgType = Object.keys(m.message)[0];
        const text = msgType === "conversation" ? m.message.conversation : 
                     msgType === "extendedTextMessage" ? m.message.extendedTextMessage.text : "";

        if (text.toLowerCase() === "/bot") {
            await sock.sendMessage(m.key.remoteJid, { text: "Yes, My Lord." }, { quoted: m });
        }
    });
}
connectToWhatsApp();
