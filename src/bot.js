const {
  Client, GatewayIntentBits, Partials, Events, ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
} = require('discord.js');
const config = require('./config');
const { getSetting, setSetting } = require('./db');
const { games, signups, tracking } = require('./store');

const QUESTION = 'Aké hry hrávaš?';
const OTHER = 'other';
const VOICE_FLUSH_MS = 5 * 60_000;

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildVoiceStates,
];
if (config.membersIntent) intents.push(GatewayIntentBits.GuildMembers);

const client = new Client({ intents, partials: [Partials.GuildMember] });

// userId -> timestamp the current (unflushed) voice stretch started
const inVoice = new Map();

function guild() {
  return client.guilds.cache.get(config.guildId) || null;
}

// ---------------------------------------------------------------- signup UI

function signupButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('signup:start').setLabel('Prihlásiť sa').setStyle(ButtonStyle.Primary),
  );
}

function gameMenu(selectedIds = [], hadOther = false) {
  const list = games.list();
  const menu = new StringSelectMenuBuilder()
    .setCustomId('signup:games')
    .setPlaceholder(QUESTION)
    .setMinValues(1)
    .setMaxValues(list.length + 1)
    .addOptions(
      ...list.map(g => ({ label: g.name.slice(0, 100), value: String(g.id), default: selectedIds.includes(g.id) })),
      { label: 'Iné…', value: OTHER, description: 'Napíšeš vlastné hry', default: hadOther },
    );
  return new ActionRowBuilder().addComponents(menu);
}

function doneRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('signup:start').setLabel('Upraviť hry').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('signup:leave').setLabel('Odhlásiť sa').setStyle(ButtonStyle.Danger),
  );
}

function summary(gameIds, otherGames) {
  const names = games.list().filter(g => gameIds.includes(g.id)).map(g => g.name);
  if (otherGames) names.push(otherGames);
  return names.join(', ');
}

async function onStart(interaction) {
  const existing = signups.get(interaction.user.id);
  await interaction.reply({
    content: `**${QUESTION}**\nVyber všetky, ktoré hrávaš. Ak tvoja hra chýba, daj **Iné…**`,
    components: [gameMenu(existing?.gameIds || [], Boolean(existing?.other_games))],
    flags: MessageFlags.Ephemeral,
  });
}

async function onGamesSelected(interaction) {
  const values = interaction.values;
  const gameIds = values.filter(v => v !== OTHER).map(Number);
  if (values.includes(OTHER)) {
    const existing = signups.get(interaction.user.id);
    const input = new TextInputBuilder()
      .setCustomId('other')
      .setLabel('Aké iné hry hrávaš?')
      .setPlaceholder('napr. Minecraft, World of Tanks')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(200)
      .setRequired(true);
    if (existing?.other_games) input.setValue(existing.other_games);
    const modal = new ModalBuilder()
      .setCustomId(`signup:other:${gameIds.join(',')}`)
      .setTitle('Iné hry')
      .addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }
  await finishSignup(interaction, gameIds, null);
}

async function onOtherSubmitted(interaction) {
  const ids = interaction.customId.split(':')[2];
  const gameIds = ids ? ids.split(',').map(Number) : [];
  const other = interaction.fields.getTextInputValue('other').trim();
  await finishSignup(interaction, gameIds, other || null);
}

async function finishSignup(interaction, gameIds, otherGames) {
  // Acknowledge right away: role changes can take longer than Discord's 3 second limit.
  await interaction.deferUpdate();
  const valid = new Set(games.list().map(g => g.id));
  gameIds = gameIds.filter(id => valid.has(id));
  const member = interaction.member;
  const previous = signups.save({
    userId: interaction.user.id,
    username: interaction.user.username,
    displayName: member?.displayName || interaction.user.globalName,
    avatarUrl: interaction.user.displayAvatarURL({ size: 64 }),
    gameIds,
    otherGames,
  });
  const roleNote = await syncRoles(interaction.user.id, previous?.gameIds || [], gameIds, true);
  const text = `${previous ? 'Prihláška upravená.' : 'Prihláška uložená!'} Hry: **${summary(gameIds, otherGames)}**${roleNote}`;
  // The select menu and the modal both come from the ephemeral message, which is updated in place.
  await interaction.editReply({ content: text, components: [doneRow()] });
}

