"use client";

import { useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";

type Props = { sessionId: string };

type Turn = { role: "user" | "agent"; text: string; at: number };

export default function VoiceQuiz(props: Props) {
  return (
    <ConversationProvider>
      <VoiceQuizInner {...props} />
    </ConversationProvider>
  );
}

function VoiceQuizInner({ sessionId }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const turnsRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onMessage: ({ source, message }: { source: string; message: string }) => {
      const role: Turn["role"] = source === "user" ? "user" : "agent";
      if (!message) return;
      setTurns((t) => [...t, { role, text: message, at: Date.now() }]);
    },
    onError: (message: string) => {
      setError(message || "Voice session error");
    },
  });

  useEffect(() => {
    if (!turnsRef.current) return;
    turnsRef.current.scrollTop = turnsRef.current.scrollHeight;
  }, [turns.length]);

  const connected = conversation.status === "connected";
  const connecting = conversation.status === "connecting";

  const start = async () => {
    if (connected || connecting || starting) return;
    setError(null);
    setStarting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const resp = await fetch(
        `/api/voice-token?sessionId=${encodeURIComponent(sessionId)}`,
        { cache: "no-store" }
      );
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(
          body.error ?? `Voice token request failed (${resp.status})`
        );
      }
      const { conversationToken, systemPromptOverride, firstMessage } =
        (await resp.json()) as {
          conversationToken: string;
          systemPromptOverride: string;
          firstMessage: string;
        };

      conversation.startSession({
        conversationToken,
        connectionType: "webrtc",
        overrides: {
          agent: {
            prompt: { prompt: systemPromptOverride },
            firstMessage,
          },
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setStarting(false);
    }
  };

  const stop = () => {
    conversation.endSession();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white border border-slate-200 p-6 flex flex-col items-center">
        <MicButton
          status={conversation.status}
          isListening={conversation.isListening}
          isSpeaking={conversation.isSpeaking}
          onClick={connected || connecting ? stop : start}
        />
        <p className="mt-4 text-sm text-[var(--muted)] min-h-[1.5rem]">
          {starting && "Connecting..."}
          {conversation.status === "connecting" && "Connecting to agent..."}
          {connected && conversation.isSpeaking && "Agent is speaking..."}
          {connected && conversation.isListening && "Listening... speak naturally."}
          {conversation.status === "disconnected" && !starting &&
            "Tap the mic to start. You can interrupt the tutor any time."}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <div
        ref={turnsRef}
        className="rounded-xl bg-white border border-slate-200 p-4 max-h-96 overflow-y-auto space-y-3"
      >
        {turns.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-8">
            The transcript will show up here as you chat.
          </p>
        ) : (
          turns.map((t, i) => (
            <div
              key={i}
              className={`flex ${
                t.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  t.role === "user"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-slate-100 text-slate-900"
                }`}
              >
                {t.text}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MicButton({
  status,
  isListening,
  isSpeaking,
  onClick,
}: {
  status: string;
  isListening: boolean;
  isSpeaking: boolean;
  onClick: () => void;
}) {
  const connected = status === "connected";
  const active = connected && (isListening || isSpeaking);
  const label = connected ? "Stop" : status === "connecting" ? "Connecting" : "Start";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all ${
        connected
          ? "bg-red-500 hover:bg-red-600"
          : "bg-[var(--accent)] hover:bg-emerald-800"
      } text-white shadow-lg`}
    >
      {active && (
        <span
          className={`absolute inset-0 rounded-full animate-ping ${
            isSpeaking ? "bg-amber-300" : "bg-white"
          } opacity-30`}
        />
      )}
      <MicIcon stopped={connected} />
    </button>
  );
}

function MicIcon({ stopped }: { stopped: boolean }) {
  if (stopped) {
    return (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="6" width="12" height="12" rx="2" />
      </svg>
    );
  }
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 1 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}
