const { EmbedBuilder } = require('discord.js');
const Config = require('./config');

module.exports = async (client) => {
    try {
        // 🔧 FIX: FETCH channel instead of cache
        const channel = await client.channels.fetch(
            Config.CHANNELS.ANNOUNCEMENTS
        );

        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle('🟦 Sector 7 City Systems Update')
            .setDescription(`
**Version v1.0.0**

━━━━━━━━━━━━━━━━━━
💸 **CITY ECONOMY SYSTEM**
━━━━━━━━━━━━━━━━━━
• Police now receive rank-based pay automatically  
• Citizens receive routine city income  
• Businessmen receive Sector 7 support funds  
• Robbers receive underworld payouts  
• All payments are delivered via DM reminders  
• Prisoners do not receive income while jailed  

━━━━━━━━━━━━━━━━━━
🆔 **IDENTITY & SECURITY UPDATE**
━━━━━━━━━━━━━━━━━━
• Citizens now operate with a 3-digit Citizen ID  
• Robbers now use 3-digit secret IDs  
• Robber IDs are reset after jail release  
• Identity masking has been improved city-wide  

━━━━━━━━━━━━━━━━━━
🏆 **LEADERBOARD IMPROVEMENTS**
━━━━━━━━━━━━━━━━━━
• Refresh buttons added to ALL leaderboards  
• Leaderboards now show real-time data on refresh  
• Rankings reflect the current city state  

━━━━━━━━━━━━━━━━━━
📌 **SYSTEM NOTES**
━━━━━━━━━━━━━━━━━━
• All player data is saved automatically  
• No action required from players  
• Changes are live immediately  

━━━━━━━━━━━━━━━━━━
🔔 *More updates coming soon…*
            `)
            .setColor(0x2F80ED)
            .setFooter({ text: 'Sector 7 • City Systems Division' })
            .setTimestamp();

        await channel.send({ embeds: [embed] });

    } catch (err) {
        console.error('❌ Update post failed:', err);
    }
};