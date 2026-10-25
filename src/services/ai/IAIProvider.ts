export interface RestyleJobParams {
  jobId: string;
  imageInputUrl: string;
  prompt: string;
  negativePrompt?: string;
  strength: number; // 0 to 100
  lookId: string;
  resolution?: '768sq' | '1k' | '1.5k' | '2k' | '4k' | 'match_input';
}

export interface RestyleJobResult {
  outputImageUrl: string;
  provider: string;
  metadata?: Record<string, unknown>;
}

export interface IAIProvider {
  readonly providerName: string;

  /**
   * Restyles an image based on prompt, strength, and negative prompt while preserving identity.
   */
  restylePhoto(params: RestyleJobParams): Promise<RestyleJobResult>;
}
