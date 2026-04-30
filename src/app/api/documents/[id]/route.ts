import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, documents } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const rows = db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, user.id)))
    .limit(1)
    .all();
  const doc = rows[0];
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ document: doc });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const result = db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, user.id)))
    .run();
  if (result.changes === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
