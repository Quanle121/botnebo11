const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

function makeCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('✅ Kết nối:', socket.id);

  socket.on('createRoom', (data) => {
    const code = makeCode();
    rooms[code] = {
      code, host: socket.id, guest: null,
      hostCountry: data.country, guestCountry: null, started: false,
    };
    socket.join(code);
    socket.roomCode = code;
    socket.isHost = true;
    socket.emit('roomCreated', { code });
    console.log('🏠 Phòng:', code);
  });

  socket.on('joinRoom', (data) => {
    const code = data.code.toUpperCase();
    const room = rooms[code];
    if (!room) return socket.emit('errorMsg', 'Phòng không tồn tại!');
    if (room.guest) return socket.emit('errorMsg', 'Phòng đã đầy!');
    room.guest = socket.id;
    room.guestCountry = data.country;
    socket.join(code);
    socket.roomCode = code;
    socket.isHost = false;
    io.to(room.host).emit('opponentJoined', { country: data.country });
    socket.emit('joinedRoom', { code, hostCountry: room.hostCountry });
    console.log('👥 Vào phòng:', code);
  });

  socket.on('startGame', () => {
    const room = rooms[socket.roomCode];
    if (!room || room.started) return;
    if (!room.host || !room.guest) return;
    room.started = true;
    io.to(room.code).emit('gameStart');
    console.log('🎮 Bắt đầu:', room.code);
  });

  socket.on('action', (action) => {
    const room = rooms[socket.roomCode];
    if (!room || !room.started) return;
    socket.to(room.code).emit('action', action);
  });

  socket.on('syncState', (st) => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    socket.to(room.code).emit('syncState', st);
  });

  socket.on('disconnect', () => {
    console.log('❌ Ngắt:', socket.id);
    const room = rooms[socket.roomCode];
    if (room) {
      socket.to(room.code).emit('opponentLeft');
      delete rooms[room.code];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server: http://localhost:${PORT}`);
});
