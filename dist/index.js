"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = require("./app");
const env_1 = require("./config/env");
const KeepAliveService_1 = require("./services/keepAlive/KeepAliveService");
const startServer = async () => {
    const app = (0, app_1.createApp)();
    // Start HTTP server immediately so /admin and APIs are instantly available
    const server = app.listen(env_1.env.PORT, () => {
        console.log(`[Server]: Photo Restyler API listening on port ${env_1.env.PORT} (${env_1.env.NODE_ENV})`);
        console.log(`[Admin]: Web Panel live at http://localhost:${env_1.env.PORT}/admin`);
        // Start 9-10 minute Keep-Alive ping service (keeps free hosting awake 24/7)
        KeepAliveService_1.KeepAliveService.start();
    });
    // Attempt database connection in background with 15s timeout
    mongoose_1.default
        .connect(env_1.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
        .then(() => {
        console.log('[Database]: Successfully connected to MongoDB');
    })
        .catch((err) => {
        console.warn('[Database Warning]: MongoDB connection failed:', err.message);
    });
    const shutdown = async () => {
        console.log('[Server]: Shutting down gracefully...');
        KeepAliveService_1.KeepAliveService.stop();
        server.close(async () => {
            await mongoose_1.default.disconnect();
            process.exit(0);
        });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
};
startServer();