async function onLeave(interaction) {
  await interaction.deferUpdate();
  const previous = signups.remove(interaction.user.id);
  if (previous) await syncRoles(interaction.user.id, previous.gameIds, [], false);
  await interaction.editReply({
    content: 'Prihláška zrušená. Kedykoľvek sa môžeš prihlásiť znova.',
    components: [signupButtonRow()],
  });
}

/**
 * Give/take the signup role and the per-game roles. Returns a short note for the user
 * when something could not be assigned (usually the bot's role sits too low).
 */
async function syncRoles(userId, oldGameIds, newGameIds, signedUp) {
  const g = guild();
  if (!g) return '';
  let member;
  try {
    member = await g.members.fetch(userId);
  } catch {
    return '';
  }
  const add = new Set();
  const remove = new Set();
  const signupRole = getSetting('signup_role_id');
  if (signupRole) (signedUp ? add : remove).add(signupRole);
  const byId = new Map(games.list().map(x => [x.id, x.role_id]));
  for (const id of oldGameIds) if (!newGameIds.includes(id) && byId.get(id)) remove.add(byId.get(id));
  for (const id of newGameIds) if (byId.get(id)) add.add(byId.get(id));
  for (const r of add) remove.delete(r);

  let failed = false;
  for (const roleId of add) {
    if (member.roles.cache.has(roleId)) continue;
    await member.roles.add(roleId, 'Prihláška na event').catch(err => { failed = true; console.warn('role add', roleId, err.message); });
  }
  for (const roleId of remove) {
    if (!member.roles.cache.has(roleId)) continue;
    await member.roles.remove(roleId, 'Zmena prihlášky').catch(err => { failed = true; console.warn('role remove', roleId, err.message); });
  }
  return failed ? '\n-# Niektoré roly sa nepodarilo nastaviť, daj vedieť adminom.' : '';
}

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isButton() && interaction.customId === 'signup:start') return await onStart(interaction);
    if (interaction.isButton() && interaction.customId === 'signup:leave') return await onLeave(interaction);
    if (interaction.isStringSelectMenu() && interaction.customId === 'signup:games') return await onGamesSelected(interaction);
    if (interaction.isModalSubmit() && interaction.customId.startsWith('signup:other:')) return await onOtherSubmitted(interaction);
  } catch (err) {
    console.error('interaction failed', err);
    const msg = { content: 'Niečo sa pokazilo, skús to znova.', flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) interaction.followUp(msg).catch(() => {});
    else interaction.reply(msg).catch(() => {});
  }
});

// ---------------------------------------------------------------- tracking

client.on(Events.MessageCreate, message => {
  if (!message.guild || message.guild.id !== config.guildId || message.author.bot || message.system) return;
  // Threads count toward their parent channel so #diskusie includes its threads.
  const channel = message.channel.isThread() ? message.channel.parent : message.channel;
  if (!channel) return;
  tracking.message({
    userId: message.author.id,
    username: message.author.username,
    channelId: channel.id,
    channelName: channel.name,
    at: message.createdTimestamp,
  });
});

client.on(Events.GuildMemberAdd, member => {
  if (member.guild.id !== config.guildId || member.user.bot) return;
  tracking.joined(member.id, member.user.username, member.joinedTimestamp || Date.now());
});

function isCounted(state) {
  // AFK channel and self-deafened users don't count as voice activity.
  return state.channelId && state.channelId !== state.guild.afkChannelId && !state.selfDeaf && !state.serverDeaf;
}

client.on(Events.VoiceStateUpdate, (before, after) => {
  if (after.guild.id !== config.guildId || after.member?.user.bot) return;
  const id = after.id;
  const now = Date.now();
  const was = inVoice.has(id);
  const is = isCounted(after);
  if (was && !is) {
    tracking.voice(id, inVoice.get(id), now);
    inVoice.delete(id);
  } else if (!was && is) {
    inVoice.set(id, now);
    tracking.seen(id, after.member?.user.username, now);
  }
});

