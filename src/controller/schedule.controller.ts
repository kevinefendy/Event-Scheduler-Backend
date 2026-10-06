import type { Request, Response } from "express";
import { ZodError } from "zod";
import { eq } from "drizzle-orm";
import { db, events } from "../config/schema";
import { schedulerSchema, idSchema } from "../validation/scheduler.validation";

// Kirim 400 kalau error-nya dari Zod
function zod400(res: Response, err: unknown): boolean {
  if (err instanceof ZodError) {
    res.status(400).json({
      
      success: false,
      message: "Validation error",
      errors: err.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
    return true;
  }
  return false;
}

// KONFLIK = waktu overlap DAN ada participant yang sama.
// Overlap: newStart < existingEnd && newEnd > existingStart
async function findConflicts(
  start: Date,
  end: Date,
  participants: string[],
  excludeId?: string
) {
  const all = await db.select().from(events);
  return all
    .filter((e) => {
      if (excludeId && e.id === excludeId) return false; // update: abaikan dirinya sendiri
      if (!(start < e.endTime && end > e.startTime)) return false;
      return e.participants.some((p) => participants.includes(p));
    })
    .map((e) => ({
      event_id: e.id,
      event_title: e.title,
      start_time: e.startTime,
      end_time: e.endTime,
      conflicting_participants: e.participants.filter((p) =>
        participants.includes(p)
      ),
    }));
}

// Cari slot kosong terdekat: durasi tetap, geser +15 menit sampai bersih
async function findSuggestion(
  start: Date,
  end: Date,
  participants: string[],
  excludeId?: string
) {
  const duration = end.getTime() - start.getTime();
  let candidate = new Date(start.getTime());
  for (let i = 0; i < 200; i++) {
    const candidateEnd = new Date(candidate.getTime() + duration);
    const busy = await findConflicts(candidate, candidateEnd, participants, excludeId);
    if (busy.length === 0) return { start_time: candidate, end_time: candidateEnd };
    candidate = new Date(candidate.getTime() + 15 * 60 * 1000);
  }
  return null;
}

// Kalau konflik -> langsung kirim 409 + suggestion. Return true jika sudah direspons.
async function send409IfConflict(
  res: Response,
  start: Date,
  end: Date,
  participants: string[],
  excludeId?: string
): Promise<boolean> {
  const conflicts = await findConflicts(start, end, participants, excludeId);
  if (conflicts.length === 0) return false;
  const suggestion = await findSuggestion(start, end, participants, excludeId);
  res.status(409).json({
    success: false,
    message: "Event conflicts with existing schedule",
    conflicts,
    ...(suggestion ? { suggestion } : {}),
  });
  return true;
}

export const scheduleController = {
  // GET /api/events
  async getAll(_req: Request, res: Response) {
    try {
      const data = await db.select().from(events);
      res.json({ success: true, data });
    } catch {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  },

  // GET /api/events/:id
  async getById(req: Request, res: Response) {
    try {
      const { id } = idSchema.parse(req.params);
      const rows = await db.select().from(events).where(eq(events.id, id));
      if (!rows[0]) return res.status(404).json({ success: false, message: "Event not found" });
      res.json({ success: true, data: rows[0] });
    } catch (err) {
      if (!zod400(res, err))
        res.status(500).json({ success: false, message: "Internal server error" });
    }
  },

  // POST /api/events
  async create(req: Request, res: Response) {
    try {
      const body = schedulerSchema.parse(req.body);
      if (await send409IfConflict(res, body.start_time, body.end_time, body.participants)) return;
      const rows = await db
        .insert(events)
        .values({
          title: body.title,
          startTime: body.start_time,
          endTime: body.end_time,
          participants: body.participants,
        })
        .returning();
      res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
      if (!zod400(res, err))
        res.status(500).json({ success: false, message: "Internal server error" });
    }
  },

  // PUT /api/events/:id
  async update(req: Request, res: Response) {
    try {
      const { id } = idSchema.parse(req.params);
      const body = schedulerSchema.parse(req.body);
      const old = await db.select().from(events).where(eq(events.id, id));
      if (!old[0]) return res.status(404).json({ success: false, message: "Event not found" });
      if (await send409IfConflict(res, body.start_time, body.end_time, body.participants, id)) return;
      const rows = await db
        .update(events)
        .set({
          title: body.title,
          startTime: body.start_time,
          endTime: body.end_time,
          participants: body.participants,
        })
        .where(eq(events.id, id))
        .returning();
      res.json({ success: true, data: rows[0] });
    } catch (err) {
      if (!zod400(res, err))
        res.status(500).json({ success: false, message: "Internal server error" });
    }
  },

  // DELETE /api/events/:id
  async remove(req: Request, res: Response) {
    try {
      const { id } = idSchema.parse(req.params);
      const old = await db.select().from(events).where(eq(events.id, id));
      if (!old[0]) return res.status(404).json({ success: false, message: "Event not found" });
      await db.delete(events).where(eq(events.id, id));
      res.json({ success: true, message: "Event deleted successfully" });
    } catch (err) {
      if (!zod400(res, err))
        res.status(500).json({ success: false, message: "Internal server error" });
    }
  },
};
