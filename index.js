const keepAlive = require('./keep_alive');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, 
    jidNormalizedUser,
    getContentType,
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const admin = require("firebase-admin");
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// --- 1. CLOUDINARY CONFIG ---
cloudinary.config({ 
  cloud_name: 'dma9eonrp', 
  api_key: '617177728891958', 
  api_secret: '8bCJRo8QbKRmF374p9PZn1zF3j4'
});

// --- 2. FIREBASE CONFIG ---
const serviceAccount = {
  "type": "service_account",
  "project_id": "j-bo-a567a",
  "private_key_id": "774d8e00478d3c5fb6aefa442a76fa9c1efbc20e",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC8PLn6M8+z3eck\nKYMChU6QBSYzOLkNe7HVimJvSnKac20nau0WzG6Ppj1RfKlIBfBX1Y/DFN/sw36f\nv0wLmpKr6rNnXRMoFz6i1fhIniWiSRfN9rDUGz1IctZ2Id4J9LGVVuovLPNlYTjP\nD6PacbAstZlcOT4ETCx9wNHiiQ1PJf9Xlo7wyeQDBQOYy9V7+gj5Wf8dWKhRUTi9\nm6WNnqMoDDeAs02GY97HsEAfm8wPnHH9J3Fn2+kB6Mpc/35gtFV+cyJAzyRZCovt\niPaX7+uDSHUpYukT4hxSOU+jl7tKYRh96mQrzcr/V3FEpp6aZ808yojzKiIRPmIG\nC0MCN7uPAgMBAAECggEAAy/OADffVM61ao3PW3wRQ+vqZSSZMWq+LHzOxM6QWSAK\nIYg0YlXsqz7nu9jt7ru3AW2qpOVWEyaOHrs42NtxjzqGdgID4IJgO5Z+wQ/4WCJ/\npit+e+DILVFQYyiYnzeGyB30Ef9jUXyPXyYHIpwZHPCoG4EWlTEK8cgRZZHnaUcW\ncKDWZFAlki+9P8LLZ5/228GC4Rm562UiOnss8L3D5uUi2pSNX2V0B6CLrCmiP/if\ng4piKHkgWN6c8PXk8SUmnxF0kfChTdKcGx/6nTLZJHxiBsH+vTZ/2ehpL66+dNIv\nKPsb4XWzJFbHxPI1ee/F0H5X65jXXO2vMhfu/jDv/QKBgQDwGd+iVpBulS+Sp6am\nCw6uG9q4RAyE0x1RzKgxmfq/rWPxy0e7BtWEvd3ng/0BYL89pROXb7tGfT4CGUHc\nXueU9koCrZw7CToHJfakkk9+1TDes92/AGJjL8cxr8ZfKsjsGHR4DAlYVLDi4yJk\nRGmSaXWdjWV7e1MA9CG2HPF30wKBgQDIs6vYJc9Y+MecqofJPoi4QwzqpQL9vWln\nbxHQCLR363pMdyS/Y1TM7PZjDuq5PQaf8ae02qSoDopK1+kIjzf7bxu1dhSDdA9L\ngNTykn+yZnF0vUYPJcmLH9jjNXpXQ1NrO8BANgPC1oITO1XAtIlrkH9lAiVWdV/8\nouYvTdAz1QKBgQCad9rjgxOKwVoI3Oke/BAmvW7ai5UOQxAi1ysCNlEWzgN1xNVS\nItRtgQVpdAXqxAZlL3XKQKzYbazeBsfTcg9FS6pTzMOtS4NUo/zo5eRU8e1t6YPo\n5ONnco6Rjcdu5IS9OAJ+VSgR9vKSFZTDsyvEcSqlARnf9nhxLZ8encJP1wKBgGMg\nosKaQiQOlACkFXbnJP3lWA7Yu3Z5xAKrUB/w/LmyG3CC9Cp3NB4W98aLSpF9O7Vp\n1Mw1pVe//rvikh2BJ0RPZ18j2BPpEdjX49V/WATUJjtjdKPspPPLIgNumWNaRGxV\nUaolQ4xLCGnZR4xrXug6sUFBYxGl3WfZSVmZ1DiVAoGAUbbKBgOJ/aK/xNozElae\n/EIzY4U8BLMw/9iECvFJRr7QAqyZUPk6cYp9QJL2YnLT+mTKQ0k7OpPaT8n+EFPB\nXBDd9uHjON0KsPJjzmXCeBpQFyUjX//Nja8ridN0h8ANeeQ+r7Zj+O9xZKUv1JT3\nUP0fL4evPSOlU19WuNWjLmQ=\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@j-bo-a567a.iam.gserviceaccount.com",
};
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// --- VARIABLES ---
const MY_NUMBER = "919233137736"; 
let localUsers = {};