function flushVoice() {
  const now = Date.now();
  for (const [id, since] of inVoice) {
    tracking.voice(id, since, now);
    inVoice.set(id, now);
  }
}

client.once(Events.ClientReady, async () => {
  const g = guild();
  console.log(`Bot prihlásený ako ${client.user.tag}${g ? ` na serveri ${g.name}` : ' (GUILD_ID nenájdený!)'}`);
  if (!g) return;
  // Pick up people already sitting in voice when the bot starts.
  for (const state of g.voiceStates.cache.values()) {
    if (!state.member?.user.bot && isCounted(state)) inVoice.set(state.id, Date.now());
  }
  if (config.membersIntent) {
    try {
      const members = await g.members.fetch();
      for (const m of members.values()) if (!m.user.bot && m.joinedTimestamp) tracking.joined(m.id, m.user.username, m.joinedTimestamp);
    } catch (err) {
      console.warn('Nepodarilo sa načítať členov (zapni Server Members Intent):', err.message);
    }
  }
  setInterval(flushVoice, VOICE_FLUSH_MS).unref();
});

// ---------------------------------------------------------------- panel API

/** The small surface the web panel uses, so it can run against a fake guild in demo mode. */
const panelApi = {
  ready: () => Boolean(guild()),

  serverName: () => guild()?.name || null,

  memberCount: () => guild()?.memberCount ?? null,

  textChannels() {
    const g = guild();
    if (!g) return [];
    const me = g.members.me;
    return [...g.channels.cache.values()]
      .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
      .sort((a, b) => (a.parent?.rawPosition ?? -1) - (b.parent?.rawPosition ?? -1) || a.rawPosition - b.rawPosition)
      .map(c => ({
        id: c.id,
        name: c.name,
        category: c.parent?.name || null,
        canSend: me ? c.permissionsFor(me).has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel]) : false,
      }));
  },

  roles() {
    const g = guild();
    if (!g) return [];
    const top = g.members.me?.roles.highest.position ?? 0;
    return [...g.roles.cache.values()]
      .filter(r => r.id !== g.id && !r.managed)
      .sort((a, b) => b.position - a.position)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor, assignable: r.position < top, members: r.members.size }));
  },

  async postSignupMessage(channelId, text) {
    const g = guild();
    const channel = g?.channels.cache.get(channelId);
    if (!channel?.isTextBased()) throw new Error('Kanál neexistuje alebo do neho bot nevidí.');
    const old = getSetting('signup_message_id');
    const oldChannel = getSetting('signup_message_channel_id');
    const message = await channel.send({ content: text || undefined, components: [signupButtonRow()] });
    setSetting('signup_message_id', message.id);
    setSetting('signup_message_channel_id', channel.id);
    // Remove the previous signup message so there is only one button around.
    if (old && oldChannel) {
      const prev = g.channels.cache.get(oldChannel);
      prev?.messages?.delete(old).catch(() => {});
    }
    return message.url;
  },

  /** Give the current signup role to everyone who already signed up. */
  async applySignupRole() {
    const roleId = getSetting('signup_role_id');
    const g = guild();
    if (!roleId || !g) return 0;
    let n = 0;
    for (const s of signups.list()) {
      const member = await g.members.fetch(s.user_id).catch(() => null);
      if (member && !member.roles.cache.has(roleId)) {
        await member.roles.add(roleId, 'Prihláška na event').then(() => n++).catch(() => {});
      }
    }
    return n;
  },

  async removeSignup(userId) {
    const previous = signups.remove(userId);
    if (previous) await syncRoles(userId, previous.gameIds, [], false);
  },
};

function start() {
  if (!config.token || !config.guildId) {
    console.error('Chýba DISCORD_TOKEN alebo GUILD_ID v .env');
    process.exit(1);
  }
  process.on('SIGINT', () => { flushVoice(); process.exit(0); });
  process.on('SIGTERM', () => { flushVoice(); process.exit(0); });
  return client.login(config.token);
}

module.exports = { start, panelApi, client };
