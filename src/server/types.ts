import express from "express";

export type FirestoreHelpers = {
  getDocWithFallback: (collectionName: string, docId: string) => Promise<any>;
  updateDocWithFallback: (collectionName: string, docId: string, data: any) => Promise<void>;
  queryWithFallback: (collectionName: string, field: string, operator: any, value: any) => Promise<any>;
};

export type BaseRouteDeps = FirestoreHelpers & {
  app: express.Express;
  authenticate: (req: any, res: any, next: any) => Promise<void>;
  isSuperAdmin: (user: { email?: string | null }) => boolean;
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
