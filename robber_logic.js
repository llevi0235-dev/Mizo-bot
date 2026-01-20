module.exports = {
    // Calculate the take (15% of victim's cash)
    calculateStealAmount(targetCash) {
        return Math.floor(targetCash * 0.15);
    },

    // Check if the robbery is worth the risk
    isWorthIt(targetCash) {
        return targetCash >= 100;
    },

    // Generate the 3-digit Robber ID (100-999)
    generateRobberID() {
        return Math.floor(100 + Math.random() * 900);
    }
};
