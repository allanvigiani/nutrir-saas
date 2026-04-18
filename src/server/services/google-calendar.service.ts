import type { FirestoreHelpers } from "../types.ts";

type GoogleCalendarServiceInput = FirestoreHelpers & {
  google: any;
  googleClientId: string;
  googleClientSecret: string;
};

export function createGoogleCalendarService({
  google,
  googleClientId,
  googleClientSecret,
  getDocWithFallback,
  updateDocWithFallback,
  queryWithFallback,
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

    const snapshot = await queryWithFallback("nutritionists", "email", "==", email);
    if (snapshot.empty) {
      return { found: false, email };
    }

    const nutritionistDoc = snapshot.docs[0];
    await updateDocWithFallback("nutritionists", nutritionistDoc.id, {
      googleCalendarTokens: tokens,
      googleCalendarConnected: true,
      updatedAt: new Date().toISOString(),
    });

    return { found: true, email };
  }

  async function createCalendarEvent(params: { appointmentId: string; nutritionistId: string }) {
    const nutritionist = await getDocWithFallback("nutritionists", params.nutritionistId);
    const nutritionistData = nutritionist?.data;
    if (!nutritionistData?.googleCalendarTokens) throw new Error("Google Calendar not connected");

    const appointment = await getDocWithFallback("appointments", params.appointmentId);
    const appointmentData = appointment?.data;
    if (!appointmentData) throw new Error("Appointment not found");

    const patient = await getDocWithFallback("patients", appointmentData.patient_id);
    const patientData = patient?.data;

    const oauthClient = new google.auth.OAuth2(googleClientId, googleClientSecret);
    oauthClient.setCredentials(nutritionistData.googleCalendarTokens);

    oauthClient.on("tokens", async (tokens: any) => {
      if (tokens.refresh_token) {
        await updateDocWithFallback("nutritionists", params.nutritionistId, {
          googleCalendarTokens: { ...nutritionistData.googleCalendarTokens, ...tokens },
        });
      }
    });

    const calendar = google.calendar({ version: "v3", auth: oauthClient });
    const startTime = new Date(appointmentData.date);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `Consulta Nutricional - ${patientData?.name || "Paciente"}`,
        description: `Consulta agendada via Nutrir App.\nPaciente: ${patientData?.name}\nE-mail: ${patientData?.email || "Não informado"}`,
        start: { dateTime: startTime.toISOString(), timeZone: "America/Sao_Paulo" },
        end: { dateTime: endTime.toISOString(), timeZone: "America/Sao_Paulo" },
        attendees: patientData?.email ? [{ email: patientData.email }] : [],
        conferenceData: {
          createRequest: {
            requestId: `nutrir-${params.appointmentId}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
      conferenceDataVersion: 1,
    });

    await updateDocWithFallback("appointments", params.appointmentId, {
      googleEventId: response.data.id,
      meetLink: response.data.hangoutLink,
      updatedAt: new Date().toISOString(),
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
