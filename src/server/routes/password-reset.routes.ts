import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import type { BaseRouteDeps } from '../types.ts';
import { createPasswordResetService } from '../services/password-reset.service.ts';

// Rate limit por email em memória — reseta junto com o processo
const emailAttempts = new Map<string, { count: number; resetAt: number }>();

function checkEmailRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = emailAttempts.get(email);
  if (!entry || now > entry.resetAt) {
    emailAttempts.set(email, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

const ipLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: 'Muitas tentativas. Tente novamente em breve.' },
});

export function registerPasswordResetRoutes(deps: BaseRouteDeps) {
  const service = createPasswordResetService({ admin: deps.admin });

  deps.app.post('/api/auth/forgot-password', ipLimiter, async (req: Request, res: Response) => {
    const { email } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!checkEmailRateLimit(normalizedEmail)) {
      return res.status(429).json({ error: 'Muitas tentativas para este e-mail. Tente novamente em 1 hora.' });
    }

    try {
      await service.sendResetEmail(normalizedEmail);
    } catch (err: unknown) {
      console.error('[password-reset] erro interno ao enviar email:', err);
    }

    return res.status(200).json({
      message: 'Se este e-mail estiver cadastrado, você receberá um link de redefinição em breve.',
    });
  });
}
