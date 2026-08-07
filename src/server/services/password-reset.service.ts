import { sendEmail, getPasswordResetTemplate } from '../../lib/mail.ts';

interface PasswordResetServiceDeps {
  admin: any;
}

export function createPasswordResetService({ admin }: PasswordResetServiceDeps) {
  async function sendResetEmail(email: string): Promise<void> {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    let firebaseLink: string;
    try {
      // continueUrl é apenas fallback do Firebase — o link real é construído abaixo
      firebaseLink = await admin.auth().generatePasswordResetLink(email, { url: appUrl + '/login' });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'auth/user-not-found') return;
      throw err;
    }

    // Extrai o oobCode gerado pelo Firebase e monta o link apontando para nossa página
    const oobCode = new URL(firebaseLink).searchParams.get('oobCode') ?? '';
    const resetLink = `${appUrl}/reset-password?oobCode=${encodeURIComponent(oobCode)}`;

    await sendEmail({
      to: email,
      subject: 'Redefinição de senha — Nutrir',
      html: getPasswordResetTemplate(resetLink),
    });
  }

  return { sendResetEmail };
}
