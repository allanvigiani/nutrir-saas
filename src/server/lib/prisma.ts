import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}

// Proxy garante que o cliente só é instanciado na primeira chamada real,
// após o dotenv já ter carregado o DATABASE_URL no server.ts
export const prisma = new Proxy<PrismaClient>({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
