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

// --- 1. CLOUDINARY CONFIG (PHOTOS) ---
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
let userSteps = {}; // Tracks if user is uploading photo or sending number

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
            photo: null,
            likes: 0,
            likedBy: [],
            lover: null,
            bestie: null,
            buddy: null,
            since: null,
            pendingReq: null // { from: jid, type: 'lover'|'bestie'|'buddy' }
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
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    return `${days}d ${hours}h`;
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
        
        const type = Object.keys(msg.message)[0];
        const body = (type === 'conversation') ? msg.message.conversation : 
                     (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : 
                     (type === 'imageMessage') ? msg.message.imageMessage.caption : '';

        const pushName = msg.pushName || "User";
        const user = getUser(normalizedSender, pushName);
        
        // --- STEP 1: HANDLE STEPS (Photo Upload / Relationship Request) ---
        if (userSteps[normalizedSender]) {
            const step = userSteps[normalizedSender];
            
            // 1A. Uploading Photo
            if (step.type === 'upload_photo') {
                if (type === 'imageMessage') {
                    await sock.sendMessage(from, { text: "⏳ Uploading to Cloud..." });
                    try {
                        const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }) });
                        // Save temp file
                        const tempPath = `./temp_${Date.now()}.jpg`;
                        fs.writeFileSync(tempPath, buffer);
                        
                        // Upload to Cloudinary
                        const result = await cloudinary.uploader.upload(tempPath);
                        user.photo = result.secure_url;
                        fs.unlinkSync(tempPath); // Delete temp

                        await saveUser(normalizedSender);
                        delete userSteps[normalizedSender];
                        userSteps[normalizedSender] = { type: 'set_bio' }; // Next step
                        return sock.sendMessage(from, { text: "✅ Photo Saved! Now send your Bio/Caption." });
                    } catch (e) {
                        console.error(e);
                        return sock.sendMessage(from, { text: "❌ Upload Failed. Try again." });
                    }
                } else {
                    return sock.sendMessage(from, { text: "⚠️ Please send an Image (Photo)." });
                }
            }

            // 1B. Setting Bio
            if (step.type === 'set_bio') {
                user.bio = body || "No Bio";
                await saveUser(normalizedSender);
                delete userSteps[normalizedSender];
                return sock.sendMessage(from, { text: "✅ Profile Updated!" });
            }

            // 1C. Sending Number for Relationship
            if (step.type === 'req_number') {
                // User sends a number or text
                // Clean the number
                let targetNum = body.replace(/\D/g, ''); 
                if (!targetNum) {
                     // Maybe it's a contact card
                     if (msg.message.contactMessage) {
                         targetNum = msg.message.contactMessage.vcard.match(/waid=(\d+)/)?.[1];
                     }
                }

                if (!targetNum || targetNum.length < 10) {
                    return sock.sendMessage(from, { text: "❌ Invalid Number. Please type the phone number (e.g., 919876543210)." });
                }

                const targetJid = targetNum + "@s.whatsapp.net";
                if (targetJid === normalizedSender) return sock.sendMessage(from, { text: "❌ You cannot choose yourself!" });

                // Check if target exists
                const target = getUser(targetJid, "Unknown");
                
                // Set pending request
                target.pendingReq = { from: normalizedSender, type: step.relType };
                await saveUser(targetJid);
                delete userSteps[normalizedSender];

                // Notify Target
                const relNames = { lover: "❤️ LOVER", bestie: "💛 BESTIE", buddy: "💙 BUDDY" };
                const relName = relNames[step.relType];
                
                await sock.sendMessage(from, { text: "✅ Request Sent!" });
                try {
                    await sock.sendMessage(targetJid, { 
                        text: `💌 *NEW REQUEST*\n\n@${normalizedSender.split('@')[0]} wants to be your ${relName}.\n\nType */accept* to say Yes.\nType */decline* to say No.`,
                        mentions: [normalizedSender]
                    });
                } catch (e) {
                    await sock.sendMessage(from, { text: "⚠️ Could not DM them. Check their privacy settings." });
                }
                return;
            }
        }

        // --- STEP 2: COMMANDS ---
        if (!body.startsWith('/') && !body.startsWith('@')) return; // Ignore chatter
        const args = body.trim().split(/ +/);
        let command = args[0].toLowerCase();
        
        // Handle @user/pf style
        let mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (body.includes('/') && command.includes('@')) {
            const parts = command.split('/');
            if (parts.length > 1) command = '/' + parts[1].replace(/\d+/g, ''); 
        }

        // --- PUBLIC COMMANDS ---

        // 1. /edit (DM or Group - triggers DM flow)
        if (command === '/edit') {
            if (isGroup) {
                await sock.sendMessage(from, { text: "📩 Check your DM to edit profile." });
                await sock.sendMessage(normalizedSender, { text: "📸 *PROFILE SETUP*\n\nPlease reply with the PHOTO you want to use." });
            } else {
                await sock.sendMessage(from, { text: "📸 *PROFILE SETUP*\n\nPlease reply with the PHOTO you want to use." });
            }
            userSteps[normalizedSender] = { type: 'upload_photo' };
        }

        // 2. @user/pf or /mypf
        if (command === '/pf' || command === '/mypf') {
            const targetJid = mentionedJid || normalizedSender;
            const t = getUser(targetJid);
            
            // Build Status Text
            let relText = "";
            if (t.lover) relText += `❤️ Lover: @${t.lover.split('@')[0]} (${formatDuration(t.since)})\n`;
            else relText += `💔 Single\n`;
            if (t.bestie) relText += `💛 Bestie: @${t.bestie.split('@')[0]}\n`;
            if (t.buddy) relText += `💙 Buddy: @${t.buddy.split('@')[0]}\n`;

            const caption = `👤 *${t.name}*\n\n📝 ${t.bio}\n\n${relText}\n👍 Likes: ${t.likes}`;

            if (t.photo) {
                await sock.sendMessage(from, { 
                    image: { url: t.photo }, 
                    caption: caption,
                    mentions: [t.lover, t.bestie, t.buddy].filter(Boolean)
                });
            } else {
                await sock.sendMessage(from, { 
                    text: caption + "\n(No Photo Set)",
                    mentions: [t.lover, t.bestie, t.buddy].filter(Boolean)
                });
            }
        }

        // 3. /like @user
        if (command === '/like') {
            if (!mentionedJid) return sock.sendMessage(from, { text: "Mention someone to like! (/like @user)" });
            if (mentionedJid === normalizedSender) return sock.sendMessage(from, { text: "You cannot like yourself." });
            
            const t = getUser(mentionedJid);
            if (t.likedBy.includes(normalizedSender)) {
                return sock.sendMessage(from, { text: "❌ You already liked this profile!" });
            }
            
            t.likes++;
            t.likedBy.push(normalizedSender);
            await saveUser(mentionedJid);
            await sock.sendMessage(from, { text: `❤️ Liked @${t.name}! Total: ${t.likes}` });
        }

        // 4. /top
        if (command === '/top') {
            const sorted = Object.values(localUsers).sort((a,b) => b.likes - a.likes).slice(0, 50);
            let out = "🔥 *TOP 50 FAMOUS USERS*\n";
            sorted.forEach((u, i) => {
                out += `${i+1}. ${u.name} - ${u.likes} Likes\n`;
            });
            await sock.sendMessage(from, { text: out });
        }

        // --- RELATIONSHIP COMMANDS (DM ONLY) ---

        if (['/propose', '/invbs', '/invbd', '/accept', '/decline', '/end'].includes(command)) {
            if (isGroup) return sock.sendMessage(from, { text: "❌ This command only works in DM (Private Chat)." });
        }

        // 5. Requests (/propose, /invbs, /invbd)
        if (command === '/propose' || command === '/invbs' || command === '/invbd') {
            if (isGroup) return; // Strict Check

            // Check if already taken
            if (command === '/propose' && user.lover) return sock.sendMessage(from, { text: "❌ You are already in a relationship! Use /end first." });
            
            let type = 'lover';
            if (command === '/invbs') type = 'bestie';
            if (command === '/invbd') type = 'buddy';

            userSteps[normalizedSender] = { type: 'req_number', relType: type };
            await sock.sendMessage(from, { text: `📱 Please type the **Phone Number** of the person you want to invite (e.g. 919233137736).\n\nOr use the attachment button to share their Contact.` });
        }

        // 6. /accept
        if (command === '/accept') {
            if (isGroup) return;
            if (!user.pendingReq) return sock.sendMessage(from, { text: "❌ No pending requests." });
            
            const requesterJid = user.pendingReq.from;
            const type = user.pendingReq.type;
            const requester = getUser(requesterJid);

            // Double check availability
            if (type === 'lover' && (user.lover || requester.lover)) {
                user.pendingReq = null;
                await saveUser(normalizedSender);
                return sock.sendMessage(from, { text: "❌ One of you is already taken! Request cancelled." });
            }

            // Link them
            const now = Date.now();
            if (type === 'lover') {
                user.lover = requesterJid; user.since = now;
                requester.lover = normalizedSender; requester.since = now;
            } else if (type === 'bestie') {
                user.bestie = requesterJid;
                requester.bestie = normalizedSender;
            } else if (type === 'buddy') {
                user.buddy = requesterJid;
                requester.buddy = normalizedSender;
            }

            user.pendingReq = null;
            await saveUser(normalizedSender);
            await saveUser(requesterJid);

            await sock.sendMessage(from, { text: "✅ You accepted the request!" });
            await sock.sendMessage(requesterJid, { text: `✅ @${user.name} accepted your request! You are now connected.`, mentions: [normalizedSender] });
        }

        // 7. /decline
        if (command === '/decline') {
            if (isGroup) return;
            if (!user.pendingReq) return sock.sendMessage(from, { text: "❌ No pending requests." });
            
            const reqJid = user.pendingReq.from;
            user.pendingReq = null;
            await saveUser(normalizedSender);
            
            await sock.sendMessage(from, { text: "❌ Request Declined." });
            await sock.sendMessage(reqJid, { text: `❌ @${user.name} declined your request.`, mentions: [normalizedSender] });
        }

        // 8. /end (Breakup)
        if (command === '/end') {
            if (isGroup) return;
            
            // If user typed "/end 1"
            const choice = args[1];
            
            if (!choice) {
                let menu = "💔 *BREAKUP MENU*\n\nWho do you want to remove?\n";
                if (user.lover) menu += "Type */end 1* for Lover\n";
                if (user.bestie) menu += "Type */end 2* for Bestie\n";
                if (user.buddy) menu += "Type */end 3* for Buddy\n";
                if (menu === "💔 *BREAKUP MENU*\n\nWho do you want to remove?\n") menu = "You have no relationships to end.";
                return sock.sendMessage(from, { text: menu });
            }

            let targetJid = null;
            let type = "";

            if (choice === '1' && user.lover) { targetJid = user.lover; type = "lover"; user.lover = null; user.since = null; }
            else if (choice === '2' && user.bestie) { targetJid = user.bestie; type = "bestie"; user.bestie = null; }
            else if (choice === '3' && user.buddy) { targetJid = user.buddy; type = "buddy"; user.buddy = null; }
            else return sock.sendMessage(from, { text: "❌ Invalid choice." });

            if (targetJid) {
                const t = getUser(targetJid);
                if (type === "lover") { t.lover = null; t.since = null; }
                if (type === "bestie") t.bestie = null;
                if (type === "buddy") t.buddy = null;
                
                await saveUser(normalizedSender);
                await saveUser(targetJid);
                
                await sock.sendMessage(from, { text: "✅ Relationship ended." });
                await sock.sendMessage(targetJid, { text: `💔 @${user.name} ended your relationship.`, mentions: [normalizedSender] });
            }
        }

        // 9. /menu
        if (command === '/menu') {
            const txt = "📜 *SOCIAL BOT MENU*\n\n*Public:*\n📸 /edit (Setup Profile)\n👤 /mypf (My Profile)\n🔎 @user/pf (Check Profile)\n❤️ /like @user (Give Love)\n🔥 /top (Leaderboard)\n\n*DM Only:*\n💍 /propose (Invite Lover)\n💛 /invbs (Invite Bestie)\n💙 /invbd (Invite Buddy)\n✅ /accept\n❌ /decline\n💔 /end (Breakup)";
            await sock.sendMessage(from, { text: txt });
        }
    });
}

// Start
keepAlive();
startBot();

// Anti-Crash
process.on('uncaughtException', (err) => console.error(err));
process.on('unhandledRejection', (err) => console.error(err));