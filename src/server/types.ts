import express from "express";

export type BaseRouteDeps = {
  app: express.Express;
  authenticate: (req: any, res: any, next: any) => Promise<void>;
  isSuperAdmin: (user: { email?: string | null }) => boolean;
  admin: any;
};

export type AsaasConfig = {
  asaasApiUrl: string;
  asaasApiKey: string;
  asaasWebhookToken?: string;
};

export type GoogleConfig = {
  google: any;
  googleClientId: string;
  googleClientSecret: string;
};
