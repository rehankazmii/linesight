"use client";

import { FormEvent, useMemo, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type AssistantResponse = { answer: string };

const initialMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I can answer questions about line health, stations, CTQs, lots/fixtures, episodes, units, and trends. Try “Worst station last 24h” or “Lots at risk this week.”",
};

export function LineAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [bucket, setBucket] = useState<"hour" | "shift" | "day" | "week">("day");

  const addMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const handleQuery = async (question: string): Promise<string> => {
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question, bucket }),
      });
      if (!res.ok) throw new Error("assistant");
      const data: AssistantResponse = await res.json();
      return data.answer;
    } catch {
      return "I had trouble fetching that data. Please try again in a moment.";
    }
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = input.trim();
    if (!question || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };
    addMessage(userMessage);
    setInput("");
    setIsLoading(true);

    const answer = await handleQuery(question);
    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: answer,
    };
    addMessage(assistantMessage);
    setIsLoading(false);
  };

  const bubbleClasses = useMemo(
    () => ({
      user: "ml-auto bg-neutral-900 text-white",
      assistant: "mr-auto bg-neutral-100 text-neutral-800",
    }),
    [],
  );

  return (
    <div className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white/90 shadow-sm">
      <div className="border-b border-neutral-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-900">Line Assistant (beta)</h3>
        <p className="text-xs text-neutral-600">Ask about RTY/FPY, stations, CTQs, lots, fixtures, episodes, units, trends.</p>
        <div className="mt-2 flex gap-2 text-[11px] text-neutral-700">
          {(["hour", "shift", "day", "week"] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(b)}
              className={`rounded-full px-2 py-1 transition ${
                bucket === b ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {b === "hour" ? "Last 8h" : b === "shift" ? "Last 24h" : b === "day" ? "Default" : "Last 7d"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[90%] rounded-2xl px-3 py-2 leading-snug shadow-sm ${
              bubbleClasses[message.role]
            }`}
          >
            {message.content.split("\n").map((line, idx) => (
              <p key={idx} className="whitespace-pre-wrap">
                {line}
              </p>
            ))}
          </div>
        ))}
        {isLoading ? (
          <div className="mr-auto h-6 w-16 rounded-full bg-neutral-100">
            <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200" />
          </div>
        ) : null}
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-neutral-100 px-4 py-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question… (RTY, episodes, lots/fixtures, glossary)"
          className="flex-1 rounded-xl border border-neutral-200 bg-white/90 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {isLoading ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}

export default LineAssistant;
