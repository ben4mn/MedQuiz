import { desc, eq } from "drizzle-orm";
import { db, studySets } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const rows = db
    .select({
      id: studySets.id,
      documentId: studySets.documentId,
      createdAt: studySets.createdAt,
    })
    .from(studySets)
    .where(eq(studySets.userId, user.id))
    .orderBy(desc(studySets.createdAt))
    .all();

  return Response.json({ studySets: rows });
}