// --- HELPER: BUFFER STREAM ---
async function streamToBuffer(stream) {
    let buffer = Buffer.alloc(0);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

// --- LOAD DATA ---
async function loadData() {
    console.log("🔄 Loading Social Data...");
    try {
        const usersSnap = await db.collection('social_users').get();
        usersSnap.forEach(doc => { localUsers[doc.id] = doc.data(); });
        console.log("✅ Data Loaded.");
    } catch (e) { console.error("Error loading:", e); }
}

async function saveUser(jid) {
    if (localUsers[jid]) await db.collection('social_users').doc(jid).set(localUsers[jid]);
}

const getUser = (jid, name) => {
    if (!localUsers[jid]) {
        localUsers[jid] = {
            id: jid,
            name: name || 'User',
            bio: "I am new here! 👋",
            photos: [], 
            privacy: 'public',
            lover: null, bestie: null, buddy: null, since: null, pendingReq: null
        };
        saveUser(jid);
    }
    if (name && localUsers[jid].name !== name) {
        localUsers[jid].name = name;
        saveUser(jid);
    }
    return localUsers[jid];
};

function formatDuration(ms) {
    if (!ms) return "";
    const seconds = Math.floor((Date.now() - ms) / 1000);
    const days = Math.floor(seconds / (3600 * 24));
    return `${days}d`;
}

function getTotalLikes(user) {
    if (!user.photos) return 0;
    return user.photos.reduce((sum, photo) => sum + (photo.likes ? photo.likes.length : 0), 0);
}

// --- MAIN BOT ---
async function startBot() {
    await loadData();
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000
    });

    if (!sock.authState.creds.me && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(MY_NUMBER);
                console.log(`CODE: ${code}`);
            } catch (err) {}
        }, 5000);
    }

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        if (update.connection === 'close' && update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            startBot();
        } else if (update.connection === 'open') console.log('✅ SOCIAL BOT CONNECTED!');
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = isGroup ? (msg.key.participant || from) : from;
        const normalizedSender = jidNormalizedUser(sender);
        
        // --- 1. ROBUST MESSAGE EXTRACTION ---
        let msgType = getContentType(msg.message);
        let msgContent = msg.message[msgType];

        // Handle ViewOnce
        if (msgType === 'viewOnceMessage' || msgType === 'viewOnceMessageV2') {
            msgType = getContentType(msgContent.message);
            msgContent = msgContent.message[msgType];
        }

        let body = "";
        let caption = "";

        if (msgContent) {
            if (msgContent.caption) caption = msgContent.caption;
            if (msgContent.text) body = msgContent.text;
            if (msgContent.conversation) body = msgContent.conversation;
        }

        const pushName = msg.pushName || "User";
        const user = getUser(normalizedSender, pushName);

        // --- 2. UPLOAD LOGIC (/up in caption) ---
        const txtToCheck = (caption || body || "").toLowerCase();
        
        if (txtToCheck.includes('/up')) {
            const isImage = msgType === 'imageMessage';
            const isVideo = msgType === 'videoMessage';

            if (isImage || isVideo) {
                if (isGroup) return sock.sendMessage(from, { text: "❌ DM Only!" });
                
                const userCaption = (caption || body).replace(/\/up/i, '').trim() || "No Caption";
                if (user.photos.length >= 5) return sock.sendMessage(from, { text: "❌ Gallery Full! Delete with /del [number]." });

                await sock.sendMessage(from, { text: "⏳ Downloading & Uploading..." });
                
                try {
                    // MANUAL STREAM DOWNLOAD (Much safer)
                    const stream = await downloadContentFromMessage(msgContent, isImage ? 'image' : 'video');
                    const buffer = await streamToBuffer(stream);

                    const ext = isVideo ? 'mp4' : 'jpg';
                    const tempPath = `./temp_${Date.now()}.${ext}`;
                    fs.writeFileSync(tempPath, buffer);
                    
                    console.log("📤 Sending to Cloudinary...");
                    const result = await cloudinary.uploader.upload(tempPath, { resource_type: "auto" });
                    
                    user.photos.push({
                        url: result.secure_url,
                        caption: userCaption,
                        type: isVideo ? 'video' : 'image',
                        likes: []
                    });

                    fs.unlinkSync(tempPath); 
                    await saveUser(normalizedSender);
                    return sock.sendMessage(from, { text: `✅ Uploaded #${user.photos.length}!\nType /pf to check.` });
                } catch (e) {
                    console.error("UPLOAD ERROR:", e);
                    return sock.sendMessage(from, { text: "❌ Upload Failed. " + e.message });
                }
            }
        }

        // --- 3. COMMAND PARSING ---
        const fullText = body || caption || "";
        if (!fullText.startsWith('/') && !fullText.startsWith('@')) return; 

        const args = fullText.trim().split(/ +/);
        let command = args[0].toLowerCase();
        
        let mentionedJid = msgContent?.contextInfo?.mentionedJid?.[0];
        if (fullText.includes('/') && command.includes('@')) {
            const parts = command.split('/');
            if (parts.length > 1) command = '/' + parts[1].replace(/\d+/g, ''); 
        }

        // --- COMMANDS ---

        if (command === '/pf' || command === '/mypf') {
            const targetJid = mentionedJid || normalizedSender;
            const t = getUser(targetJid);
            const totalLikes = getTotalLikes(t);
            const isMe = targetJid === normalizedSender;

            if (!isMe && t.privacy === 'private') return sock.sendMessage(from, { text: `🔒 @${t.name}'s profile is Private.` });

            let status = "";
            if (t.lover) status += `❤️ Lover: @${t.lover.split('@')[0]} (${formatDuration(t.since)})\n`;
            else status += `💔 Single\n`;
            if (t.bestie) status += `💛 Bestie: @${t.bestie.split('@')[0]}\n`;
            if (t.buddy) status += `💙 Buddy: @${t.buddy.split('@')[0]}\n`;

            let galleryTxt = "";
            if (t.photos && t.photos.length > 0) {
                galleryTxt = "\n📸 *Gallery:*\n";
                t.photos.forEach((p, i) => {
                    const pLikes = p.likes ? p.likes.length : 0;
                    galleryTxt += `#${i+1}: ${p.caption} (❤️ ${pLikes})\n`;
                });
            } else { galleryTxt = "\n(No Photos Uploaded)"; }

            const txt = `👤 *${t.name}*\n❤️ ${totalLikes} Total Likes\n\n📝 ${t.bio}\n\n${status}${galleryTxt}\n\n*Reply /like to Vote!*`;

            try {
                if (t.photos && t.photos.length > 0) {
                    const main = t.photos[0];
                    const msgContent = main.type === 'video' 
                        ? { video: { url: main.url }, caption: txt, mentions: [t.lover, t.bestie, t.buddy].filter(Boolean) }
                        : { image: { url: main.url }, caption: txt, mentions: [t.lover, t.bestie, t.buddy].filter(Boolean) };
                    await sock.sendMessage(from, msgContent, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: txt, mentions: [t.lover, t.bestie, t.buddy].filter(Boolean) }, { quoted: msg });
                }
            } catch (e) {
                console.error("SEND PROFILE ERROR:", e);
                await sock.sendMessage(from, { text: txt + "\n(Image failed to load)", mentions: [t.lover, t.bestie, t.buddy].filter(Boolean) });
            }
        }

        if (command === '/bio') {
            if (isGroup) return sock.sendMessage(from, { text: "❌ DM Only." });
            const newBio = fullText.replace('/bio', '').trim();
            if (!newBio) return sock.sendMessage(from, { text: "❌ Usage: /bio Text" });
            user.bio = newBio;
            await saveUser(normalizedSender);
            await sock.sendMessage(from, { text: "✅ Bio Updated!" });
        }

        if (command.startsWith('/del')) {
            if (isGroup) return sock.sendMessage(from, { text: "❌ DM Only." });
            let index = parseInt(fullText.replace(/\D/g, ''));
            if (!index || index < 1 || index > user.photos.length) return sock.sendMessage(from, { text: `❌ Usage: /del 1` });
            user.photos.splice(index - 1, 1);
            await saveUser(normalizedSender);
            await sock.sendMessage(from, { text: `🗑️ Deleted #${index}` });
        }

        if (command === '/like') {
            let photoIndex = 1;
            const parts = fullText.split(' ');
            if (parts[1] && !isNaN(parts[1])) photoIndex = parseInt(parts[1]);

            let targetJid = mentionedJid;
            if (!targetJid) {
                const quotedPart = msgContent?.contextInfo?.participant;
                if (quotedPart) targetJid = quotedPart;
            }

            if (!targetJid) return sock.sendMessage(from, { text: "❌ Reply to user or mention: /like @user" });
            if (targetJid === normalizedSender) return sock.sendMessage(from, { text: "❌ No self-likes." });

            const t = getUser(targetJid);
            if (!t.photos || t.photos.length === 0) return sock.sendMessage(from, { text: "❌ No photos." });
            if (photoIndex < 1 || photoIndex > t.photos.length) return sock.sendMessage(from, { text: "❌ Invalid photo #." });

            const photo = t.photos[photoIndex - 1];
            if (!photo.likes) photo.likes = [];
            if (photo.likes.includes(normalizedSender)) return sock.sendMessage(from, { text: "❌ Already liked!" });

            photo.likes.push(normalizedSender);
            await saveUser(targetJid);
            return sock.sendMessage(from, { text: `❤️ Liked Photo #${photoIndex} of @${t.name}!` });
        }

        if (command === '/top') {
            const sorted = Object.values(localUsers)
                .map(u => ({ name: u.name, likes: getTotalLikes(u) }))
                .sort((a,b) => b.likes - a.likes)
                .slice(0, 50);
            let out = "🔥 *TOP 50 STARS*\n";
            sorted.forEach((u, i) => out += `${i+1}. ${u.name} - ❤️ ${u.likes}\n`);
            await sock.sendMessage(from, { text: out });
        }

        if (command === '/public') { user.privacy = 'public'; await saveUser(normalizedSender); await sock.sendMessage(from, { text: "✅ Public" }); }
        if (command === '/private') { user.privacy = 'private'; await saveUser(normalizedSender); await sock.sendMessage(from, { text: "🔒 Private" }); }

        if (['/propose', '/invbs', '/invbd', '/accept', '/decline', '/end'].includes(command)) {
            if (isGroup) return sock.sendMessage(from, { text: "❌ DM Only." });
            
            if (['/propose', '/invbs', '/invbd'].includes(command)) {
                if (command === '/propose' && user.lover) return sock.sendMessage(from, { text: "❌ Taken." });
                let type = command === '/propose' ? 'lover' : (command === '/invbs' ? 'bestie' : 'buddy');
                user.pendingAction = type; 
                await saveUser(normalizedSender);
                await sock.sendMessage(from, { text: `📱 Type their **Phone Number** (e.g. 919876543210).` });
            }

            if (command === '/accept' && user.pendingReq) {
                const req = user.pendingReq;
                const rUser = getUser(req.from);
                if (req.type === 'lover' && (user.lover || rUser.lover)) { user.pendingReq = null; await saveUser(normalizedSender); return sock.sendMessage(from, { text: "❌ Taken." }); }
                const now = Date.now();
                if (req.type === 'lover') { user.lover = req.from; user.since = now; rUser.lover = normalizedSender; rUser.since = now; }
                else if (req.type === 'bestie') { user.bestie = req.from; rUser.bestie = normalizedSender; }
                else if (req.type === 'buddy') { user.buddy = req.from; rUser.buddy = normalizedSender; }
                user.pendingReq = null;
                await saveUser(normalizedSender); await saveUser(req.from);
                await sock.sendMessage(from, { text: "✅ Connected!" });
                await sock.sendMessage(req.from, { text: `✅ @${user.name} accepted!`, mentions: [normalizedSender] });
            }

            if (command === '/decline' && user.pendingReq) {
                const f = user.pendingReq.from; user.pendingReq = null; await saveUser(normalizedSender);
                await sock.sendMessage(from, { text: "❌ Declined." });
                await sock.sendMessage(f, { text: "❌ Request Declined." });
            }

            if (command === '/end') {
                if (!args[1]) return sock.sendMessage(from, { text: "💔 Usage: /end 1 (Lover), /end 2 (Bestie), /end 3 (Buddy)" });
                let tJid = null, type = "";
                if (args[1] === '1') { tJid = user.lover; type = 'lover'; user.lover = null; }
                if (args[1] === '2') { tJid = user.bestie; type = 'bestie'; user.bestie = null; }
                if (args[1] === '3') { tJid = user.buddy; type = 'buddy'; user.buddy = null; }
                if (tJid) {
                    const t = getUser(tJid);
                    if (type === 'lover') t.lover = null;
                    if (type === 'bestie') t.bestie = null;
                    if (type === 'buddy') t.buddy = null;
                    await saveUser(normalizedSender); await saveUser(tJid);
                    await sock.sendMessage(from, { text: "✅ Ended." });
                    await sock.sendMessage(tJid, { text: `💔 Broken up by @${user.name}`, mentions: [normalizedSender] });
                }
            }
        }

        if (user.pendingAction && /^\d{10,15}$/.test(fullText.replace(/\D/g, ''))) {
            const targetNum = fullText.replace(/\D/g, '');
            const targetJid = targetNum + "@s.whatsapp.net";
            if (targetJid === normalizedSender) return sock.sendMessage(from, { text: "❌ Cannot choose yourself." });
            const target = getUser(targetJid, "Unknown");
            target.pendingReq = { from: normalizedSender, type: user.pendingAction };
            user.pendingAction = null; 
            await saveUser(normalizedSender); await saveUser(targetJid);
            await sock.sendMessage(from, { text: "✅ Request Sent!" });
            await sock.sendMessage(targetJid, { text: `💌 *REQUEST*\n\n@${user.name} wants to connect.\nReply */accept* or */decline*`, mentions: [normalizedSender] });
        }
    });
}
keepAlive();
startBot();
process.on('uncaughtException', (err) => console.error(err));
process.on('unhandledRejection', (err) => console.error(err));
