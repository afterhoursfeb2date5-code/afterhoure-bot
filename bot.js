const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, AttachmentBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const puppeteer = require('puppeteer');
require('dotenv').config();

const MusicSystem = require('./music-system');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
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
const AUTO_RESPONSES_FILE = path.join(CONFIG_DIR, 'autoresponses.json');
const INTRODUCTIONS_FILE = path.join(CONFIG_DIR, 'introductions.json');
const GREET_CONFIG_FILE = path.join(CONFIG_DIR, 'greet-config.json');

// Hardcoded Channel IDs
const HARDCODED_BOOSTER_CHANNEL_ID = '1468793035042062531';
const HARDCODED_LOGS_CHANNEL_ID = '1470227456396103859';
const HARDCODED_GREET_CHANNEL_ID = '1468776142864515263';

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

function loadAutoResponses() {
    try {
        if (fs.existsSync(AUTO_RESPONSES_FILE)) {
            const data = fs.readFileSync(AUTO_RESPONSES_FILE, 'utf8');
            const parsed = JSON.parse(data);
            // Convert array ke Map
            const autoResponses = new Map();
            if (Array.isArray(parsed)) {
                for (const item of parsed) {
                    autoResponses.set(item.sentence, {
                        response: item.response,
                        mention: item.mention || false,
                        deleteTrigger: item.deleteTrigger || false,
                        createdBy: item.createdBy,
                        createdAt: item.createdAt
                    });
                }
            }
            console.log(`📝 Loaded ${autoResponses.size} auto-responses`);
            return autoResponses;
        }
        return new Map();
    } catch (error) {
        console.error('Error loading auto-responses:', error);
        return new Map();
    }
}

