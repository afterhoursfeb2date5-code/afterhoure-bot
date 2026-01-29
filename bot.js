const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ] 
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Register slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('setuproles')
        .setDescription('Setup role selection menus (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('admin-embed')
        .setDescription('Send a custom embed with buttons to a channel (Admin only)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to send the embed to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Embed title')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Embed description')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Embed color (hex, e.g., #FF0000)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('image')
                .setDescription('Image URL')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('thumbnail')
                .setDescription('Thumbnail URL')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('footer')
                .setDescription('Footer text')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('button1_name')
                .setDescription('Button 1 name')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('button1_url')
                .setDescription('Button 1 URL')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('button1_emoji')
                .setDescription('Button 1 emoji')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('button2_name')
                .setDescription('Button 2 name')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('button2_url')
                .setDescription('Button 2 URL')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('button2_emoji')
                .setDescription('Button 2 emoji')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('button3_name')
                .setDescription('Button 3 name')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('button3_url')
                .setDescription('Button 3 URL')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('button3_emoji')
                .setDescription('Button 3 emoji')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('admin-say')
        .setDescription('Send a custom message or reply with an optional file!')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('Message text to send')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('attachment')
                .setDescription('Optional file to send')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reply-to')
                .setDescription('Message ID to reply to (optional)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🔄 Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('✅ Slash commands registered!');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
})();

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} udah online!`);
    console.log(`🏠 Di ${client.guilds.cache.size} server`);
    client.user.setActivity('/setuproles | /admin-embed', { type: 'WATCHING' });
});

// Handle interactions (slash commands & components)
client.on('interactionCreate', async (interaction) => {
    // Handle slash commands
    if (interaction.isCommand()) {
        const { commandName } = interaction;

        if (commandName === 'setuproles') {
            try {
                // Character Catalog Embed & Menu
                const characterEmbed = new EmbedBuilder()
                    .setColor('#808080')
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

                await interaction.channel.send({ 
                    embeds: [characterEmbed], 
                    components: [characterMenu] 
                });

                // Gaming Roles Embed & Menu
                const gamingEmbed = new EmbedBuilder()
                    .setColor('#808080')
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

                await interaction.channel.send({ 
                    embeds: [gamingEmbed], 
                    components: [gamingMenu] 
                });

                // Hobbies Embed & Menu
                const hobbiesEmbed = new EmbedBuilder()
                    .setColor('#808080')
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

                await interaction.channel.send({ 
                    embeds: [hobbiesEmbed], 
                    components: [hobbiesMenu] 
                });

                await interaction.reply({ content: '✅ Role selection menu udah di-setup!', ephemeral: true });
            } catch (error) {
                console.error('Error setting up roles:', error);
                await interaction.reply({ content: '❌ Error saat setup menu!', ephemeral: true });
            }
        }

        if (commandName === 'admin-embed') {
            try {
                const channel = interaction.options.getChannel('channel');
                const title = interaction.options.getString('title');
                const description = interaction.options.getString('description');
                const color = interaction.options.getString('color') || '#808080';
                const imageUrl = interaction.options.getString('image');
                const thumbnailUrl = interaction.options.getString('thumbnail');
                const footerText = interaction.options.getString('footer');
                
                // Get button inputs
                const button1Name = interaction.options.getString('button1_name');
                const button1Url = interaction.options.getString('button1_url');
                const button1Emoji = interaction.options.getString('button1_emoji');
                
                const button2Name = interaction.options.getString('button2_name');
                const button2Url = interaction.options.getString('button2_url');
                const button2Emoji = interaction.options.getString('button2_emoji');
                
                const button3Name = interaction.options.getString('button3_name');
                const button3Url = interaction.options.getString('button3_url');
                const button3Emoji = interaction.options.getString('button3_emoji');

                // Create embed
                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor(color)
                    .setTimestamp();

                if (footerText) {
                    embed.setFooter({ text: footerText });
                } else {
                    embed.setFooter({ text: 'Mickey Mouse Trap House' });
                }

                if (imageUrl) {
                    embed.setImage(imageUrl);
                }

                if (thumbnailUrl) {
                    embed.setThumbnail(thumbnailUrl);
                }

                // Build buttons
                const buttonRow = new ActionRowBuilder();
                const buttonList = [
                    { name: button1Name, url: button1Url, emoji: button1Emoji },
                    { name: button2Name, url: button2Url, emoji: button2Emoji },
                    { name: button3Name, url: button3Url, emoji: button3Emoji }
                ];

                for (const btn of buttonList) {
                    if (btn.name && btn.url) {
                        const button = new ButtonBuilder()
                            .setLabel(btn.name)
                            .setURL(btn.url)
                            .setStyle(ButtonStyle.Link);

                        if (btn.emoji) {
                            button.setEmoji(btn.emoji);
                        }

                        buttonRow.addComponents(button);
                    }
                }

                // Send embed
                if (buttonRow.components.length > 0) {
                    await channel.send({ 
                        embeds: [embed], 
                        components: [buttonRow] 
                    });
                } else {
                    await channel.send({ embeds: [embed] });
                }

                await interaction.reply({ content: '✅ Embed berhasil dikirim!', ephemeral: true });
            } catch (error) {
                console.error('Error sending embed:', error);
                await interaction.reply({ content: '❌ Error saat mengirim embed!', ephemeral: true });
            }
        if (commandName === 'admin-say') {
            try {
                const text = interaction.options.getString('text');
                const attachment = interaction.options.getAttachment('attachment');
                const replyToId = interaction.options.getString('reply-to');

                const messageOptions = {
                    content: text
                };

                if (attachment) {
                    messageOptions.files = [attachment.url];
                }

                let sentMessage;
                if (replyToId) {
                    try {
                        const messageToReply = await interaction.channel.messages.fetch(replyToId);
                        sentMessage = await messageToReply.reply(messageOptions);
                    } catch (error) {
                        console.error('Error fetching message to reply:', error);
                        return await interaction.reply({ 
                            content: '❌ Message ID tidak ditemukan atau sudah dihapus!', 
                            ephemeral: true 
                        });
                    }
                } else {
                    sentMessage = await interaction.channel.send(messageOptions);
                }

                await interaction.reply({ content: '✅ Message berhasil dikirim!', ephemeral: true });
            } catch (error) {
                console.error('Error sending message:', error);
                await interaction.reply({ 
                    content: `❌ Error: ${error.message}`, 
                    ephemeral: true 
                });
            }
        }
    }

    // Handle string select menus
    if (interaction.isStringSelectMenu()) {
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
        const missingRoles = [];

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
            } else {
                missingRoles.push(roleName);
            }
        }

        // Kirim 1 message aja yang cuma keliatan sama user (ephemeral)
        const responseEmbed = new EmbedBuilder();
        
        if (addedRoles.length > 0) {
            const addedText = addedRoles.map(roleName => {
                const role = interaction.guild.roles.cache.find(r => r.name === roleName);
                return `${role ? `<@&${role.id}>` : `@${roleName}`}`;
            }).join('\n');
            
            responseEmbed.addFields({
                name: '✅ Added Roles',
                value: addedText,
                inline: false
            });
        }
        
        if (removedRoles.length > 0) {
            const removedText = removedRoles.map(roleName => {
                const role = interaction.guild.roles.cache.find(r => r.name === roleName);
                return `${role ? `<@&${role.id}>` : `@${roleName}`}`;
            }).join('\n');
            
            responseEmbed.addFields({
                name: '❌ Removed Roles',
                value: removedText,
                inline: false
            });
        }

        if (missingRoles.length > 0) {
            responseEmbed.addFields({
                name: '⚠️ Missing Roles',
                value: missingRoles.join('\n'),
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

        const msg = await interaction.reply({ 
            embeds: [responseEmbed], 
            ephemeral: true 
        });

        // Auto-delete message setelah 5 detik
        setTimeout(() => {
            msg.delete().catch(() => {});
        }, 3000);
            } catch (error) {
        console.error('Error handling role selection:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Error')
            .setDescription(`Error: ${error.message}\n\nPastikan:\n1. Bot punya "Manage Roles" permission\n2. Role names cocok dengan setting`)
            .setTimestamp();
        
        const msg = await interaction.reply({ 
            embeds: [errorEmbed], 
            ephemeral: true 
        });

        // Auto-delete message setelah 3 detik
        setTimeout(() => {
            msg.delete().catch(() => {});
        }, 3000);
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
