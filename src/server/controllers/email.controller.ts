import { logger } from "../logger.ts";
import { getDb, withNutritionistRLS } from "../lib/rls-context.ts";
import type { createPatientsService } from "../services/patients.service.ts";
import type { createMealPlansService } from "../services/meal-plans.service.ts";

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
  patientsService: ReturnType<typeof createPatientsService>;
  mealPlansService: ReturnType<typeof createMealPlansService>;
};

export function createEmailController({ emailService, patientsService, mealPlansService }: EmailControllerDeps) {
  // Envia sempre para o e-mail do próprio usuário autenticado (verificado pelo Firebase) —
  // nunca para um endereço arbitrário do body, senão vira relay de spam usando o SMTP do app.
  async function testEmail(req: any, res: any) {
    if (!req.user?.email) return res.status(400).json({ error: "Usuário sem e-mail cadastrado." });
    try {
      await emailService.sendTestEmail(req.user.email);
      return res.json({ success: true, message: "E-mail de teste enviado com sucesso!" });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // patientEmail/patientName/dados do nutricionista vêm sempre do banco, nunca do body —
  // o body só informa QUAL paciente (patientId), a posse é verificada via withNutritionistRLS.
  async function sendWelcomeEmail(req: any, res: any) {
    const { patientId } = req.body;
    if (!patientId) return res.status(400).json({ error: "patientId é obrigatório." });
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const patient = await patientsService.getOne(req.user.uid, patientId);
        if (!patient.email) {
          res.status(400).json({ error: "Paciente não possui e-mail cadastrado." });
          return;
        }
        const nutritionist = await getDb().nutritionist.findUnique({ where: { id: req.user.uid } });
        if (!nutritionist) {
          res.status(404).json({ error: "Nutricionista não encontrado." });
          return;
        }
        await emailService.sendWelcomeEmail({
          patientEmail: patient.email,
          patientName: patient.name,
          nutritionistName: nutritionist.name,
          nutritionistEmail: nutritionist.email,
          nutritionistPhone: nutritionist.phone ?? undefined,
        });
        res.json({ success: true, message: "E-mail de boas-vindas enviado!" });
      });
    } catch (error: any) {
      logger.error("[Email] Erro no endpoint de boas-vindas", error);
      return res.status(error.message === "Paciente não encontrado" ? 404 : 500).json({ error: error.message });
    }
  }

  async function sendMealPlan(req: any, res: any) {
    const { mealPlanId, pdfBase64, fileName } = req.body;
    if (!mealPlanId || !pdfBase64) {
      return res.status(400).json({ error: "Dados incompletos para envio do plano." });
    }
    try {
      await withNutritionistRLS(req.user.uid, async () => {
        const plan = await mealPlansService.getOne(req.user.uid, mealPlanId);
        const patient = await patientsService.getOne(req.user.uid, plan.patient_id);
        if (!patient.email) {
          res.status(400).json({ error: "Paciente não possui e-mail cadastrado." });
          return;
        }
        const nutritionist = await getDb().nutritionist.findUnique({ where: { id: req.user.uid } });
        if (!nutritionist) {
          res.status(404).json({ error: "Nutricionista não encontrado." });
          return;
        }
        await emailService.sendMealPlanEmail({
          patientEmail: patient.email,
          patientName: patient.name,
          nutritionistName: nutritionist.name,
          pdfBase64,
          fileName,
        });
        res.json({ success: true, message: "Plano alimentar enviado com sucesso!" });
      });
    } catch (error: any) {
      logger.error("[Email] Erro ao enviar plano alimentar", error);
      const notFound = error.message === "Paciente não encontrado" || error.message === "Plano não encontrado";
      return res.status(notFound ? 404 : 500).json({ error: error.message });
    }
  }

  return {
    testEmail,
    sendWelcomeEmail,
    sendMealPlan,
  };
}
