import { logger } from "../logger.ts";

type EmailControllerDeps = {
  emailService: {
    sendTestEmail: (to: string) => Promise<void>;
    sendWelcomeEmail: (params: {
      patientEmail: string;
      patientName: string;
      nutritionistName: string;
      nutritionistEmail: string;
      nutritionistPhone?: string;
    }) => Promise<void>;
    sendMealPlanEmail: (params: {
      patientEmail: string;
      patientName: string;
      nutritionistName: string;
      pdfBase64: string;
      fileName?: string;
    }) => Promise<void>;
  };
};

export function createEmailController({ emailService }: EmailControllerDeps) {
  async function testEmail(req: any, res: any) {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: "Destinatário é obrigatório." });
    try {
      await emailService.sendTestEmail(to);
      return res.json({ success: true, message: "E-mail de teste enviado com sucesso!" });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async function sendWelcomeEmail(req: any, res: any) {
    const { patientEmail, patientName, nutritionistName, nutritionistEmail, nutritionistPhone } = req.body;
    if (!patientEmail || !patientName) return res.status(400).json({ error: "Dados do paciente incompletos." });
    try {
      await emailService.sendWelcomeEmail({
        patientEmail,
        patientName,
        nutritionistName,
        nutritionistEmail,
        nutritionistPhone,
      });
      return res.json({ success: true, message: "E-mail de boas-vindas enviado!" });
    } catch (error: any) {
      logger.error("[Email] Erro no endpoint de boas-vindas", error);
      return res.status(500).json({ error: error.message });
    }
  }

  async function sendMealPlan(req: any, res: any) {
    const { patientEmail, patientName, nutritionistName, pdfBase64, fileName } = req.body;
    if (!patientEmail || !pdfBase64) {
      return res.status(400).json({ error: "Dados incompletos para envio do plano." });
    }
    try {
      await emailService.sendMealPlanEmail({
        patientEmail,
        patientName,
        nutritionistName,
        pdfBase64,
        fileName,
      });
      return res.json({ success: true, message: "Plano alimentar enviado com sucesso!" });
    } catch (error: any) {
      logger.error("[Email] Erro ao enviar plano alimentar", error);
      return res.status(500).json({ error: error.message });
    }
  }

  return {
    testEmail,
    sendWelcomeEmail,
    sendMealPlan,
  };
}
