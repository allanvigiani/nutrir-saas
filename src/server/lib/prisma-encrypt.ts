import { encrypt, decrypt } from './crypto.ts';
import { PrismaClient } from '@prisma/client';

type FieldConfig = {
  fields: string[];
  jsonFields?: string[];
};

const ENCRYPTED_MODELS: Record<string, FieldConfig> = {
  Patient:      { fields: ['cpf', 'diseases', 'medications', 'allergies'] },
  Nutritionist: { fields: ['cpf', 'cnpj'] },
  Consultation: { fields: ['anamnesis', 'complaints'] },
  LabExam:      { fields: ['observations'], jsonFields: ['markers'] },
};

// Mapeia chaves de relação Prisma → nome do modelo para decrypt recursivo
const RELATION_TO_MODEL: Record<string, string> = {
  consultations: 'Consultation',
  labExams:      'LabExam',
  patients:      'Patient',
};

function encryptData(model: string, data: Record<string, any>): void {
  const config = ENCRYPTED_MODELS[model];
  if (!config || !data || typeof data !== 'object') return;

  for (const field of config.fields) {
    if (data[field] != null) {
      data[field] = encrypt(String(data[field]));
    }
  }
  for (const field of config.jsonFields ?? []) {
    if (data[field] != null) {
      data[field] = encrypt(JSON.stringify(data[field]));
    }
  }
}

function decryptRecord(model: string, record: any): void {
  if (!record || typeof record !== 'object') return;

  const config = ENCRYPTED_MODELS[model];
  if (config) {
    for (const field of config.fields) {
      if (record[field]) {
        try { record[field] = decrypt(record[field]); } catch { /* plaintext ainda não migrado */ }
      }
    }
    for (const field of config.jsonFields ?? []) {
      if (record[field]) {
        try { record[field] = JSON.parse(decrypt(record[field])); } catch { /* plaintext ainda não migrado */ }
      }
    }
  }

  // Decrypt relações incluídas (ex: patient com consultations)
  for (const [key, value] of Object.entries(record)) {
    const nestedModel = RELATION_TO_MODEL[key];
    if (!nestedModel) continue;
    if (Array.isArray(value)) {
      for (const item of value) decryptRecord(nestedModel, item);
    } else if (value && typeof value === 'object') {
      decryptRecord(nestedModel, value);
    }
  }
}

function decryptResult(model: string, result: any): void {
  if (Array.isArray(result)) {
    for (const item of result) decryptRecord(model, item);
  } else {
    decryptRecord(model, result);
  }
}

const WRITE_ACTIONS = new Set(['create', 'update', 'upsert', 'createMany', 'updateMany']);
const READ_ACTIONS  = new Set(['findUnique', 'findFirst', 'findMany', 'findUniqueOrThrow', 'findFirstOrThrow']);

export function withEncryption(prisma: PrismaClient): any {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          if (model && WRITE_ACTIONS.has(operation) && args.data) {
            encryptData(model, args.data);
          }

          const result = await query(args);

          if (model && READ_ACTIONS.has(operation) && result) {
            decryptResult(model, result);
          }

          return result;
        },
      },
    },
  });
}