function saveAutoResponses(autoResponses) {
    try {
        // Convert Map ke array
        const data = Array.from(autoResponses.entries()).map(([sentence, config]) => ({
            sentence,
            response: config.response,
            mention: config.mention,
            deleteTrigger: config.deleteTrigger,
            createdBy: config.createdBy,
            createdAt: config.createdAt
        }));
        fs.writeFileSync(AUTO_RESPONSES_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving auto-responses:', error);
    }
}

// Introduction functions
function loadIntroductions() {
    try {
        if (fs.existsSync(INTRODUCTIONS_FILE)) {
            return JSON.parse(fs.readFileSync(INTRODUCTIONS_FILE, 'utf8'));
        }
        return {};
    } catch (error) {
        console.error('Error loading introductions:', error);
        return {};
    }
}

function saveIntroductions(introductions) {
    try {
        fs.writeFileSync(INTRODUCTIONS_FILE, JSON.stringify(introductions, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving introductions:', error);
    }
}

// Greeting functions
function loadGreetConfig() {
    try {
        if (fs.existsSync(GREET_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(GREET_CONFIG_FILE, 'utf8'));
        }
        return {};
    } catch (error) {
        console.error('Error loading greet config:', error);
        return {};
    }
}

function saveGreetConfig(config) {
    try {
        fs.writeFileSync(GREET_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving greet config:', error);
    }
}

// Format greeting message with variables
function formatGreetMessage(template, member, guild) {
    return template
        .replace(/{user}/g, member.user.username)
        .replace(/{mention}/g, member.toString())
        .replace(/{server}/g, guild.name)
        .replace(/{memberCount}/g, guild.memberCount)
        .replace(/{tag}/g, member.user.tag);
}

// Reaction Roles functions
const REACTION_ROLES_FILE = path.join(CONFIG_DIR, 'reaction-roles.json');

function loadReactionRoles() {
    try {
        if (fs.existsSync(REACTION_ROLES_FILE)) {
            return JSON.parse(fs.readFileSync(REACTION_ROLES_FILE, 'utf8'));
        }
        return {};
    } catch (error) {
        console.error('Error loading reaction roles:', error);
        return {};
    }
}

function saveReactionRoles(reactionRoles) {
    try {
        fs.writeFileSync(REACTION_ROLES_FILE, JSON.stringify(reactionRoles, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving reaction roles:', error);
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
        .setName('suggest')
        .setDescription('Submit a suggestion to the server'),
    new SlashCommandBuilder()
        .setName('disconnect')
        .setDescription('Disconnect bot from voice channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder()
        .setName('introduction')
        .setDescription('Create your introduction card'),
    new SlashCommandBuilder()
        .setName('reaction-role')
        .setDescription('Manage reaction roles')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Setup reaction role for a message')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('Message ID to setup reaction role on')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('parent_role_id')
                        .setDescription('Parent role ID (optional - auto-given with child role)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all reaction-role mappings for a message')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('Message ID to list')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a reaction-role mapping')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('Message ID')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('Emoji to remove')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    new SlashCommandBuilder()
        .setName('set')
        .setDescription('Configure server settings (Admin only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('greet-message')
                .setDescription('Set welcome message template')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Welcome message (use {user}, {mention}, {server}, {memberCount}, {tag})')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('test-greet')
        .setDescription('Test the welcome message'),
].map(command => command.toJSON());

// Helper function to send logs
async function sendLog(guild, title, description, color = '#FF9900') {
    try {
        const logsChannel = guild.channels.cache.get(HARDCODED_LOGS_CHANNEL_ID);
        if (!logsChannel) return; // Logs channel tidak ada
        
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
                        .setFooter({ text: '𝐀 𝐟 𝐭 𝐞 𝐫 — 𝐇 𝐨 𝐮 𝐫 𝐬' })
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

client.once('clientReady', async () => {
    console.log(`✅ ${client.user.tag} udah online!`);
    console.log(`🏠 Di ${client.guilds.cache.size} server`);
    
    // Load configs from file
    client.boosterConfig = loadBoosterConfig();
    client.logsConfig = loadLogsConfig();
    client.autoResponses = loadAutoResponses();
    client.introductions = loadIntroductions();
    client.reactionRoles = loadReactionRoles();
    
    // Initialize Music System
    client.musicSystem = new MusicSystem(client);
    console.log('🎵 Music system initialized');
    
    // Temp storage while user memilih age sebelum submit modal
    client._introTemp = new Map();
    console.log('📁 Configs loaded from file');

    // Log voice state setup
    console.log('✅ Voice State Update listener ready!');
    
    // Set rotating presence
    const activities = [
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
                    embed.setFooter({ text: '          ' });
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

                if (replyToId) {
                    try {
                        const messageToReply = await interaction.channel.messages.fetch(replyToId);
                        await messageToReply.reply(messageOptions);
                    } catch (error) {
                        console.error('Error fetching message to reply:', error);
                        return await interaction.reply({ 
                            content: '❌ Message ID tidak ditemukan atau sudah dihapus!', 
                            flags: 64 
                        });
                    }
                } else {
                    await interaction.channel.send(messageOptions);
                }

                // Reply dengan notifikasi, auto-delete dalam 1 detik
                const reply = await interaction.reply({ 
                    content: '✅ Message berhasil dikirim!', 
                    flags: 64 
                });
                
                setTimeout(() => reply.delete().catch(() => {}), 1000);
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
                    createdAt: new Date().toISOString()
                });
                
                // Save ke file
                saveAutoResponses(client.autoResponses);

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
                
                // Save ke file
                saveAutoResponses(client.autoResponses);

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

                // Set connection in music system queue
                const queue = client.musicSystem.getQueue(interaction.guildId);
                queue.connection = connection;

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

                // Clear music queue connection
                const queue = client.musicSystem.getQueue(guildId);
                queue.connection = null;
                queue.playing = false;

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

        if (commandName === 'suggest') {
            try {
                const modal = new ModalBuilder()
                    .setCustomId('suggestion_modal')
                    .setTitle('New Suggestion');

                const textInput = new TextInputBuilder()
                    .setCustomId('suggestion_text')
                    .setLabel('Tuliskan saran dan masukan')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const actionRow = new ActionRowBuilder().addComponents(textInput);
                modal.addComponents(actionRow);

                await interaction.showModal(modal);
            } catch (error) {
                console.error('Error showing suggestion modal:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (commandName === 'introduction') {
            try {
                // Create age select menu - langsung tampil saat command dijalankan
                const ageSelect = new StringSelectMenuBuilder()
                    .setCustomId('intro_age_select')
                    .setPlaceholder('Pilih kategori umur')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('18+')
                            .setValue('18plus')
                            .setDescription('18 tahun ke atas'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('18-')
                            .setValue('18minus')
                            .setDescription('Di bawah 18 tahun')
                    );

                const row = new ActionRowBuilder().addComponents(ageSelect);

                await interaction.reply({
                    content: '📋 Pilih kategori umur kamu terlebih dahulu:',
                    components: [row],
                    flags: 64
                });
            } catch (error) {
                console.error('Error showing age select:', error);
                await interaction.reply({ content: `❌ Error: ${error.message}`, flags: 64 });
            }
        }

        if (commandName === 'reaction-role') {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'setup') {
                try {
                    const messageId = interaction.options.getString('message_id');
                    const parentRoleId = interaction.options.getString('parent_role_id');

                    // Verify message exists
                    let message;
                    try {
                        message = await interaction.channel.messages.fetch(messageId);
                    } catch (error) {
                        return await interaction.reply({
                            content: '❌ Message tidak ditemukan! Pastikan message ID valid dan di channel ini.',
                            flags: 64
                        });
                    }

                    // Verify parent role exists if provided
                    if (parentRoleId) {
                        const role = interaction.guild.roles.cache.get(parentRoleId);
                        if (!role) {
                            return await interaction.reply({
                                content: '❌ Parent role ID tidak valid!',
                                flags: 64
                            });
                        }
                    }

                    // Initialize temp storage for this user
                    if (!client._reactionRoleSetup) {
                        client._reactionRoleSetup = new Map();
                    }

                    // Create modal
                    const modal = new ModalBuilder()
                        .setCustomId(`reaction_role_modal_${messageId}:${parentRoleId || 'none'}`)
                        .setTitle('Setup Reaction Roles');

                    const instructions = new TextInputBuilder()
                        .setCustomId('rr_instructions')
                        .setLabel('Format: emoji:@role')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Standard emoji: 🎮:@Gamers\nCustom emoji: <:emoji_name:123456>:@Role\n🎨:@Artists')
                        .setRequired(true);

                    const row = new ActionRowBuilder().addComponents(instructions);
                    modal.addComponents(row);

                    await interaction.showModal(modal);
                } catch (error) {
                    console.error('Error in reaction-role setup:', error);
                    await interaction.reply({
                        content: `❌ Error: ${error.message}`,
                        flags: 64
                    });
                }
            }

            else if (subcommand === 'list') {
                try {
                    const messageId = interaction.options.getString('message_id');
                    const reactionRoles = client.reactionRoles || {};

                    if (!reactionRoles[messageId]) {
                        return await interaction.reply({
                            content: '❌ Tidak ada reaction role setup untuk message ini!',
                            flags: 64
                        });
                    }

                    const config = reactionRoles[messageId];
                    const listEmbed = new EmbedBuilder()
                        .setColor('#00D9FF')
                        .setTitle('📋 Reaction Role Mappings')
                        .setDescription(`Message ID: \`${messageId}\``)
                        .setTimestamp();

                    // Show parent role if exists
                    if (config.parentRole) {
                        const parentRole = interaction.guild.roles.cache.get(config.parentRole);
                        listEmbed.addFields({
                            name: '👑 Parent Role',
                            value: `<@&${config.parentRole}> (${parentRole?.name || 'Unknown'})`,
                            inline: false
                        });
                    }

                    // Show child roles
                    const mappings = config.roles || config; // Support old format too
                    for (const [emoji, roleId] of Object.entries(mappings)) {
                        if (emoji === 'parentRole') continue; // Skip parentRole field
                        const role = interaction.guild.roles.cache.get(roleId);
                        const roleDisplay = role ? role.name : `Unknown (${roleId})`;
                        listEmbed.addFields({
                            name: emoji,
                            value: `<@&${roleId}> (${roleDisplay})`,
                            inline: false
                        });
                    }

                    await interaction.reply({ embeds: [listEmbed], flags: 64 });
                } catch (error) {
                    console.error('Error listing reaction roles:', error);
                    await interaction.reply({
                        content: `❌ Error: ${error.message}`,
                        flags: 64
                    });
                }
            }

            else if (subcommand === 'remove') {
                try {
                    const messageId = interaction.options.getString('message_id');
                    const emoji = interaction.options.getString('emoji');
                    const reactionRoles = client.reactionRoles || {};

                    if (!reactionRoles[messageId]) {
                        return await interaction.reply({
                            content: `❌ Message ID tidak ditemukan!`,
                            flags: 64
                        });
                    }

                    const config = reactionRoles[messageId];
                    const roles = config.roles || config;

                    if (!roles[emoji]) {
                        return await interaction.reply({
                            content: `❌ Emoji \`${emoji}\` tidak ditemukan untuk message ini!`,
                            flags: 64
                        });
                    }

                    delete roles[emoji];

                    // Jika roles ada, update dengan struktur baru
                    if (config.roles) {
                        config.roles = roles;
                    } else {
                        // Update old format
                        reactionRoles[messageId] = roles;
                    }

                    // Jika tidak ada emoji lagi, hapus message entry
                    if (Object.keys(roles).length === 0) {
                        delete reactionRoles[messageId];
                    }

                    client.reactionRoles = reactionRoles;
                    saveReactionRoles(reactionRoles);

                    const removeEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('✅ Reaction Role Dihapus')
                        .addFields({
                            name: 'Emoji',
                            value: emoji,
                            inline: true
                        })
                        .setTimestamp();

                    await interaction.reply({ embeds: [removeEmbed], flags: 64 });
                } catch (error) {
                    console.error('Error removing reaction role:', error);
                    await interaction.reply({
                        content: `❌ Error: ${error.message}`,
                        flags: 64
                    });
                }
            }
        }

        // Set command - configurable settings
        if (commandName === 'set') {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'greet-message') {
                try {
                    const message = interaction.options.getString('message');
                    const greetConfig = loadGreetConfig();

                    if (!greetConfig[interaction.guildId]) {
                        greetConfig[interaction.guildId] = {};
                    }

                    greetConfig[interaction.guildId].message = message;
                    saveGreetConfig(greetConfig);

                    const successEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('✅ Greet Message Set')
                        .setDescription(`Template pesan telah diubah`)
                        .addFields(
                            { name: 'Template', value: `\`\`\`${message}\`\`\``, inline: false },
                            { name: 'Available Variables', value: '{user} = username\n{mention} = mention user\n{server} = server name\n{memberCount} = total members\n{tag} = user#tag', inline: false }
                        )
                        .setTimestamp();

                    await interaction.reply({ embeds: [successEmbed], flags: 64 });
                } catch (error) {
                    console.error('Error setting greet message:', error);
                    await interaction.reply({
                        content: `❌ Error: ${error.message}`,
                        flags: 64
                    });
                }
            }
        }

        // Test greet command
        if (commandName === 'test-greet') {
            try {
                const greetConfig = loadGreetConfig();
                const config = greetConfig[interaction.guildId];

                if (!config || !config.message) {
                    return await interaction.reply({
                        content: '❌ Greeting message belum dikonfigurasi! Set message dulu menggunakan `/set greet-message`',
                        flags: 64
                    });
                }

                const channel = interaction.guild.channels.cache.get(HARDCODED_GREET_CHANNEL_ID);
                if (!channel) {
                    return await interaction.reply({
                        content: '❌ Greet channel tidak valid atau sudah dihapus!',
                        flags: 64
                    });
                }

                // Format message
                const formattedMessage = formatGreetMessage(config.message, interaction.member, interaction.guild);

                await channel.send(formattedMessage);

                const testEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ Test Message Sent')
                    .setDescription(`Pesan test dikirim ke ${channel.toString()}`)
                    .setTimestamp();

                await interaction.reply({ embeds: [testEmbed], flags: 64 });
            } catch (error) {
                console.error('Error testing greet:', error);
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
                const embed = new EmbedBuilder();

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
                const footerIcon = 'https://i.imgur.com/U76N6jc.png';
                if (footerText) {
                    embed.setFooter({ text: footerText, iconURL: footerIcon });
                } else {
                    embed.setFooter({ text: '𝐀 𝐟 𝐭 𝐞 𝐫 — 𝐇 𝐨 𝐮 𝐫 𝐬', iconURL: footerIcon });
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

        if (interaction.customId === 'suggestion_modal') {
            try {
                const suggestionText = interaction.fields.getTextInputValue('suggestion_text');
                const suggestionsChannelId = '1470305240489132042';

                const suggestionsChannel = interaction.guild.channels.cache.get(suggestionsChannelId);
                if (!suggestionsChannel) {
                    return await interaction.reply({
                        content: '❌ Suggestions channel tidak ditemukan!',
                        flags: 64
                    });
                }

                // Create suggestion embed
                const suggestionEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setAuthor({
                        name: "New Suggestion!",
                        iconURL: "https://i.imgur.com/U76N6jc.png"
                    })
                    .addFields({
                        name: '<:ide:1470352870011306004> Submitter:',
                        value: `${interaction.user.username} | <@${interaction.user.id}>`,
                        inline: false
                    },
                    {
                        name: '<:suggest:1470352894560698534> Suggestion:',
                        value: suggestionText,
                        inline: false
                    })
                    .setThumbnail(interaction.user.displayAvatarURL());

                // Create suggestion box button (gray color)
                const suggestionBoxButton = new ButtonBuilder()
                    .setCustomId('suggestion_box_button')
                    .setLabel('Suggestion Box')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('<:isi:1470354854483329190>');

                const boxRow = new ActionRowBuilder().addComponents(suggestionBoxButton);

                // Send to suggestions channel
                await suggestionsChannel.send({
                    embeds: [suggestionEmbed],
                    components: [boxRow]
                });

                // Reply to user with auto-delete after 2 seconds
                const reply = await interaction.reply({
                    content: '✅ Suggestion berhasil dikirim!',
                    flags: 64
                });
                setTimeout(() => {
                    reply.delete().catch(console.error);
                }, 2000);
            } catch (error) {
                console.error('Error processing suggestion:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (interaction.customId === 'intro_form_modal') {
            try {
                const name = interaction.fields.getTextInputValue('intro_name');
                const hobby = interaction.fields.getTextInputValue('intro_hobby');
                const about = interaction.fields.getTextInputValue('intro_about');

                // Get age yang sudah disimpan
                const tempData = client._introTemp.get(interaction.user.id) || {};
                const age = tempData.age === '18plus' ? '18+' : '18-';

                // Create introduction embed matching Python example appearance
                const colorDark = 0x2D2D41; // rgb(45,45,65)
                const dateStr = new Date().toLocaleDateString('en-GB'); // dd/mm/YYYY
                const introEmbed = new EmbedBuilder()
                    .setColor(colorDark)
                    .setAuthor({
                        name: "Introduction Card!",
                        iconURL: "https://i.imgur.com/U76N6jc.png"
                    })
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .addFields(
                        { name: 'Name', value: `\`\`\`${name}\`\`\``, inline: true },
                        { name: 'Age', value: `\`\`\`${age}\`\`\``, inline: true },
                        { name: 'Hobby', value: `\`\`\`${hobby}\`\`\``, inline: false },
                        { name: 'About Me', value: `\`\`\`${about || '-'}\`\`\``, inline: false }
                    )
                    .setFooter({ text: `Intro dari ${interaction.user.username} • ${dateStr}`})

                // Create introduction button for starting intro process
                const introButton = new ButtonBuilder()
                    .setCustomId('start_intro_button')
                    .setLabel('Introduction Yourself')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('<:Intro:1470932555984273408>');

                const row = new ActionRowBuilder().addComponents(introButton);

                // Send to introduction channel
                const introChannelId = '1468647406253117551'; // Ganti dengan channel ID intro kamu
                const introChannel = interaction.guild.channels.cache.get(introChannelId);

                if (introChannel) {
                    await introChannel.send({
                        embeds: [introEmbed],
                        components: [row]
                    });
                }

                // Save introduction to file
                const introductions = client.introductions || {};
                introductions[interaction.user.id] = {
                    userId: interaction.user.id,
                    name: name,
                    age: age,
                    hobby: hobby,
                    about: about,
                    username: interaction.user.username,
                    avatar: interaction.user.displayAvatarURL(),
                    submittedAt: new Date()
                };
                client.introductions = introductions;
                saveIntroductions(introductions);

                // Clean up temp data
                client._introTemp.delete(interaction.user.id);

                // Reply to user
                const successReply = await interaction.reply({
                    content: '✅ Introduction berhasil dikirim! Terima kasih sudah memperkenalkan diri! 🎉',
                    flags: 64
                });

                setTimeout(() => {
                    successReply.delete().catch(console.error);
                }, 3000);
            } catch (error) {
                console.error('Error processing introduction:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        // Reaction Role Modal Handler
        if (interaction.customId.startsWith('reaction_role_modal_')) {
            try {
                // Defer reply immediately to avoid timeout
                await interaction.deferReply({ ephemeral: true });

                // Parse messageId and parentRoleId from customId (format: reaction_role_modal_messageId:parentRoleId)
                const customIdContent = interaction.customId.replace('reaction_role_modal_', ''); // Remove prefix
                const parts = customIdContent.split(':'); // Split by colon
                const messageId = parts[0];
                const parentRoleId = parts[1] === 'none' ? null : parts[1];

                const input = interaction.fields.getTextInputValue('rr_instructions');

                // Parse input dengan logic yang lebih smart untuk custom emoji
                const lines = input.split('\n').filter(line => line.trim());
                const mappings = {};
                const failedLines = [];

                for (const line of lines) {
                    // Handle custom emoji format: <:name:id>:@role atau standard emoji: 🎮:@role
                    let emoji, roleInput;
                    
                    // Check if line contains custom emoji <:...:...>
                    const customEmojiMatch = line.match(/^(<:[^:]+:\d+>)\s*:\s*(.+)$/);
                    if (customEmojiMatch) {
                        emoji = customEmojiMatch[1];
                        roleInput = customEmojiMatch[2].trim();
                    } else {
                        // Standard emoji or Unicode
                        const standardMatch = line.match(/^(.+?)\s*:\s*(.+)$/);
                        if (!standardMatch) {
                            failedLines.push(`❌ \`${line}\` - Format tidak valid`);
                            continue;
                        }
                        emoji = standardMatch[1].trim();
                        roleInput = standardMatch[2].trim();
                    }

                    // Validate emoji is not empty
                    if (!emoji) {
                        failedLines.push(`❌ Emoji tidak ditemukan`);
                        continue;
                    }

                    // Parse role (remove @ if present)
                    let role;
                    const roleQuery = roleInput.replace(/^@/, '').trim();

                    // Try to find role by mention first
                    if (roleInput.match(/^<@&(\d+)>$/)) {
                        const roleId = roleInput.match(/^<@&(\d+)>$/)[1];
                        role = interaction.guild.roles.cache.get(roleId);
                    }
                    // Try to find role by name
                    else {
                        role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleQuery.toLowerCase());
                    }

                    if (!role) {
                        failedLines.push(`❌ ${emoji} → Role "${roleQuery}" tidak ditemukan!`);
                        continue;
                    }

                    // Check if emoji already mapped (avoid duplicates)
                    if (mappings[emoji]) {
                        failedLines.push(`⚠️ ${emoji} → Sudah di-map ke role lain, skip`);
                        continue;
                    }

                    mappings[emoji] = role.id;
                }

                if (Object.keys(mappings).length === 0) {
                    return await interaction.editReply({
                        content: `❌ Tidak ada mapping yang valid!\n${failedLines.join('\n')}`
                    });
                }

                // Save to file with new structure
                const reactionRoles = client.reactionRoles || {};
                reactionRoles[messageId] = {
                    parentRole: parentRoleId,
                    roles: mappings
                };
                client.reactionRoles = reactionRoles;
                saveReactionRoles(reactionRoles);

                // Add reactions to message with better error handling
                let addedCount = 0;
                const failedReactions = [...failedLines]; // Include parsing failures

                const message = await interaction.channel.messages.fetch(messageId).catch(err => {
                    failedReactions.push(`❌ Message ID invalid - tidak bisa fetch message`);
                    return null;
                });

                if (message) {
                    for (const emoji of Object.keys(mappings)) {
                        try {
                            // Validate emoji is not empty
                            if (!emoji || emoji.length === 0) {
                                failedReactions.push(`❌ Empty emoji - skip`);
                                continue;
                            }

                            // Validate emoji is not too long (reasonable limit)
                            if (emoji.length > 100) {
                                console.warn(`Emoji too long: ${emoji}`);
                                failedReactions.push(`⚠️ ${emoji} (terlalu panjang)`);
                                continue;
                            }

                            await message.react(emoji);
                            addedCount++;
                            console.log(`✅ Added reaction ${emoji} to message`);
                        } catch (error) {
                            console.error(`Error adding reaction ${emoji}:`, error.message);
                            failedReactions.push(`⚠️ ${emoji} → ${error.message}`);
                        }
                    }
                }

                const parentRoleDisplay = parentRoleId ? `<@&${parentRoleId}>` : 'None';
                const successEmbed = new EmbedBuilder()
                    .setColor(failedReactions.length > 0 ? '#FFAA00' : '#00FF00')
                    .setTitle(failedReactions.length > 0 ? '⚠️ Reaction Roles Setup (Partial)' : '✅ Reaction Roles Setup')
                    .setDescription(`${addedCount} reactions berhasil ditambahkan${failedReactions.length > 0 ? `, ${failedReactions.length} gagal/error` : ''}`)
                    .addFields({
                        name: '👑 Parent Role',
                        value: parentRoleDisplay,
                        inline: true
                    }, {
                        name: '✅ Emoji-Role Mappings',
                        value: Object.entries(mappings).map(([emoji, roleId]) => {
                            const role = interaction.guild.roles.cache.get(roleId);
                            return `${emoji} → ${role?.name || 'Unknown'}`;
                        }).join('\n') || 'None',
                        inline: false
                    });

                if (failedReactions.length > 0) {
                    // Split into multiple embeds if too many failures
                    const failureTexts = [];
                    let currentText = '';
                    
                    for (const fail of failedReactions) {
                        if ((currentText + fail).length > 1024) {
                            failureTexts.push(currentText);
                            currentText = fail + '\n';
                        } else {
                            currentText += (currentText ? '\n' : '') + fail;
                        }
                    }
                    if (currentText) failureTexts.push(currentText);

                    if (failureTexts.length <= 2) {
                        successEmbed.addFields({
                            name: '⚠️ Issues',
                            value: failureTexts.join('\n') || 'None',
                            inline: false
                        });
                    } else {
                        successEmbed.addFields({
                            name: '⚠️ Issues (1/' + failureTexts.length + ')',
                            value: failureTexts[0] || 'None',
                            inline: false
                        });
                    }
                }

                successEmbed.setTimestamp();
                await interaction.editReply({ embeds: [successEmbed] });
            } catch (error) {
                console.error('Error processing reaction role modal:', error);
                try {
                    await interaction.editReply({
                        content: `❌ Error: ${error.message}`
                    });
                } catch (e) {
                    console.error('Failed to send error reply:', e.message);
                }
            }
        }
    }

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



        // Handle Introduction button - trigger age selection & form
        if (interaction.customId === 'start_intro_button') {
            try {
                // Create age select menu - langsung tampil saat button diklik
                const ageSelect = new StringSelectMenuBuilder()
                    .setCustomId('intro_age_select')
                    .setPlaceholder('Pilih kategori umur')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('18+')
                            .setValue('18plus')
                            .setDescription('18 tahun ke atas'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('18-')
                            .setValue('18minus')
                            .setDescription('Di bawah 18 tahun')
                    );

                const row = new ActionRowBuilder().addComponents(ageSelect);

                await interaction.reply({
                    content: '📋 Pilih kategori umur kamu terlebih dahulu:',
                    components: [row],
                    flags: 64
                });
            } catch (error) {
                console.error('Error showing age select from button:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        // Handle view introduction profile buttons (deprecated - replaced by start_intro_button)
        if (interaction.customId.startsWith('view_intro_')) {
            try {
                const userId = interaction.customId.replace('view_intro_', '');
                const introductions = client.introductions || {};
                const intro = introductions[userId];

                if (!intro) {
                    return await interaction.reply({
                        content: '❌ Introduction tidak ditemukan!',
                        flags: 64
                    });
                }

                const dateStrProfile = new Date(intro.submittedAt).toLocaleDateString('en-GB');
                const profileEmbed = new EmbedBuilder()
                    .setColor(colorDark)
                    .setTitle(`✨ ${intro.name}`)
                    .setDescription(`Halo! Selamat datang 👋`)
                    .setThumbnail(intro.avatar)
                    .addFields(
                        { name: 'Name', value: `\`\`\`${intro.name}\`\`\``, inline: true },
                        { name: 'Age', value: `\`\`\`${intro.age}\`\`\``, inline: true },
                        { name: 'Hobby', value: `\`\`\`${intro.hobby}\`\`\``, inline: false },
                        { name: 'About Me', value: `\`\`\`${intro.about || '-'}\`\`\``, inline: false }
                    )
                    .setFooter({ text: `Intro dari ${intro.username} • ${dateStrProfile}`, iconURL: intro.avatar })

                await interaction.reply({
                    embeds: [profileEmbed],
                    flags: 64
                });
            } catch (error) {
                console.error('Error viewing introduction:', error);
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    flags: 64
                });
            }
        }

        if (interaction.customId === 'suggestion_box_button') {
            try {
                const modal = new ModalBuilder()
                    .setCustomId('suggestion_modal')
                    .setTitle('New Suggestion');

                const textInput = new TextInputBuilder()
                    .setCustomId('suggestion_text')
                    .setLabel('Tuliskan saran dan masukan')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const actionRow = new ActionRowBuilder().addComponents(textInput);
                modal.addComponents(actionRow);

                await interaction.showModal(modal);
            } catch (error) {
                console.error('Error showing suggestion modal:', error);
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
            if (interaction.customId === 'intro_age_select') {
                const ageValue = interaction.values[0];

                // Store age temporarily
                if (!client._introTemp) {
                    client._introTemp = new Map();
                }
                client._introTemp.set(interaction.user.id, { age: ageValue });

                // Show introduction form modal
                const modal = new ModalBuilder()
                    .setCustomId('intro_form_modal')
                    .setTitle('Introduce Yourself');

                const nameInput = new TextInputBuilder()
                    .setCustomId('intro_name')
                    .setLabel('Nama')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Masukkan nama kamu')
                    .setRequired(true);

                const hobbyInput = new TextInputBuilder()
                    .setCustomId('intro_hobby')
                    .setLabel('Hobby')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Apa hobby mu?')
                    .setRequired(true);

                const aboutInput = new TextInputBuilder()
                    .setCustomId('intro_about')
                    .setLabel('About You')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Ceritakan sesuatu tentang dirimu...')
                    .setRequired(true);

                const row1 = new ActionRowBuilder().addComponents(nameInput);
                const row2 = new ActionRowBuilder().addComponents(hobbyInput);
                const row3 = new ActionRowBuilder().addComponents(aboutInput);

                modal.addComponents(row1, row2, row3);

                await interaction.showModal(modal);

                // Try to remove the original age-select message so it's not left visible
                // (works for ephemeral responses; swallow any errors)
                try {
                    await interaction.deleteReply().catch(() => {});
                } catch (e) {
                    // ignore
                }
            }
        } catch (error) {
            console.error('Error handling string select menu:', error);
        }
    }
});

// Handle prefix commands & autoresponses
const PREFIX = 'fam.';

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

            // fam.roleicon [roleID/mention/name]
            if (command === 'roleicon') {
                try {
                    const roleInput = args.slice(1).join(' ');
                    if (!roleInput) {
                        return message.reply({ content: '❌ Gunakan: `fam.roleicon [roleID/mention/nama]`\nContoh: Reply ke image → `fam.roleicon @VIP`', flags: 64 });
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

            // fam.inrole [roleID/mention/name]
            else if (command === 'inrole') {
                try {
                    const roleInput = args.slice(1).join(' ');
                    if (!roleInput) {
                        return message.reply({ content: '❌ Gunakan: `fam.inrole [roleID/mention/nama]`\nContoh: `fam.inrole 123456` atau `fam.inrole @VIP` atau `fam.inrole VIP`', flags: 64 });
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

            // fam.createrole [name] [color1] [color2]
            else if (command === 'createrole') {
                try {
                    if (!message.member.permissions.has('ManageRoles')) {
                        return message.reply({ content: '❌ Kamu tidak punya permission untuk membuat role!', flags: 64 });
                    }

                    const roleName = args[1];
                    const roleColor1 = args[2] || '#FF0000';
                    const roleColor2 = args[3] || '#0000FF';

                    if (!roleName) {
                        return message.reply({ content: '❌ Gunakan: `fam.createrole [name] [color1] [color2]`\nContoh: `fam.createrole VIP #FF0000 #0000FF`', flags: 64 });
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

            // fam.removebg - Remove background from image
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
                            content: '❌ Gunakan: `fam.removebg` dengan attachment gambar atau balas ke message dengan gambar!\nContoh: Upload gambar → `fam.removebg`', 
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
                            .setFooter({ text: `Request by ${message.author.username}` })
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

            // fam.list - Show all prefix commands
            else if (command === 'list') {
                try {
                    const listEmbed = new EmbedBuilder()
                        .setColor('#808080')
                        .setTitle('Daftar Prefix Commands')
                        .setDescription('Semua available prefix commands:')
                        .addFields(
                            { 
                                name: 'fam.roleicon [ID/mention/nama]', 
                                value: 'Tampilkan info role dengan berbagai cara input\nContoh: `fam.roleicon @VIP` atau `fam.roleicon VIP`', 
                                inline: false 
                            },
                            { 
                                name: 'fam.inrole [ID/mention/nama]', 
                                value: 'Tampilkan list members dalam role (max 10)\nContoh: `fam.inrole @VIP` atau `fam.inrole VIP`', 
                                inline: false 
                            },
                            { 
                                name: 'fam.createrole [name] [color1] [color2]', 
                                value: 'Buat role baru dengan gradient\nContoh: `fam.createrole VIP #FF0000 #0000FF`\nPerlu: ManageRoles permission', 
                                inline: false 
                            },
                            { 
                                name: 'fam.removebg', 
                                value: 'Remove background dari gambar pakai remove.bg API\nContoh: Upload gambar → `fam.removebg` atau reply ke image → `fam.removebg`', 
                                inline: false 
                            },
                            { 
                                name: '🎵 Music Commands (Spotify + YouTube)', 
                                value: '`fam.play` `fam.skip` `fam.pause` `fam.resume` `fam.queue` `fam.stop` `fam.shuffle` `fam.loop` `fam.nowplaying`', 
                                inline: false 
                            },
                            { 
                                name: 'fam.play [query/URL]', 
                                value: '✨ **HYBRID SEARCH!**\n🎵 Cari di Spotify dulu (album art, metadata)\n▶️ Stream dari YouTube (compatibility)\n📍 Contoh: `fam.play bohemian rhapsody`\nWorks: Lagu, artist, URL Spotify\n\n*Source badges:*\n🎵 = Spotify found, YouTube stream\n▶️ = YouTube only\n🟢 = Spotify only (can\'t stream)', 
                                inline: false 
                            },
                            { 
                                name: 'fam.list', 
                                value: 'Tampilkan list semua commands', 
                                inline: false 
                            }
                        )
                        .setFooter({ text: 'Gunakan fam.[command] untuk menjalankan command | Spotify credentials: ' + (SPOTIFY_CLIENT_ID ? '✅ Configured' : '❌ Missing') });

                    await message.reply({ embeds: [listEmbed] });
                } catch (error) {
                    console.error('Error executing list command:', error);
                    await message.reply({ content: `❌ Error: ${error.message}`, flags: 64 });
                }
            }

            // ===== MUSIC COMMANDS =====

            // fam.play [YouTube URL / Spotify URL / query] - Hybrid search
            else if (command === 'play') {
                try {
                    const query = args.slice(1).join(' ');
                    if (!query) {
                        return message.reply({ 
                            content: '❌ Gunakan: `fam.play [lagu/artist/URL]`\n📍 Contoh:\n• `fam.play bohemian rhapsody`\n• `fam.play never gonna give you up`\n• `fam.play https://open.spotify.com/track/...` (akan convert ke YouTube)\n\n✨ Bot akan search di Spotify dulu, terus stream dari YouTube!', 
                            flags: 64 
                        });
                    }

                    const loadingMsg = await message.reply({ content: '🔍 Searching di Spotify & YouTube...' });

                    try {
                        // Use hybrid search (Spotify + YouTube)
                        const result = await client.musicSystem.searchBoth(
                            query,
                            SPOTIFY_CLIENT_ID,
                            SPOTIFY_CLIENT_SECRET
                        );
                        
                        if (!result) {
                            await loadingMsg.edit({ content: '❌ Lagu tidak ditemukan! Coba search dengan nama artist/lagu yang lebih jelas.' });
                            return;
                        }

                        // Handle Spotify-only result (no YouTube match)
                        if (result.source === 'spotify' && !result.videoId) {
                            await loadingMsg.edit({ 
                                content: '⚠️ Lagu ditemukan di Spotify tapi tidak ada match di YouTube.\nCoba search dengan keyword lain atau gunakan title lengkap + artist!' 
                            });
                            return;
                        }

                        // Add to queue
                        const song = {
                            title: result.title,
                            artist: result.artist,
                            duration: result.duration,
                            videoId: result.videoId,
                            thumbnail: result.thumbnail,
                            source: result.source || 'youtube',
                            spotifyUrl: result.spotifyUrl || null,
                            hybridInfo: result.hybridInfo || '',
                            requestedBy: message.author.id
                        };

                        await client.musicSystem.addToQueue(message.guildId, song);

                        const queueList = client.musicSystem.getFullQueue(message.guildId);
                        
                        // Start playback if not playing
                        if (!client.musicSystem.getQueue(message.guildId).playing && queueList.length === 1) {
                            // Auto-play first song
                            setTimeout(() => {
                                client.musicSystem.playNextSong(message.guildId).catch(err => {
                                    console.error('Auto-play error:', err);
                                });
                            }, 500);
                        }
                        
                        // Build embed with source info
                        let sourceEmoji = '▶️';
                        let sourceText = 'YouTube';
                        if (result.source === 'hybrid') {
                            sourceEmoji = '🎵';
                            sourceText = 'Spotify → YouTube';
                        } else if (result.source === 'spotify') {
                            sourceEmoji = '🟢';
                            sourceText = 'Spotify';
                        }
                        
                        const playEmbed = new EmbedBuilder()
                            .setColor(result.source === 'hybrid' ? '#1DB954' : '#FF0000')
                            .setTitle('🎵 Added to Queue')
                            .setDescription(`[${song.title}](https://www.youtube.com/watch?v=${song.videoId})`)
                            .addFields(
                                { name: 'Artist', value: song.artist || 'Unknown', inline: true },
                                { name: 'Duration', value: client.musicSystem.formatTime(song.duration), inline: true },
                                { name: 'Queue Position', value: `#${queueList.length}`, inline: true },
                                { name: 'Requested By', value: `<@${message.author.id}>`, inline: true }
                            )
                            .setThumbnail(song.thumbnail)
                            .setFooter({ text: `Source: ${sourceEmoji} ${sourceText}` })
                            .setTimestamp();

                        await loadingMsg.edit({ content: '', embeds: [playEmbed] });

                    } catch (searchError) {
                        console.error('Error searching:', searchError);
                        await loadingMsg.edit({ content: `❌ Error saat search: ${searchError.message}` });
                    }

                } catch (error) {
                    console.error('Error executing play command:', error);
                    await message.reply({ content: `❌ Error: ${error.message}`, flags: 64 });
                }
            }

            // fam.skip - Skip current song
            else if (command === 'skip') {
                try {
                    const queueFull = client.musicSystem.getFullQueue(message.guildId);
                    const currentSong = client.musicSystem.getCurrentSong(message.guildId);
                    
                    if (!currentSong && queueFull.length === 0) {
                        return message.reply({ 
                            content: '❌ Queue kosong! Tidak ada lagu yang bisa di-skip.', 
                            flags: 64 
                        });
                    }

                    const nextSong = await client.musicSystem.skipSong(message.guildId);

                    const skipEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('⏭️ Song Skipped')
                        .addFields(
                            { name: 'Skipped', value: `${currentSong?.title || 'N/A'}`, inline: false },
                            { name: 'Now Playing', value: `${nextSong?.title || 'Queue Empty'}`, inline: false }
                        )
                        .setTimestamp();

                    await message.reply({ embeds: [skipEmbed] });

                } catch (error) {
                    console.error('Error executing skip command:', error);
                    await message.reply({ content: `❌ Error: ${error.message}`, flags: 64 });
                }
            }

            // fam.pause - Pause music
            else if (command === 'pause') {
                try {
                    const currentSong = client.musicSystem.getCurrentSong(message.guildId);
                    if (!currentSong) {
                        return message.reply({ 
                            content: '❌ Tidak ada lagu yang sedang dimainkan!', 
                            flags: 64 
                        });
                    }

                    client.musicSystem.pausePlayback(message.guildId);

                    const pauseEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('⏸️ Music Paused')
                        .setDescription(`Paused: **${currentSong.title}**`)
                        .setThumbnail(currentSong.thumbnail)
                        .setFooter({ text: 'Gunakan fam.resume untuk melanjutkan' })
                        .setTimestamp();

                    await message.reply({ embeds: [pauseEmbed] });

                } catch (error) {
                    console.error('Error executing pause command:', error);
                    await message.reply({ content: `❌ Error: ${error.message}`, flags: 64 });
                }
            }

            // fam.resume - Resume music
            else if (command === 'resume') {
                try {
                    const currentSong = client.musicSystem.getCurrentSong(message.guildId);
                    if (!currentSong) {
                        return message.reply({ 
                            content: '❌ Tidak ada lagu yang sedang dimainkan!', 
                            flags: 64 
                        });
                    }

                    client.musicSystem.resumePlayback(message.guildId);

                    const resumeEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('▶️ Music Resumed')
                        .setDescription(`Resumed: **${currentSong.title}**`)
                        .setThumbnail(currentSong.thumbnail)
                        .setTimestamp();

                    await message.reply({ embeds: [resumeEmbed] });

                } catch (error) {
                    console.error('Error executing resume command:', error);
                    await message.reply({ content: `❌ Error: ${error.message}`, flags: 64 });
                }
            }

            // fam.queue - Show queue
            else if (command === 'queue') {
                try {
                    const queue = client.musicSystem.getFullQueue(message.guildId);
                    const currentSong = client.musicSystem.getCurrentSong(message.guildId);

                    if (!currentSong && queue.length === 0) {
                        return message.reply({ 
                            content: '❌ Queue kosong! Gunakan `fam.play` untuk menambahkan lagu.', 
                            flags: 64 
                        });
                    }

                    let description = '';

                    if (currentSong) {
                        // Determine source emoji
                        let sourceEmoji = '▶️';
                        if (currentSong.source === 'hybrid') sourceEmoji = '🎵';
                        else if (currentSong.source === 'spotify') sourceEmoji = '🟢';
                        
                        description += `**Now Playing:**\n${sourceEmoji} [${currentSong.title}](https://www.youtube.com/watch?v=${currentSong.videoId})\n`;
                        description += `⏱️ ${client.musicSystem.formatTime(currentSong.duration)}\n\n`;
                    }

                    if (queue.length > 0) {
                        description += `**Up Next (${queue.length} songs):**\n`;
                        const displayCount = Math.min(queue.length, 10);
                        for (let i = 0; i < displayCount; i++) {
                            const song = queue[i];
                            
                            // Determine source emoji per track
                            let sourceEmoji = '▶️';
                            if (song.source === 'hybrid') sourceEmoji = '🎵';
                            else if (song.source === 'spotify') sourceEmoji = '🟢';
                            
                            description += `${i + 1}. ${sourceEmoji} [${song.title}](https://www.youtube.com/watch?v=${song.videoId}) - ${client.musicSystem.formatTime(song.duration)}\n`;
                        }

                        if (queue.length > 10) {
                            description += `\n... dan ${queue.length - 10} lagu lainnya`;
                        }
                    } else {
                        description += '**Up Next:** Queue kosong\n';
                    }

                    const guildQueue = client.musicSystem.getQueue(message.guildId);
                    const loopMode = guildQueue.loop || 'off';
                    const loopEmoji = loopMode === 'one' ? '🔂' : loopMode === 'all' ? '🔁' : '➡️';

                    const queueEmbed = new EmbedBuilder()
                        .setColor('#0099FF')
                        .setTitle('🎵 Music Queue')
                        .setDescription(description)
                        .setFooter({ text: `Loop Mode: ${loopEmoji} ${loopMode} | 🎵 = Spotify | ▶️ = YouTube` })
                        .setTimestamp();

                    if (currentSong?.thumbnail) {
                        queueEmbed.setThumbnail(currentSong.thumbnail);
                    }

                    await message.reply({ embeds: [queueEmbed] });

                } catch (error) {
                    console.error('Error executing queue command:', error);
                    await message.reply({ content: `❌ Error: ${error.message}`, flags: 64 });
                }
            }

            // fam.stop - Stop music and clear queue
            else if (command === 'stop') {
                try {
                    const guildQueue = client.musicSystem.getQueue(message.guildId);
                    const wasPlaying = client.musicSystem.getCurrentSong(message.guildId) !== null;
                    client.musicSystem.stopPlayback(message.guildId);

                    const stopEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('⏹️ Music Stopped')
                        .setDescription(wasPlaying ? 'Musik dihentikan dan queue dibersihkan.' : 'Queue telah dibersihkan.')
                        .setTimestamp();

                    await message.reply({ embeds: [stopEmbed] });

                } catch (error) {
                    console.error('Error executing stop command:', error);
                    await message.reply({ content: `❌ Error: ${error.message}`, flags: 64 });
                }
            }

            // fam.shuffle - Shuffle queue
            else if (command === 'shuffle') {
                try {
                    const queue = client.musicSystem.getFullQueue(message.guildId);
                    if (queue.length < 2) {
                        return message.reply({ 
                            content: '❌ Queue minimal harus punya 2 lagu untuk di-shuffle!', 
                            flags: 64 
                        });
                    }

                    client.musicSystem.shuffleQueue(message.guildId);

                    const shuffleEmbed = new EmbedBuilder()
                        .setColor('#9900FF')
                        .setTitle('🔀 Queue Shuffled')
                        .setDescription(`Queue berhasil di-shuffle! Sekarang ada ${queue.length} lagu dalam queue.`)
                        .setTimestamp();

                    await message.reply({ embeds: [shuffleEmbed] });

                } catch (error) {
                    console.error('Error executing shuffle command:', error);
                    await message.reply({ content: `❌ Error: ${error.message}`, flags: 64 });
                }
            }

            // fam.loop [off|one|all] - Set loop mode
            else if (command === 'loop') {
                try {
                    const mode = (args[1] || 'off').toLowerCase();
                    if (!['off', 'one', 'all'].includes(mode)) {
                        return message.reply({ 
                            content: '❌ Gunakan: `fam.loop [off|one|all]`\n- `off`: Tidak ada looping\n- `one`: Loop lagu sekarang (repeat)\n- `all`: Loop semua queue', 
                            flags: 64 
                        });
                    }

                    const guildQueue = client.musicSystem.getQueue(message.guildId);
                    guildQueue.loop = mode;

                    const loopEmojis = { 'off': '➡️', 'one': '🔂', 'all': '🔁' };
                    const loopDescriptions = {
                        'off': 'Loop dimatikan - lagu akan berhenti setelah queue selesai',
                        'one': 'Lagu sekarang akan diulang',
                        'all': 'Semua lagu dalam queue akan diulang'
                    };

                    const loopEmbed = new EmbedBuilder()
                        .setColor('#00CCFF')
                        .setTitle(`${loopEmojis[mode]} Loop Mode Changed`)
                        .setDescription(loopDescriptions[mode])
                        .addFields({ name: 'Mode', value: mode.toUpperCase(), inline: true })
                        .setTimestamp();

                    await message.reply({ embeds: [loopEmbed] });

                } catch (error) {
                    console.error('Error executing loop command:', error);
                    await message.reply({ content: `❌ Error: ${error.message}`, flags: 64 });
                }
            }

            // fam.nowplaying - Show current song info
            else if (command === 'nowplaying') {
                try {
                    const currentSong = client.musicSystem.getCurrentSong(message.guildId);
                    if (!currentSong) {
                        return message.reply({ 
                            content: '❌ Tidak ada lagu yang sedang dimainkan!', 
                            flags: 64 
                        });
                    }

                    const queueFull = client.musicSystem.getFullQueue(message.guildId);
                    const guildQueue = client.musicSystem.getQueue(message.guildId);

                    // Determine source display
                    let sourceDisplay = '▶️ YouTube';
                    let sourceColor = '#FF0000';
                    if (currentSong.source === 'hybrid') {
                        sourceDisplay = '🎵 Spotify → YouTube';
                        sourceColor = '#1DB954';
                    } else if (currentSong.source === 'spotify') {
                        sourceDisplay = '🟢 Spotify';
                        sourceColor = '#1DB954';
                    }

                    const nowPlayingEmbed = new EmbedBuilder()
                        .setColor(sourceColor)
                        .setTitle('🎵 Now Playing')
                        .setDescription(`[${currentSong.title}](https://www.youtube.com/watch?v=${currentSong.videoId})`)
                        .addFields(
                            { name: 'Artist', value: currentSong.artist || 'Unknown', inline: true },
                            { name: 'Duration', value: client.musicSystem.formatTime(currentSong.duration), inline: true },
                            { name: 'Source', value: sourceDisplay, inline: true },
                            { name: 'Requested By', value: `<@${currentSong.requestedBy}>`, inline: true },
                            { name: 'Queue Position', value: `1 / ${queueFull.length + 1}`, inline: true }
                        )
                        .setThumbnail(currentSong.thumbnail)
                        .setFooter({ text: `Loop: ${guildQueue.loop || 'off'}` })
                        .setTimestamp();

                    if (currentSong.hybridInfo) {
                        nowPlayingEmbed.addFields({
                            name: '✨ Info',
                            value: currentSong.hybridInfo,
                            inline: false
                        });
                    }

                    await message.reply({ embeds: [nowPlayingEmbed] });

                } catch (error) {
                    console.error('Error executing nowplaying command:', error);
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

// Handle message reaction add
client.on('messageReactionAdd', async (reaction, user) => {
    try {
        // Ignore bot reactions
        if (user.bot) return;

        // Ignore if message is partial
        if (reaction.message.partial) {
            await reaction.message.fetch();
        }

        const messageId = reaction.message.id;
        const emoji = reaction.emoji.toString();
        const reactionRoles = client.reactionRoles || {};

        // Check if this message has reaction roles
        if (!reactionRoles[messageId]) {
            return;
        }

        // Support both old and new data structures
        const config = reactionRoles[messageId];
        const roles = config.roles || config;
        const parentRoleId = config.parentRole || null;

        if (!roles[emoji]) {
            return;
        }

        // Get the role IDs
        const childRoleId = roles[emoji];
        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id);
        const childRole = guild.roles.cache.get(childRoleId);
        const parentRole = parentRoleId ? guild.roles.cache.get(parentRoleId) : null;

        if (!childRole) {
            console.warn(`Role ${childRoleId} not found for message ${messageId}`);
            return;
        }

        // Add child role to user
        await member.roles.add(childRole).catch(error => {
            console.error(`Error adding role ${childRole.name} to ${user.tag}:`, error.message);
        });

        // Add parent role if exists
        if (parentRole && !member.roles.cache.has(parentRoleId)) {
            await member.roles.add(parentRole).catch(error => {
                console.error(`Error adding parent role ${parentRole.name} to ${user.tag}:`, error.message);
            });
            console.log(`✅ Added role ${childRole.name} + ${parentRole.name} to ${user.tag}`);
        } else {
            console.log(`✅ Added role ${childRole.name} to ${user.tag}`);
        }
    } catch (error) {
        console.error('Error handling message reaction add:', error);
    }
});

// Handle message reaction remove
client.on('messageReactionRemove', async (reaction, user) => {
    try {
        // Ignore bot reactions
        if (user.bot) return;

        // Ignore if message is partial
        if (reaction.message.partial) {
            await reaction.message.fetch();
        }

        const messageId = reaction.message.id;
        const emoji = reaction.emoji.toString();
        const reactionRoles = client.reactionRoles || {};

        // Check if this message has reaction roles
        if (!reactionRoles[messageId]) {
            return;
        }

        // Support both old and new data structures
        const config = reactionRoles[messageId];
        const roles = config.roles || config;
        const parentRoleId = config.parentRole || null;

        if (!roles[emoji]) {
            return;
        }

        // Get the role IDs
        const childRoleId = roles[emoji];
        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id);
        const childRole = guild.roles.cache.get(childRoleId);
        const parentRole = parentRoleId ? guild.roles.cache.get(parentRoleId) : null;

        if (!childRole) {
            console.warn(`Role ${childRoleId} not found for message ${messageId}`);
            return;
        }

        // Remove child role from user
        await member.roles.remove(childRole).catch(error => {
            console.error(`Error removing role ${childRole.name} from ${user.tag}:`, error.message);
        });

        // Check if user has any other child roles from this message's configuration
        let hasOtherChildRole = false;
        for (const [otherEmoji, otherRoleId] of Object.entries(roles)) {
            if (otherEmoji !== emoji && member.roles.cache.has(otherRoleId)) {
                hasOtherChildRole = true;
                break;
            }
        }

        // Remove parent role if user doesn't have any other child roles
        if (parentRole && !hasOtherChildRole) {
            await member.roles.remove(parentRole).catch(error => {
                console.error(`Error removing parent role ${parentRole.name} from ${user.tag}:`, error.message);
            });
            console.log(`✅ Removed role ${childRole.name} (and ${parentRole.name} - no other child roles) from ${user.tag}`);
        } else {
            console.log(`✅ Removed role ${childRole.name} from ${user.tag}`);
        }
    } catch (error) {
        console.error('Error handling message reaction remove:', error);
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
            const channel = newMember.guild.channels.cache.get(HARDCODED_BOOSTER_CHANNEL_ID);
            if (channel) {
                const boostCount = newMember.guild.premiumSubscriptionCount || 0;
                const boostEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('<a:FAM_Booster2:1470223709154574427> Hi, ' + newMember + '! Thanks for the boost.')
                    .setDescription(`Enjoy your special perks <a:FAM_Booster:1470223346741416043>\n\nClaim your Custom Role at <#1469743159306227855>`)
                    .setThumbnail(newMember.user.displayAvatarURL())
                    .setTimestamp()
                    .setFooter({ text: `We currently have ${boostCount} boosts` });

                await channel.send({ embeds: [boostEmbed] }).catch(() => {});
            }
        }
    } catch (error) {
        console.error('Error handling boost detection:', error);
    }
});

// Handle new member join - send greeting
client.on('guildMemberAdd', async (member) => {
    try {
        // Ignore bots
        if (member.user.bot) return;

        const greetConfig = loadGreetConfig();
        const config = greetConfig[member.guild.id];

        // Check if greeting message is configured
        if (!config || !config.message) {
            return; // Greeting not configured, skip
        }

        const channel = member.guild.channels.cache.get(HARDCODED_GREET_CHANNEL_ID);
        if (!channel) {
            return; // Channel not found or deleted
        }

        // Format and send greeting message
        const formattedMessage = formatGreetMessage(config.message, member, member.guild);

        try {
            await channel.send(formattedMessage);
            console.log(`✅ Welcome message sent to ${member.user.tag} in ${member.guild.name}`);
        } catch (error) {
            console.error(`Error sending welcome message to ${member.user.tag}:`, error);
        }
    } catch (error) {
        console.error('Error handling guild member add:', error);
    }
});

// Handle voice state changes (join/leave voice channel)
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        console.log('[VOICE EVENT TRIGGERED]');
        console.log(`[VOICE] User ID: ${newState.userId}, Guild: ${newState.guild.name}`);
        
        // Get user first
        const user = newState.user || await client.users.fetch(newState.userId).catch(() => null);
        
        if (!user) {
            console.log('[VOICE] User not found');
            return;
        }
        
        if (user.bot) {
            console.log(`[VOICE] Skipping bot: ${user.username}`);
            return;
        }

        const guild = newState.guild;

        // Determine if user joined or left
        const joinedVoice = !oldState.channel && newState.channel;
        const leftVoice = oldState.channel && !newState.channel;

        console.log(`[VOICE] ${user.username} - Joined: ${joinedVoice}, Left: ${leftVoice}`);

        if (!joinedVoice && !leftVoice) {
            console.log('[VOICE] Not a join or leave event, skipping');
            return;
        }

        // Get notification channel (try to find text channel in same category)
        let notificationChannel = null;
        
        // Get the voice channel (old if left, new if joined)
        const voiceChannel = joinedVoice ? newState.channel : oldState.channel;
        console.log(`[VOICE] Voice Channel: ${voiceChannel.name}, Category: ${voiceChannel.parent?.name || 'None'}`);
        
        if (voiceChannel && voiceChannel.parent) {
            // Find text channels in the same category
            const textChannels = guild.channels.cache.filter(ch => 
                ch.parentId === voiceChannel.parentId && ch.isTextBased() && !ch.isDMBased()
            );
            console.log(`[VOICE] Found ${textChannels.size} text channels in category`);
            notificationChannel = textChannels.first();
        }

        // Fallback to hardcoded logs channel
        if (!notificationChannel) {
            console.log(`[VOICE] No category text channels, trying fallback logs channel`);
            notificationChannel = guild.channels.cache.get(HARDCODED_LOGS_CHANNEL_ID);
        }

        if (!notificationChannel) {
            console.log(`[VOICE] No notification channel found!`);
            return;
        }

        console.log(`[VOICE] Using channel: ${notificationChannel.name}`);

        // Create message based on event
        let message = '';
        let color = 0x5865F2; // Default blue
        
        if (joinedVoice) {
            // User joined voice
            message = `✅ **${user.username}** has joined 🎤 **${newState.channel.name}**\nUser ID: ${user.id} • <t:${Math.floor(Date.now() / 1000)}:t>`;
            color = 0x5865F2; // Blue
        } 
        else if (leftVoice) {
            // User left voice
            message = `❌ **${user.username}** has left 🎤 **${oldState.channel.name}**\nUser ID: ${user.id} • <t:${Math.floor(Date.now() / 1000)}:t>`;
            color = 0xFF0000; // Red
        }

        if (message) {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setDescription(message);

            await notificationChannel.send({ embeds: [embed] }).catch(err => {
                console.error(`[VOICE] Failed to send notification: ${err.message}`);
            });
            console.log(`[VOICE] Notification sent successfully`);
        }
    } catch (error) {
        console.error('[VOICE] Error handling voice state update:', error);
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
