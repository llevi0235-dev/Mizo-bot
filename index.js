// MIZO BOT - SIMPLE VERSION
const { default: makeWASocket, useSingleFileAuthState } = require("@whiskeysockets/baileys");
const express = require("express");
const app = express();
const port = process.env.PORT || 10000;

app.get("/", (_, res) => res.send("Bot Active"));
app.listen(port, () => console.log(`✅ Port ${port}`));

async function start() {
    const { state, saveState } = useSingleFileAuthState('./auth_info.json');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveState);
    
    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log("✅ Connected!");
            sock.sendMessage("919233137736@s.whatsapp.net", { 
                text: "Bot connected! Send /menu" 
            });
        }
    });
    
    sock.ev.on('messages.upsert', ({ messages }) => {
        const msg = messages[0];
        if (msg?.message?.conversation === "/menu") {
            sock.sendMessage(msg.key.remoteJid, {
                text: "Menu:\n/work - Earn money\n/daily - Daily reward\n/status - Your profile"
            });
        }
    });
}

start();