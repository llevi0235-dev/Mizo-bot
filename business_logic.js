module.exports = {
    // Process the investment math
    processInvestment(amount) {
        const winChance = 0.60; // 60% chance to win
        const success = Math.random() < winChance;
        
        if (success) {
            // Return between 20% and 50% profit
            const profitMultiplier = 0.2 + (Math.random() * 0.3);
            return { success: true, change: Math.floor(amount * profitMultiplier) };
        } else {
            // Lose between 10% and 30% of investment
            const lossMultiplier = 0.1 + (Math.random() * 0.2);
            return { success: false, change: -Math.floor(amount * lossMultiplier) };
        }
    },

    getSalary() {
        return 1000; 
    }
};
