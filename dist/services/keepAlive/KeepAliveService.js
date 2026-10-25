"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeepAliveService = void 0;
const env_1 = require("../../config/env");
class KeepAliveService {
    static timer = null;
    static PING_INTERVAL_MS = 9 * 60 * 1000; // 9 minutes (Render sleeps at 15m)
    /**
     * Starts periodic self-ping to keep the free-tier server continuously awake
     */
    static start() {
        if (this.timer)
            return;
        const targetBaseUrl = env_1.env.RENDER_EXTERNAL_URL ||
            env_1.env.SELF_PING_URL ||
            `http://localhost:${env_1.env.PORT}`;
        const cleanBaseUrl = targetBaseUrl.replace(/\/+$/, '');
        const pingUrl = `${cleanBaseUrl}/health`;
        console.log(`[KeepAlive]: Keep-Alive heartbeat service initialized for: ${pingUrl}`);
        console.log(`[KeepAlive]: Ping frequency set to every 9 minutes to prevent sleep.`);
        // Initial ping after 5 seconds of startup
        setTimeout(() => {
            this.pingServer(pingUrl);
        }, 5000);
        // Periodic ping loop
        this.timer = setInterval(() => {
            this.pingServer(pingUrl);
        }, this.PING_INTERVAL_MS);
    }
    /**
     * Executes a health check HTTP GET request
     */
    static async pingServer(url) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Snapie-KeepAlive-Ping/1.0',
                },
            });
            if (response.ok) {
                console.log(`[KeepAlive]: Heartbeat ping sent successfully to ${url} (Status: ${response.status} - Server Awake)`);
            }
            else {
                console.warn(`[KeepAlive]: Ping returned non-200 status: ${response.status}`);
            }
        }
        catch (err) {
            console.warn(`[KeepAlive]: Ping attempt notice: ${err.message}`);
        }
    }
    /**
     * Stops the keep-alive timer on server shutdown
     */
    static stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            console.log('[KeepAlive]: Service stopped.');
        }
    }
}
exports.KeepAliveService = KeepAliveService;
