export type QuizQuestion =
  | {
      id: string;
      type: "mcq";
      stem: string;
      choices: { label: string; text: string }[];
      correctLabel: string;
      rationale: string;
      topic: string;
    }
  | {
      id: string;
      type: "short";
      stem: string;
      correctAnswer: string;
      rationale: string;
      topic: string;
    }
  | {
      id: string;
      type: "recall";
      stem: string;
      expectedPoints: string[];
      rationale: string;
      topic: string;
    };

export type GeneratedContent = {
  sessionId: string;
  sources: { name: string; wordCount: number }[];
  mindMapMarkdown: string;
  quizQuestions: QuizQuestion[];
  voiceAgentPrompt: string;
  createdAt: number;
};

export type ExtractedDoc = {
  name: string;
  text: string;
  wordCount: number;
};

export type SessionData = {
  sessionId: string;
  extracted: ExtractedDoc[];
  generated?: GeneratedContent;
  createdAt: number;
};
