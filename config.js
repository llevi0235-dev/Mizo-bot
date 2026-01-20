require('dotenv').config();

module.exports = {
    // --- SECRETS ---
    TOKEN: process.env.DISCORD_TOKEN, 
    ADMIN_ID: "1373539575829368963", 
    GUILD_ID: '1450121159722008588', 

    // --- CHANNEL IDS ---
    CHANNELS: {
        IMMIGRATION: '1458862119532364013',
        MAIN_LEADERBOARD: '1458852649537044480',
        POLICE_LEADERBOARD: '1458853049535234048',
        ROBBER_LEADERBOARD: '1458853112101404672',
        BUSINESS_LEADERBOARD: '1458853173715996672',
        PRISON_LOGS: '1458853874051387392', // Replace with your actual Jail Feed ID
        CRIME_FEED: '1458853489530343424',
        NEWS: '1458853549530343424'
    },

    // --- POLICE RANKS ---
    POLICE_RANKS: [
        { name: 'Officer', min: 0, salary: 450 },
        { name: 'Senior Officer', min: 2, salary: 550 },
        { name: 'Lead Officer', min: 5, salary: 700 },
        { name: 'Sergeant', min: 10, salary: 900 },
        { name: 'Inspector', min: 20, salary: 1200 },
        { name: 'Chief Inspector', min: 40, salary: 1600 },
        { name: 'Commander', min: 70, salary: 2200 },
        { name: 'Commissioner', min: 110, salary: 3000 }
    ],

    // --- FIREBASE ---
    firebaseConfig: {
        apiKey: process.env.FB_API_KEY,
        authDomain: "j-bo-a567a.firebaseapp.com",
        databaseURL: "https://j-bo-a567a-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "j-bo-a567a",
        storageBucket: "j-bo-a567a.firebasestorage.app",
        messagingSenderId: "1029278826614",
        appId: "1:1029278826614:web:b608af7356752ff2e9df57"
    }
};
