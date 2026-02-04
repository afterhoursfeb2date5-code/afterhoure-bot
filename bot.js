const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, AttachmentBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
require('dotenv').config();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ] 
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Music Manager
const musicManager = {
    queues: new Map(), // guildId -> {songs: [], playing: bool, player: AudioPlayer, connection: VoiceConnection}
    
    getQueue(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, { songs: [], playing: false, player: null, connection: null });
        }
        return this.queues.get(guildId);
    },
    
    async searchSpotify(query) {
        try {
            if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;
            
            // Get Spotify access token
            const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
            const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', 
                'grant_type=client_credentials',
                { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            
            const accessToken = tokenResponse.data.access_token;
            
            // Search track
            const searchResponse = await axios.get('https://api.spotify.com/v1/search', {
                params: { q: query, type: 'track', limit: 1 },
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (searchResponse.data.tracks.items.length === 0) return null;
            
            const track = searchResponse.data.tracks.items[0];
            return {
                title: `${track.name} - ${track.artists[0].name}`,
                artist: track.artists[0].name,
                url: track.external_urls.spotify,
                thumbnail: track.album.images[0]?.url
            };
        } catch (error) {
            console.error('Spotify search error:', error.message);
            return null;
        }
    },
    
    async getYouTubeInfo(query) {
        try {
            // Check if query is direct YouTube URL
            if (query.includes('youtube.com') || query.includes('youtu.be')) {
                const info = await ytdl.getInfo(query);
                return {
                    title: info.videoDetails.title,
                    url: query,
                    thumbnail: info.videoDetails.thumbnail.thumbnails[0].url,
                    duration: parseInt(info.videoDetails.lengthSeconds),
                    artist: info.videoDetails.author.name
                };
            }
            
            // Search YouTube
            const response = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
            const videoIdMatch = response.data.match(/\\"\\"\\"\""\/watch\\?v=([a-zA-Z0-9_-]{11})/);
            
            if (!videoIdMatch) return null;
            
            const videoId = videoIdMatch[1];
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const info = await ytdl.getInfo(videoUrl);
            
            return {
                title: info.videoDetails.title,
                url: videoUrl,
                thumbnail: info.videoDetails.thumbnail.thumbnails[0].url,
                duration: parseInt(info.videoDetails.lengthSeconds),
                artist: info.videoDetails.author.name
            };
        } catch (error) {
            console.error('YouTube search error:', error.message);
            return null;
        }
    }
};

// Config file paths
const CONFIG_DIR = path.join(__dirname, 'config');
const BOOSTER_CONFIG_FILE = path.join(CONFIG_DIR, 'booster-config.json');
const LOGS_CONFIG_FILE = path.join(CONFIG_DIR, 'logs-config.json');
const GIVEAWAY_CONFIG_FILE = path.join(CONFIG_DIR, 'giveaway-config.json');
const GIVEAWAY_SETTINGS_FILE = path.join(CONFIG_DIR, 'giveaway-settings.json');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Load configs
function loadBoosterConfig() {
    try {
        if (fs.existsSync(BOOSTER_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(BOOSTER_CONFIG_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading booster config:', error);
    }
    return {};
}

function loadLogsConfig() {
    try {
        if (fs.existsSync(LOGS_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(LOGS_CONFIG_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading logs config:', error);
    }
    return {};
}

function saveBoosterConfig(config) {
    try {
        fs.writeFileSync(BOOSTER_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving booster config:', error);
    }
}

function saveLogsConfig(config) {
    try {
        fs.writeFileSync(LOGS_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving logs config:', error);
    }
}

function loadGiveawayConfig() {
    try {
        if (fs.existsSync(GIVEAWAY_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(GIVEAWAY_CONFIG_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading giveaway config:', error);
    }
    return {};
}

function saveGiveawayConfig(config) {
    try {
        fs.writeFileSync(GIVEAWAY_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving giveaway config:', error);
    }
}

function loadGiveawaySettings() {
    try {
        if (fs.existsSync(GIVEAWAY_SETTINGS_FILE)) {
            return JSON.parse(fs.readFileSync(GIVEAWAY_SETTINGS_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading giveaway settings:', error);
    }
    return {};
}

function saveGiveawaySettings(settings) {
    try {
        fs.writeFileSync(GIVEAWAY_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving giveaway settings:', error);
    }
}

// User points config

// Helper function untuk format duration untuk display
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// Helper function untuk parse duration (e.g., "1h", "30m", "7d")
function parseDuration(durationStr) {
    const match = durationStr.match(/^(\d+)([smhd])$/);
    if (!match) return null;

    const amount = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 's': return amount * 1000;
        case 'm': return amount * 60 * 1000;
        case 'h': return amount * 60 * 60 * 1000;
        case 'd': return amount * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

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
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageMessages),
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
    new SlashCommandBuilder()
        .setName('auto-respon')
        .setDescription('Add an autoresponder (Admin only)')
        .addStringOption(option =>
            option.setName('sentence')
                .setDescription('The trigger sentence')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('response')
                .setDescription('The response message')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('mention')
                .setDescription('Should the bot mention the user?')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('delete_trigger')
                .setDescription('Should delete the trigger message?')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('auto-respon-list')
        .setDescription('Show all stored autoresponses (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('auto-respon-remove')
        .setDescription('Remove an autoresponse (Admin only)')
        .addStringOption(option =>
            option.setName('sentence')
                .setDescription('The sentence to remove')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('setup-booster-channel')
        .setDescription('Setup channel for boost thank-you messages (Admin only)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to send boost messages')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('setup-logs')
        .setDescription('Setup moderation logs channel (Admin only)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel for mod logs')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a user for temporary duration (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to timeout')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration (e.g., 1h, 30m, 7d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for timeout')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a user permanently (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to mute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for mute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Remove mute from a user (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to remove mute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for unmute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder()
        .setName('connect')
        .setDescription('Connect bot to a voice channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Voice channel to connect to')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder()
        .setName('disconnect')
        .setDescription('Disconnect bot from voice channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder()
        .setName('gstart')
        .setDescription('Start a giveaway')
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Duration (e.g., 30s, 5m, 24h, 7d)')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription('Number of winners')
                .setMinValue(1)
                .setMaxValue(50)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('prize')
                .setDescription('Prize description')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    new SlashCommandBuilder()
        .setName('gend')
        .setDescription('End a giveaway and pick winners')
        .addStringOption(option =>
            option.setName('giveaway_id')
                .setDescription('Giveaway ID')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    new SlashCommandBuilder()
        .setName('greroll')
        .setDescription('Reroll winners for a giveaway')
        .addStringOption(option =>
            option.setName('giveaway_id')
                .setDescription('Giveaway ID')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    new SlashCommandBuilder()
        .setName('gdelete')
        .setDescription('Delete a giveaway')
        .addStringOption(option =>
            option.setName('giveaway_id')
                .setDescription('Giveaway ID')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    new SlashCommandBuilder()
        .setName('glist')
        .setDescription('List all active giveaways'),
    new SlashCommandBuilder()
        .setName('gsettings')
        .setDescription('Configure giveaway settings')
        .addSubcommand(subcommand =>
            subcommand.setName('show')
                .setDescription('Show current settings'))
        .addSubcommand(subcommand =>
            subcommand.setName('set-color')
                .setDescription('Set embed color')
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Hex color code (e.g., #FF0000)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('set-emoji')
                .setDescription('Set join emoji')
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('Emoji to use for joining')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
].map(command => command.toJSON());

// Helper function to send logs
async function sendLog(guild, title, description, color = '#FF9900') {
    try {
        const logsChannelId = client.logsConfig?.[guild.id];
        if (!logsChannelId) return; // No logs channel configured
        
        const logsChannel = guild.channels.cache.get(logsChannelId);
        if (!logsChannel) return;
        
        const logEmbed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();
        
        await logsChannel.send({ embeds: [logEmbed] }).catch(err => {
            console.error('Error sending log:', err);
        });
    } catch (error) {
        console.error('Error in sendLog:', error);
    }
}

// Giveaway helper functions
const giveawayTimers = new Map(); // Store timeout IDs

async function endGiveaway(giveawayId, guild) {
    try {
        const giveaways = loadGiveawayConfig();
        const giveaway = giveaways[giveawayId];

        if (!giveaway) return;

        giveaway.ended = true;
        saveGiveawayConfig(giveaways);

        const channel = guild?.channels.cache.get(giveaway.channelId);
        if (!channel) return;

        try {
            const message = await channel.messages.fetch(giveaway.messageId);
            
            // Update message to show it ended
            const endedEmbed = new EmbedBuilder()
                .setColor(giveaway.color)
                .setTitle('🎁 GIVEAWAY - ENDED')
                .setDescription(`React with ${giveaway.emoji} to enter!\n\n**Prize:** ${giveaway.prize}\n**Status:** Ended`)
                .addFields(
                    { name: 'Winners', value: `${giveaway.winners}`, inline: true },
                    { name: 'Participants', value: `${giveaway.participants.length}`, inline: true }
                )
                .setFooter({ text: `Giveaway ID: ${giveawayId}` })
                .setTimestamp();

            await message.edit({ embeds: [endedEmbed] });
        } catch (error) {
            console.error('Error updating giveaway message:', error);
        }

        // Pick winners
        if (giveaway.participants.length === 0) {
            const noWinnersEmbed = new EmbedBuilder()
                .setColor(giveaway.color)
                .setTitle('❌ No Winners')
                .setDescription(`No one participated in the giveaway for **${giveaway.prize}**`)
                .setFooter({ text: `Giveaway ID: ${giveawayId}` })
                .setTimestamp();

            await channel.send({ embeds: [noWinnersEmbed] });
        } else {
            const winners = [];
            const availableParticipants = [...giveaway.participants];
            const numWinners = Math.min(giveaway.winners, availableParticipants.length);

            for (let i = 0; i < numWinners; i++) {
                const randomIdx = Math.floor(Math.random() * availableParticipants.length);
                winners.push(availableParticipants[randomIdx]);
                availableParticipants.splice(randomIdx, 1);
            }

            const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
            const winnersEmbed = new EmbedBuilder()
                .setColor(giveaway.color)
                .setTitle('🎉 Giveaway Winners!')
                .setDescription(`**Prize:** ${giveaway.prize}\n\n**Winners:** ${winnerMentions}`)
                .addFields({
                    name: 'Congratulations!',
                    value: 'You have won the giveaway! Check your DMs for more info.',
                    inline: false
                })
                .setFooter({ text: `Giveaway ID: ${giveawayId}` })
                .setTimestamp();

            await channel.send({ embeds: [winnersEmbed] });

            // Send DM to winners
            for (const winnerId of winners) {
                try {
                    const user = await client.users.fetch(winnerId);
                    const dmEmbed = new EmbedBuilder()
                        .setColor(giveaway.color)
                        .setTitle('🎉 Congratulations!')
                        .setDescription(`You won the giveaway for **${giveaway.prize}** in ${guild.name}!`)
                        .setFooter({ text: 'Mickey Trap Academy' })
                        .setTimestamp();

                    await user.send({ embeds: [dmEmbed] }).catch(() => {});
                } catch (error) {
                    console.error(`Error sending DM to winner ${winnerId}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Error ending giveaway:', error);
    }
}

function scheduleGiveawayEnd(giveawayId) {
    try {
        const giveaways = loadGiveawayConfig();
        const giveaway = giveaways[giveawayId];

        if (!giveaway) return;

        const timeUntilEnd = Math.max(0, giveaway.endsAt - Date.now());

        if (giveawayTimers.has(giveawayId)) {
            clearTimeout(giveawayTimers.get(giveawayId));
        }

        const timerId = setTimeout(() => {
            const guild = client.guilds.cache.get(giveaway.guildId);
            if (guild) {
                endGiveaway(giveawayId, guild);
            }
            giveawayTimers.delete(giveawayId);
        }, timeUntilEnd);

        giveawayTimers.set(giveawayId, timerId);
    } catch (error) {
        console.error('Error scheduling giveaway end:', error);
    }
}


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

// Helper function to play next song
async function playNextSong(guildId, interaction) {
    const queue = musicManager.getQueue(guildId);
    
    if (!queue.connection || queue.songs.length === 0) {
        queue.playing = false;
        return;
    }

    queue.playing = true;
    const track = queue.songs[0];

    try {
        const stream = ytdl(track.url, {
            quality: 'highestaudio',
            filter: 'audioonly'
        });

        const resource = createAudioResource(stream);
        queue.player.play(resource);

        // Listen for track end
        queue.player.once(AudioPlayerStatus.Idle, async () => {
            queue.songs.shift();
            if (queue.songs.length > 0) {
                await playNextSong(guildId, null);
            } else {
                queue.playing = false;
            }
        });

        if (interaction) {
            const playEmbed = new EmbedBuilder()
                .setColor('#1DB954')
                .setTitle('🎵 Now Playing')
                .setDescription(`**${track.title}**`)
                .setThumbnail(track.thumbnail)
                .addFields(
                    { name: 'Artist', value: track.artist, inline: true },
                    { name: 'Queue', value: `${queue.songs.length - 1} songs remaining`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [playEmbed] }).catch(() => {});
        }
    } catch (error) {
        console.error('Error playing track:', error);
        queue.songs.shift();
        if (queue.songs.length > 0) {
            await playNextSong(guildId, null);
        } else {
            queue.playing = false;
        }
    }
}

client.once('clientReady', () => {
    console.log(`✅ ${client.user.tag} udah online!`);
    console.log(`🏠 Di ${client.guilds.cache.size} server`);
    
    // Load configs from file
    client.boosterConfig = loadBoosterConfig();
    client.logsConfig = loadLogsConfig();
    console.log('📁 Configs loaded from file');
    
    // Load and schedule giveaways
    const giveaways = loadGiveawayConfig();
    let activeGiveawaysCount = 0;
    for (const [giveawayId, giveaway] of Object.entries(giveaways)) {
        if (!giveaway.ended && giveaway.endsAt > Date.now()) {
            scheduleGiveawayEnd(giveawayId);
            activeGiveawaysCount++;
        }
    }
    if (activeGiveawaysCount > 0) {
        console.log(`🎁 ${activeGiveawaysCount} active giveaways scheduled`);
    }
    
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
                    .setFooter({ text: 'Mickey Trap Academy' })
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
                    .setFooter({ text: 'Mickey Trap Academy' })
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
                    .setFooter({ text: 'Mickey Trap Academy' })
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
                    embed.setFooter({ text: 'Mickey Trap Academy' });
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

                await interaction.reply({ content: '✅ User banned!', flags: 64 });

                // Send to logs channel
                await sendLog(
                    interaction.guild,
                    '⛔ User Banned',
                    `**User:** ${user.tag} (${user.id})\n**Reason:** ${reason}\n**Banned by:** ${interaction.user.tag}`,
                    '#FF0000'
                );
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

                await interaction.reply({ content: '✅ User kicked!', flags: 64 });

                // Send to logs channel
                await sendLog(
                    interaction.guild,
                    '👢 User Kicked',
                    `**User:** ${user.tag} (${user.id})\n**Reason:** ${reason}\n**Kicked by:** ${interaction.user.tag}`,
                    '#FF6600'
                );
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

                await interaction.reply({ content: '✅ User unbanned!', flags: 64 });

                // Send to logs channel
                await sendLog(
                    interaction.guild,
                    '✅ User Unbanned',
                    `**User ID:** ${userId}\n**Reason:** ${reason}\n**Unbanned by:** ${interaction.user.tag}`,
                    '#00FF00'
                );
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
                const row5 = new ActionRowBuilder().addComponents(footerInput);

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

        if (commandName === 'auto-respon') {
            try {
                const sentence = interaction.options.getString('sentence').toLowerCase();
                const response = interaction.options.getString('response');
                const mention = interaction.options.getBoolean('mention') || false;
                const deleteTrigger = interaction.options.getBoolean('delete_trigger') || false;

                // Initialize storage jika belum ada
                if (!client.autoResponses) {
                    client.autoResponses = new Map();
                }

                // Cek apakah sentence sudah ada
                if (client.autoResponses.has(sentence)) {
                    return await interaction.reply({
                        content: `❌ Autoresponder untuk "${sentence}" sudah ada! Hapus terlebih dahulu menggunakan /auto-respon-remove`,
                        flags: 64
                    });
                }

                // Simpan autoresponse
                client.autoResponses.set(sentence, {
                    response: response,
                    mention: mention,
                    deleteTrigger: deleteTrigger,
                    createdBy: interaction.user.tag,
                    createdAt: new Date()
                });

                const addEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ Autoresponder Ditambahkan')
                    .addFields(
                        { name: 'Trigger', value: `\`${sentence}\``, inline: true },
                        { name: 'Response', value: response, inline: false },
                        { name: 'Mention User', value: mention ? 'Yes' : 'No', inline: true },
                        { name: 'Delete Trigger', value: deleteTrigger ? 'Yes' : 'No', inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [addEmbed], flags: 64 });
            } catch (error) {
                console.error('Error adding autoresponder:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'auto-respon-list') {
            try {
                if (!client.autoResponses || client.autoResponses.size === 0) {
                    return await interaction.reply({
                        content: '❌ Tidak ada autoresponder yang tersimpan!',
                        flags: 64
                    });
                }

                const listEmbed = new EmbedBuilder()
                    .setColor('#00D9FF')
                    .setTitle('📋 Daftar Autoresponder')
                    .setDescription(`Total: ${client.autoResponses.size}`);

                let counter = 1;
                for (const [sentence, data] of client.autoResponses) {
                    const value = `**Response:** ${data.response}\n**Mention:** ${data.mention ? 'Yes' : 'No'} | **Delete:** ${data.deleteTrigger ? 'Yes' : 'No'}`;
                    listEmbed.addFields({
                        name: `${counter}. \`${sentence}\``,
                        value: value,
                        inline: false
                    });
                    counter++;

                    // Max 25 fields per embed
                    if (counter > 25) break;
                }

                await interaction.reply({ embeds: [listEmbed], flags: 64 });
            } catch (error) {
                console.error('Error listing autoresponders:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'auto-respon-remove') {
            try {
                const sentence = interaction.options.getString('sentence').toLowerCase();

                if (!client.autoResponses || !client.autoResponses.has(sentence)) {
                    return await interaction.reply({
                        content: `❌ Autoresponder untuk "${sentence}" tidak ditemukan!`,
                        flags: 64
                    });
                }

                client.autoResponses.delete(sentence);

                const removeEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('✅ Autoresponder Dihapus')
                    .addFields({
                        name: 'Trigger',
                        value: `\`${sentence}\``,
                        inline: true
                    })
                    .setTimestamp();

                await interaction.reply({ embeds: [removeEmbed], flags: 64 });
            } catch (error) {
                console.error('Error removing autoresponder:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'setup-booster-channel') {
            try {
                const channel = interaction.options.getChannel('channel');

                // Set booster channel untuk guild ini
                client.boosterConfig[interaction.guildId] = {
                    ...client.boosterConfig[interaction.guildId],
                    channelId: channel.id
                };
                
                // Save to file
                saveBoosterConfig(client.boosterConfig);

                const setupEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ Booster Channel Setup')
                    .addFields({
                        name: 'Channel',
                        value: `${channel}`,
                        inline: false
                    })
                    .setDescription('Bot akan kirim thank-you message di channel ini saat member boost')
                    .setTimestamp();

                await interaction.reply({ embeds: [setupEmbed], flags: 64 });
            } catch (error) {
                console.error('Error setting up booster channel:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'setup-logs') {
            try {
                const channel = interaction.options.getChannel('channel');

                // Set logs channel untuk guild ini
                client.logsConfig[interaction.guildId] = channel.id;
                
                // Save to file
                saveLogsConfig(client.logsConfig);

                const setupEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ Moderation Logs Channel Setup')
                    .addFields({
                        name: 'Channel',
                        value: `${channel}`,
                        inline: false
                    })
                    .setDescription('Bot akan log semua moderation actions di channel ini (ban, kick, timeout, mute, dll)')
                    .setTimestamp();

                // Send ke logs channel
                await channel.send({ embeds: [setupEmbed] });
                
                // Reply ke admin dengan ephemeral
                await interaction.reply({ 
                    content: '✅ Logs channel berhasil di-setup!',
                    flags: 64 
                });
            } catch (error) {
                console.error('Error setting up logs channel:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'timeout') {
            try {
                const user = interaction.options.getUser('user');
                const duration = interaction.options.getString('duration');
                const reason = interaction.options.getString('reason') || 'No reason provided';
                const member = interaction.guild.members.cache.get(user.id);

                // Check if user exists
                if (!member) {
                    return await interaction.reply({
                        content: '❌ User not found in this server!',
                        flags: 64
                    });
                }

                // Parse duration
                const durationMs = parseDuration(duration);
                if (!durationMs) {
                    return await interaction.reply({
                        content: '❌ Invalid duration format! Use: 1h, 30m, 7d, etc.',
                        flags: 64
                    });
                }

                // Check if duration is valid (max 28 days)
                if (durationMs > 28 * 24 * 60 * 60 * 1000) {
                    return await interaction.reply({
                        content: '❌ Timeout duration cannot exceed 28 days!',
                        flags: 64
                    });
                }

                // Timeout the member
                await member.timeout(durationMs, reason);

                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#FFAA00')
                    .setTitle('⏱️ User Timed Out')
                    .addFields(
                        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Duration', value: duration, inline: true },
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'Timed out by', value: interaction.user.tag, inline: true }
                    )
                    .setThumbnail(user.displayAvatarURL())
                    .setTimestamp();

                await interaction.reply({ content: '✅ User timed out!', flags: 64 });

                // Send to logs channel
                await sendLog(
                    interaction.guild,
                    '⏱️ User Timed Out',
                    `**User:** ${user.tag} (${user.id})\n**Duration:** ${duration}\n**Reason:** ${reason}\n**Timed out by:** ${interaction.user.tag}`,
                    '#FFAA00'
                );
            } catch (error) {
                console.error('Error timing out user:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'unmute') {
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

                // Check if user is timed out
                if (!member.communicationDisabledUntil) {
                    return await interaction.reply({
                        content: '❌ User is not timed out!',
                        flags: 64
                    });
                }

                // Remove timeout
                await member.timeout(null, reason);

                const unmuteEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ User Unmuted')
                    .addFields(
                        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'Unmuted by', value: interaction.user.tag, inline: true }
                    )
                    .setThumbnail(user.displayAvatarURL())
                    .setTimestamp();

                await interaction.reply({ content: '✅ User unmuted!', flags: 64 });

                // Send to logs channel
                await sendLog(
                    interaction.guild,
                    '✅ User Unmuted',
                    `**User:** ${user.tag} (${user.id})\n**Reason:** ${reason}\n**Unmuted by:** ${interaction.user.tag}`,
                    '#00FF00'
                );
            } catch (error) {
                console.error('Error unmuting user:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'mute') {
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

                // Mute the member (28 days = max permanent until manual unmute)
                const permanentMuteDuration = 28 * 24 * 60 * 60 * 1000;
                await member.timeout(permanentMuteDuration, reason);

                const muteEmbed = new EmbedBuilder()
                    .setColor('#FF00FF')
                    .setTitle('🔇 User Muted (Permanent)')
                    .addFields(
                        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'Muted by', value: interaction.user.tag, inline: true },
                        { name: 'Type', value: 'Permanent (until unmuted)', inline: true }
                    )
                    .setThumbnail(user.displayAvatarURL())
                    .setTimestamp();

                await interaction.reply({ content: '✅ User muted!', flags: 64 });

                // Send to logs channel
                await sendLog(
                    interaction.guild,
                    '🔇 User Muted (Permanent)',
                    `**User:** ${user.tag} (${user.id})\n**Reason:** ${reason}\n**Muted by:** ${interaction.user.tag}\n**Type:** Permanent (until unmuted)`,
                    '#FF00FF'
                );
            } catch (error) {
                console.error('Error muting user:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'connect') {
            try {
                const voiceChannel = interaction.options.getChannel('channel');

                // Check if bot can connect
                if (!voiceChannel.joinable) {
                    return await interaction.reply({
                        content: '❌ Bot tidak bisa join channel ini! Pastikan bot punya permission untuk join.',
                        flags: 64
                    });
                }

                // Connect to voice channel
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: voiceChannel.guild.id,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                });

                // Store connection reference
                if (!client.voiceConnections) {
                    client.voiceConnections = new Map();
                }
                client.voiceConnections.set(voiceChannel.guild.id, connection);

                const connectEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ Bot Connected')
                    .setDescription(`Bot berhasil connect ke **${voiceChannel.name}**!`)
                    .setTimestamp();

                await interaction.reply({ embeds: [connectEmbed], flags: 64 });
            } catch (error) {
                console.error('Error connecting to voice channel:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'disconnect') {
            try {
                const guildId = interaction.guildId;

                if (!client.voiceConnections || !client.voiceConnections.has(guildId)) {
                    return await interaction.reply({
                        content: '❌ Bot tidak sedang connect ke voice channel apapun!',
                        flags: 64
                    });
                }

                // Get connection and destroy it
                const connection = client.voiceConnections.get(guildId);
                connection.destroy();
                client.voiceConnections.delete(guildId);

                const disconnectEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('✅ Bot Disconnected')
                    .setDescription('Bot sudah disconnect dari voice channel!')
                    .setTimestamp();

                await interaction.reply({ embeds: [disconnectEmbed], flags: 64 });
            } catch (error) {
                console.error('Error disconnecting from voice channel:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        // Giveaway Commands
        if (commandName === 'gstart') {
            try {
                const timeStr = interaction.options.getString('time');
                const winners = interaction.options.getInteger('winners');
                const prize = interaction.options.getString('prize');

                const durationMs = parseDuration(timeStr);
                if (!durationMs) {
                    return await interaction.reply({
                        content: '❌ Invalid time format! Use: 30s, 5m, 24h, or 7d',
                        flags: 64
                    });
                }

                // Generate giveaway ID
                const giveawayId = `${interaction.guildId}-${Date.now()}`;
                
                // Load settings
                const settings = loadGiveawaySettings();
                const guildSettings = settings[interaction.guildId] || {
                    color: '#808080'
                };

                const endsAt = Math.floor((Date.now() + durationMs) / 1000);

                // Create simple embed like UBest Giveaway
                const giveawayEmbed = new EmbedBuilder()
                    .setColor(guildSettings.color)
                    .setTitle(`🎁 ${prize}`)
                    .addFields(
                        { name: '🏆 Pemenang', value: `${winners}`, inline: true },
                        { name: '👥 Participants', value: '0', inline: true },
                        { name: '⏰ Berakhir pada', value: `<t:${endsAt}:R>`, inline: false }
                    )
                    .setFooter({ text: `ID: ${giveawayId}` });

                // Create buttons
                const buttons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`giveaway_join-${giveawayId}`)
                            .setLabel('Join')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`giveaway_leave-${giveawayId}`)
                            .setLabel('Leave')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId(`giveaway_participants-${giveawayId}`)
                            .setLabel('👥 Participants')
                            .setStyle(ButtonStyle.Secondary)
                    );

                // Send giveaway message
                const giveawayMsg = await interaction.channel.send({ 
                    embeds: [giveawayEmbed],
                    components: [buttons]
                });

                // Load giveaway config
                const giveaways = loadGiveawayConfig();

                // Store giveaway data
                giveaways[giveawayId] = {
                    guildId: interaction.guildId,
                    channelId: interaction.channelId,
                    messageId: giveawayMsg.id,
                    prize: prize,
                    winners: winners,
                    createdAt: Date.now(),
                    endsAt: Date.now() + durationMs,
                    participants: [],
                    ended: false,
                    color: guildSettings.color
                };

                saveGiveawayConfig(giveaways);

                // Schedule giveaway end
                scheduleGiveawayEnd(giveawayId);

                await interaction.reply({
                    content: `✅ Giveaway started! ID: \`${giveawayId}\``,
                    flags: 64
                });
            } catch (error) {
                console.error('Error in gstart command:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'gend') {
            try {
                const giveawayId = interaction.options.getString('giveaway_id');
                const giveaways = loadGiveawayConfig();
                const giveaway = giveaways[giveawayId];

                if (!giveaway) {
                    return await interaction.reply({
                        content: '❌ Giveaway not found!',
                        flags: 64
                    });
                }

                if (giveaway.ended) {
                    return await interaction.reply({
                        content: '❌ Giveaway already ended!',
                        flags: 64
                    });
                }

                // End the giveaway
                await endGiveaway(giveawayId, interaction.guild);

                await interaction.reply({
                    content: `✅ Giveaway ended!`,
                    flags: 64
                });
            } catch (error) {
                console.error('Error in gend command:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'greroll') {
            try {
                const giveawayId = interaction.options.getString('giveaway_id');
                const giveaways = loadGiveawayConfig();
                const giveaway = giveaways[giveawayId];

                if (!giveaway) {
                    return await interaction.reply({
                        content: '❌ Giveaway not found!',
                        flags: 64
                    });
                }

                if (!giveaway.ended) {
                    return await interaction.reply({
                        content: '❌ Giveaway is still running! End it first.',
                        flags: 64
                    });
                }

                if (giveaway.participants.length === 0) {
                    return await interaction.reply({
                        content: '❌ No participants in this giveaway!',
                        flags: 64
                    });
                }

                // Pick new winners
                const winners = [];
                const availableParticipants = [...giveaway.participants];
                const numWinners = Math.min(giveaway.winners, availableParticipants.length);

                for (let i = 0; i < numWinners; i++) {
                    const randomIdx = Math.floor(Math.random() * availableParticipants.length);
                    winners.push(availableParticipants[randomIdx]);
                    availableParticipants.splice(randomIdx, 1);
                }

                // Create winners announcement
                const guild = client.guilds.cache.get(giveaway.guildId);
                const channel = guild?.channels.cache.get(giveaway.channelId);

                if (channel) {
                    const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
                    const rerollEmbed = new EmbedBuilder()
                        .setColor(giveaway.color)
                        .setTitle('🎉 Giveaway Rerolled!')
                        .setDescription(`**Prize:** ${giveaway.prize}\n\n**New Winners:** ${winnerMentions}`)
                        .setFooter({ text: `Giveaway ID: ${giveawayId}` })
                        .setTimestamp();

                    await channel.send({ embeds: [rerollEmbed] });
                }

                await interaction.reply({
                    content: `✅ New winners selected!`,
                    flags: 64
                });
            } catch (error) {
                console.error('Error in greroll command:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'gdelete') {
            try {
                const giveawayId = interaction.options.getString('giveaway_id');
                const giveaways = loadGiveawayConfig();

                if (!giveaways[giveawayId]) {
                    return await interaction.reply({
                        content: '❌ Giveaway not found!',
                        flags: 64
                    });
                }

                delete giveaways[giveawayId];
                saveGiveawayConfig(giveaways);

                await interaction.reply({
                    content: `✅ Giveaway deleted!`,
                    flags: 64
                });
            } catch (error) {
                console.error('Error in gdelete command:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'glist') {
            try {
                const giveaways = loadGiveawayConfig();
                const guildGiveaways = Object.entries(giveaways).filter(([_, g]) => g.guildId === interaction.guildId);

                if (guildGiveaways.length === 0) {
                    return await interaction.reply({
                        content: '❌ No giveaways found!',
                        flags: 64
                    });
                }

                const listEmbed = new EmbedBuilder()
                    .setColor('#FF00FF')
                    .setTitle('🎁 Active Giveaways')
                    .setFooter({ text: 'Mickey Trap Academy' })
                    .setTimestamp();

                for (const [giveawayId, giveaway] of guildGiveaways) {
                    const timeRemaining = giveaway.endsAt - Date.now();
                    const status = giveaway.ended ? '✅ Ended' : `⏱️ ${formatDuration(timeRemaining)}`;
                    
                    listEmbed.addFields({
                        name: `${giveaway.prize}`,
                        value: `ID: \`${giveawayId}\`\nStatus: ${status}\nParticipants: ${giveaway.participants.length}\nWinners: ${giveaway.winners}`,
                        inline: false
                    });
                }

                await interaction.reply({ embeds: [listEmbed], flags: 64 });
            } catch (error) {
                console.error('Error in glist command:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'gsettings') {
            try {
                const subcommand = interaction.options.getSubcommand();
                const settings = loadGiveawaySettings();
                const guildSettings = settings[interaction.guildId] || {
                    color: '#808080'
                };

                if (subcommand === 'show') {
                    const settingsEmbed = new EmbedBuilder()
                        .setColor(guildSettings.color)
                        .setTitle('⚙️ Giveaway Settings')
                        .addFields(
                            { name: 'Embed Color', value: guildSettings.color, inline: true }
                        )
                        .setFooter({ text: 'Mickey Trap Academy' })
                        .setTimestamp();

                    return await interaction.reply({ embeds: [settingsEmbed], flags: 64 });
                }

                if (subcommand === 'set-color') {
                    const color = interaction.options.getString('color');

                    // Validate hex color
                    if (!/^#[0-9A-F]{6}$/i.test(color)) {
                        return await interaction.reply({
                            content: '❌ Invalid hex color! Use format: #FF0000',
                            flags: 64
                        });
                    }

                    guildSettings.color = color;
                    settings[interaction.guildId] = guildSettings;
                    saveGiveawaySettings(settings);

                    return await interaction.reply({
                        content: `✅ Giveaway color changed to ${color}`,
                        flags: 64
                    });
                }

                if (subcommand === 'set-emoji') {
                    const emoji = interaction.options.getString('emoji');

                    guildSettings.emoji = emoji;
                    settings[interaction.guildId] = guildSettings;
                    saveGiveawaySettings(settings);

                    return await interaction.reply({
                        content: `✅ Giveaway emoji changed to ${emoji}`,
                        flags: 64
                    });
                }
            } catch (error) {
                console.error('Error in gsettings command:', error);
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
                
                // Use catch untuk optional fields
                let footerText = '';
                try {
                    footerText = interaction.fields.getTextInputValue('embed_footer');
                } catch (e) {
                    footerText = '';
                }

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
                if (footerText) {
                    embed.setFooter({ text: footerText });
                } else {
                    embed.setFooter({ text: 'Mickey Trap Academy' });
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

// Handle prefix commands & autoresponses
const PREFIX = 'ma.';

client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Ignore DMs
    if (!message.guild) return;


    try {
        // Handle prefix commands
        if (message.content.startsWith(PREFIX)) {
            const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
            const command = args[0].toLowerCase();

            // ma.roleicon [roleID/mention/name]
            if (command === 'roleicon') {
                try {
                    const roleInput = args.slice(1).join(' ');
                    if (!roleInput) {
                        return message.reply({ content: '❌ Gunakan: `ma.roleicon [roleID/mention/nama]`\nContoh: Reply ke image → `ma.roleicon @VIP`', flags: 64 });
                    }

                    let role;
                    // Check jika role ID
                    if (/^\d+$/.test(roleInput)) {
                        role = message.guild.roles.cache.get(roleInput);
                    } 
                    // Check jika mention role <@&id>
                    else if (roleInput.match(/^<@&(\d+)>$/)) {
                        const roleId = roleInput.match(/^<@&(\d+)>$/)[1];
                        role = message.guild.roles.cache.get(roleId);
                    }
                    // Check by name
                    else {
                        role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleInput.toLowerCase());
                    }

                    if (!role) {
                        return message.reply({ content: `❌ Role "${roleInput}" tidak ditemukan!`, flags: 64 });
                    }

                    // Check attachment dalam message atau dari reply
                    let attachment;
                    
                    // Cek attachment langsung dalam message
                    if (message.attachments.size > 0) {
                        attachment = message.attachments.first();
                    } 
                    // Cek dari reply message
                    else if (message.reference) {
                        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
                        if (!repliedMessage || repliedMessage.attachments.size === 0) {
                            return message.reply({ content: '❌ Message yang direply tidak memiliki attachment/gambar!', flags: 64 });
                        }
                        attachment = repliedMessage.attachments.first();
                    } 
                    else {
                        return message.reply({ content: '❌ Kirim gambar dalam 1 pesan dengan command atau balas ke message dengan gambar!', flags: 64 });
                    }

                    if (!attachment.contentType?.startsWith('image/')) {
                        return message.reply({ content: '❌ Attachment harus berupa gambar!', flags: 64 });
                    }

                    // Check permissions
                    if (!message.member.permissions.has('ManageRoles')) {
                        return message.reply({ content: '❌ Kamu tidak punya permission untuk mengubah role icon!', flags: 64 });
                    }

                    if (!message.guild.members.me.permissions.has('ManageRoles')) {
                        return message.reply({ content: '❌ Bot tidak punya permission untuk mengubah role icon!', flags: 64 });
                    }

                    // Set role icon
                    await role.setIcon(attachment.url);

                    const successEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('✅ Ikon Role Berhasil Diubah')
                        .setDescription(`Ikon untuk role **${role.name}** telah diperbarui!`)
                        .setThumbnail(attachment.url)
                        .setTimestamp();

                    await message.reply({ embeds: [successEmbed] });
                } catch (error) {
                    console.error('Error executing roleicon command:', error);
                    await message.reply({ content: `❌ Error: ${error.message}`, flags: 64 });
                }
            }

            // ma.inrole [roleID/mention/name]
            else if (command === 'inrole') {
                try {
                    const roleInput = args.slice(1).join(' ');
                    if (!roleInput) {
                        return message.reply({ content: '❌ Gunakan: `ma.inrole [roleID/mention/nama]`\nContoh: `ma.inrole 123456` atau `ma.inrole @VIP` atau `ma.inrole VIP`', flags: 64 });
                    }

                    let role;
                    // Check jika role ID
                    if (/^\d+$/.test(roleInput)) {
                        role = message.guild.roles.cache.get(roleInput);
                    }
                    // Check jika mention role <@&id>
                    else if (roleInput.match(/^<@&(\d+)>$/)) {
                        const roleId = roleInput.match(/^<@&(\d+)>$/)[1];
                        role = message.guild.roles.cache.get(roleId);
                    }
                    // Check by name
                    else {
                        role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleInput.toLowerCase());
                    }

                    if (!role) {
                        return message.reply({ content: `❌ Role "${roleInput}" tidak ditemukan!`, flags: 64 });
                    }

                    const members = role.members.toJSON();
                    let memberList = '';
                    
                    for (let i = 0; i < Math.min(members.length, 10); i++) {
                        memberList += `${i + 1}. ${members[i].user.username}\n`;
                    }

                    if (members.length > 10) {
                        memberList += `\n... dan ${members.length - 10} member lainnya`;
                    }

                    const inroleEmbed = new EmbedBuilder()
                        .setColor(role.color || '#808080')
                        .setTitle(`Members in Role: ${role.name} (${members.length})`)
                        .setDescription(memberList || 'Tidak ada member dalam role ini')
                        .setTimestamp();

                    await message.reply({ embeds: [inroleEmbed] });
                } catch (error) {
                    console.error('Error executing inrole command:', error);
                    await message.reply({ content: `❌ Error: ${error.message}`, flags: 64 });
                }
            }

            // ma.createrole [name] [color1] [color2]
            else if (command === 'createrole') {
                try {
                    if (!message.member.permissions.has('ManageRoles')) {
                        return message.reply({ content: '❌ Kamu tidak punya permission untuk membuat role!', flags: 64 });
                    }

                    const roleName = args[1];
                    const roleColor1 = args[2] || '#FF0000';
                    const roleColor2 = args[3] || '#0000FF';

                    if (!roleName) {
                        return message.reply({ content: '❌ Gunakan: `ma.createrole [name] [color1] [color2]`\nContoh: `ma.createrole VIP #FF0000 #0000FF`', flags: 64 });
                    }

                    const newRole = await message.guild.roles.create({
                        name: roleName,
                        color: roleColor1,
                        reason: `Role dibuat oleh ${message.author.tag}`
                    });

                    // Store gradient info untuk future reference (bisa update manual di Discord)
                    const gradientInfo = {
                        roleId: newRole.id,
                        color1: roleColor1,
                        color2: roleColor2,
                        createdBy: message.author.tag,
                        createdAt: new Date()
                    };

                    // Store di client untuk reference
                    if (!client.roleGradients) {
                        client.roleGradients = new Map();
                    }
                    client.roleGradients.set(newRole.id, gradientInfo);

                    const createEmbed = new EmbedBuilder()
                        .setColor(roleColor1)
                        .setTitle('✅ Role Berhasil Dibuat')
                        .setDescription(`Role **${newRole.name}** telah dibuat!\n\n⚠️ **Untuk apply Gradient Style:**\nGo to Server Settings → Roles → ${newRole.name} → Change Syle to "Gradient"`)
                        .addFields(
                            { name: 'Role ID', value: newRole.id, inline: true },
                            { name: 'Color 1', value: roleColor1, inline: true },
                            { name: 'Color 2', value: roleColor2, inline: true },
                            { name: 'Preview Gradient', value: `${roleColor1} ➜ ${roleColor2}`, inline: false }
                        )
                        .setTimestamp();

                    await message.reply({ embeds: [createEmbed] });
                } catch (error) {
                    console.error('Error executing createrole command:', error);
                    await message.reply({ content: `❌ Error: ${error.message}`, flags: 64 });
                }
            }

            // ma.meme - Random meme
            else if (command === 'meme') {
                try {
                    const response = await fetch('https://api.imgflip.com/get_memes');
                    const data = await response.json();

                    if (!data.success || !data.data.memes || data.data.memes.length === 0) {
                        return await message.reply({ content: '❌ Error fetching memes! Try again.', flags: 64 });
                    }

                    // Get random meme
                    const randomMeme = data.data.memes[Math.floor(Math.random() * data.data.memes.length)];

                    const memeEmbed = new EmbedBuilder()
                        .setTitle(randomMeme.name)
                        .setImage(randomMeme.url)
                        .setColor('#808080')
                        .setFooter({ text: `Meme #${randomMeme.id}` })
                        .setTimestamp();

                    await message.reply({ embeds: [memeEmbed] });
                } catch (error) {
                    console.error('Error fetching meme:', error);
                    await message.reply({ content: '❌ Error fetching meme! API sedang bermasalah.', flags: 64 });
                }
            }

            // ma.removebg - Remove background from image
            else if (command === 'removebg') {
                try {
                    const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;
                    
                    if (!REMOVE_BG_API_KEY) {
                        return message.reply({ 
                            content: '❌ Remove.bg API key tidak dikonfigurasi! Admin harus set REMOVE_BG_API_KEY di .env', 
                            flags: 64 
                        });
                    }

                    let imageUrl;

                    // Cek attachment langsung dalam message
                    if (message.attachments.size > 0) {
                        const attachment = message.attachments.first();
                        if (!attachment.contentType?.startsWith('image/')) {
                            return message.reply({ 
                                content: '❌ Attachment harus berupa gambar! (jpg, png, webp, dll)', 
                                flags: 64 
                            });
                        }
                        imageUrl = attachment.url;
                    }
                    // Cek dari reply message
                    else if (message.reference) {
                        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
                        
                        if (!repliedMessage) {
                            return message.reply({ 
                                content: '❌ Tidak bisa fetch message yang direply!', 
                                flags: 64 
                            });
                        }

                        if (repliedMessage.attachments.size === 0) {
                            return message.reply({ 
                                content: '❌ Message yang direply tidak punya attachment/gambar!', 
                                flags: 64 
                            });
                        }

                        const attachment = repliedMessage.attachments.first();
                        if (!attachment.contentType?.startsWith('image/')) {
                            return message.reply({ 
                                content: '❌ Attachment harus berupa gambar!', 
                                flags: 64 
                            });
                        }
                        imageUrl = attachment.url;
                    }
                    else {
                        return message.reply({ 
                            content: '❌ Gunakan: `ma.removebg` dengan attachment gambar atau balas ke message dengan gambar!\nContoh: Upload gambar → `ma.removebg`', 
                            flags: 64 
                        });
                    }

                    // Show loading message
                    const loadingMsg = await message.reply({ 
                        content: '⏳ Processing gambar... mohon tunggu (bisa sampai 10 detik)' 
                    });

                    try {
                        // Call remove.bg API
                        const response = await axios.post('https://api.remove.bg/v1.0/removebg', 
                            { image_url: imageUrl },
                            {
                                headers: {
                                    'X-Api-Key': REMOVE_BG_API_KEY
                                },
                                responseType: 'arraybuffer'
                            }
                        );

                        // Convert to Buffer
                        const imageBuffer = Buffer.from(response.data, 'binary');

                        // Generate filename
                        const fileName = `removebg_${Date.now()}.png`;

                        // Send image sebagai file
                        const successEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('✅ Background Removed!')
                            .setDescription('Background dari gambar kamu sudah dihilangkan!')
                            .setImage(`attachment://${fileName}`)
                            .setFooter({ text: 'Powered by remove.bg' })
                            .setTimestamp();

                        // Delete loading message
                        await loadingMsg.delete().catch(() => {});

                        // Send result
                        await message.reply({
                            embeds: [successEmbed],
                            files: [{
                                attachment: imageBuffer,
                                name: fileName
                            }]
                        });

                    } catch (apiError) {
                        // Delete loading message
                        await loadingMsg.delete().catch(() => {});

                        if (apiError.response?.status === 403) {
                            return message.reply({
                                content: '❌ API Key tidak valid atau quota habis! Cek di https://www.remove.bg/api',
                                flags: 64
                            });
                        } else if (apiError.response?.status === 402) {
                            return message.reply({
                                content: '❌ API quota habis! Bot owner perlu upgrade di https://www.remove.bg/api',
                                flags: 64
                            });
                        } else if (apiError.response?.status === 400) {
                            return message.reply({
                                content: '❌ Gambar tidak valid atau format tidak didukung! Coba gambar lain',
                                flags: 64
                            });
                        }
                        
                        throw apiError;
                    }

                } catch (error) {
                    console.error('Error executing removebg command:', error);
                    await message.reply({ 
                        content: `❌ Error: ${error.message || 'Terjadi kesalahan saat process gambar'}`, 
                        flags: 64 
                    });
                }
            }

            // ma.list - Show all prefix commands
            else if (command === 'list') {
                try {
                    const listEmbed = new EmbedBuilder()
                        .setColor('#808080')
                        .setTitle('Daftar Prefix Commands')
                        .setDescription('Semua available prefix commands:')
                        .addFields(
                            { 
                                name: 'ma.roleicon [ID/mention/nama]', 
                                value: 'Tampilkan info role dengan berbagai cara input\nContoh: `ma.roleicon @VIP` atau `ma.roleicon VIP`', 
                                inline: false 
                            },
                            { 
                                name: 'ma.inrole [ID/mention/nama]', 
                                value: 'Tampilkan list members dalam role (max 10)\nContoh: `ma.inrole @VIP` atau `ma.inrole VIP`', 
                                inline: false 
                            },
                            { 
                                name: 'ma.createrole [name] [color1] [color2]', 
                                value: 'Buat role baru dengan gradient\nContoh: `ma.createrole VIP #FF0000 #0000FF`\nPerlu: ManageRoles permission', 
                                inline: false 
                            },
                            { 
                                name: 'ma.removebg', 
                                value: 'Remove background dari gambar pakai remove.bg API\nContoh: Upload gambar → `ma.removebg` atau reply ke image → `ma.removebg`', 
                                inline: false 
                            },
                            { 
                                name: 'ma.meme', 
                                value: 'Kirim random meme dari internet 😂\nContoh: `ma.meme`', 
                                inline: false 
                            },
                            { 
                                name: 'ma.list', 
                                value: 'Tampilkan list semua commands', 
                                inline: false 
                            }
                        )
                        .setFooter({ text: 'Gunakan ma.[command] untuk menjalankan command' });

                    await message.reply({ embeds: [listEmbed] });
                } catch (error) {
                    console.error('Error executing list command:', error);
                    await message.reply({ content: `❌ Error: ${error.message}`, flags: 64 });
                }
            }

            return;
        }


        // Handle autoresponses
        if (client.autoResponses && client.autoResponses.size > 0) {
            const messageContent = message.content.toLowerCase();

            for (const [sentence, data] of client.autoResponses) {
                if (messageContent.includes(sentence)) {
                    // Delete trigger message jika enabled
                    if (data.deleteTrigger) {
                        await message.delete().catch(() => {});
                    }

                    // Send response
                    const responseText = data.mention ? `${message.author}` : '';
                    await message.reply({
                        content: responseText ? `${responseText} ${data.response}` : data.response,
                        allowedMentions: { repliedUser: data.mention }
                    }).catch(() => {});

                    break; // Hanya 1 autoresponse per message
                }
            }
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
});

// Handle message reaction add (giveaway join)
// Handle button interactions (giveaway buttons)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    try {
        const customId = interaction.customId;

        // Giveaway Join Button
        if (customId.startsWith('giveaway_join-')) {
            const giveawayId = customId.replace('giveaway_join-', '');
            const giveaways = loadGiveawayConfig();
            const giveaway = giveaways[giveawayId];

            if (!giveaway) {
                return await interaction.reply({ content: '❌ Giveaway not found!', flags: 64 });
            }

            if (giveaway.ended) {
                return await interaction.reply({ content: '❌ Giveaway already ended!', flags: 64 });
            }

            if (giveaway.participants.includes(interaction.user.id)) {
                return await interaction.reply({ content: '❌ You already joined!', flags: 64 });
            }

            giveaway.participants.push(interaction.user.id);
            saveGiveawayConfig(giveaways);

            // Update embed
            const channel = interaction.guild.channels.cache.get(giveaway.channelId);
            if (channel) {
                try {
                    const message = await channel.messages.fetch(giveaway.messageId);
                    const embed = message.embeds[0];
                    const newEmbed = new EmbedBuilder(embed.data)
                        .spliceFields(1, 1, {
                            name: '👥 Participants',
                            value: `${giveaway.participants.length}`,
                            inline: true
                        });
                    await message.edit({ embeds: [newEmbed] });
                } catch (error) {
                    console.error('Error updating embed:', error);
                }
            }

            await interaction.reply({ content: `✅ Joined! Total participants: ${giveaway.participants.length}`, flags: 64 });
        }

        // Giveaway Leave Button
        if (customId.startsWith('giveaway_leave-')) {
            const giveawayId = customId.replace('giveaway_leave-', '');
            const giveaways = loadGiveawayConfig();
            const giveaway = giveaways[giveawayId];

            if (!giveaway) {
                return await interaction.reply({ content: '❌ Giveaway not found!', flags: 64 });
            }

            if (!giveaway.participants.includes(interaction.user.id)) {
                return await interaction.reply({ content: '❌ You are not in this giveaway!', flags: 64 });
            }

            giveaway.participants = giveaway.participants.filter(id => id !== interaction.user.id);
            saveGiveawayConfig(giveaways);

            // Update embed
            const channel = interaction.guild.channels.cache.get(giveaway.channelId);
            if (channel) {
                try {
                    const message = await channel.messages.fetch(giveaway.messageId);
                    const embed = message.embeds[0];
                    const newEmbed = new EmbedBuilder(embed.data)
                        .spliceFields(1, 1, {
                            name: '👥 Participants',
                            value: `${giveaway.participants.length}`,
                            inline: true
                        });
                    await message.edit({ embeds: [newEmbed] });
                } catch (error) {
                    console.error('Error updating embed:', error);
                }
            }

            await interaction.reply({ content: `✅ Left giveaway! Total participants: ${giveaway.participants.length}`, flags: 64 });
        }

        // Giveaway Participants Button
        if (customId.startsWith('giveaway_participants-')) {
            const giveawayId = customId.replace('giveaway_participants-', '');
            const giveaways = loadGiveawayConfig();
            const giveaway = giveaways[giveawayId];

            if (!giveaway) {
                return await interaction.reply({ content: '❌ Giveaway not found!', flags: 64 });
            }

            if (giveaway.participants.length === 0) {
                return await interaction.reply({ content: '❌ No participants yet!', flags: 64 });
            }

            const participantsList = giveaway.participants.slice(0, 25).map((id, idx) => `${idx + 1}. <@${id}>`).join('\n');
            const remainingCount = giveaway.participants.length > 25 ? `\n\n... and ${giveaway.participants.length - 25} more` : '';

            const participantsEmbed = new EmbedBuilder()
                .setColor(giveaway.color || '#FF00FF')
                .setTitle(`👥 Participants (${giveaway.participants.length})`)
                .setDescription(participantsList + remainingCount)
                .setFooter({ text: `Giveaway: ${giveaway.prize}` });

            await interaction.reply({ embeds: [participantsEmbed], flags: 64 });
        }
    } catch (error) {
        console.error('Error handling button interaction:', error);
    }
});

// Handle guild member update (detect boost)
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
        // Check jika member baru boost server
        const wasNotBoosting = !oldMember.premiumSinceTimestamp;
        const isNowBoosting = newMember.premiumSinceTimestamp;

        if (wasNotBoosting && isNowBoosting) {
            // Member just boosted!
            const config = client.boosterConfig?.[newMember.guild.id];

            if (config?.channelId) {
                // Send thank-you message
                const channel = newMember.guild.channels.cache.get(config.channelId);
                if (channel) {
                    const boostEmbed = new EmbedBuilder()
                        .setColor('#FF00FF')
                        .setTitle('🎉 Terima Kasih atas Boostnya!')
                        .setDescription(`${newMember} baru aja **boost server** kami!\n\nTerima kasih sudah support server ini! 💜\n\n📌 **Silahkan klaim custom role kamu di** #╠・✨—custom-role-booster`)
                        .setThumbnail(newMember.user.displayAvatarURL())
                        .setTimestamp()
                        .setFooter({ text: 'Mickey Trap Academy Boosters' });

                    await channel.send({ embeds: [boostEmbed] }).catch(() => {});
                }
            }


        }
    } catch (error) {
        console.error('Error handling boost detection:', error);
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
