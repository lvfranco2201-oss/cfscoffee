import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import '@/lib/env'; // Validates all required env vars at startup — throws if missing

const connectionString = process.env.DATABASE_URL!;

// Singleton pattern protection for Next.js Hot Reload (HMR)
const globalForDb = globalThis as unknown as {
  postgresClient: postgres.Sql | undefined;
};

const client = globalForDb.postgresClient ?? postgres(connectionString, {
  prepare: false, 
  ssl: { rejectUnauthorized: false },
  max: 10, // Optional: Connection pool limit to protect Aurora
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.postgresClient = client;
}

export const db = drizzle(client, { schema });
