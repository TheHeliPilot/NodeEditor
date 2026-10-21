const fs = require('node:fs');
const path = require('node:path');

// Minimal .env loader so the bot runs without extra dependencies.
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
loadDotEnv(path.join(__dirname, '..', '.env'));

const env = process.env;

module.exports = {
  token: env.DISCORD_TOKEN || '',
  guildId: env.GUILD_ID || '',
  membersIntent: (env.MEMBERS_INTENT || 'true') !== 'false',
  port: Number(env.PORT || 3000),
  publicUrl: (env.PUBLIC_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ''),
  dbPath: path.resolve(env.DB_PATH || path.join(__dirname, '..', 'data', 'bot.db')),
  timezone: env.TIMEZONE || 'Europe/Bratislava',
};
