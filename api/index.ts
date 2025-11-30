import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();

// CORS
const origins = (process.env.ORIGIN ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

app.use(cors({ origin: origins }));
app.use(express.json());

/**
 * ICE server configuration object structure.
 * 
 * @typedef {Object} IceServerConfig
 * @property {string|string[]} urls - STUN/TURN server URL(s)
 * @property {string} [username] - Username for TURN server authentication (optional)
 * @property {string} [credential] - Password/credential for TURN server authentication (optional)
 */

/**
 * Complete ICE configuration response structure.
 * 
 * @typedef {Object} IceConfigResponse
 * @property {IceServerConfig[]} iceServers - Array of ICE server configurations
 */

/**
 * GET endpoint that provides WebRTC ICE server configuration.
 * 
 * Returns a configuration object containing STUN and TURN server details required
 * for establishing WebRTC peer-to-peer connections. Includes Google's public STUN
 * server and optionally configured TURN servers for NAT traversal.
 * 
 * @route GET /api/ice-config
 * @group ICE Configuration - WebRTC configuration endpoints
 * 
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * 
 * @returns {IceConfigResponse} JSON object containing ICE server configuration
 * 
 * @example
 * // Client-side request
 * fetch('http://localhost:4000/api/ice-config')
 *   .then(response => response.json())
 *   .then(config => {
 *     const peerConnection = new RTCPeerConnection(config);
 *   });
 * 
 * @example
 * // Response format
 * {
 *   "iceServers": [
 *     {
 *       "urls": "stun:stun.l.google.com:19302"
 *     },
 *     {
 *       "urls": ["turn:turn.example.com:3478", "turns:turn.example.com:5349"],
 *       "username": "myusername",
 *       "credential": "mypassword"
 *     }
 *   ]
 * }
 * 
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
 * Health check response structure.
 * 
 * @typedef {Object} HealthCheckResponse
 * @property {string} status - Current status of the service ("ok" or "error")
 * @property {string} service - Name of the service
 */

/**
 * GET endpoint for health check and service monitoring.
 * 
 * Returns the current status of the server. Useful for monitoring tools,
 * load balancers, and container orchestration systems to verify service availability.
 * 
 * @route GET /health
 * @group Health - Service health monitoring endpoints
 * 
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * 
 * @returns {HealthCheckResponse} JSON object indicating service health status
 * 
 * @example
 * // Health check request
 * fetch('http://localhost:4000/health')
 *   .then(response => response.json())
 *   .then(data => console.log(data));
 *   // Output: { status: 'ok', service: 'ICE Config Server' }
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ICE Config Server' });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`ICE config server running on port ${PORT}`);
});