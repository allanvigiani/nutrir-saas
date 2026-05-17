import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { withEncryption } from './prisma-encrypt.ts';

const globalForPrisma = globalThis as unknown as { prisma?: any };

function getClient(): any {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    const base = new PrismaClient({ adapter });
    globalForPrisma.prisma = withEncryption(base);
  }
  return globalForPrisma.prisma;
}

// Proxy garante que o cliente só é instanciado na primeira chamada real,
// após o dotenv já ter carregado o DATABASE_URL no server.ts
export const prisma = new Proxy<any>({} as any, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
