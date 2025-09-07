const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, delay, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const fs = require('fs');
const Mega = require('megajs');
const config = require('./config');

// Utility: convert string to boolean
const toBool = (val) => val === 'true';

// Random emoji reaction
const randomEmoji = () => {
    if (!config.CUSTOM_REACT || !config.CUSTOM_REACT_EMOJIS) return '❤️';
    const emojis = config.CUSTOM_REACT_EMOJIS.split(',');
    return emojis[Math.floor(Math.random() * emojis.length)];
};

async function startBot() {
    // Download session from Mega if not exists
    if (!fs.existsSync('auth_info.json')) {
        console.log('Downloading auth_info.json from Mega...');
        const file = new Mega.File({ fileId: 'YOUR_MEGA_FILE_ID', key: 'YOUR_MEGA_FILE_KEY' });

        await file.download().then(stream => {
            let data = '';
            stream.on('data', chunk => data += chunk.toString());
            stream.on('end', () => {
                fs.writeFileSync('auth_info.json', data);
                console.log('Session loaded from Mega!');
            });
        });
    }

    // Load auth state
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info.json');
    const { version } = await fetchLatestBaileysVersion();

    // Create socket
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        browser: ['Joel XMD', 'Chrome', '1.0']
    });

    sock.ev.on('creds.update', saveCreds);

    // Connection update
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = (lastDisconnect.error)?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
            else console.log('Logged out. Re-scan QR.');
        } else if (connection === 'open') {
            console.log('Joel XMD connected successfully!');
            // Notify owner
            if (config.OWNER_NUMBER) {
                sock.sendMessage(config.OWNER_NUMBER + '@s.whatsapp.net', { 
                    text: 'Joel XMD is connected successfully, enjoy!' 
                });
            }
        }
    });

    // Auto presence & status
    setInterval(async () => {
        if (toBool(config.ALWAYS_ONLINE)) await sock.sendPresenceUpdate('available');
        if (toBool(config.AUTO_TYPING)) await sock.sendPresenceUpdate('composing');
        if (toBool(config.AUTO_RECORDING)) await sock.sendPresenceUpdate('recording');
    }, 15000);

    // Listen messages
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        const prefix = config.PREFIX || '.';
        const cmd = text.startsWith(prefix) ? text.slice(prefix.length).trim().split(' ')[0].toLowerCase() : null;

        // Commands
        switch(cmd) {
            case 'ping':
                await sock.sendMessage(jid, { text: 'Pong! Joel XMD is active ✅' });
                break;
            case 'alive':
                await sock.sendMessage(jid, { text: `💡 *${config.BOT_NAME}* is online!\nOwner: ${config.OWNER_NAME}` });
                break;
            case 'menu':
                await sock.sendMessage(jid, { 
                    text: `📜 *Joel XMD Menu*\nCommands:\n- .ping\n- .alive\n- .menu\n- .autotyping\n- .autorecording\n- .alwaysonline\n- .wapresence\n\nFeatures:\n- Auto Typing: ${config.AUTO_TYPING}\n- Auto Recording: ${config.AUTO_RECORDING}\n- Always Online: ${config.ALWAYS_ONLINE}\n- Auto Status Seen: ${config.AUTO_STATUS_SEEN}\n- Auto Status React: ${config.AUTO_STATUS_REACT}\n- Auto Status Reply: ${config.AUTO_STATUS_REPLY}` 
                });
                break;
            case 'autotyping':
                await sock.sendMessage(jid, { text: `Auto typing is ${config.AUTO_TYPING}` });
                break;
            case 'autorecording':
                await sock.sendMessage(jid, { text: `Auto recording is ${config.AUTO_RECORDING}` });
                break;
            case 'alwaysonline':
                await sock.sendMessage(jid, { text: `Always online is ${config.ALWAYS_ONLINE}` });
                break;
            case 'wapresence':
                await sock.sendMessage(jid, { 
                    text: `📊 Presence status:\nTyping: ${config.AUTO_TYPING}\nRecording: ${config.AUTO_RECORDING}\nOnline: ${config.ALWAYS_ONLINE}` 
                });
                break;
            default:
                break;
        }

        // Auto-status features
        if (toBool(config.AUTO_STATUS_SEEN)) sock.readMessages([msg.key]);
        if (toBool(config.AUTO_STATUS_REACT)) sock.sendMessage(jid, { react: { text: randomEmoji(), key: msg.key } });
        if (toBool(config.AUTO_STATUS_REPLY)) sock.sendMessage(jid, { text: config.AUTO_STATUS_MSG });

        // Auto-sticker reply
        if (toBool(config.AUTO_STICKER) && msg.message.conversation) {
            await sock.sendMessage(jid, { sticker: { url: 'https://i.ibb.co/YourSticker.webp' } });
        }

        // Auto-voice reply
        if (toBool(config.AUTO_VOICE) && msg.message.conversation) {
            await sock.sendMessage(jid, { audio: { url: 'https://i.ibb.co/YourAudio.mp3' }, mimetype: 'audio/mpeg' });
        }

        // Anti-link
        if (toBool(config.ANTI_LINK) && text.includes('https://chat.whatsapp.com/')) {
            await sock.sendMessage(jid, { text: '⚠️ Group links are not allowed!' });
        }

        // Mention reply
        if (toBool(config.MENTION_REPLY) && msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(sock.user.id)) {
            await sock.sendMessage(jid, { text: `You mentioned me! 👋` });
        }

        // Anti-bad word (example)
        if (toBool(config.ANTI_BAD)) {
            const badWords = ['badword1','badword2'];
            if (badWords.some(w => text.toLowerCase().includes(w))) {
                await sock.sendMessage(jid, { text: '⚠️ Please avoid bad words!' });
            }
        }

        // Anti-delete
        if (toBool(config.ANTI_DELETE)) {
            sock.ev.on('messages.delete', async (msgDel) => {
                const deletedMsg = msgDel.keys[0];
                if (deletedMsg.remoteJid === jid) {
                    await sock.sendMessage(jid, { text: `⚠️ Message deleted: ${deletedMsg.id}` });
                }
            });
        }

        // Auto-react to every message
        if (toBool(config.AUTO_REACT)) sock.sendMessage(jid, { react: { text: randomEmoji(), key: msg.key } });
    });

    // Admin events
    sock.ev.on('group-participants.update', async (update) => {
        if (!toBool(config.ADMIN_EVENTS)) return;
        const { participants, action, jid } = update;
        for (let user of participants) {
            if (action === 'add') await sock.sendMessage(jid, { text: `Welcome @${user.split('@')[0]}! 🎉` });
            else if (action === 'remove') await sock.sendMessage(jid, { text: `Goodbye @${user.split('@')[0]}! 👋` });
        }
    });
}

startBot();