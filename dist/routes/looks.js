"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.looksRouter = void 0;
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const starterLooks_1 = require("../data/starterLooks");
const models_1 = require("../models");
require("../data/customLooksStorage");
const admin_1 = require("./admin");
exports.looksRouter = (0, express_1.Router)();
// GET /api/v1/looks - returns active effects and templates
exports.looksRouter.get('/looks', async (req, res) => {
    try {
        const kind = req.query.kind;
        // Start with default starter looks
        let results = [...starterLooks_1.STARTER_LOOKS];
        // If MongoDB is connected, load all custom admin-uploaded looks from database
        if (mongoose_1.default.connection.readyState === 1) {
            try {
                let query = { active: { $ne: false } };
                if (kind)
                    query.kind = kind;
                const dbLooks = await models_1.Look.find(query).sort({ order: 1 }).lean();
                for (const dl of dbLooks) {
                    const id = (dl.id || dl.lookId || dl._id?.toString());
                    const formatted = {
                        id,
                        name: dl.name,
                        kind: dl.kind,
                        description: dl.description || '',
                        tier: (dl.tier || 'free'),
                        credit_cost: dl.creditCost || 0,
                        order: dl.order || 0,
                        active: dl.active !== false,
                        pipeline_a: dl.pipeline_a || dl.pipelineA || {
                            grain: 0.25,
                            vignette: 0.2,
                            split_tone: { shadow: '#1F2A38', highlight: '#FFE8C8' },
                            contrast: 1.15,
                            halation: 0.15,
                            flash_falloff: 0.3,
                            white_balance: 5500,
                            filter_strength_default: 80,
                        },
                        pipeline_b: dl.pipeline_b || dl.pipelineB || {
                            prompt_template: `${dl.name} aesthetic photography`,
                            default_strength: 80,
                            negative_prompt: 'blurry, cartoon, 3d, distorted',
                        },
                        preview: {
                            before_url: dl.preview?.before_url || dl.preview?.beforeUrl || '',
                            after_url: dl.preview?.after_url || dl.preview?.afterUrl || '',
                            thumbnail_url: dl.preview?.thumbnail_url || dl.preview?.thumbnailUrl || '',
                        },
                    };
                    const existingIdx = results.findIndex((l) => l.id === id);
                    if (existingIdx !== -1) {
                        results[existingIdx] = formatted;
                    }
                    else {
                        results.unshift(formatted);
                    }
                }
            }
            catch (dbErr) {
                console.warn('[Looks] MongoDB query warning:', dbErr);
            }
        }
        let filtered = results.filter((l) => l.active);
        if (kind) {
            filtered = filtered.filter((l) => l.kind === kind);
        }
        filtered.sort((a, b) => a.order - b.order);
        const host = req.get('host') || 'localhost:4000';
        const proto = req.get('x-forwarded-proto') || (host.includes('onrender.com') ? 'https' : req.protocol);
        const baseUrl = `${proto}://${host}`;
        const normalized = filtered.map((look) => ({
            ...look,
            preview: {
                ...look.preview,
                before_url: (0, admin_1.resolveMediaUrl)(baseUrl, look.preview.before_url),
                after_url: (0, admin_1.resolveMediaUrl)(baseUrl, look.preview.after_url),
                thumbnail_url: (0, admin_1.resolveMediaUrl)(baseUrl, look.preview.thumbnail_url),
            },
        }));
        res.status(200).json({
            success: true,
            data: normalized,
            count: normalized.length,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch looks and templates',
        });
    }
});
// GET /api/v1/looks/:id
exports.looksRouter.get('/looks/:id', (req, res) => {
    const { id } = req.params;
    const look = starterLooks_1.STARTER_LOOKS.find((l) => l.id === id);
    if (!look) {
        return res.status(404).json({
            success: false,
            error: 'Look not found',
        });
    }
    const host = req.get('host') || 'localhost:4000';
    const proto = req.get('x-forwarded-proto') || (host.includes('onrender.com') ? 'https' : req.protocol);
    const baseUrl = `${proto}://${host}`;
    const normalized = {
        ...look,
        preview: {
            ...look.preview,
            before_url: (0, admin_1.resolveMediaUrl)(baseUrl, look.preview.before_url),
            after_url: (0, admin_1.resolveMediaUrl)(baseUrl, look.preview.after_url),
            thumbnail_url: (0, admin_1.resolveMediaUrl)(baseUrl, look.preview.thumbnail_url),
        },
    };
    res.status(200).json({
        success: true,
        data: normalized,
    });
});
