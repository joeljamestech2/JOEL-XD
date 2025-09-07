/**
 * Joel XMD WhatsApp Bot
 * Author: LORD_JOEL
 */

const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, useSingleFileAuthState, makeInMemoryStore, delay } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const { SESSION_ID, BOT_NAME, OWNER_NUMBER, PREFIX, AUTO_TYPING, AUTO_RECORDING, ALWAYS_ONLINE, MENU_IMAGE_URL, AUTO_STATUS_MSG } = require('./config.js');
const Mega = require('megajs');

const store = makeInMemoryStore({ logger: P().child({ level: 'silent', stream: 'store' }) });

function parseSessionId(sessionId) {
    if(!sessionId.startsWith(`${BOT_NAME}~`)) throw new Error('Invalid session ID format!');
    const base64Data = sessionId.split('~')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    return JSON.parse(buffer.toString());
}

async function startBot() {
    try {
        const { version } = await fetchLatestBaileysVersion();
        const auth = parseSessionId(SESSION_ID);

        const sock = makeWASocket({
            logger: P({ level: 'silent' }),
            auth,
            printQRInTerminal: true,
            browser: [BOT_NAME, 'Chrome', '1.0.0'],
            version
        });

        store.bind(sock.ev);

        // Auto presence
        sock.ev.on('presence.update', async (update) => {
            if(ALWAYS_ONLINE === 'true') {
                await sock.sendPresenceUpdate('available');
            }
        });

        if(AUTO_TYPING === 'true') sock.sendPresenceUpdate('composing');
        if(AUTO_RECORDING === 'true') sock.sendPresenceUpdate('recording');

        // Connection events
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if(connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log('Disconnected. Reason:', reason);
                startBot();
            } else if(connection === 'open') {
                console.log(`${BOT_NAME} connected successfully!`);

                // Send startup message
                await sock.sendMessage(OWNER_NUMBER + '@s.whatsapp.net', {
                    text: `${BOT_NAME} is connected successfully! Enjoy.`
                });
            }
        });

        // Message handler
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            const msg = messages[0];
            if(!msg.message || msg.key.fromMe) return;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const from = msg.key.remoteJid;

            // Commands
            if(text.startsWith(PREFIX)) {
                const cmd = text.slice(PREFIX.length).trim().split(/ +/).shift().toLowerCase();

                if(cmd === 'ping') {
                    await sock.sendMessage(from, { text: `🏓 Pong!` });
                } else if(cmd === 'alive') {
                    await sock.sendMessage(from, { text: `${BOT_NAME} is alive!\n${AUTO_STATUS_MSG}` });
                } else if(cmd === 'menu') {
                    await sock.sendMessage(from, { image: { url: MENU_IMAGE_URL }, caption: `*${BOT_NAME} Menu*\n\n- ping\n- alive\n- menu\n- auto typing\n- auto recording\n- always online\n- wapresence` });
                } else if(cmd === 'wapresence') {
                    await sock.sendMessage(from, { text: `Auto Presence Status:` +
                        `\n- Auto Typing: ${AUTO_TYPING}` +
                        `\n- Auto Recording: ${AUTO_RECORDING}` +
                        `\n- Always Online: ${ALWAYS_ONLINE}` });
                }
            }
        });

        // MegaJS example
        // const file = Mega.File({ url: 'https://mega.nz/file/...yourfile...' });
        // await file.loadAttributes();
        // console.log(file.name, file.size);

    } catch(err) {
        console.log('Error in startBot:', err);
        setTimeout(startBot, 5000);
    }
}

startBot();
