"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.looksRouter = void 0;
const express_1 = require("express");
const starterLooks_1 = require("../data/starterLooks");
require("../data/customLooksStorage");
const admin_1 = require("./admin");
exports.looksRouter = (0, express_1.Router)();
// GET /api/v1/looks - returns active effects and templates
exports.looksRouter.get('/looks', async (req, res) => {
    try {
        const kind = req.query.kind;
        // In production with MongoDB connected:
        // let query: any = { active: true };
        // if (kind) query.kind = kind;
        // const looks = await Look.find(query).sort({ order: 1 });
        let results = starterLooks_1.STARTER_LOOKS.filter((l) => l.active);
        if (kind) {
            results = results.filter((l) => l.kind === kind);
        }
        results.sort((a, b) => a.order - b.order);
        const host = req.get('host') || 'localhost:4000';
        const baseUrl = `${req.protocol}://${host}`;
        const normalized = results.map((look) => ({
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
    const baseUrl = `${req.protocol}://${host}`;
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
