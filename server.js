import { default: makeWASocket, DisconnectReason, useSingleFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore, delay, getMessageTimestamp } from "@whiskeysockets/baileys";
import P from "pino";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load session
const SESSION_FILE = './session.json'; // fallback if SESSION_ID not set
let sessionId = process.env.SESSION_ID || 'JOEL-XMD~your_session_here';

// In-memory store for chats and messages
const store = makeInMemoryStore({ logger: P({ level: 'silent' }) });

// Owner number
const OWNER = process.env.OWNER_NUMBER || 'YOUR_NUMBER_WITH_COUNTRY_CODE';

async function startBot() {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA version v${version.join('.')}, latest: ${isLatest}`);

    const { state, saveState } = useSingleFileAuthState(SESSION_FILE);

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        defaultQueryTimeoutMs: 60000
    });

    store.bind(sock.ev);

    // Save session updates
    sock.ev.on('creds.update', saveState);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log('Connection closed:', lastDisconnect?.error?.output?.payload || reason);
            if (reason !== DisconnectReason.loggedOut) {
                startBot(); // reconnect
            }
        } else if (connection === 'open') {
            console.log('✅ Joel XMD Connected Successfully!');
            sock.sendMessage(OWNER + '@s.whatsapp.net', { text: 'Joel XMD is connected successfully. Enjoy!' });
        }
    });

    // Listen for messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (!messageContent) return;

        const sender = msg.key.remoteJid;

        // Commands
        if (messageContent.startsWith('.ping')) {
            await sock.sendMessage(sender, { text: 'Pong 🏓' });
        }

        if (messageContent.startsWith('.alive')) {
            await sock.sendMessage(sender, { text: 'Joel XMD Bot is alive ⚡' });
        }

        if (messageContent.startsWith('.menu')) {
            await sock.sendMessage(sender, { text: '📝 Joel XMD Commands:\n.ping\n.alive\n.menu' });
        }

        // Auto presence features
        if (process.env.ALWAYS_ONLINE === 'true') {
            await sock.presenceSubscribe(sender);
        }

        if (process.env.AUTO_TYPING === 'true') {
            await sock.sendPresenceUpdate('composing', sender);
            await delay(2000);
            await sock.sendPresenceUpdate('paused', sender);
        }

        if (process.env.AUTO_RECORDING === 'true') {
            await sock.sendPresenceUpdate('recording', sender);
            await delay(2000);
            await sock.sendPresenceUpdate('paused', sender);
        }
    });
}

startBot();