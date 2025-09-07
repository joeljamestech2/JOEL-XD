import 'dotenv/config';

export default {
    SESSION_ID: process.env.SESSION_ID || 'JOEL-XMD~Z6gSFLrT#x8BQLYPFSkkjE-PK3XwJZmdBlHCHcoHSNp7t8j0pZ1s',
    BOT_OWNER_NUMBER: process.env.BOT_OWNER_NUMBER || '255781144539',
    BOT_PREFIX: process.env.BOT_PREFIX || '.',
    ALWAYS_ONLINE: process.env.ALWAYS_ONLINE || 'false',
    AUTO_RECORDING: process.env.AUTO_RECORDING || 'false',
    AUTO_TYPING: process.env.AUTO_TYPING || 'false',
    AUTO_STATUS_REACT: process.env.AUTO_STATUS_REACT || 'true',
    AUTO_STATUS_REPLY: process.env.AUTO_STATUS_REPLY || 'false',
    AUTO_STATUS_MSG: process.env.AUTO_STATUS_MSG || '*Joel XMD viewed your status!*'
};