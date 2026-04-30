# MedQuiz

> Paste your chapter notes. Get a mind map, a quiz, and a voice tutor that actually listens.

**Live app:** https://tat.4mn.org
**Marketing page:** https://ben4mn.github.io/MedQuiz/

MedQuiz is a voice-first study companion for medical students, built to solve a specific problem: ChatGPT voice was robotic and just parroted answers back instead of judging them. So we combined Claude (for reasoning) with ElevenLabs (for voice quality) and wrapped it in a Next.js app that can be used on any phone or laptop.

## Features

- **Paste or upload** — paste a chapter as text, or upload up to 3 `.docx` / `.pdf` files
- **Interactive mind map** — the chapter's structure as a radial tree, pinch-zoom on mobile
- **Mixed-format quiz** — multiple choice, short answer, free recall, each with a rationale
- **Natural voice tutor** — WebRTC mic, barge-in, turn-taking, real conversation flow
- **Context-aware reasoning** — the tutor knows your source material and judges answers on understanding, not keyword match

## Architecture

```
Browser ──paste/upload──▶ /api/paste or /api/upload ──▶ session store
                                                │
Browser ──click Start───▶ /api/generate ─(Claude Sonnet 4.6)──▶ mind map + quiz + voice prompt
                                                │
Browser ◀───────────── /study (3 tabs: mind map / text quiz / voice quiz)

Voice tab:
Browser ──/api/voice-token──▶ ElevenLabs (signed WebRTC token)
Browser ◀──────WebRTC audio──▶ ElevenLabs agent (STT + TTS + turn-taking)
                                  │
                                  ▼
                       /api/voice-llm (OpenAI-compatible SSE bridge)
                                  │
                                  ▼
                            Anthropic Messages API (streaming)
```

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Anthropic SDK · ElevenLabs React SDK · mammoth + pdf-parse · markmap

## Local development

```bash
git clone https://github.com/ben4mn/MedQuiz.git
cd MedQuiz
npm install
cp .env.example .env.local    # then fill in real values
npm run dev
```

Visit http://localhost:3000.

### Required environment variables

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `ELEVENLABS_API_KEY` | https://elevenlabs.io (account settings) |
| `ELEVENLABS_AGENT_ID` | Created during the one-time ElevenLabs agent setup below |

### One-time ElevenLabs agent setup

The voice quiz uses a Conversational AI agent configured with Claude as its custom LLM. Create this once:

1. Go to https://elevenlabs.io/app/conversational-ai/agents and create a new agent.
2. In the agent settings:
   - **LLM**: Custom LLM
   - **Server URL**: your app's base URL + `/api/voice-llm`. For local dev, you'll need a public tunnel — e.g. `https://yourtunnel.example.com/api/voice-llm`
   - **Model ID**: anything, e.g. `medquiz-claude` (not used)
   - **API key**: anything non-empty (not validated in dev)
3. Pick a warm voice (Aria, Sarah, and Charlotte are good choices).
4. **Security tab**: enable override for **System Prompt** and **First Message**. Required — without these, per-session tutor prompts are silently dropped.
5. Copy the agent ID into `ELEVENLABS_AGENT_ID` in `.env.local`.

### Making voice work locally

ElevenLabs agents need a publicly-resolvable URL to reach your Custom LLM. Use Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the generated `*.trycloudflare.com` URL into the agent's Server URL setting.

## Production mode

Turbopack's dev-mode HMR uses a WebSocket, which Cloudflare's proxy doesn't always route cleanly. For anything shared over a tunnel, run the production build:

```bash
npm run build
npm run start
```

## Node 24 CA workaround

Node 24's bundled root CA list is missing GlobalSign Root CA and GTS Root R4, which breaks HTTPS calls to `api.anthropic.com` with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. The repo's npm scripts load a local `certs.pem` via `NODE_EXTRA_CA_CERTS`.

On a Mac, regenerate the bundle from your system keychain:

```bash
{
  security find-certificate -c "GlobalSign Root CA" -a -p /System/Library/Keychains/SystemRootCertificates.keychain
  security find-certificate -c "GTS Root R4" -a -p /System/Library/Keychains/SystemRootCertificates.keychain
  security find-certificate -c "ISRG Root X1" -a -p /System/Library/Keychains/SystemRootCertificates.keychain
  security find-certificate -c "ISRG Root X2" -a -p /System/Library/Keychains/SystemRootCertificates.keychain
} > certs.pem
```

`certs.pem` is gitignored.

## Project structure

```
src/
├── app/
│   ├── layout.tsx, page.tsx, globals.css
│   ├── study/page.tsx            — three-tab study view
│   └── api/
│       ├── upload/route.ts       — .docx/.pdf → text
│       ├── paste/route.ts        — raw text → session
│       ├── generate/route.ts     — Claude builds mind map + quiz + agent prompt
│       ├── voice-token/route.ts  — fetches ElevenLabs WebRTC token
│       └── voice-llm/route.ts    — OpenAI-compatible SSE proxy to Anthropic
├── components/
│   ├── FileDropzone.tsx          — drag/drop with iOS-safe label+input
│   ├── MindMap.tsx               — markmap SVG wrapper
│   ├── TextQuiz.tsx              — one-question-at-a-time card
│   └── VoiceQuiz.tsx             — WebRTC mic UI + live transcript
└── lib/
    ├── types.ts                  — shared types
    ├── sessionStore.ts           — in-memory session store
    ├── parsers.ts                — docx/pdf extraction
    ├── anthropic.ts              — SDK client factory
    ├── openai-to-anthropic.ts    — OpenAI chat-completions ↔ Anthropic Messages
    └── prompts.ts                — generation system/user prompts
```

## Known limitations

- Sessions live in server memory; restart clears them. Fine for single-user; add Postgres or SQLite for multi-user.
- No auth. Put basic auth or Cloudflare Access in front before sharing broadly.
- Mic permissions: some in-app browsers (Instagram DMs, Slack) don't support `getUserMedia`. Users need a full browser tab.

## License

MIT
