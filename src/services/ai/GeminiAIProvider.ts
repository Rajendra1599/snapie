import { IAIProvider, RestyleJobParams, RestyleJobResult } from './IAIProvider';
import { BFLImageAIProvider } from './BFLImageAIProvider';

/**
 * GeminiAIProvider (Migrated)
 * Replaced Google Imagen 3 image generation with Black Forest Labs FLUX 3 Image API.
 */
export class GeminiAIProvider implements IAIProvider {
  readonly providerName = 'gemini';
  private bflProvider: BFLImageAIProvider;

  constructor() {
    this.bflProvider = new BFLImageAIProvider();
  }

  async restylePhoto(params: RestyleJobParams): Promise<RestyleJobResult> {
    console.log('[GeminiAIProvider]: Routing image restyle through migrated BFL FLUX 3 Image API');
    return this.bflProvider.restylePhoto(params);
  }
}
