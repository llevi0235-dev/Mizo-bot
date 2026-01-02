module.exports = {
    // --- ADMIN & BOT ---
    adminNumber: "919233137736@s.whatsapp.net", // YOUR NUMBER
    botNumber: "919233137736", 

    // --- FIREBASE KEYS (Paste yours here) ---
    firebaseConfig: {
        apiKey: "AIzaSyAtbA4OsuRr5qmVSwbIo-M03uCGJ-wbxCM",
        authDomain: "j-bo-a567a.firebaseapp.com",
        databaseURL: "https://j-bo-a567a-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "j-bo-a567a",
        storageBucket: "j-bo-a567a.firebasestorage.app",
        messagingSenderId: "1029278826614",
        appId: "1:1029278826614:web:b608af7356752ff2e9df57"
    },

    // --- GAME ECONOMY RULES ---
    startingCash: 10000,
    
    // Income Rates
    citizenIncome: 400,
    citizenIncomeTime: 30, // Minutes
    thiefIncome: 50,
    thiefIncomeTime: 20, // Minutes
    policeIncome: 450,
    policeIncomeTime: 30, // Minutes
    businessmanIncome: 1000,
    businessmanIncomeTime: 30, // Minutes

    // Roles & Costs
    citizenSignupBonus: 10000,
    businessmanSignupBonus: 500000,
    
    costScanTarget: 200,
    costScanPolice: 100,
    costRob: 100,
    costPoliceScan: 200,
    costArrest: 50,

    // Probabilities
    investmentSuccessRate: 0.40, // 40% win
    investmentFailRate: 0.60,   // 60% loss
    
    // Limits
    maxRoleChanges: 2,
    roleChangeCooldown: 2 * 24 * 60 * 60 * 1000, // 2 Days in milliseconds
    thiefJailTime: 5 * 60 * 1000, // 5 Minutes
    robberyCooldown: 30 * 60 * 1000 // 30 Minutes
};
