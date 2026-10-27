"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeroConfig = exports.OnboardingSlide = exports.Report = exports.Purchase = exports.CreditLedger = exports.Generation = exports.Look = exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const UserSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    ageConfirmedAt: { type: Date },
    consentVersion: { type: String },
    locale: { type: String, default: 'en_IN' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    deletedAt: { type: Date },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });
const LookSchema = new mongoose_1.Schema({
    id: { type: String, index: true },
    lookId: { type: String, index: true },
    name: { type: String, required: true },
    kind: { type: String, enum: ['effect', 'template'], default: 'effect' },
    description: { type: String, default: '' },
    tier: { type: String, enum: ['free', 'plus', 'gold'], default: 'free' },
    creditCost: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
}, { timestamps: true, strict: false });
const GenerationSchema = new mongoose_1.Schema({
    generationId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    lookId: { type: String, required: true },
    strength: { type: Number, default: 80 },
    status: {
        type: String,
        enum: ['queued', 'running', 'completed', 'failed', 'rejected'],
        default: 'queued',
        index: true,
    },
    inputKey: { type: String, required: true },
    outputKey: { type: String },
    errorCode: { type: String },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    completedAt: { type: Date },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });
const CreditLedgerSchema = new mongoose_1.Schema({
    ledgerId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    delta: { type: Number, required: true },
    reason: {
        type: String,
        enum: [
            'initial_grant',
            'generation_reserve',
            'generation_refund',
            'store_purchase',
            'subscription_daily',
        ],
        required: true,
    },
    generationId: { type: String, index: true },
    storeTransactionId: { type: String },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });
const PurchaseSchema = new mongoose_1.Schema({
    purchaseId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    store: { type: String, enum: ['google_play', 'app_store'], required: true },
    productId: { type: String, required: true },
    transactionId: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['active', 'expired', 'refunded'], default: 'active' },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });
const ReportSchema = new mongoose_1.Schema({
    reportId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    generationId: { type: String, required: true, index: true },
    reason: { type: String, required: true },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });
const OnboardingSlideSchema = new mongoose_1.Schema({
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    before_url: { type: String, default: '' },
    after_url: { type: String, default: '' },
    filter: { type: [Number], default: [] },
    order: { type: Number, default: 1 },
}, { timestamps: true });
const HeroConfigSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true, default: 'default' },
    picture1_url: { type: String, default: '' },
    picture2_url: { type: String, default: '' },
    title: { type: String, default: 'aesthetic\nfilters' },
    subtitle: { type: String, default: 'Film looks and pro adjustments, free on any photo.' },
    button_text: { type: String, default: 'SELECT A PHOTO' },
}, { timestamps: true });
exports.User = mongoose_1.default.model('User', UserSchema);
exports.Look = mongoose_1.default.model('Look', LookSchema);
exports.Generation = mongoose_1.default.model('Generation', GenerationSchema);
exports.CreditLedger = mongoose_1.default.model('CreditLedger', CreditLedgerSchema);
exports.Purchase = mongoose_1.default.model('Purchase', PurchaseSchema);
exports.Report = mongoose_1.default.model('Report', ReportSchema);
exports.OnboardingSlide = mongoose_1.default.model('OnboardingSlide', OnboardingSlideSchema);
exports.HeroConfig = mongoose_1.default.model('HeroConfig', HeroConfigSchema);
