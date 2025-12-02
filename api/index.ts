import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';


const app = express();

// CORS
const origins = (process.env.ORIGIN ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

app.use(cors({ origin: origins }));
app.use(express.json());

/**
 * Devuelve la config ICE para WebRTC
 */
app.get('/api/ice-config', (req, res) => {
    const config = {
        iceServers: [
            {
                urls: 'stun:stun.l.google.com:19302'
            },
            {
                urls: process.env.TURN_URL?.split(",").map(u => u.trim()),
                username: process.env.TURN_USERNAME,
                credential: process.env.TURN_PASSWORD,
            }
        ]
    };

    res.json(config);
});

/**
 * Health Check
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ICE Config Server' });
});


const PORT = Number(process.env.PORT) || 4000;

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: {
        origin: origins
    }
});

let peers: any = {};

io.on("connection", (socket) => {
    if (!peers[socket.id]) {
        peers[socket.id] = {};
        socket.emit("introduction", Object.keys(peers));
        io.emit("newUserConnected", socket.id);
        console.log(
            "Peer joined with ID",
            socket.id,
            ". There are " + io.engine.clientsCount + " peer(s) connected."
        );
    }

    socket.on("signal", (to, from, data) => {
        if (to in peers) {
            io.to(to).emit("signal", to, from, data);
        } else {
            console.log("Peer not found!");
        }
    });

    socket.on("disconnect", () => {
        delete peers[socket.id];
        io.sockets.emit("userDisconnected", socket.id);
        console.log(
            "Peer disconnected with ID",
            socket.id,
            ". There are " + io.engine.clientsCount + " peer(s) connected."
        );
    });
});

server.listen(PORT, () => {
    console.log(`ICE config and Socket.IO server running on port ${PORT}`);
});