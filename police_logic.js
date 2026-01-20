const Config = require('./config');

module.exports = {
    // Determine rank based on number of arrests (cases)
    getRankInfo(cases = 0) {
        let currentRank = Config.POLICE_RANKS[0];
        for (const rank of Config.POLICE_RANKS) {
            if (cases >= rank.min) {
                currentRank = rank;
            }
        }
        return currentRank;
    },

    // Calculate how much reward they get for a successful arrest
    calculateArrestReward() {
        return 500; // Flat $500 reward
    }
};
