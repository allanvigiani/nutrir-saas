import type { BaseRouteDeps } from "../types.ts";
import { prisma } from "../lib/prisma.ts";
import { hashField } from "../lib/crypto.ts";
import { withNutritionistRLS } from "../lib/rls-context.ts";

export function registerAuthRoutes(deps: BaseRouteDeps) {
  deps.app.post("/api/auth/register-profile", deps.authenticate, async (req: any, res: any) => {
    const uid: string = req.user.uid;

    const { name, crn, cpf, cnpj, email, phone } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }

    try {
      await withNutritionistRLS(uid, async () => {
        // Checar unicidade de CPF (excluindo o próprio nutricionista)
        if (cpf) {
          const cpfHash = hashField(cpf);
          const duplicate = await prisma.nutritionist.findFirst({
            where: { cpfHash, NOT: { id: uid } },
          });
          if (duplicate) {
            res.status(409).json({ error: "CPF já cadastrado para outro nutricionista." });
            return;
          }
        }

        // Checar unicidade de CNPJ
        if (cnpj) {
          const cnpjHash = hashField(cnpj);
          const duplicate = await prisma.nutritionist.findFirst({
            where: { cnpjHash, NOT: { id: uid } },
          });
          if (duplicate) {
            res.status(409).json({ error: "CNPJ já cadastrado para outro nutricionista." });
            return;
          }
        }

        await prisma.nutritionist.upsert({
          where: { id: uid },
          update: {
            name,
            crn: crn || null,
            cpf: cpf || null,
            cpfHash: cpf ? hashField(cpf) : null,
            cnpj: cnpj || null,
            cnpjHash: cnpj ? hashField(cnpj) : null,
            email,
            phone: phone || null,
            updatedAt: new Date(),
          },
          create: {
            id: uid,
            name,
            crn: crn || null,
            cpf: cpf || null,
            cpfHash: cpf ? hashField(cpf) : null,
            cnpj: cnpj || null,
            cnpjHash: cnpj ? hashField(cnpj) : null,
            email,
            phone: phone || null,
            role: "nutritionist",
            plan: "free",
          },
        });

        res.json({ success: true });
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Erro ao criar perfil." });
    }
  });
}
