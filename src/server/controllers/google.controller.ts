import { logger } from "../logger.ts";

type GoogleControllerDeps = {
  isSuperAdmin: (user: { email?: string | null }) => boolean;
  googleService: {
    getAuthUrl: (origin: string) => { url: string; redirectUri: string };
    handleCallback: (params: { code: string; redirectUri: string }) => Promise<{ found: boolean; email: string }>;
    createCalendarEvent: (params: { appointmentId: string; nutritionistId: string }) => Promise<{ meetLink: string; eventId: string }>;
  };
};

function detectOrigin(req: any) {
  const clientOrigin = req.query.origin as string;
  const forwardedProto = req.headers["x-forwarded-proto"] as string;
  const forwardedHost = req.headers["x-forwarded-host"] as string;
  const detectedOrigin = forwardedProto && forwardedHost ? `${forwardedProto}://${forwardedHost}` : `${req.protocol}://${req.get("host")}`;
  return clientOrigin || detectedOrigin;
}

export function createGoogleController({ isSuperAdmin, googleService }: GoogleControllerDeps) {
  const googleCalendarEnableApiUrl = process.env.GOOGLE_CALENDAR_ENABLE_API_URL || "";

  async function getAuthUrl(req: any, res: any) {
    const origin = detectOrigin(req);
    const { url } = googleService.getAuthUrl(origin);
    return res.json({ url });
  }

  async function callback(req: any, res: any) {
    const { code, state } = req.query;
    const detectedOrigin = detectOrigin(req);
    const redirectUri = (state as string) || `${detectedOrigin}/api/auth/google/callback`;

    try {
      const result = await googleService.handleCallback({ code: code as string, redirectUri });
      if (!result.found) {
        return res.send(`
          <html><head><meta charset="UTF-8"></head><body>
            <script>alert("Nutricionista não encontrado com este e-mail (${result.email}) no sistema.");window.close();</script>
          </body></html>
        `);
      }

      return res.send(`
        <html><body>
          <script>
            if (window.opener) { window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*'); window.close(); }
            else { window.location.href = '/settings'; }
          </script>
          <p>Conexão com Google Agenda realizada com sucesso! Esta janela fechará automaticamente.</p>
        </body></html>
      `);
    } catch (error: any) {
      logger.error("[Google Auth] Error in callback", error);
      return res.status(500).send("Erro ao processar autenticação com Google.");
    }
  }

  async function createCalendarEvent(req: any, res: any) {
    const { appointmentId, nutritionistId } = req.body;
    if (req.user.uid !== nutritionistId && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Não autorizado a criar eventos para este nutricionista." });
    }

    try {
      const result = await googleService.createCalendarEvent({ appointmentId, nutritionistId });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      if (error.message === "Google Calendar not connected") return res.status(400).json({ error: error.message });
      if (error.message === "Appointment not found") return res.status(404).json({ error: error.message });
      if (error.message?.includes("Google Calendar API has not been used") || error.message?.includes("is disabled")) {
        return res.status(403).json({
          error: "A API do Google Agenda não está ativada no seu projeto do Google Cloud.",
          details: googleCalendarEnableApiUrl
            ? `Para corrigir, acesse o link abaixo e clique em 'ATIVAR': ${googleCalendarEnableApiUrl}`
            : "A URL de ativação da API não está configurada no ambiente.",
          link: googleCalendarEnableApiUrl || undefined,
        });
      }
      logger.error("[Google Calendar] Error creating event", error);
      return res.status(500).json({ error: error.message });
    }
  }

  return {
    getAuthUrl,
    callback,
    createCalendarEvent,
  };
}
