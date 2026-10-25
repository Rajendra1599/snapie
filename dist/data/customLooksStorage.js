"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCustomLooks = loadCustomLooks;
exports.saveCustomLook = saveCustomLook;
exports.deleteCustomLook = deleteCustomLook;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const starterLooks_1 = require("./starterLooks");
const CUSTOM_LOOKS_FILE = path_1.default.join(__dirname, 'custom_looks.json');
/**
 * Loads custom looks from custom_looks.json and prepends them to STARTER_LOOKS
 */
function loadCustomLooks() {
    try {
        if (!fs_1.default.existsSync(CUSTOM_LOOKS_FILE)) {
            // Seed with Rajendra Bhuyan if files exist
            const initial = [
                {
                    id: 'rajendra_bhuyan_custom',
                    name: 'RAJENDRA BHUYAN',
                    kind: 'effect',
                    description: 'Custom curated restyle look.',
                    tier: 'free',
                    credit_cost: 0,
                    order: -100, // Top priority
                    active: true,
                    pipeline_a: {
                        grain: 0.25,
                        vignette: 0.2,
                        split_tone: { shadow: '#1F2A38', highlight: '#FFE8C8' },
                        contrast: 1.15,
                        halation: 0.15,
                        flash_falloff: 0.3,
                        white_balance: 5500,
                        filter_strength_default: 80,
                    },
                    pipeline_b: {
                        prompt_template: 'Rajendra Bhuyan aesthetic portrait, warm cinematic flash lighting',
                        default_strength: 80,
                        negative_prompt: 'blurry, cartoon, 3d, distorted',
                    },
                    preview: {
                        before_url: '/uploads/1792813900239_Rajendra_Bhuyan_before.jpg',
                        after_url: '/uploads/1792813900666_Rajendra_Bhuyan_after.jpg',
                        thumbnail_url: '/uploads/1792813900666_Rajendra_Bhuyan_after.jpg',
                    },
                },
            ];
            fs_1.default.writeFileSync(CUSTOM_LOOKS_FILE, JSON.stringify(initial, null, 2));
            return initial;
        }
        const content = fs_1.default.readFileSync(CUSTOM_LOOKS_FILE, 'utf-8');
        const looks = JSON.parse(content);
        return looks;
    }
    catch (err) {
        console.error('[CustomLooksStorage] Error reading custom_looks.json:', err);
        return [];
    }
}
function saveCustomLook(look) {
    try {
        const existing = loadCustomLooks();
        // Remove if already exists with same id
        const filtered = existing.filter((l) => l.id !== look.id);
        filtered.unshift(look);
        fs_1.default.writeFileSync(CUSTOM_LOOKS_FILE, JSON.stringify(filtered, null, 2));
        // Update in-memory STARTER_LOOKS
        const idx = starterLooks_1.STARTER_LOOKS.findIndex((l) => l.id === look.id);
        if (idx !== -1) {
            starterLooks_1.STARTER_LOOKS[idx] = look;
        }
        else {
            starterLooks_1.STARTER_LOOKS.unshift(look);
        }
    }
    catch (err) {
        console.error('[CustomLooksStorage] Error saving custom look:', err);
    }
}
function deleteCustomLook(id) {
    try {
        const existing = loadCustomLooks();
        const filtered = existing.filter((l) => l.id !== id);
        fs_1.default.writeFileSync(CUSTOM_LOOKS_FILE, JSON.stringify(filtered, null, 2));
        const idx = starterLooks_1.STARTER_LOOKS.findIndex((l) => l.id === id);
        if (idx !== -1) {
            starterLooks_1.STARTER_LOOKS.splice(idx, 1);
        }
    }
    catch (err) {
        console.error('[CustomLooksStorage] Error deleting custom look:', err);
    }
}
// Initial sync on module load
const customOnStart = loadCustomLooks();
for (const cl of customOnStart) {
    if (!starterLooks_1.STARTER_LOOKS.some((l) => l.id === cl.id)) {
        starterLooks_1.STARTER_LOOKS.unshift(cl);
    }
}
