// Test script untuk preview Booster Embed Message
const { EmbedBuilder } = require('discord.js');

// Dummy member object untuk testing
const mockMember = {
    user: {
        username: 'TestUser',
        displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png'
    },
    toString: () => '<@123456789>'
};

// Dummy boostCount
const boostCount = 5;

// Create embed seperti di bot.js
const boostEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🚀 Hi, ' + mockMember + '! Thanks for the boost.')
    .setDescription(`Enjoy your special perks ⭐\n\nClaim your Custom Role at 🎪 · custom-role`)
    .setThumbnail(mockMember.user.displayAvatarURL())
    .setTimestamp()
    .setFooter({ text: `We currently have ${boostCount} boosts` });

// Display embed data
console.log('\n');
console.log('═══════════════════════════════════════════════════════════');
console.log('             📋 PREVIEW BOOSTER MESSAGE EMBED');
console.log('═══════════════════════════════════════════════════════════');
console.log('\n');
console.log('📌 Embed Data:');
console.log(JSON.stringify(boostEmbed.toJSON(), null, 2));
console.log('\n');
console.log('═══════════════════════════════════════════════════════════');
console.log('             ✅ Embed siap untuk dikirim ke Discord');
console.log('═══════════════════════════════════════════════════════════');
console.log('\n');

// Alternative dengan custom emoji (jika ada ID yang valid)
console.log('\n\n');
console.log('═══════════════════════════════════════════════════════════');
console.log('    PREVIEW DENGAN CUSTOM EMOJI (Jika ingin diupdate)');
console.log('═══════════════════════════════════════════════════════════');
console.log('\n');

const boostEmbedCustom = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('<:FAM_Bosster2:1470223709154574427> Hi, ' + mockMember + '! Thanks for the boost.')
    .setDescription(`Enjoy your special perks <:FAM_Booster:1470223346741416043>\n\nClaim your Custom Role at 🎪 · custom-role`)
    .setThumbnail(mockMember.user.displayAvatarURL())
    .setTimestamp()
    .setFooter({ text: `We currently have ${boostCount} boosts` });

console.log('📌 Embed Data dengan Custom Emoji:');
console.log(JSON.stringify(boostEmbedCustom.toJSON(), null, 2));
console.log('\n');
console.log('═══════════════════════════════════════════════════════════');
console.log('\n');

console.log('💡 TIP: Custom emojis akan muncul jika:');
console.log('   1. Bot memiliki akses ke emoji di server');
console.log('   2. Emoji ID valid dan masih tersimpan di Discord');
console.log('   3. Format emoji benar: <:emoji_name:emoji_id>');
console.log('\n');
