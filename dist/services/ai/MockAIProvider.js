"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockAIProvider = void 0;
class MockAIProvider {
    providerName = 'mock';
    async restylePhoto(params) {
        // Simulates AI processing latency
        await new Promise((resolve) => setTimeout(resolve, 800));
        return {
            outputImageUrl: params.imageInputUrl,
            provider: 'mock',
            metadata: {
                simulated: true,
                lookId: params.lookId,
                strength: params.strength,
            },
        };
    }
}
exports.MockAIProvider = MockAIProvider;
