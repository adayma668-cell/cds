import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis;

const handler = {
  get(_, prop) {
    if (!globalForPrisma.prisma) {
      const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        family: 4,
      });
      const adapter = new PrismaPg(pool);
      globalForPrisma.prisma = new PrismaClient({ adapter });
    }
    return globalForPrisma.prisma[prop];
  },
};

const prisma = new Proxy({}, handler);

export default prisma;
