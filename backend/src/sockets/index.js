const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');

let io = null;

const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function initSockets(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyToken(token);
      socket.user = payload;
      next();
    } catch (err) {
      next(new Error('Invalid session'));
    }
  });

  io.on('connection', (socket) => {
    const { role, id, branchId } = socket.user;

    if (role === 'admin') {
      // Admin sees everything, across every branch.
      socket.join('role:admin');
    } else if (branchId) {
      // Receptionists/providers only hear about their own branch:
      // - branch:<id>            room status changes for that branch
      // - branch:<id>:role:<r>   notifications targeted at their role in that branch
      socket.join(`branch:${branchId}`);
      socket.join(`branch:${branchId}:role:${role}`);
    }
    socket.join(`user:${id}`);

    socket.on('disconnect', () => {
      // no-op, connection cleanup is handled by socket.io
    });
  });

  return io;
}

function getIo() {
  if (!io) throw new Error('Socket.io has not been initialized yet.');
  return io;
}

module.exports = { initSockets, getIo };
