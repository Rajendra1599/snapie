import { Router, Request, Response } from 'express';

export const privacyRouter = Router();

const privacyPolicyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - Snapie</title>
  <style>
    :root {
      --bg: #FBF8F2;
      --card-bg: #FFFFFF;
      --text-main: #18181B;
      --text-sub: #52525B;
      --accent: #E11D48;
      --border: #E4E4E7;
      --badge-bg: #F4F4F5;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      margin: 0;
      padding: 24px 16px;
      line-height: 1.6;
    }
    .container {
      max-width: 780px;
      margin: 0 auto;
      background: var(--card-bg);
      border-radius: 20px;
      padding: 36px 32px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.04);
      border: 1px solid var(--border);
    }
    h1 {
      font-size: 28px;
      font-weight: 800;
      margin-top: 0;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    .badge {
      display: inline-block;
      background: var(--badge-bg);
      color: var(--text-sub);
      font-size: 13px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 12px;
      margin-bottom: 24px;
    }
    h2 {
      font-size: 20px;
      font-weight: 700;
      margin-top: 32px;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
    }
    h3 {
      font-size: 16px;
      font-weight: 600;
      margin-top: 20px;
      margin-bottom: 8px;
    }
    p, li {
      font-size: 15px;
      color: var(--text-sub);
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin-bottom: 6px;
    }
    .highlight-box {
      background: #FFF1F2;
      border-left: 4px solid var(--accent);
      padding: 16px 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .highlight-box p {
      margin: 0;
      color: #9F1239;
      font-weight: 500;
    }
    a {
      color: var(--accent);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      font-size: 13px;
      color: #A1A1AA;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Privacy Policy</h1>
    <div class="badge">Snapie App • Last Updated: October 2026</div>

    <p><strong>Snapie</strong> is a photo styling and enhancement app that applies different aesthetics and filters to your photos. Snapie has two distinct modes:</p>
    <ul>
      <li><strong>Classic Filters (Pipeline A)</strong> — real, on-device aesthetic filters. No AI. Photos never leave your device.</li>
      <li><strong>AI Restyler (Pipeline B)</strong> — AI-generated poses, editorial looks, lighting, and restyled portraits powered by <strong>Black Forest Labs (FLUX AI model)</strong> based on your selected photo.</li>
    </ul>
    <p>This Privacy Policy explains what we collect, how we use it, and your choices. By using Snapie, you agree to this Policy. If you don't agree, please do not use the app.</p>

    <h2>What We Are (and Aren't) Doing</h2>
    <ul>
      <li><strong>No account needed:</strong> You can use Snapie without creating an account or sharing contact details.</li>
      <li><strong>Classic Filters stay on your device:</strong> In Classic mode, filters are applied entirely locally on your device. Your photo is never sent to our servers or to any AI provider.</li>
      <li><strong>AI Restyler uses Black Forest Labs FLUX AI:</strong> In AI mode, the app securely transmits your selected photo to Black Forest Labs' state-of-the-art FLUX model to produce your restyled output.</li>
      <li><strong>Transient processing only:</strong> Your photos, prompts, and outputs are used only to fulfill your generation request and are not permanently retained on our servers after completion.</li>
      <li><strong>Local device history:</strong> Your generated history and photos are saved directly on your device (in your gallery and local app storage), unless you choose to delete them.</li>
      <li><strong>Subscriptions & Billing:</strong> Handled securely via Google Play Billing and Apple StoreKit. We do not collect or store credit card data.</li>
    </ul>

    <h2>Face Data</h2>
    <div class="highlight-box">
      <p><strong>Zero Biometric Facial Recognition:</strong> Snapie does not perform facial recognition, identity matching, biometric analysis, or the creation or storage of face templates or biometric identifiers. We do not extract or store facial geometry.</p>
    </div>
    <ul>
      <li><strong>What we collect:</strong> Photos you choose to select may contain faces.</li>
      <li><strong>How it is used:</strong> Photos containing faces are used solely to create the image look you requested. In AI mode, your selected photo is sent to Black Forest Labs FLUX AI to generate the output, which is returned to you. In Classic mode, photos are processed entirely on-device and are not transmitted at all.</li>
      <li><strong>Sharing:</strong> Photos that may contain faces are shared only with Black Forest Labs FLUX AI for the sole purpose of rendering your requested style — never for facial identification, analytics, advertising, or profiling.</li>
      <li><strong>Storage & retention:</strong> Photos sent to BFL for AI generation are transmitted securely via encrypted HTTPS and are not retained on our servers after the request completes. Your input photos and generated outputs remain stored on your local device until you delete them.</li>
      <li><strong>Consent & control:</strong> You choose which photos to use. You can delete your on-device history at any time, and you control camera and photo library access via your device settings.</li>
      <li><strong>No sale or model training:</strong> We do not use your photos to train AI models. We do not sell, lease, trade, or profit from any face-containing content.</li>
    </ul>

    <h2>Information We Collect</h2>
    <p>We collect the minimum necessary to operate Snapie:</p>

    <h3>1. Content You Choose to Provide</h3>
    <p>Photos you select to create an image. In AI Restyler mode, these are securely transmitted to our backend only to invoke Black Forest Labs FLUX AI model and return the result to you. In Classic mode, photos are processed on-device and are not transmitted anywhere. We do not persist your input photos or generated outputs on our servers after fulfillment.</p>

    <h3>2. Subscription & Credit Signals</h3>
    <p>To manage your subscription and credits, we process:</p>
    <ul>
      <li>Google Play Billing / Apple StoreKit transaction tokens to verify whether you have an active Plus or Gold VIP subscription.</li>
      <li>An anonymous app user identifier to associate your purchases, entitlements, and daily credits with your installation.</li>
      <li>Your daily credit count (5 fresh daily credits for subscribers) and credit pack balance, to enforce daily generation limits and apply credits you have purchased.</li>
    </ul>

    <h3>3. Device / Network & Integrity Metadata</h3>
    <p>Standard HTTP request data (IP address, user-agent, timestamps) may be processed temporarily for security, abuse prevention, and reliable server communication. We do not collect your name, email, phone number, contacts, or precise GPS location.</p>

    <h3>4. Analytics & Diagnostics</h3>
    <p>To understand app stability and fix crashes, we collect:</p>
    <ul>
      <li><strong>Product analytics:</strong> Anonymous user identifier, subscription tier, and basic interaction events (such as viewing the paywall, starting an AI generation, or exporting a result). We do not record screens, sessions, or user inputs.</li>
      <li><strong>Crash reports:</strong> Device model, OS version, and stack traces when an error occurs, to diagnose and resolve bugs.</li>
      <li><strong>Photos and prompts are NEVER included in analytics or crash reports.</strong></li>
    </ul>

    <h2>Third-Party Processors</h2>
    <ul>
      <li><strong>Black Forest Labs (FLUX 3 Image / Klein):</strong> Creates the AI restyled output image in AI mode.</li>
      <li><strong>Google Play Billing & Apple StoreKit:</strong> Handles subscriptions, credit-pack purchases, and in-app transactions securely.</li>
      <li><strong>Amazon Web Services (AWS S3 & CloudFront):</strong> Provides temporary transient staging for image generation results with short expiration lifespans.</li>
    </ul>

    <h2>Children's Privacy</h2>
    <p>Snapie is not directed to children under 13 (or 16 in the EU/UK). We do not knowingly collect personal data from minors. If you believe a minor's data was submitted without proper consent, please contact us immediately.</p>

    <h2>Data Retention & Deletion</h2>
    <ul>
      <li><strong>Photos & Prompts:</strong> Not stored on our servers after returning your generated image.</li>
      <li><strong>Local History:</strong> Stored on your device until you delete it or uninstall the app.</li>
      <li><strong>Account & Data Deletion:</strong> You can permanently wipe all local generation history and app data at any time via the <em>"Delete Account & Data"</em> button in Settings.</li>
    </ul>

    <h2>Contact Us</h2>
    <p>If you have questions about this Privacy Policy or wish to exercise any privacy rights, contact us at:</p>
    <p><strong>Snapie App Support</strong><br>
    Email: <a href="mailto:support.snapie@gmail.com">support.snapie@gmail.com</a></p>

    <div class="footer">
      &copy; 2026 Snapie. All rights reserved.
    </div>
  </div>
</body>
</html>`;

// GET /privacy - Public HTML Privacy Policy for App Store & Google Play Console
privacyRouter.get('/privacy', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(privacyPolicyHtml);
});

// GET /api/v1/privacy - JSON representation
privacyRouter.get('/privacy-policy', (_req: Request, res: Response) => {
  res.status(200).json({
    appName: 'Snapie',
    lastUpdated: 'October 2026',
    contactEmail: 'support.snapie@gmail.com',
    aiProvider: 'Black Forest Labs (FLUX AI)',
    modes: {
      classic: 'On-device filters (no AI, no data transmission)',
      ai: 'Black Forest Labs FLUX AI model (transient processing, zero cloud retention)',
    },
    biometricFacialRecognition: false,
    faceTemplatesStored: false,
    permanentCloudStorage: false,
    dailyCredits: '5 credits daily for Plus & Gold VIP subscribers',
  });
});
