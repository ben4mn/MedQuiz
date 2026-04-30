import { NextRequest } from "next/server";
import { createId } from "@paralleldrive/cuid2";
import { eq, desc } from "drizzle-orm";
import { db, documents } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { extractFile, wordCount } from "@/lib/parsers";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 500_000;
const MIN_TEXT_CHARS = 200;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const rows = db
    .select({
      id: documents.id,
      title: documents.title,
      wordCount: documents.wordCount,
      sourceType: documents.sourceType,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(eq(documents.userId, user.id))
    .orderBy(desc(documents.createdAt))
    .all();

  return Response.json({ documents: rows });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";
  const now = Date.now();

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return Response.json({ error: "Invalid multipart body" }, { status: 400 });
    }

    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return Response.json({ error: "No files uploaded" }, { status: 400 });
    }

    const created = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return Response.json(
          { error: `"${file.name}" exceeds the 10MB limit` },
          { status: 400 }
        );
      }
      const lower = file.name.toLowerCase();
      const sourceType = lower.endsWith(".pdf")
        ? "pdf"
        : lower.endsWith(".docx")
          ? "docx"
          : null;
      if (!sourceType) {
        return Response.json(
          { error: `"${file.name}" must be .docx or .pdf` },
          { status: 400 }
        );
      }
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const text = await extractFile(file.name, buffer);
        if (text.length < 50) {
          return Response.json(
            { error: `"${file.name}" appears empty or unreadable` },
            { status: 400 }
          );
        }
        const id = createId();
        const title = file.name.replace(/\.(docx|pdf)$/i, "");
        db.insert(documents)
          .values({
            id,
            userId: user.id,
            title,
            sourceText: text,
            wordCount: wordCount(text),
            sourceType,
            createdAt: now,
          })
          .run();
        created.push({ id, title, wordCount: wordCount(text) });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return Response.json(
          { error: `Failed to parse "${file.name}": ${msg}` },
          { status: 500 }
        );
      }
    }

    return Response.json({ documents: created });
  }

  // JSON path (paste mode)
  let body: { text?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const text = (body.text ?? "").trim();
  const title = (body.title ?? "").trim().slice(0, 120) || "Pasted notes";

  if (text.length < MIN_TEXT_CHARS) {
    return Response.json(
      { error: `Please paste at least ${MIN_TEXT_CHARS} characters.` },
      { status: 400 }
    );
  }
  if (text.length > MAX_TEXT_CHARS) {
    return Response.json(
      { error: `That's over ${MAX_TEXT_CHARS.toLocaleString()} characters. Try a smaller chunk.` },
      { status: 400 }
    );
  }

  const id = createId();
  db.insert(documents)
    .values({
      id,
      userId: user.id,
      title,
      sourceText: text,
      wordCount: wordCount(text),
      sourceType: "paste",
      createdAt: now,
    })
    .run();

  return Response.json({
    documents: [{ id, title, wordCount: wordCount(text) }],
  });
}
