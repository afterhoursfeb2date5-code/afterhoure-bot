const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

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
    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server (Admin only)')
        .addStringOption(option =>
            option.setName('user_id')
                .setDescription('User ID to unban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the unban')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    new SlashCommandBuilder()
        .setName('embed-create')
        .setDescription('Create a custom embed with a modal (Admin only)')
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

client.once('clientReady', () => {
    console.log(`✅ ${client.user.tag} udah online!`);
    console.log(`🏠 Di ${client.guilds.cache.size} server`);
    
    // Set rotating presence
    const activities = [
        { name: '/setuproles', type: 'WATCHING' },
        { name: 'role selection', type: 'WATCHING' },
        { name: '/admin-embed', type: 'WATCHING' },
        { name: 'members', type: 'WATCHING' }
    ];
    
    let activityIndex = 0;
    client.user.setActivity(activities[activityIndex].name, { type: activities[activityIndex].type });
    
    setInterval(() => {
        activityIndex = (activityIndex + 1) % activities.length;
        client.user.setActivity(activities[activityIndex].name, { type: activities[activityIndex].type });
    }, 15000); // Berubah setiap 15 detik
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

                await interaction.reply({ content: '✅ Role selection menu udah di-setup!', flags: 64 });
            } catch (error) {
                console.error('Error setting up roles:', error);
                await interaction.reply({ content: '❌ Error saat setup menu!', flags: 64 });
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

                await interaction.reply({ content: '✅ Embed berhasil dikirim!', flags: 64 });
            } catch (error) {
                console.error('Error sending embed:', error);
                await interaction.reply({ content: '❌ Error saat mengirim embed!', flags: 64 });
            }
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
                            flags: 64 
                        });
                    }
                } else {
                    sentMessage = await interaction.channel.send(messageOptions);
                }

                await interaction.reply({ content: '✅ Message berhasil dikirim!', flags: 64 });
            } catch (error) {
                console.error('Error sending message:', error);
                await interaction.reply({ 
                    content: `❌ Error: ${error.message}`,
                    flags: 64 
                });
            }
        }

        if (commandName === 'ban') {
            try {
                const user = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason') || 'No reason provided';
                const member = interaction.guild.members.cache.get(user.id);

                // Check if user is bannable
                if (member && !member.bannable) {
                    return await interaction.reply({
                        content: '❌ Cannot ban this user! (Role hierarchy issue)',
                        flags: 64
                    });
                }

                // Ban the user
                await interaction.guild.bans.create(user.id, { reason: reason });

                const banEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('⛔ User Banned')
                    .addFields(
                        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'Banned by', value: interaction.user.tag, inline: true }
                    )
                    .setThumbnail(user.displayAvatarURL())
                    .setTimestamp();

                await interaction.reply({ embeds: [banEmbed], flags: 64 });
            } catch (error) {
                console.error('Error banning user:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'kick') {
            try {
                const user = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason') || 'No reason provided';
                const member = interaction.guild.members.cache.get(user.id);

                // Check if user exists
                if (!member) {
                    return await interaction.reply({
                        content: '❌ User not found in this server!',
                        flags: 64
                    });
                }

                // Check if user is kickable
                if (!member.kickable) {
                    return await interaction.reply({
                        content: '❌ Cannot kick this user! (Role hierarchy issue)',
                        flags: 64
                    });
                }

                // Kick the user
                await member.kick(reason);

                const kickEmbed = new EmbedBuilder()
                    .setColor('#FF6600')
                    .setTitle('👢 User Kicked')
                    .addFields(
                        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'Kicked by', value: interaction.user.tag, inline: true }
                    )
                    .setThumbnail(user.displayAvatarURL())
                    .setTimestamp();

                await interaction.reply({ embeds: [kickEmbed], flags: 64 });
            } catch (error) {
                console.error('Error kicking user:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'unban') {
            try {
                const userId = interaction.options.getString('user_id');
                const reason = interaction.options.getString('reason') || 'No reason provided';

                // Check if user is actually banned
                const banInfo = await interaction.guild.bans.fetch(userId).catch(() => null);
                
                if (!banInfo) {
                    return await interaction.reply({
                        content: '❌ User is not banned on this server!',
                        flags: 64
                    });
                }

                // Unban the user
                await interaction.guild.bans.remove(userId, reason);

                const unbanEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ User Unbanned')
                    .addFields(
                        { name: 'User ID', value: userId, inline: true },
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'Unbanned by', value: interaction.user.tag, inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [unbanEmbed], flags: 64 });
            } catch (error) {
                console.error('Error unbanning user:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'embed-create') {
            try {
                // Create modal dengan text inputs
                const modal = new ModalBuilder()
                    .setCustomId('embed_create_modal')
                    .setTitle('Create Embed');

                // Title input
                const titleInput = new TextInputBuilder()
                    .setCustomId('embed_title')
                    .setLabel('Title')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Enter embed title')
                    .setRequired(false);

                // Description input
                const descriptionInput = new TextInputBuilder()
                    .setCustomId('embed_description')
                    .setLabel('Description')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Enter embed description')
                    .setRequired(false);

                // Color input
                const colorInput = new TextInputBuilder()
                    .setCustomId('embed_color')
                    .setLabel('Color (hex, e.g., #FF0000)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('#808080')
                    .setRequired(false);

                // Image URL input
                const imageInput = new TextInputBuilder()
                    .setCustomId('embed_image')
                    .setLabel('Image URL')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('https://...')
                    .setRequired(false);

                // Thumbnail URL input
                const thumbnailInput = new TextInputBuilder()
                    .setCustomId('embed_thumbnail')
                    .setLabel('Thumbnail URL')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('https://...')
                    .setRequired(false);

                // Footer input
                const footerInput = new TextInputBuilder()
                    .setCustomId('embed_footer')
                    .setLabel('Footer Text')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Footer text here')
                    .setRequired(false);

                // Add rows to modal
                const row1 = new ActionRowBuilder().addComponents(titleInput);
                const row2 = new ActionRowBuilder().addComponents(descriptionInput);
                const row3 = new ActionRowBuilder().addComponents(colorInput);
                const row4 = new ActionRowBuilder().addComponents(imageInput);
                const row5 = new ActionRowBuilder().addComponents(thumbnailInput);

                modal.addComponents(row1, row2, row3, row4, row5);

                await interaction.showModal(modal);
            } catch (error) {
                console.error('Error showing embed modal:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }
    }

    // Handle modal submissions
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'embed_create_modal') {
            try {
                // Get values from modal
                const title = interaction.fields.getTextInputValue('embed_title');
                const description = interaction.fields.getTextInputValue('embed_description');
                const color = interaction.fields.getTextInputValue('embed_color') || '#808080';
                const imageUrl = interaction.fields.getTextInputValue('embed_image');
                const thumbnailUrl = interaction.fields.getTextInputValue('embed_thumbnail');
                const footerText = interaction.fields.getTextInputValue('embed_footer');

                // Create the embed
                const embed = new EmbedBuilder()
                    .setTimestamp();

                if (title) embed.setTitle(title);
                if (description) embed.setDescription(description);
                if (color) {
                    try {
                        embed.setColor(color);
                    } catch (e) {
                        embed.setColor('#808080'); // Default jika color invalid
                    }
                }
                if (imageUrl) embed.setImage(imageUrl);
                if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
                if (footerText) {
                    embed.setFooter({ text: footerText });
                } else {
                    embed.setFooter({ text: 'Mickey Mouse Trap House' });
                }

                // Create preview with buttons
                const sendButton = new ButtonBuilder()
                    .setCustomId('embed_send')
                    .setLabel('Send')
                    .setStyle(ButtonStyle.Success);

                const cancelButton = new ButtonBuilder()
                    .setCustomId('embed_cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Danger);

                const buttonRow = new ActionRowBuilder().addComponents(sendButton, cancelButton);

                // Store embed data temporarily (bisa juga pake Map kalau banyak user)
                const embeds = client.embeds || new Map();
                embeds.set(interaction.user.id, {
                    embed: embed,
                    userId: interaction.user.id,
                    createdAt: Date.now()
                });
                client.embeds = embeds;

                await interaction.reply({
                    content: '📋 Preview:',
                    embeds: [embed],
                    components: [buttonRow],
                    flags: 64
                });
            } catch (error) {
                console.error('Error processing embed modal:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }
    }

    // Handle buttons for embed preview
    if (interaction.isButton()) {
        if (interaction.customId === 'embed_send') {
            try {
                const embeds = client.embeds || new Map();
                const embedData = embeds.get(interaction.user.id);

                if (!embedData) {
                    return await interaction.reply({
                        content: '❌ Embed data expired! Please create a new embed.',
                        flags: 64
                    });
                }

                // Send embed to channel
                await interaction.channel.send({ embeds: [embedData.embed] });

                // Clean up
                embeds.delete(interaction.user.id);
                client.embeds = embeds;

                await interaction.reply({
                    content: '✅ Embed sent successfully!',
                    flags: 64
                });
            } catch (error) {
                console.error('Error sending embed:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (interaction.customId === 'embed_cancel') {
            try {
                const embeds = client.embeds || new Map();
                embeds.delete(interaction.user.id);
                client.embeds = embeds;

                await interaction.reply({
                    content: '❌ Embed creation cancelled.',
                    flags: 64
                });
            } catch (error) {
                console.error('Error cancelling embed:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
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
            flags: 64 
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
                flags: 64 
            });

            // Auto-delete message setelah 3 detik
            setTimeout(() => {
                msg.delete().catch(() => {});
            }, 3000);
        }
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
