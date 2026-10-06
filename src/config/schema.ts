import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import dotenv from "dotenv";

dotenv.config();

// Tabel events: participants pakai text[] (array string PostgreSQL)
export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  participants: text("participants").array().notNull(),
});

// Koneksi database (Neon HTTP, tanpa hardcode password)
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema: { events } });
