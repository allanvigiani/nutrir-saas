import { getDb } from "../lib/rls-context.ts";

type GoogleCalendarServiceInput = {
  google: any;
  googleClientId: string;
  googleClientSecret: string;
};

export function createGoogleCalendarService({
  google,
  googleClientId,
  googleClientSecret,
}: GoogleCalendarServiceInput) {
  function getAuthUrl(origin: string) {
    const scopes = (process.env.GOOGLE_OAUTH_SCOPES || "")
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);
    if (!scopes.length) {
      throw new Error("GOOGLE_OAUTH_SCOPES não configurada.");
    }

    const redirectUri = `${origin}/api/auth/google/callback`;
    const client = new google.auth.OAuth2(googleClientId, googleClientSecret, redirectUri);

    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      state: redirectUri,
    });

    return { url, redirectUri };
  }

  async function handleCallback(params: { code: string; redirectUri: string }) {
    const client = new google.auth.OAuth2(googleClientId, googleClientSecret, params.redirectUri);
    const { tokens } = await client.getToken(params.code);

    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;
    if (!email) throw new Error("Could not get user email from Google");

    const nutritionist = await getDb().nutritionist.findFirst({ where: { email } });
    if (!nutritionist) return { found: false, email };

    await getDb().nutritionist.update({
      where: { id: nutritionist.id },
      data: {
        googleCalendarTokens: tokens,
        googleCalendarConnected: true,
        updatedAt: new Date(),
      },
    });

    return { found: true, email };
  }

  async function createCalendarEvent(params: { appointmentId: string; nutritionistId: string }) {
    const nutritionist = await getDb().nutritionist.findUnique({
      where: { id: params.nutritionistId },
    });
    if (!nutritionist?.googleCalendarTokens) throw new Error("Google Calendar not connected");

    const appointment = await getDb().appointment.findUnique({
      where: { id: params.appointmentId },
      include: { patient: true },
    });
    if (!appointment) throw new Error("Appointment not found");

    const patient = appointment.patient;

    const oauthClient = new google.auth.OAuth2(googleClientId, googleClientSecret);
    oauthClient.setCredentials(nutritionist.googleCalendarTokens);

    oauthClient.on("tokens", async (tokens: any) => {
      if (tokens.refresh_token) {
        await getDb().nutritionist.update({
          where: { id: params.nutritionistId },
          data: {
            googleCalendarTokens: { ...(nutritionist.googleCalendarTokens as object), ...tokens },
          },
        });
      }
    });

    const calendar = google.calendar({ version: "v3", auth: oauthClient });
    const startTime = new Date(appointment.date);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `Consulta Nutricional - ${patient?.name || "Paciente"}`,
        description: `Consulta agendada via Nutrir App.\nPaciente: ${patient?.name}\nE-mail: ${patient?.email || "Não informado"}`,
        start: { dateTime: startTime.toISOString(), timeZone: "America/Sao_Paulo" },
        end: { dateTime: endTime.toISOString(), timeZone: "America/Sao_Paulo" },
        attendees: patient?.email ? [{ email: patient.email }] : [],
        conferenceData: {
          createRequest: {
            requestId: `nutrir-${params.appointmentId}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
      conferenceDataVersion: 1,
    });

    await getDb().appointment.update({
      where: { id: params.appointmentId },
      data: {
        googleEventId: response.data.id,
        meetLink: response.data.hangoutLink,
        updatedAt: new Date(),
      },
    });

    return {
      meetLink: response.data.hangoutLink,
      eventId: response.data.id,
    };
  }

  return {
    getAuthUrl,
    handleCallback,
    createCalendarEvent,
  };
}
