const http = require('http');
require('dotenv').config();

const app = require('./app');
const { initSockets } = require('./sockets');
const { startTimerWatcher } = require('./jobs/timerWatcher');

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

initSockets(server);
startTimerWatcher();

server.listen(PORT, () => {
  console.log(`Serene Spa backend running on port ${PORT}`);
});
