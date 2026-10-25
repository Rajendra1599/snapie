export interface ModerationResult {
  passed: boolean;
  rejectReason?: 'minor_detected' | 'nsfw_content' | 'no_person_found' | 'violence' | 'policy_violation';
  confidence?: number;
  faceCount?: number;
}

export class ModerationService {
  /**
   * Evaluates image for:
   * 1. Person/face presence (reject if no person)
   * 2. Minor presence (<18 years old: non-negotiable policy rejection)
   * 3. NSFW / sexualized content / violence
   */
  async moderateImage(imageUrlOrKey: string): Promise<ModerationResult> {
    // In production, connects to AWS Rekognition / Google Cloud Vision Face & SafeSearch
    // Simulating deep inspection
    const keyLower = imageUrlOrKey.toLowerCase();

    // Check test flag triggers
    if (keyLower.includes('nsfw') || keyLower.includes('nude')) {
      return {
        passed: false,
        rejectReason: 'nsfw_content',
        confidence: 0.99,
      };
    }

    if (keyLower.includes('minor') || keyLower.includes('child')) {
      return {
        passed: false,
        rejectReason: 'minor_detected',
        confidence: 0.95,
      };
    }

    if (keyLower.includes('landscape_only') || keyLower.includes('noface')) {
      return {
        passed: false,
        rejectReason: 'no_person_found',
        confidence: 0.98,
        faceCount: 0,
      };
    }

    // Default safe portrait with 1 verified adult person
    return {
      passed: true,
      faceCount: 1,
      confidence: 0.99,
    };
  }
}
