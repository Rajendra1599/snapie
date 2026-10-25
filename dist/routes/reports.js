"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportsRouter = void 0;
const express_1 = require("express");
const crypto_1 = require("crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
exports.reportsRouter = (0, express_1.Router)();
// POST /api/v1/reports
// Submits a report for safety review and hides output pending moderation
exports.reportsRouter.post('/reports', async (req, res) => {
    try {
        const { userId, generationId, reason } = req.body;
        if (!userId || !generationId || !reason) {
            return res.status(400).json({ error: 'userId, generationId, and reason are required' });
        }
        if (mongoose_1.default.connection.readyState === 1) {
            const report = await models_1.Report.create({
                reportId: (0, crypto_1.randomUUID)(),
                userId,
                generationId,
                reason,
            });
            // Hide output pending review
            await models_1.Generation.findOneAndUpdate({ generationId }, { status: 'rejected', errorCode: 'flagged_for_review' });
            return res.status(201).json({ success: true, data: report });
        }
        else {
            return res.status(201).json({
                success: true,
                data: { reportId: (0, crypto_1.randomUUID)(), userId, generationId, reason },
            });
        }
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to submit report' });
    }
});
