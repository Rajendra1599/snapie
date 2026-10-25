import request from 'supertest';
import { createApp } from './app';

describe('Backend App, Auth, Looks & Generations Endpoints', () => {
  const app = createApp();

  it('GET /api/v1/health returns ok status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('1.0.0');
  });

  it('GET /api/v1/looks returns active catalog with 10 effects and 8 templates', async () => {
    const res = await request(app).get('/api/v1/looks');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(18);
  });

  it('GET /api/v1/purchases/products returns Google Play subscription catalog', async () => {
    const res = await request(app).get('/api/v1/purchases/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subscriptions.length).toBe(2);
    expect(res.body.data.packageName).toBe('com.snapie.app');
  });

  it('POST /api/v1/purchases/google-play/verify verifies and grants subscription', async () => {
    const res = await request(app)
      .post('/api/v1/purchases/google-play/verify')
      .send({
        userId: 'test_play_user_1',
        productId: 'boothie_gold_weekly',
        purchaseToken: 'test_token_google_play_xyz_123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.planType).toBe('gold');
    expect(res.body.data.store).toBe('google_play');
  });

  it('POST /api/v1/auth/anonymous registers a new user with 0 initial free credits', async () => {
    const res = await request(app)
      .post('/api/v1/auth/anonymous')
      .send({ locale: 'en_IN', timezone: 'Asia/Kolkata' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBeDefined();
    expect(res.body.data.creditsBalance).toBe(0);
  });

  it('POST /api/v1/generations/upload-url provides a 5-minute signed S3 upload URL', async () => {
    const res = await request(app)
      .post('/api/v1/generations/upload-url')
      .send({ userId: 'test_user_123', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.uploadUrl).toBeDefined();
    expect(res.body.data.key).toContain('uploads/test_user_123/');
    expect(res.body.data.expiresInSeconds).toBe(300);
  });

  it('POST /api/v1/generations rejects with 402 when user has 0 credits (Always-Paid Rule)', async () => {
    const res = await request(app)
      .post('/api/v1/generations')
      .send({
        userId: 'test_user_zero_balance',
        lookId: 'night_terrace',
        inputKey: 'uploads/test_user_zero_balance/sample.jpg',
        strength: 80,
        idempotencyKey: 'idem_key_1',
      });

    expect(res.status).toBe(402);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('insufficient_credits');
  });

  it('POST /api/v1/reports accepts generation report for moderation review', async () => {
    const res = await request(app)
      .post('/api/v1/reports')
      .send({
        userId: 'test_user_report',
        generationId: 'gen_12345',
        reason: 'offensive_content',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reportId).toBeDefined();
  });

  it('DELETE /api/v1/users/:id successfully handles permanent account & data deletion', async () => {
    const res = await request(app).delete('/api/v1/users/user_to_delete_99');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('permanently deleted');
  });
});
