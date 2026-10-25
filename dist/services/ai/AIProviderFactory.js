"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIProviderFactory = void 0;
const MockAIProvider_1 = require("./MockAIProvider");
const BFLImageAIProvider_1 = require("./BFLImageAIProvider");
const HuggingFaceAIProvider_1 = require("./HuggingFaceAIProvider");
const env_1 = require("../../config/env");
class AIProviderFactory {
    static getProvider(providerName) {
        const selected = (providerName || env_1.env.AI_PROVIDER).toLowerCase();
        switch (selected) {
            case 'bfl':
            case 'flux':
            case 'flux3':
                return new BFLImageAIProvider_1.BFLImageAIProvider();
            case 'gemini':
                // Seamlessly route Gemini requests to the migrated BFL FLUX 3 Image engine
                return new BFLImageAIProvider_1.BFLImageAIProvider();
            case 'huggingface':
                return new HuggingFaceAIProvider_1.HuggingFaceAIProvider();
            case 'mock':
                return new MockAIProvider_1.MockAIProvider();
            default:
                return new BFLImageAIProvider_1.BFLImageAIProvider();
        }
    }
}
exports.AIProviderFactory = AIProviderFactory;
