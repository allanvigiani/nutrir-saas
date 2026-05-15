import type { BaseRouteDeps } from "../types.ts";

export function registerAuthRoutes(deps: BaseRouteDeps) {
  deps.app.post("/api/auth/register-profile", deps.authenticate, async (req: any, res: any) => {
    const uid: string = req.user.uid;

    const { name, crn, cpf, cnpj, email, phone } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }

    try {
      await deps.adminDb.collection("nutritionists").doc(uid).set({
        name,
        crn: crn || null,
        cpf: cpf || null,
        cnpj: cnpj || null,
        email,
        phone: phone || null,
        role: "nutritionist",
        plan: "free",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      });

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Erro ao criar perfil." });
    }
  });
}
