const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits } = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ] 
});

const TOKEN = process.env.TOKEN

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} udah online!`);
    console.log(`🏠 Di ${client.guilds.cache.size} server`);
});

// Command untuk bikin role selection menu (Admin only)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Command !setuproles - Bikin role selection menu
    if (command === 'setuproles') {
        // Check admin permission
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Lu harus admin buat pake command ini!');
        }

        // Character Catalog Embed & Menu
        const characterEmbed = new EmbedBuilder()
            .setColor('#00D9FF')
            .setTitle('Character Catalog')
            .setDescription(`Silahkan pilih character yang sesuai dengan kamu!

😍 | **Fineshyt** 
😎 | **Sigma** 
🥺 | **Imup** 
😏 | **Narcissist**
😜 | **Mpruyy**
😆 | **Chalant**
🧐 | **Otaku**
🗣️ | **Yapper**   
🤩 | **Kalcer**  
🤓 | **Suki**
💿 | **Performative**
🥴 | **Delulu**
😒 | **Nonchalant** `)
            .setImage('https://imgur.com/LLi6XfL.png')
            .setFooter({ text: 'Mickey Mouse Trap House' })
            .setTimestamp();

        const characterMenu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('character_roles')
                    .setPlaceholder('Click menu ini untuk memilih roles!')
                    .setMinValues(0)
                    .setMaxValues(13)
                    .addOptions([
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Fineshyt')
                            .setValue('fineshyt')
                            .setEmoji('😍'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Sigma')
                            .setValue('sigma')
                            .setEmoji('😎'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Imup')
                            .setValue('imup')
                            .setEmoji('🥺'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Narcissist')
                            .setValue('narcissist')
                            .setEmoji('😏'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Mpruyy')
                            .setValue('mpruyy')
                            .setEmoji('😜'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Chalant')
                            .setValue('chalant')
                            .setEmoji('😆'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Otaku')
                            .setValue('otaku')
                            .setEmoji('🧐'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Yapper')
                            .setValue('yapper')
                            .setEmoji('🗣️'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Kalcer')
                            .setValue('kalcer')
                            .setEmoji('🤩'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Suki')
                            .setValue('suki')
                            .setEmoji('🤓'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Performative')
                            .setValue('performative')
                            .setEmoji('💿'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Delulu')
                            .setValue('delulu')
                            .setEmoji('🥴'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Nonchalant')
                            .setValue('nonchalant')
                            .setEmoji('😒'),
                    ])
            );

        await message.channel.send({ 
            embeds: [characterEmbed], 
            components: [characterMenu] 
        });

        // Gaming Roles Embed & Menu
        const gamingEmbed = new EmbedBuilder()
            .setColor('#00D9FF')
            .setTitle('Games Catalog')
            .setDescription(`Pilih game yang kamu mainkan!

🔫 | **Valorant**
⚔️ | **Mobile Legends**
🎯 | **PUBG Mobile**
⚡ | **Genshin Impact**
⛏️ | **Minecraft**
🎮 | **Roblox**
🔥 | **Free Fire**
💣 | **Call of Duty**
🎪 | **Apex Legends**
🏗️ | **Fortnite**`)
            .setImage('https://i.imgur.com/LwqQEPT.png')
            .setFooter({ text: 'Mickey Mouse Trap House' })
            .setTimestamp();

        const gamingMenu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('gaming_roles')
                    .setPlaceholder('Click menu ini untuk memilih roles!')
                    .setMinValues(0)
                    .setMaxValues(10)
                    .addOptions([
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Valorant')
                            .setValue('valorant')
                            .setEmoji('🔫'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Mobile Legends')
                            .setValue('mobile_legends')
                            .setEmoji('⚔️'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('PUBG Mobile')
                            .setValue('pubg_mobile')
                            .setEmoji('🎯'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Genshin Impact')
                            .setValue('genshin')
                            .setEmoji('⚡'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Minecraft')
                            .setValue('minecraft')
                            .setEmoji('⛏️'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Roblox')
                            .setValue('roblox')
                            .setEmoji('🎮'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Free Fire')
                            .setValue('free_fire')
                            .setEmoji('🔥'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Call of Duty Mobile')
                            .setValue('codm')
                            .setEmoji('💣'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Apex Legends')
                            .setValue('apex')
                            .setEmoji('🎪'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Fortnite')
                            .setValue('fortnite')
                            .setEmoji('🏗️'),
                    ])
            );

        await message.channel.send({ 
            embeds: [gamingEmbed], 
            components: [gamingMenu] 
        });

        // Hobbies Embed & Menu
        const hobbiesEmbed = new EmbedBuilder()
            .setColor('#00D9FF')
            .setTitle('Hobbies Catalog')
            .setDescription(`Pilih hobby kamu!

