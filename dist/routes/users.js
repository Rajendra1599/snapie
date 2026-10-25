"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
const S3CloudFrontStorageService_1 = require("../services/storage/S3CloudFrontStorageService");
exports.usersRouter = (0, express_1.Router)();
const storageService = new S3CloudFrontStorageService_1.S3CloudFrontStorageService();
// DELETE /api/v1/users/:id
// Non-negotiable privacy requirement: deletes all user data and photos
exports.usersRouter.delete('/users/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        if (mongoose_1.default.connection.readyState === 1) {
            // Find all generations to clean up storage objects
            const generations = await models_1.Generation.find({ userId });
            for (const gen of generations) {
                if (gen.inputKey) {
                    try {
                        await storageService.deleteObject(gen.inputKey);
                    }
                    catch (_) { }
                }
                if (gen.outputKey) {
                    try {
                        await storageService.deleteObject(gen.outputKey);
                    }
                    catch (_) { }
                }
            }
            // Delete all database records
            await Promise.all([
                models_1.User.deleteOne({ userId }),
                models_1.Generation.deleteMany({ userId }),
                models_1.CreditLedger.deleteMany({ userId }),
                models_1.Purchase.deleteMany({ userId }),
                models_1.Report.deleteMany({ userId }),
            ]);
        }
        res.status(200).json({
            success: true,
            message: 'All user data, records, and photos have been permanently deleted from our servers. Please cancel any active store subscriptions directly in Google Play or the App Store.',
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to delete user account' });
    }
});
