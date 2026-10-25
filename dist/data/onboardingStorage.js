"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ONBOARDING_SLIDES = void 0;
exports.loadOnboardingSlides = loadOnboardingSlides;
exports.saveOnboardingSlide = saveOnboardingSlide;
exports.deleteOnboardingSlide = deleteOnboardingSlide;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ONBOARDING_FILE = path_1.default.join(__dirname, 'custom_onboarding.json');
// Default high-quality starter slides (used when app first opens)
exports.DEFAULT_ONBOARDING_SLIDES = [
    {
        id: 'slide_1',
        title: 'welcome to snapie.',
        subtitle: 'give your photos an instant glow-up 🤍',
        before_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80',
        after_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80',
        filter: [
            1.15, 0.0, 0.0, 0.0, 18.0,
            0.0, 1.08, 0.0, 0.0, 10.0,
            -0.05, 0.0, 0.95, 0.0, -8.0,
            0.0, 0.0, 0.0, 1.0, 0.0,
        ],
        order: 1,
    },
    {
        id: 'slide_2',
        title: 'soft flash, big glow.',
        subtitle: 'instant analog aesthetics & direct flash lighting on any photo.',
        before_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80',
        after_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80',
        filter: [
            1.25, 0.0, 0.0, 0.0, 22.0,
            0.0, 1.15, 0.0, 0.0, 14.0,
            -0.1, 0.0, 0.90, 0.0, -12.0,
            0.0, 0.0, 0.0, 1.0, 0.0,
        ],
        order: 2,
    },
    {
        id: 'slide_3',
        title: 'take it to the next level.',
        subtitle: 'drag to compare before and after restyling.',
        before_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80',
        after_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80',
        filter: [
            1.20, 0.0, 0.0, 0.0, 16.0,
            0.0, 1.10, 0.0, 0.0, 8.0,
            -0.05, 0.0, 0.95, 0.0, -10.0,
            0.0, 0.0, 0.0, 1.0, 0.0,
        ],
        order: 3,
    },
];
function loadOnboardingSlides() {
    try {
        if (!fs_1.default.existsSync(ONBOARDING_FILE)) {
            fs_1.default.writeFileSync(ONBOARDING_FILE, JSON.stringify(exports.DEFAULT_ONBOARDING_SLIDES, null, 2));
            return exports.DEFAULT_ONBOARDING_SLIDES;
        }
        const content = fs_1.default.readFileSync(ONBOARDING_FILE, 'utf-8');
        const slides = JSON.parse(content);
        return slides.length > 0 ? slides : exports.DEFAULT_ONBOARDING_SLIDES;
    }
    catch (err) {
        console.error('[OnboardingStorage] Error reading custom_onboarding.json:', err);
        return exports.DEFAULT_ONBOARDING_SLIDES;
    }
}
function saveOnboardingSlide(slide) {
    try {
        const existing = loadOnboardingSlides();
        const filtered = existing.filter((s) => s.id !== slide.id);
        filtered.push(slide);
        // Sort by order ascending
        filtered.sort((a, b) => a.order - b.order);
        fs_1.default.writeFileSync(ONBOARDING_FILE, JSON.stringify(filtered, null, 2));
    }
    catch (err) {
        console.error('[OnboardingStorage] Error saving onboarding slide:', err);
    }
}
function deleteOnboardingSlide(id) {
    try {
        const existing = loadOnboardingSlides();
        const filtered = existing.filter((s) => s.id !== id);
        fs_1.default.writeFileSync(ONBOARDING_FILE, JSON.stringify(filtered, null, 2));
    }
    catch (err) {
        console.error('[OnboardingStorage] Error deleting onboarding slide:', err);
    }
}
