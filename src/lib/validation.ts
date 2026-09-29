import { z } from "zod";
export const historySchema = z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }).strict()).min(1).max(120);
export async function readBody(request: Request): Promise<unknown> {
  const body = await request.text();
  if (body.length > 150000) throw new Error("Request too large");
  return JSON.parse(body);
}
