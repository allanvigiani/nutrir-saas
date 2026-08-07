import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/mail.ts', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  getPasswordResetTemplate: vi.fn().mockReturnValue('<html>reset</html>'),
}));

import { sendEmail } from '../../lib/mail.ts';
import { createPasswordResetService } from '../../server/services/password-reset.service.ts';

describe('createPasswordResetService', () => {
  let mockGenerateLink: ReturnType<typeof vi.fn>;
  let mockAdmin: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateLink = vi.fn().mockResolvedValue('https://firebase.com/reset?oobCode=xyz');
    mockAdmin = { auth: () => ({ generatePasswordResetLink: mockGenerateLink }) };
  });

  it('envia email quando usuário existe', async () => {
    const service = createPasswordResetService({ admin: mockAdmin });
    await service.sendResetEmail('user@example.com');

    expect(mockGenerateLink).toHaveBeenCalledWith(
      'user@example.com',
      expect.objectContaining({ url: expect.any(String) })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('senha'),
        html: expect.any(String),
      })
    );
  });

  it('não lança erro quando auth/user-not-found', async () => {
    mockGenerateLink.mockRejectedValue({ code: 'auth/user-not-found' });
    const service = createPasswordResetService({ admin: mockAdmin });

    await expect(service.sendResetEmail('naoexiste@example.com')).resolves.toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('propaga outros erros do Firebase', async () => {
    mockGenerateLink.mockRejectedValue({ code: 'auth/too-many-requests' });
    const service = createPasswordResetService({ admin: mockAdmin });

    await expect(service.sendResetEmail('user@example.com')).rejects.toMatchObject({
      code: 'auth/too-many-requests',
    });
  });
});
