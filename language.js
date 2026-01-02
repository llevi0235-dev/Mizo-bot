const translations = {
    // --- GENERAL ---
    welcome: {
        en: "Welcome! You are now a Citizen. Cash: 10,000",
        mz: "Lo leng rawh! Citizen i ni ta. Pawisa: 10,000"
    },
    not_enough_cash: {
        en: "You don't have enough cash!",
        mz: "Pawisa i nei tawk lo!"
    },
    cooldown_active: {
        en: "You must wait before doing this again.",
        mz: "I nghah rih a ngai."
    },
    
    // --- ROLES ---
    role_changed: {
        en: "Role changed successfully to:",
        mz: "Nihna thlak a ni ta:"
    },
    role_limit_reached: {
        en: "You have changed roles too many times. Wait 2 days.",
        mz: "Nihna i thlak ngun lutuk. Ni 2 nghak rawh."
    },

    // --- THIEF ACTIONS ---
    target_scan_header: {
        en: "--- TARGET SCAN ---",
        mz: "--- MI ZAWNNA ---"
    },
    rob_success: {
        en: "Robbery Successful! You stole:",
        mz: "Rawk a hlawhtling! I ruk zat:"
    },
    rob_failed_close: {
        en: "Wrong ID but close! You got 2%",
        mz: "ID diklo mahse a hnai! 2% i hmu"
    },
    rob_failed_far: {
        en: "Wrong ID! You got 1%",
        mz: "ID diklo! 1% i hmu"
    },
    thief_caught: {
        en: "YOU ARE CAUGHT! Going to Jail for 5 mins.",
        mz: "MAN I NI! Jail-ah minute 5 i tang ang."
    },

    // --- POLICE ACTIONS ---
    scan_result: {
        en: "Thief Found:",
        mz: "Rukru Hmuh:"
    },
    arrest_success: {
        en: "Arrest Successful! Thief lost 80%. Reward:",
        mz: "Man a hlawhtling! Rukru in 80% a hloh. Lawmman:"
    },
    arrest_failed: {
        en: "Wrong ID! The thief escaped.",
        mz: "ID diklo! Rukru a tlanbo."
    },

    // --- BUSINESSMAN ---
    invest_start: {
        en: "Investment started. Wait 30 mins.",
        mz: "Sum dawnna tan a ni. Minute 30 nghak rawh."
    },
    loan_request_sent: {
        en: "Loan request sent to Admin.",
        mz: "Loan dilna Admin hnenah thawn a ni."
    },

    // --- ADMIN ---
    banned: {
        en: "You have been BANNED from the game.",
        mz: "Game atang hian BAN i ni."
    }
};

module.exports = (key, lang = 'both') => {
    const t = translations[key];
    if (!t) return "Missing Translation";
    if (lang === 'en') return `🇬🇧 ${t.en}`;
    if (lang === 'mz') return `🇲🇿 ${t.mz}`;
    return `🇬🇧 ${t.en}\n---------------\n🇲🇿 ${t.mz}`;
};
