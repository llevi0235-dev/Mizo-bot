const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ref, get, set } = require('firebase/database');
const db = require('./database');
const Config = require('./config');
const CitizenLogic = require('./citizen_logic');

module.exports = {
    async setup(client) {
        const channel = await client.channels.fetch(Config.CHANNELS.IMMIGRATION);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle('🏙️ Welcome to Sector 7')
            .setDescription('To participate in the city economy and start your journey, you must first register for a Citizen ID Card.')
            .setColor(0x0099FF)
            .setFooter({ text: 'Sector 7 Immigration Department' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('GET ID CARD')
                .setEmoji('🪪')
                .setStyle(ButtonStyle.Primary)
        );

        const messages = await channel.messages.fetch({ limit: 5 });
        if (!messages.find(m => m.author.id === client.user.id)) {
            await channel.send({ embeds: [embed], components: [row] });
        }
    },

    async handleRegistration(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // 1. Check if user exists directly in Firebase
        const snapshot = await get(ref(db, `users/${interaction.user.id}`));
        if (snapshot.exists()) {
            return interaction.editReply("❌ **Error:** You are already registered in the city records.");
        }

        // 2. Generate the 6-digit ID using CitizenLogic
        const newId = CitizenLogic.generateID(); 

        // 3. Create the profile structure directly
        const newUserData = {
            id: newId,
            username: interaction.user.username,
            role: 'citizen',
            cash: 5000, // Starting money
            arrests: 0,
            jailTime: null,
            joinedAt: Date.now()
        };

        // 4. Save to Firebase
        await set(ref(db, `users/${interaction.user.id}`), newUserData);

        // 5. Mask the ID for the display (e.g., citizen-123456)
        const maskedID = `citizen-${newId}`;
        
        return interaction.editReply(`✅ **Success!** Your Citizen ID has been issued: **${maskedID}**\nWelcome to Sector 7.`);
    }
};
