"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiAIProvider = void 0;
const BFLImageAIProvider_1 = require("./BFLImageAIProvider");
/**
 * GeminiAIProvider (Migrated)
 * Replaced Google Imagen 3 image generation with Black Forest Labs FLUX 3 Image API.
 */
class GeminiAIProvider {
    providerName = 'gemini';
    bflProvider;
    constructor() {
        this.bflProvider = new BFLImageAIProvider_1.BFLImageAIProvider();
    }
    async restylePhoto(params) {
        console.log('[GeminiAIProvider]: Routing image restyle through migrated BFL FLUX 3 Image API');
        return this.bflProvider.restylePhoto(params);
    }
}
exports.GeminiAIProvider = GeminiAIProvider;
