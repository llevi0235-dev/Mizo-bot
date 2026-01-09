require('dotenv').config();

module.exports = {
    // --- SECRETS ---
    DISCORD_TOKEN: process.env.DISCORD_TOKEN, 
    ADMIN_ID: process.env.ADMIN_ID || "1373539575829368963", 

    // 👇 ADDED THIS (Required for Promotions)
    GUILD_ID: '1450121159722008588', 
    
    // --- FIREBASE CONFIG ---
    firebaseConfig: {
        apiKey: process.env.FB_API_KEY,
        authDomain: process.env.FB_AUTH_DOMAIN || "j-bo-a567a.firebaseapp.com",
        databaseURL: process.env.FB_DB_URL || "https://j-bo-a567a-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: process.env.FB_PROJECT_ID || "j-bo-a567a",
        storageBucket: process.env.FB_STORAGE_BUCKET || "j-bo-a567a.firebasestorage.app",
        messagingSenderId: process.env.FB_SENDER_ID || "1029278826614",
        appId: process.env.FB_APP_ID || "1:1029278826614:web:b608af7356752ff2e9df57"
    },

    // --- CHANNEL IDS ---
    CHANNELS: {
        IMMIGRATION_CATEGORY: '1458861484632182879', 
        GET_ID_CARD: '1458862119532364013',
        
        // Leaderboards
        LEADERBOARD_MAIN: '1458852649544843274',
        TOP_OFFICERS: '1458851589686300736',
        LOOT_LEADERBOARD: '1458853409179304046',
        TOP_INVESTORS: '1458853822314053724',
        
        // Logs
        CRIME_FEEDS: '1458855691271012480',
        ROBBER_FEED: '1459253361827119154',
        POLICE_PROMOTIONS: '1459267929802805329',
        SECTOR7_NEWS: '1459271957336817854',
        
        // Changed name from POLICE_RECORDS to RECORD_ROOM to match your index.js code
        RECORD_ROOM: '1458856052656443484', 
        
        PRISON_JAIL: '1458858485750960233',
        PRISON_RECORDS: '1458856403308646461',
        BUSINESS_INVEST_STATUS: '1458856807845072989',
        BUSINESS_INVEST_RECORD: '1458888748052775085'
    }
};
