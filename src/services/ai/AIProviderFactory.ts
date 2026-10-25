import { IAIProvider } from './IAIProvider';
import { MockAIProvider } from './MockAIProvider';
import { BFLImageAIProvider } from './BFLImageAIProvider';
import { GeminiAIProvider } from './GeminiAIProvider';
import { HuggingFaceAIProvider } from './HuggingFaceAIProvider';
import { env } from '../../config/env';

export class AIProviderFactory {
  static getProvider(providerName?: string): IAIProvider {
    const selected = (providerName || env.AI_PROVIDER).toLowerCase();

    switch (selected) {
      case 'bfl':
      case 'flux':
      case 'flux3':
        return new BFLImageAIProvider();
      case 'gemini':
        // Seamlessly route Gemini requests to the migrated BFL FLUX 3 Image engine
        return new BFLImageAIProvider();
      case 'huggingface':
        return new HuggingFaceAIProvider();
      case 'mock':
        return new MockAIProvider();
      default:
        return new BFLImageAIProvider();
    }
  }
}
