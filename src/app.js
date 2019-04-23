const { Client } = require('discord.js');
const { Logger } = require('logger');
const fs = require('fs');
const ytdl = require('ytdl-core');

const client = new Client();
const logger = new Logger();

const config = require('../config/settings.json');
const queueFilename = './data/queue.txt';

let owner = undefined;
const queue = fs.readFileSync(queueFilename).toString().split('\n');
const queueLength = queue.length;

function updatePresence(songTitle) {
  // Subject to change in the future.
  const presence = songTitle ? songTitle : 'PAUSED';
  client.user.setPresence({
    activity: {
      name: presence,
      type: 'PLAYING'
    }
  }).catch(err => logger.error(err));
}

async function playMusic(conn, entry = 0) {
  const song = queue[entry];
  const stream = ytdl(song, { filter: 'audioonly' });

  stream.on('info', info => {
    logger.info(`Playing: ${info.title}`);
    updatePresence(info.title);
  });

  const dispatcher = await conn.play(stream);

  dispatcher.on('end', () => {
    if (entry == queueLength - 1) playMusic(conn);
    else playMusic(conn, entry + 1);
  });

  dispatcher.on('error', err => logger.error(err));
}

client.on('ready', () => {
  logger.info('Connected to Discord! - Ready.');
  updatePresence();

  client.users.fetch(config.owner_id)
    .then( user => owner = user).catch( err => logger.error(err));

  client.channels.fetch(config.channel_id)
    .then( voiceChannel => {
      if (voiceChannel.joinable) {
        voiceChannel.join()
          .then( connection => {
            logger.info(`Joined ${voiceChannel.name}.`);
            playMusic(connection);
          }).catch( err => {
            owner.send('Something went wrong when trying to connect to the voice channel!');
            logger.error(err);
          });
      } else {
        owner.send('I cannot join the voice channel that I was supposed to join!');
      }
    }).catch( err => {
      if (err == 'DiscordAPIError: Unknown Channel') owner.send('The voice channel I tried to join no longer exists!');
      else owner.send('Something went wrong when trying to look for the channel I was supposed to join!');
      logger.error(err);
    });
});

client.on('guildUnavailable', guild => {
  logger.warn(`Guild ${guild.name} is currently unavailable.`);
});

client.on('warn', info => {
  logger.warn(info);
});

client.on('resume', () => {
  logger.info('Client gateway resumed.');
});

client.on('invalidated', () => {
  logger.error('Client connection invalidated, terminating execution with code 1.');
  process.exit(1);
});

client.login(config.discord_token);