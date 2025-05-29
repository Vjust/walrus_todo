import request from 'supertest';
import express from 'express';
import { createAuthRoutes } from '../routes/auth';
import { config } from '../config';
import { cleanupAuthController } from '../controllers/authController';

describe('Auth API Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRoutes());
  });

  afterAll(() => {
    // Clean up auth controller to prevent hanging tests
    cleanupAuthController();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should reject invalid wallet format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          wallet: 'invalid-wallet',
          signature: '0x' + '0'.repeat(256),
          message: 'Sign in to WalTodo',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should accept valid wallet and return tokens', async () => {
      const validWallet = '0x' + '0'.repeat(64);
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          wallet: validWallet,
          signature: '0x' + '0'.repeat(256),
          message: 'Sign in to WalTodo',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('wallet', validWallet);
      expect(response.body.data).toHaveProperty('expiresIn', 86400);
    });

    it('should reject request with missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          wallet: '0x' + '0'.repeat(64),
          // missing signature and message
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/verify', () => {
    it('should reject request without token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });

    it('should verify valid token', async () => {
      // First login to get a token
      const validWallet = '0x' + '0'.repeat(64);
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          wallet: validWallet,
          signature: '0x' + '0'.repeat(256),
          message: 'Sign in to WalTodo',
        });

      const { accessToken } = loginResponse.body.data;

      // Now verify the token
      const response = await request(app)
        .post('/api/v1/auth/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('valid', true);
      expect(response.body.data).toHaveProperty('wallet', validWallet);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      // First login to get tokens
      const validWallet = '0x' + '0'.repeat(64);
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          wallet: validWallet,
          signature: '0x' + '0'.repeat(256),
          message: 'Sign in to WalTodo',
        });

      const { refreshToken } = loginResponse.body.data;

      // Now refresh the token
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('wallet', validWallet);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid refresh token');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      // First login to get a token
      const validWallet = '0x' + '0'.repeat(64);
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          wallet: validWallet,
          signature: '0x' + '0'.repeat(256),
          message: 'Sign in to WalTodo',
        });

      const { accessToken } = loginResponse.body.data;

      // Now logout
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});