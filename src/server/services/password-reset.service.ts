import { getAuth } from 'firebase-admin/auth';
import { sendEmail, getPasswordResetTemplate } from '../../lib/mail.ts';

export function createPasswordResetService() {
  async function sendResetEmail(email: string): Promise<void> {
    const continueUrl = (process.env.APP_URL || 'http://localhost:3000') + '/login';

    let resetLink: string;
    try {
      resetLink = await getAuth().generatePasswordResetLink(email, { url: continueUrl });
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') return;
      throw err;
    }

    await sendEmail({
      to: email,
      subject: 'Redefinição de senha — Nutrir',
      html: getPasswordResetTemplate(resetLink),
    });
  }

  return { sendResetEmail };
}
