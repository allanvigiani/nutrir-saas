export type AsaasClient = {
  request: (endpoint: string, options?: any) => Promise<any>;
};

type CreateAsaasClientInput = {
  asaasApiUrl: string;
  asaasApiKey: string;
};

export function createAsaasClient({ asaasApiUrl, asaasApiKey }: CreateAsaasClientInput): AsaasClient {
  async function request(endpoint: string, options: any = {}) {
    try {
      const baseUrl = (asaasApiUrl || "").replace(/\/$/, "");
      if (!baseUrl) {
        throw new Error("ASAAS_API_URL não configurada.");
      }
      const apiPath = endpoint.replace(/^\//, "");
      const url = `${baseUrl}/${apiPath}`;

      console.log(`[Asaas Request] ${options.method || "GET"} ${url}`);

      const response = await fetch(url, {
        ...options,
        headers: {
          access_token: asaasApiKey || "",
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      const text = await response.text();
      console.log(`[Asaas Response] Status: ${response.status}`);

      let data: any;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text };
      }

      if (!response.ok) {
        console.error(`[Asaas Error] Status: ${response.status}`, JSON.stringify(data, null, 2));

        let errorMsg = "Erro na API do Asaas";
        if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
          errorMsg = data.errors.map((e: any) => e.description).join(" | ");
        } else if (data.message) {
          errorMsg = data.message;
        } else {
          errorMsg = `Erro na API do Asaas (${response.status})`;
        }

        throw new Error(errorMsg);
      }

      return data;
    } catch (error: any) {
      console.error(`Erro em asaasFetch (${endpoint}):`, error.message);
      throw error;
    }
  }

  return { request };
}
