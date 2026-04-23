import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis;

const handler = {
  get(_, prop) {
    if (!globalForPrisma.prisma) {
      const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
      globalForPrisma.prisma = new PrismaClient({ adapter });
    }
    return globalForPrisma.prisma[prop];
  },
};

const prisma = new Proxy({}, handler);

export default prisma;
