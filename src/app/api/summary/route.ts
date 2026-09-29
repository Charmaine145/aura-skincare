import { z } from "zod";
import { readSession } from "@/lib/session";
import { summarize } from "@/lib/summary";
import { readBody } from "@/lib/validation";
export async function POST(request: Request) {
  try { const input = z.object({ session: z.string().max(60000).optional() }).strict().parse(await readBody(request)); return Response.json(summarize(readSession(input.session))); }
  catch { return Response.json({ error: "Unable to verify this call summary." }, { status: 400 }); }
}
