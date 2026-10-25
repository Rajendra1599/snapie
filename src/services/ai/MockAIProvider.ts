import { IAIProvider, RestyleJobParams, RestyleJobResult } from './IAIProvider';

export class MockAIProvider implements IAIProvider {
  readonly providerName = 'mock';

  async restylePhoto(params: RestyleJobParams): Promise<RestyleJobResult> {
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
