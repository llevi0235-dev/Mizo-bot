const keepAlive = require('./keep_alive');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, 
    jidNormalizedUser,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const admin = require("firebase-admin");
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// --- 1. CLOUDINARY CONFIG (MEDIA) ---
cloudinary.config({ 
  cloud_name: 'dma9eonrp', 
  api_key: '617177728891958', 
  api_secret: '8bCJRo8QbKRmF374p9PZn1zF3j4'
});

// --- 2. FIREBASE CONFIG (DATABASE) ---
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

// --- HELPER FUNCTIONS ---
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
            photos: [], // Array of {url, caption, type}
            likes: 0,
            likedBy: [],
            lover: null,
            bestie: null,
            buddy: null,
            since: null,
            pendingReq: null
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
        // FIX: Always use normalized sender to ensure Group vs DM data is the SAME
        const sender = isGroup ? (msg.key.participant || from) : from;
        const normalizedSender = jidNormalizedUser(sender);
        
        // --- 1. DETECT MESSAGE TYPE & CONTENT ---
        const type = Object.keys(msg.message)[0];
        let body = "";
        let caption = "";

        if (type === 'conversation') body = msg.message.conversation;
        else if (type === 'extendedTextMessage') body = msg.message.extendedTextMessage.text;
        else if (type === 'imageMessage') caption = msg.message.imageMessage.caption || "";
        else if (type === 'videoMessage') caption = msg.message.videoMessage.caption || "";

        const pushName = msg.pushName || "User";
        if (localUsers[normalizedSender]?.name !== pushName) getUser(normalizedSender, pushName);
        const user = getUser(normalizedSender, pushName);

        // --- 2. MEDIA UPLOAD LOGIC (/upload) ---
        // Checks if Image or Video has caption starting with /upload
        if ((type === 'imageMessage' || type === 'videoMessage') && caption.toLowerCase().startsWith('/upload')) {
            
            if (isGroup) return sock.sendMessage(from, { text: "❌ Uploads are DM Only! Message the bot privately." });

            const userCaption = caption.replace('/upload', '').trim() || "No Caption";
            
            // Limit Photos
            if (user.photos.length >= 5) return sock.sendMessage(from, { text: "❌ Gallery Full! Delete old ones using /del [number]." });

            await sock.sendMessage(from, { text: "⏳ Uploading..." });
            
            try {
                const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }) });
                const isVideo = type === 'videoMessage';
                const tempPath = `./temp_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
                fs.writeFileSync(tempPath, buffer);
                
                // Upload to Cloudinary (Supports Video too)
                const result = await cloudinary.uploader.upload(tempPath, { resource_type: "auto" });
                
                // Save to Gallery
                user.photos.push({
                    url: result.secure_url,
                    caption: userCaption,
                    type: isVideo ? 'video' : 'image'
                });

                fs.unlinkSync(tempPath); 
                await saveUser(normalizedSender);
                return sock.sendMessage(from, { text: `✅ Uploaded #${user.photos.length}! \nTo view: /pf\nTo delete: /del ${user.photos.length}` });
            } catch (e) {
                console.error(e);
                return sock.sendMessage(from, { text: "❌ Upload Error." });
            }
        }

        // --- 3. TEXT COMMANDS ---
        
        const fullText = body || caption; // Use caption if it was media
        if (!fullText.startsWith('/') && !fullText.startsWith('@')) return; 

        const args = fullText.trim().split(/ +/);
        let command = args[0].toLowerCase();

        // Handle @user/pf style
        let mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (fullText.includes('/') && command.includes('@')) {
            const parts = command.split('/');
            if (parts.length > 1) command = '/' + parts[1].replace(/\d+/g, ''); 
        }

        // --- COMMAND LIST ---

        // /bio [text] (DM Only)
        if (command === '/bio') {
            if (isGroup) return sock.sendMessage(from, { text: "❌ Edit Bio in DM Only." });
            const newBio = fullText.replace('/bio', '').trim();
            if (!newBio) return sock.sendMessage(from, { text: "❌ Usage: /bio I am the king" });
            
            user.bio = newBio;
            await saveUser(normalizedSender);
            await sock.sendMessage(from, { text: "✅ Bio Updated!" });
        }

        // /del [number] (DM Only)
        if (command.startsWith('/del')) {
            if (isGroup) return sock.sendMessage(from, { text: "❌ Delete in DM Only." });
            
            // Try to find number in /del#1 or /del 1
            let indexStr = fullText.replace('/del', '').replace('#', '').trim();
            let index = parseInt(indexStr);

            if (!index || index < 1 || index > user.photos.length) {
                return sock.sendMessage(from, { text: `❌ Usage: /del 1 (to delete Photo #1).\nYou have ${user.photos.length} items.` });
            }

            // Remove item (Arrays are 0-based, so minus 1)
            const deleted = user.photos.splice(index - 1, 1);
            await saveUser(normalizedSender);
            await sock.sendMessage(from, { text: `🗑️ Deleted #${index} (${deleted[0].caption})` });
        }

        // /pf or @user/pf
        if (command === '/pf' || command === '/mypf') {
            const targetJid = mentionedJid || normalizedSender;
            const t = getUser(targetJid);
            
            // Stats
            let status = "";
            if (t.lover) status += `❤️ Lover: @${t.lover.split('@')[0]} (${formatDuration(t.since)})\n`;
            else status += `💔 Single\n`;
            if (t.bestie) status += `💛 Bestie: @${t.bestie.split('@')[0]}\n`;
            if (t.buddy) status += `💙 Buddy: @${t.buddy.split('@')[0]}\n`;

            // Gallery List
            let galleryTxt = "";
            if (t.photos.length > 0) {
                galleryTxt = "\n📸 *Gallery:*\n";
                t.photos.forEach((p, i) => {
                    galleryTxt += `#${i+1} [${p.type === 'video'?'Vid':'Img'}]: ${p.caption}\n`;
                });
            } else {
                galleryTxt = "\n(No Photos Uploaded)";
            }

            const txt = `👤 *${t.name}*\n📝 ${t.bio}\n👍 Likes: ${t.likes}\n\n${status}${galleryTxt}`;

            // Send Profile Pic (Photo #1) if exists
            if (t.photos.length > 0) {
                const main = t.photos[0];
                if (main.type === 'image') {
                    await sock.sendMessage(from, { image: { url: main.url }, caption: txt, mentions: [t.lover, t.bestie, t.buddy].filter(Boolean) });
                } else if (main.type === 'video') {
                    await sock.sendMessage(from, { video: { url: main.url }, caption: txt, mentions: [t.lover, t.bestie, t.buddy].filter(Boolean) });
                }
            } else {
                await sock.sendMessage(from, { text: txt, mentions: [t.lover, t.bestie, t.buddy].filter(Boolean) });
            }
        }

        // /like @user
        if (command === '/like') {
            if (!mentionedJid) return sock.sendMessage(from, { text: "Mention someone! (/like @user)" });
            if (mentionedJid === normalizedSender) return sock.sendMessage(from, { text: "No self-likes." });
            
            const t = getUser(mentionedJid);
            if (t.likedBy.includes(normalizedSender)) return sock.sendMessage(from, { text: "Already liked!" });
            
            t.likes++;
            t.likedBy.push(normalizedSender);
            await saveUser(mentionedJid);
            await sock.sendMessage(from, { text: `❤️ Liked @${t.name}! Total: ${t.likes}` });
        }

        // /top
        if (command === '/top') {
            const sorted = Object.values(localUsers).sort((a,b) => b.likes - a.likes).slice(0, 50);
            let out = "🔥 *TOP 50*\n";
            sorted.forEach((u, i) => out += `${i+1}. ${u.name} - ${u.likes}\n`);
            await sock.sendMessage(from, { text: out });
        }

        // /help
        if (command === '/help') {
            await sock.sendMessage(from, { text: `🤖 *SOCIAL BOT COMMANDS*\n\n*DM ONLY:*\n📸 Attach Photo + Caption: */upload My Pic*\n📝 */bio I am cool* (Set Bio)\n🗑️ */del 1* (Delete Photo #1)\n💍 */propose* (Get Lover)\n💛 */invbs* (Get Bestie)\n💙 */invbd* (Get Buddy)\n✅ */accept* | ❌ */decline*\n💔 */end* (Breakup)\n\n*PUBLIC / GROUP:*\n👤 */pf* (My Profile)\n🔎 *@user/pf* (Check User)\n❤️ */like @user*\n🔥 */top*` });
        }

        // DM Relationships (Only check group restriction)
        if (['/propose', '/invbs', '/invbd', '/accept', '/decline', '/end'].includes(command)) {
            if (isGroup) return sock.sendMessage(from, { text: "❌ DM Only." });
            
            // PROPOSE/INVITE
            if (['/propose', '/invbs', '/invbd'].includes(command)) {
                if (command === '/propose' && user.lover) return sock.sendMessage(from, { text: "❌ Already taken!" });
                
                let type = command === '/propose' ? 'lover' : (command === '/invbs' ? 'bestie' : 'buddy');
                
                // We need to ask for number (using a small state just for this or simple parsing)
                // Simplified: "Please type: /req [number]" to confirm
                // But you liked the "State" for this part. 
                // Let's stick to your request: "DM the user" -> The bot needs to know WHO.
                // We will use a dedicated command: /connect [number] [type] ? 
                // OR: Just ask for number. 
                // Since we removed userSteps to stop SPAM, we need a one-shot command or a safe step.
                // SAFE STEP: Only activate step if command is explicit.
                
                user.pendingAction = type; // Safe temporary tag
                await saveUser(normalizedSender);
                await sock.sendMessage(from, { text: `📱 Please type the **Phone Number** of the person (e.g. 919876543210).` });
            }

            // ACCEPT / DECLINE
            if (command === '/accept' && user.pendingReq) {
                const req = user.pendingReq;
                const rUser = getUser(req.from);
                
                if (req.type === 'lover' && (user.lover || rUser.lover)) {
                    user.pendingReq = null; await saveUser(normalizedSender);
                    return sock.sendMessage(from, { text: "❌ Someone is already taken." });
                }

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
                const f = user.pendingReq.from;
                user.pendingReq = null; await saveUser(normalizedSender);
                await sock.sendMessage(from, { text: "❌ Declined." });
                await sock.sendMessage(f, { text: "❌ Request Declined." });
            }

            // END
            if (command === '/end') {
                if (!args[1]) return sock.sendMessage(from, { text: "💔 Usage:\n/end 1 (Lover)\n/end 2 (Bestie)\n/end 3 (Buddy)" });
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
                } else {
                    await sock.sendMessage(from, { text: "❌ Nothing to end there." });
                }
            }
        }

        // --- 4. HANDLE NUMBER INPUT FOR RELATIONSHIP ---
        // (Only if user.pendingAction exists - Safe from spam because it requires /propose first)
        if (user.pendingAction && /^\d{10,15}$/.test(body.replace(/\D/g, ''))) {
            const targetNum = body.replace(/\D/g, '');
            const targetJid = targetNum + "@s.whatsapp.net";
            if (targetJid === normalizedSender) return sock.sendMessage(from, { text: "❌ Cannot choose yourself." });
            
            const target = getUser(targetJid, "Unknown");
            target.pendingReq = { from: normalizedSender, type: user.pendingAction };
            
            const types = { lover: "❤️ LOVER", bestie: "💛 BESTIE", buddy: "💙 BUDDY" };
            const typeName = types[user.pendingAction];
            
            user.pendingAction = null; // Clear state
            await saveUser(normalizedSender);
            await saveUser(targetJid);
            
            await sock.sendMessage(from, { text: "✅ Request Sent!" });
            await sock.sendMessage(targetJid, { text: `💌 *REQUEST*\n\n@${user.name} wants to be your ${typeName}.\n\nReply */accept* or */decline*`, mentions: [normalizedSender] });
        }

    });
}

// Start
keepAlive();
startBot();

// Anti-Crash
process.on('uncaughtException', (err) => console.error(err));
process.on('unhandledRejection', (err) => console.error(err));
