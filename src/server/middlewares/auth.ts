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
      return next();
    } catch (error) {
      console.error("[Auth Middleware] Erro ao verificar token:", error);
      return res.status(401).json({ error: "Não autorizado. Token inválido." });
    }
  };
}
