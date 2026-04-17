import { getMealPlanEmailTemplate, getPatientWelcomeTemplate, sendEmail } from "../../lib/mail.ts";

export function createEmailService() {
  async function sendTestEmail(to: string) {
    await sendEmail({
      to,
      subject: "Teste de Configuração SMTP - Nutrir",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #059669;">Olá!</h2>
          <p>Este é um e-mail de teste para confirmar que a configuração SMTP da <b>Brevo</b> está funcionando corretamente no sistema Nutrir.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">Enviado em: ${new Date().toLocaleString("pt-BR")}</p>
        </div>
      `,
    });
  }

  async function sendWelcomeEmail(params: {
    patientEmail: string;
    patientName: string;
    nutritionistName: string;
    nutritionistEmail: string;
    nutritionistPhone?: string;
  }) {
    const html = getPatientWelcomeTemplate(
      params.patientName,
      params.nutritionistName,
      params.nutritionistEmail,
      params.nutritionistPhone,
    );
    await sendEmail({
      to: params.patientEmail,
      subject: `Bem-vindo ao Nutrir! - Seu nutricionista ${params.nutritionistName} te cadastrou`,
      html,
    });
  }

  async function sendMealPlanEmail(params: {
    patientEmail: string;
    patientName: string;
    nutritionistName: string;
    pdfBase64: string;
    fileName?: string;
  }) {
    const html = getMealPlanEmailTemplate(params.patientName, params.nutritionistName);
    await sendEmail({
      to: params.patientEmail,
      subject: `🍎 Seu Plano Alimentar - Nutricionista ${params.nutritionistName}`,
      html,
      attachments: [
        {
          filename: params.fileName || "Plano_Alimentar.pdf",
          content: params.pdfBase64,
          encoding: "base64",
        },
      ],
    });
  }

  return {
    sendTestEmail,
    sendWelcomeEmail,
    sendMealPlanEmail,
  };
}
