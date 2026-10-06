import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
    schema: './src/config/schema.ts',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    }
})