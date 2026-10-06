import { z } from "zod";

// Validasi body POST / PUT
export const schedulerSchema = z
  .object({
    title: z.string().min(1, "title wajib diisi"),
    start_time: z.coerce.date({ message: "start_time harus tanggal yang valid" }),
    end_time: z.coerce.date({ message: "end_time harus tanggal yang valid" }),
    participants: z
      .array(z.string().min(1, "participant tidak boleh kosong"))
      .min(1, "minimal 1 participant"),
  })
  .refine((d) => d.end_time > d.start_time, {
    message: "end_time harus lebih besar dari start_time",
    path: ["end_time"],
  });

// Validasi param :id harus UUID
export const idSchema = z.object({
  id: z.string().uuid("id harus berupa UUID yang valid"),
});
