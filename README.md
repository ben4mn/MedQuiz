# MedQuiz

A voice-first study companion for medical students. Upload chapter notes, get a mind map, a text quiz, and a natural-conversation voice tutor powered by Claude and ElevenLabs.

## Local development

```bash
npm install
npm run dev
# http://localhost:3000
```

The app uses two third-party services:

- **Anthropic** (Claude) for content generation and as the "brain" behind the voice tutor.
- **ElevenLabs Conversational AI** for microphone capture, STT, voice activity detection, turn-taking, barge-in, and TTS.

Set keys in `.env.local` (git-ignored):

```
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_AGENT_ID=   # filled in after you create the agent, see below
```

## One-time ElevenLabs agent setup

The voice quiz uses a Conversational AI agent configured with Claude as its "custom LLM". Do this once:

1. Go to https://elevenlabs.io/app/conversational-ai/agents and create a new agent.
2. In the agent settings:
   - **LLM**: choose **Custom LLM**.
   - **Server URL**: the base URL of this app. For local dev, you'll need a public tunnel (see below). Set this to `https://<tunnel>.trycloudflare.com/api/voice-llm`.
   - **Model ID**: anything — e.g. `medquiz-claude`. It's passed through but not used.
   - **API key**: anything non-empty — the route doesn't validate it in dev.
3. Pick a **voice** (Aria, Sarah, and Charlotte are good warm choices) and output format.
4. In the **Security** tab, enable override for **System Prompt** and **First Message** — required so the per-session tutor prompt and greeting can be injected.
5. Copy the agent ID into `ELEVENLABS_AGENT_ID` in `.env.local`. Restart `npm run dev`.

## Running the voice quiz locally

ElevenLabs agents can only reach a publicly-resolvable URL, so you need a tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
# note the https://*.trycloudflare.com URL it prints
```

Update the agent's "Server URL" in the ElevenLabs dashboard to point at that tunnel + `/api/voice-llm`.

## Production (Expedia network) note

Node 24's bundled root CA list is missing GlobalSign Root CA and GTS Root R4, which makes HTTPS calls to `api.anthropic.com` fail with "Connection error." A local `certs.pem` is generated from the macOS keychain and loaded via `NODE_EXTRA_CA_CERTS` in the npm scripts. To regenerate:

```bash
{
  security find-certificate -c "GlobalSign Root CA" -a -p /System/Library/Keychains/SystemRootCertificates.keychain
  security find-certificate -c "GTS Root R4" -a -p /System/Library/Keychains/SystemRootCertificates.keychain
  security find-certificate -c "ISRG Root X1" -a -p /System/Library/Keychains/SystemRootCertificates.keychain
  security find-certificate -c "ISRG Root X2" -a -p /System/Library/Keychains/SystemRootCertificates.keychain
  security find-certificate -c "Starfield" -a -p /System/Library/Keychains/SystemRootCertificates.keychain
  security find-certificate -c "Amazon" -a -p /System/Library/Keychains/SystemRootCertificates.keychain
} > certs.pem
```

## Architecture

```
Browser ────uploads docs────▶ /api/upload ──(mammoth/pdf-parse)──▶ session store
                                                    │
Browser ────click Start─────▶ /api/generate ─(Claude Sonnet 4.6)──▶ mind map + quiz + voice prompt
                                                    │
Browser ◀────────────────── study page (3 tabs: mind map / text quiz / voice quiz)

Voice tab:
Browser ──/api/voice-token──▶ ElevenLabs (get WebRTC conversation token)
Browser ◀─────WebRTC audio──▶ ElevenLabs agent (STT + TTS + VAD + turn-taking)
                                  │
                                  ▼
                       /api/voice-llm (OpenAI-compatible SSE endpoint)
                                  │
                                  ▼
                            Anthropic Messages API (streaming)
```

## Known limitations

- Sessions are stored in server memory; restart loses content. Fine for personal use.
- No auth. Any visitor with the tunnel URL could use the app. Add basic auth before sharing widely.
