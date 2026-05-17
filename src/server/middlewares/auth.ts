import { logger } from "../logger.ts";
import { withAdminRLS } from "../lib/rls-context.ts";
import { getDb } from "../lib/rls-context.ts";

type AuthMiddlewareDeps = {
  admin: {
    auth: () => {
      verifyIdToken: (token: string) => Promise<any>;
    };
  };
};

export function createAuthenticateMiddleware({ admin }: AuthMiddlewareDeps) {
  return async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Não autorizado. Token ausente." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken;

      const nutritionist = await withAdminRLS(() =>
        getDb().nutritionist.findUnique({
          where: { id: decodedToken.uid },
          select: { role: true, plan: true },
        })
      );

      req.user.dbRole = nutritionist?.role ?? "nutritionist";
      req.user.dbPlan = nutritionist?.plan ?? "free";
      req.user.isAdmin = req.user.dbRole === "admin";
      req.user.isPremium = req.user.isAdmin || req.user.dbPlan === "premium";

      return next();
    } catch (error) {
      logger.error("[Auth Middleware] Erro ao verificar token", error);
      return res.status(401).json({ error: "Não autorizado. Token inválido." });
    }
  };
}

export function requirePremiumOrAdmin(req: any, res: any, next: any) {
  if (!req.user?.isPremium) {
    return res.status(403).json({ error: "Disponível apenas no plano Premium." });
  }
  return next();
}