👔 | **Fashion**
🎬 | **Entertainment**
🎵 | **Music**
⚽ | **Sports**
🎨 | **Art & Design**`)
            .setImage('https://i.imgur.com/UFP0ybB.png')
            .setFooter({ text: 'Mickey Mouse Trap House' })
            .setTimestamp();

        const hobbiesMenu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('hobbies_roles')
                    .setPlaceholder('Click menu ini untuk memilih roles!')
                    .setMinValues(0)
                    .setMaxValues(5)
                    .addOptions([
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Fashion')
                            .setValue('fashion')
                            .setEmoji('👔'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Entertainment')
                            .setValue('entertainment')
                            .setEmoji('🎬'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Music')
                            .setValue('music')
                            .setEmoji('🎵'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Sports')
                            .setValue('sports')
                            .setEmoji('⚽'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Art & Design')
                            .setValue('art')
                            .setEmoji('🎨'),
                    ])
            );

        await message.channel.send({ 
            embeds: [hobbiesEmbed], 
            components: [hobbiesMenu] 
        });

        message.reply('✅ Role selection menu udah di-setup!');
    }
});

// Handle role selection
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;

    try {
        const selectedValues = interaction.values;
        const member = interaction.member;

        // Mapping role values ke role names
        const roleMapping = {
            // Character roles
            'fineshyt': 'Fineshyt',
            'sigma': 'Sigma',
            'imup': 'Imup',
            'narcissist': 'Narcissist',
            'mpruyy': 'Mpruyy',
            'chalant': 'Chalant',
            'otaku': 'Otaku',
            'yapper': 'Yapper',
            'kalcer': 'Kalcer',
            'suki': 'Suki',
            'performative': 'Performative',
            'delulu': 'Delulu',
            'nonchalant': 'Nonchalant',
            // Gaming roles
            'valorant': 'Valorant',
            'mobile_legends': 'Mobile Legends',
            'pubg_mobile': 'PUBG Mobile',
            'genshin': 'Genshin Impact',
            'minecraft': 'Minecraft',
            'roblox': 'Roblox',
            'free_fire': 'Free Fire',
            'codm': 'COD Mobile',
            'apex': 'Apex Legends',
            'fortnite': 'Fortnite',
            // Hobbies
            'fashion': 'Fashion',
            'entertainment': 'Entertainment',
            'music': 'Music',
            'sports': 'Sports',
            'art': 'Art & Design',
        };

        // Ambil semua roles yang ada di mapping sesuai menu type
        let allRolesInCategory = [];
        if (interaction.customId === 'character_roles') {
            allRolesInCategory = ['fineshyt', 'sigma', 'imup', 'narcissist', 'mpruyy', 'chalant', 'otaku', 'yapper', 'kalcer', 'suki', 'performative', 'delulu', 'nonchalant'];
        } else if (interaction.customId === 'gaming_roles') {
            allRolesInCategory = ['valorant', 'mobile_legends', 'pubg_mobile', 'genshin', 'minecraft', 'roblox', 'free_fire', 'codm', 'apex', 'fortnite'];
        } else if (interaction.customId === 'hobbies_roles') {
            allRolesInCategory = ['fashion', 'entertainment', 'music', 'sports', 'art'];
        }

        const addedRoles = [];
        const removedRoles = [];

        // Remove roles yang ga dipilih
        for (const roleValue of allRolesInCategory) {
            if (!selectedValues.includes(roleValue)) {
                const roleName = roleMapping[roleValue];
                const role = interaction.guild.roles.cache.find(r => r.name === roleName);
                if (role && member.roles.cache.has(role.id)) {
                    await member.roles.remove(role);
                    removedRoles.push(roleName);
                }
            }
        }

        // Add roles yang dipilih
        for (const value of selectedValues) {
            const roleName = roleMapping[value];
            const role = interaction.guild.roles.cache.find(r => r.name === roleName);
            
            if (role) {
                if (!member.roles.cache.has(role.id)) {
                    await member.roles.add(role);
                    addedRoles.push(roleName);
                }
            }
        }

        // Kirim 1 message aja yang cuma keliatan sama user (ephemeral)
        const responseEmbed = new EmbedBuilder();
        
        if (addedRoles.length > 0) {
            const addedText = addedRoles.map(roleName => {
                const role = interaction.guild.roles.cache.find(r => r.name === roleName);
                return `✅ ${role ? `<@&${role.id}>` : `@${roleName}`}`;
            }).join('\n');
            
            responseEmbed.addFields({
                name: '📥 Added Roles',
                value: addedText,
                inline: false
            });
        }
        
        if (removedRoles.length > 0) {
            const removedText = removedRoles.map(roleName => {
                const role = interaction.guild.roles.cache.find(r => r.name === roleName);
                return `❌ ${role ? `<@&${role.id}>` : `@${roleName}`}`;
            }).join('\n');
            
            responseEmbed.addFields({
                name: '📤 Removed Roles',
                value: removedText,
                inline: false
            });
        }

        if (addedRoles.length === 0 && removedRoles.length === 0) {
            responseEmbed
                .setColor('#FFD700')
                .setDescription('✅ No changes made!');
        } else {
            responseEmbed.setColor('#00D9FF');
        }

        await interaction.reply({ 
            embeds: [responseEmbed], 
            ephemeral: true 
        });
    } catch (error) {
        console.error('Error handling role selection:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Error')
            .setDescription('Ada error pas update roles. Pastikan bot punya permission yang cukup!')
            .setTimestamp();
        
        await interaction.reply({ 
            embeds: [errorEmbed], 
            ephemeral: true 
        });
    }
});

// Error handling
client.on('error', error => {
    console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

client.login(TOKEN);