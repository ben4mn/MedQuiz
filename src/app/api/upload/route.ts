import { NextRequest } from "next/server";
import { extractFile, wordCount } from "@/lib/parsers";
import { newSessionId, putSession } from "@/lib/sessionStore";
import type { ExtractedDoc } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILES = 3;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
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
  if (files.length > MAX_FILES) {
    return Response.json(
      { error: `Maximum ${MAX_FILES} files per upload` },
      { status: 400 }
    );
  }

  const extracted: ExtractedDoc[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return Response.json(
        { error: `"${file.name}" exceeds the 10MB limit` },
        { status: 400 }
      );
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".docx") && !lower.endsWith(".pdf")) {
      return Response.json(
        { error: `"${file.name}" must be a .docx or .pdf file` },
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
      extracted.push({ name: file.name, text, wordCount: wordCount(text) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return Response.json(
        { error: `Failed to parse "${file.name}": ${msg}` },
        { status: 500 }
      );
    }
  }

  const sessionId = newSessionId();
  putSession({
    sessionId,
    extracted,
    createdAt: Date.now(),
  });

  return Response.json({
    sessionId,
    extracted: extracted.map((e) => ({ name: e.name, wordCount: e.wordCount })),
  });
}
