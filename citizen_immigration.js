const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UM = require('./userManager');
const Config = require('./config');
const CitizenLogic = require('./citizen_logic');

module.exports = {
    // The setup for the immigration channel message
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

        // Fetch and check for existing message to avoid spamming
        const messages = await channel.messages.fetch({ limit: 5 });
        if (!messages.find(m => m.author.id === client.user.id)) {
            await channel.send({ embeds: [embed], components: [row] });
        }
    },

    // The logic that runs when the button is clicked
    async handleRegistration(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const existingUser = await UM.getUser(interaction.user.id);
        if (existingUser) {
            return interaction.editReply("❌ **Error:** You are already registered in the city records.");
        }

        // Create the new citizen profile
        const newCitizen = await UM.createUser(
            interaction.user.id, 
            interaction.user.username, 
            'citizen'
        );

        const maskedID = UM.maskID(newCitizen.special_id, 'citizen');
        
        return interaction.editReply(`✅ **Success!** Your Citizen ID has been issued: **${maskedID}**\nWelcome to Sector 7.`);
    }
};
