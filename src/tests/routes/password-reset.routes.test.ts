import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockSendResetEmail = vi.fn().mockResolvedValue(undefined);

vi.mock('../../server/services/password-reset.service.ts', () => ({
  createPasswordResetService: vi.fn(() => ({ sendResetEmail: mockSendResetEmail })),
}));

// Desabilita rate limit nos testes
vi.mock('express-rate-limit', () => ({
  default: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  rateLimit: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

import { registerPasswordResetRoutes } from '../../server/routes/password-reset.routes.ts';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerPasswordResetRoutes({ app } as any);
  return app;
}

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 200 quando email existe', async () => {
    const res = await request(buildApp())
      .post('/api/auth/forgot-password')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBeTruthy();
    expect(mockSendResetEmail).toHaveBeenCalledWith('user@example.com');
  });

  it('retorna 200 mesmo quando email não existe (segurança)', async () => {
    mockSendResetEmail.mockResolvedValueOnce(undefined);
    const res = await request(buildApp())
      .post('/api/auth/forgot-password')
      .send({ email: 'naoexiste@example.com' });

    expect(res.status).toBe(200);
  });

  it('retorna 400 quando email está ausente', async () => {
    const res = await request(buildApp())
      .post('/api/auth/forgot-password')
      .send({});

    expect(res.status).toBe(400);
  });

  it('retorna 400 quando email é inválido', async () => {
    const res = await request(buildApp())
      .post('/api/auth/forgot-password')
      .send({ email: 'nao-e-email' });

    expect(res.status).toBe(400);
  });
});
