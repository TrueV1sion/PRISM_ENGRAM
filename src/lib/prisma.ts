import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
    prisma: InstanceType<typeof PrismaClient> | undefined;
};

function createPrismaClient() {
    const defaultDbPath = path.join(process.cwd(), "prisma", "dev.db");
    const connectionUrl = process.env.DATABASE_URL || `file:${defaultDbPath}`;

    // PrismaBetterSqlite3 expects a URL object or string but in SQLite we can just pass the prisma client
    // Note: the original code passed { url: file... }.
    const adapter = new PrismaBetterSqlite3({ url: connectionUrl });
    return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
