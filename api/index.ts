import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';

/**
 * Express application instance.
 * @type {express.Application}
 */
const app = express();

/**
 * Allowed CORS origins parsed from environment variables.
 * @type {string[]}
 */
const origins = (process.env.ORIGIN ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

app.use(cors({ origin: origins }));
app.use(express.json());

/**
 * Returns ICE server configuration for WebRTC connections.
 * Includes Google's STUN server and optional TURN servers from environment variables.
 * 
 * @route GET /api/ice-config
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {Object} ICE configuration with iceServers array
 * 
 * @example
 * // Response format:
 * {
 *   "iceServers": [
 *     { "urls": "stun:stun.l.google.com:19302" },
 *     { "urls": [...], "username": "...", "credential": "..." }
 *   ]
 * }
 */
app.get('/api/ice-config', (req, res) => {
    const iceServers: any[] = [
        {
            urls: 'stun:stun.l.google.com:19302'
        }
    ];

    // Only add TURN server if all required credentials are configured
    if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_PASSWORD) {
        iceServers.push({
            urls: process.env.TURN_URL.split(",").map(u => u.trim()),
            username: process.env.TURN_USERNAME,
            credential: process.env.TURN_PASSWORD,
        });
    }

    const config = {
        iceServers
    };

    res.json(config);
});

/**
 * Health check endpoint for monitoring service availability.
 * 
 * @route GET /health
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @returns {Object} Status object with service name
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ICE Config Server' });
});

/**
 * Server port number from environment or default.
 * @type {number}
 * @default 4000
 */
const PORT = Number(process.env.PORT) || 4000;

/**
 * HTTP server instance for Express and Socket.IO.
 * @type {http.Server}
 */
const server = http.createServer(app);

/**
 * Socket.IO server instance for WebRTC signaling.
 * @type {SocketIOServer}
 */
const io = new SocketIOServer(server, {
    cors: {
        origin: origins
    }
});

/**
 * In-memory storage of connected peer sessions.
 * Maps socket IDs to peer information.
 * 
 * @type {Object.<string, Object>}
 */
let peers: any = {};

/**
 * Handles Socket.IO connection events for WebRTC signaling.
 * Manages peer introduction, signal routing, and disconnection cleanup.
 * 
 * @listens io#connection
 * @param {Socket} socket - Socket.IO socket instance for the connected client
 * 
 * @fires socket#introduction - Sends list of existing peer IDs to new peer
 * @fires io#newUserConnected - Broadcasts new peer ID to all clients
 * @fires socket#signal - Forwards WebRTC signaling data between peers
 * @fires io#userDisconnected - Broadcasts disconnected peer ID to all clients
 */
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

    /**
     * Routes WebRTC signaling data from one peer to another.
     * 
     * @listens socket#signal
     * @param {string} to - Target peer socket ID
     * @param {string} from - Source peer socket ID
     * @param {Object} data - WebRTC signaling data (offer, answer, or ICE candidate)
     */
    socket.on("signal", (to, from, data) => {
        if (to in peers) {
            io.to(to).emit("signal", from, to, data);
            console.log(`Signal routed from ${from} to ${to}`);
        } else {
            console.log(`Peer ${to} not found! Cannot route signal from ${from}`);
        }
    });

    /**
     * Handles peer disconnection and cleanup.
     * Removes peer from storage and notifies all connected clients.
     * 
     * @listens socket#disconnect
     */
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

/**
 * Starts the HTTP and Socket.IO server.
 * @listens PORT
 */
server.listen(PORT, () => {
    console.log(`ICE config and Socket.IO server running on port ${PORT}`);
});