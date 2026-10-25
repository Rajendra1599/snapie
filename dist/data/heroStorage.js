"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_HERO_CONFIG = void 0;
exports.loadHeroConfig = loadHeroConfig;
exports.saveHeroConfig = saveHeroConfig;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const HERO_FILE = path_1.default.join(__dirname, 'custom_hero.json');
exports.DEFAULT_HERO_CONFIG = {
    picture1_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&q=80',
    picture2_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80',
    title: 'aesthetic\nfilters',
    subtitle: 'Film looks and pro adjustments, free on any photo.',
    button_text: 'SELECT A PHOTO',
};
function loadHeroConfig() {
    try {
        if (!fs_1.default.existsSync(HERO_FILE)) {
            fs_1.default.writeFileSync(HERO_FILE, JSON.stringify(exports.DEFAULT_HERO_CONFIG, null, 2));
            return exports.DEFAULT_HERO_CONFIG;
        }
        const content = fs_1.default.readFileSync(HERO_FILE, 'utf-8');
        const config = JSON.parse(content);
        return config;
    }
    catch (err) {
        console.error('[HeroStorage] Error reading custom_hero.json:', err);
        return exports.DEFAULT_HERO_CONFIG;
    }
}
function saveHeroConfig(config) {
    try {
        const current = loadHeroConfig();
        const updated = {
            ...current,
            ...config,
        };
        fs_1.default.writeFileSync(HERO_FILE, JSON.stringify(updated, null, 2));
        return updated;
    }
    catch (err) {
        console.error('[HeroStorage] Error saving custom_hero.json:', err);
        return exports.DEFAULT_HERO_CONFIG;
    }
}
