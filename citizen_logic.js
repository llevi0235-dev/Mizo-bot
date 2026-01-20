module.exports = {
    // Generate a 6-digit Citizen ID (100000 - 999999)
    generateCitizenID() {
        return Math.floor(100000 + Math.random() * 900000);
    },

    // Standard starting cash for new arrivals
    getStartingCash() {
        return 500;
    },

    // Routine city income for basic citizens
    getBasicWages() {
        return 300;
    }
};
