"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const health_1 = require("./routes/health");
const looks_1 = require("./routes/looks");
const auth_1 = require("./routes/auth");
const generations_1 = require("./routes/generations");
const purchases_1 = require("./routes/purchases");
const reports_1 = require("./routes/reports");
const users_1 = require("./routes/users");
const admin_1 = require("./routes/admin");
const privacy_1 = require("./routes/privacy");
const createApp = () => {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: '50mb' }));
    app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
    // Static uploads directory for media fallbacks
    app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../public/uploads')));
    // Root redirect to Admin Panel
    app.get('/', (_req, res) => {
        res.redirect('/admin');
    });
    // Root Health check for Cloud Platforms (Render, AWS, Railway) & Keep-Alive
    app.use(health_1.healthRouter);
    // Public Privacy Policy Web Page (Available at /privacy and /privacy-policy)
    app.use(privacy_1.privacyRouter);
    // Admin Web Panel (Available directly at http://localhost:4000/admin)
    app.use(admin_1.adminRouter);
    // Standard Image Edit endpoints for BFL FLUX 3 Image
    app.post('/api/image/edit', generations_1.handleImageEdit);
    app.post('/image/edit', generations_1.handleImageEdit);
    // API Routes
    app.use('/api/v1', health_1.healthRouter);
    app.use('/api/v1', looks_1.looksRouter);
    app.use('/api/v1', auth_1.authRouter);
    app.use('/api/v1', generations_1.generationsRouter);
    app.use('/api/v1', purchases_1.purchasesRouter);
    app.use('/api/v1', reports_1.reportsRouter);
    app.use('/api/v1', users_1.usersRouter);
    app.use('/api/v1', admin_1.adminRouter);
    app.use('/api/v1', privacy_1.privacyRouter);
    // Fallback 404
    app.use((_req, res) => {
        res.status(404).json({ error: 'Endpoint not found' });
    });
    // Global Error Handler
    app.use((err, _req, res, _next) => {
        // Spec rule: Never log image bytes or raw signed URLs
        console.error('[Internal Error]:', err.message);
        res.status(500).json({
            error: 'An unexpected internal server error occurred',
        });
    });
    return app;
};
exports.createApp = createApp;
