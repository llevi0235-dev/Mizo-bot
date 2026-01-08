require('dotenv').config();

module.exports = {
    // --- SECRETS ---
    // If you are using a .env file, keep these as process.env.
    // If you are not using .env, paste your actual strings inside the quotes.
    DISCORD_TOKEN: process.env.DISCORD_TOKEN, 
    ADMIN_ID: "1373539575829368963",
    
    // --- FIREBASE CONFIG ---
    firebaseConfig: {
        apiKey: process.env.FB_API_KEY,
        authDomain: "j-bo-a567a.firebaseapp.com",
        databaseURL: "https://j-bo-a567a-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "j-bo-a567a",
        storageBucket: "j-bo-a567a.firebasestorage.app",
        messagingSenderId: "1029278826614",
        appId: "1:1029278826614:web:b608af7356752ff2e9df57"
    },

    // --- CHANNEL IDS ---
    CHANNELS: {
        // Immigration (New Ticket System)
        IMMIGRATION_CATEGORY: '1458861484632182879', 
        GET_ID_CARD: '1458862119532364013',

        // Leaderboards
        LEADERBOARD_MAIN: '1458852649544843274', // Shows Top Officers AND Richest
        TOP_OFFICERS: '1458851589686300736',
        LOOT_LEADERBOARD: '1458853409179304046',
        TOP_INVESTORS: '1458853822314053724',

        // Game Channels
        CRIME_FEEDS: '1458855691271012480',
        POLICE_RECORDS: '1458856052656443484',
        PRISON_JAIL: '1458858485750960233',
        PRISON_RECORDS: '1458856403308646461',
        BUSINESS_INVEST_STATUS: '1458856807845072989',
        BUSINESS_INVEST_RECORD: '1458888748052775085'
    }
};
