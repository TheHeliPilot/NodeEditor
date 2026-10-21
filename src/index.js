const bot = require('./bot');
const { startServer } = require('./web/server');

startServer(bot.panelApi);
bot.start();
