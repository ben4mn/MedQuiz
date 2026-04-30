import type { ExtractedDoc } from "./types";

function joinSources(docs: ExtractedDoc[]): string {
  return docs
    .map(
      (d, i) =>
        `=== SOURCE ${i + 1}: ${d.name} (${d.wordCount} words) ===\n${d.text}`
    )
    .join("\n\n");
}

export function generationSystem(): string {
  return [
    "You are an expert medical educator building study materials for a medical student.",
    "You will receive source material (chapters from her textbook or lecture notes).",
    "From it, you generate three artifacts:",
    "  1. A mind map as an indented markdown outline.",
    "  2. A quiz — a mix of MCQ, short-answer, and free-recall questions.",
    "  3. A system prompt for a voice tutor that will quiz her on this material.",
    "",
    "Return ONLY valid JSON matching the schema. No prose, no backticks, no commentary.",
    "Be clinically precise. Do not invent facts that are not in the sources.",
  ].join("\n");
}

export function generationUser(docs: ExtractedDoc[]): string {
  const schema = `{
  "mindMapMarkdown": string,  // Indented markdown outline, e.g. "# Topic\\n## Subtopic\\n- Point"
  "quizQuestions": Array<
    | { "type": "mcq", "stem": string, "choices": [{"label": "A", "text": string}, ...], "correctLabel": "A"|"B"|"C"|"D", "rationale": string, "topic": string }
    | { "type": "short", "stem": string, "correctAnswer": string, "rationale": string, "topic": string }
    | { "type": "recall", "stem": string, "expectedPoints": string[], "rationale": string, "topic": string }
  >,
  "voiceAgentPrompt": string  // System prompt for a voice tutor agent
}`;

  const voicePromptGuidance = [
    "The voiceAgentPrompt field must be a complete system prompt for a conversational voice tutor agent. It must:",
    "  - Instruct the tutor to ask ONE question at a time and wait for the student's spoken answer.",
    "  - Instruct the tutor to listen for understanding, not just keyword matching. Give partial credit. Ask a clarifying follow-up when an answer is incomplete rather than immediately correcting.",
    "  - Instruct the tutor to NEVER just repeat or paraphrase the student's answer back verbatim — it should judge, teach, or move on.",
    "  - Instruct the tutor to speak in short, natural sentences suitable for TTS. Avoid markdown, bullet points, or any special characters that don't read well aloud. Numbers should be spelled out when short.",
    "  - Instruct the tutor to keep a warm but focused tone — like a senior resident pimping a rotating student in a friendly way.",
    "  - Instruct the tutor to start with a brief greeting and the first question.",
    "  - Embed 15-25 specific question ideas drawn from the source material so the agent has a reservoir.",
    "  - Include a concise summary of the key facts from the source so the agent can judge answers correctly.",
  ].join("\n");

  return [
    "Source material follows. Generate the three artifacts.",
    "",
    "Quiz requirements:",
    "  - 15-25 questions total, mixed types (favor MCQ ~50%, short ~30%, recall ~20%).",
    "  - Cover the breadth of the source. Include both factual recall and clinical reasoning.",
    "  - For MCQs, 4 plausible choices; the distractors should be common confusions, not obviously wrong.",
    "  - rationale should be 1-3 sentences explaining WHY the correct answer is right, citing the source.",
    "  - topic is a short label (e.g., 'RAAS', 'Diuretics', 'Hyperkalemia treatment').",
    "",
    "Mind map requirements:",
    "  - A single markdown outline rooted at the overall subject.",
    "  - 3-4 levels deep. Use # for root, ## for major sections, - for leaves.",
    "  - Each leaf should be short (under ~10 words) — the mind map is a visual, not a summary.",
    "",
    voicePromptGuidance,
    "",
    `Return JSON matching this TypeScript schema exactly:\n${schema}`,
    "",
    "=== SOURCE MATERIAL ===",
    joinSources(docs),
  ].join("\n");
}
