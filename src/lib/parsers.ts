import mammoth from "mammoth";

export async function extractDocx(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return normalize(value);
}

export async function extractPdf(buffer: Buffer): Promise<string> {
  const mod = await import("pdf-parse");
  const pdfParse = (mod as unknown as { default: (b: Buffer) => Promise<{ text: string }> }).default;
  const result = await pdfParse(buffer);
  return normalize(result.text);
}

export async function extractFile(
  name: string,
  buffer: Buffer
): Promise<string> {
  const lower = name.toLowerCase();
  if (lower.endsWith(".docx")) return extractDocx(buffer);
  if (lower.endsWith(".pdf")) return extractPdf(buffer);
  throw new Error(`Unsupported file type: ${name}`);
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function normalize(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
