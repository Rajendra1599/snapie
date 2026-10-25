"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleanupJob = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../../models");
const S3CloudFrontStorageService_1 = require("../storage/S3CloudFrontStorageService");
class CleanupJob {
    storageService;
    constructor(storageService) {
        this.storageService = storageService || new S3CloudFrontStorageService_1.S3CloudFrontStorageService();
    }
    /**
     * Deletes original input uploads older than 24 hours after completion.
     * Keeps final output results until user explicitly deletes them.
     */
    async run24HourOriginalDeletion() {
        if (mongoose_1.default.connection.readyState !== 1) {
            return { deletedCount: 0 };
        }
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        // Find completed or failed generations older than 24h that still have an inputKey
        const expiredGenerations = await models_1.Generation.find({
            completedAt: { $lt: cutoff },
            inputKey: { $ne: '' },
        });
        let count = 0;
        for (const gen of expiredGenerations) {
            if (gen.inputKey) {
                try {
                    await this.storageService.deleteObject(gen.inputKey);
                    gen.inputKey = ''; // Mark input as purged
                    await gen.save();
                    count++;
                }
                catch (_) { }
            }
        }
        return { deletedCount: count };
    }
}
exports.CleanupJob = CleanupJob;
