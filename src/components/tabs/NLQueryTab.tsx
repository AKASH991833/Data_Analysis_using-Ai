"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  MessageSquare,
  Sparkles,
  BarChart3,
  User,
  Bot,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface NLQueryTabProps {
  datasetId: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  chart?: {
    type: string;
    title: string;
    xKey?: string;
    yKey?: string;
    dataKey?: string;
    data: Record<string, unknown>[];
  };
}

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
];

const suggestions = [
  "Show me the total summary",
  "What are the top performers?",
  "Show monthly trend",
  "How many records are there?",
  "Show distribution breakdown",
  "What is the average value?",
];

export function NLQueryTab({ datasetId }: NLQueryTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load query history on mount
  useEffect(() => {
    fetch(`/api/datasets/${datasetId}/queries`)
      .then((r) => r.json())
      .then((history: { question: string; answer: string }[]) => {
        if (!history || history.length === 0) return;
        const msgs: Message[] = [];
        for (const q of history.reverse()) {
          msgs.push({ role: "user", content: q.question });
          msgs.push({ role: "assistant", content: q.answer });
        }
        setMessages(msgs);
      })
      .catch(() => {});
  }, [datasetId]);

  const sendQuery = async (question: string) => {
    if (!question.trim()) return;

    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`/api/datasets/${datasetId}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();

      const assistantMsg: Message = {
        role: "assistant",
        content: data.answer || "I couldn't process that query.",
        chart: data.chart,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, an error occurred." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="glass-card overflow-hidden flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Ask AI Anything
            </h3>
            <p className="text-[10px] text-slate-500">
              Natural language analytics powered by AI
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Sparkles className="w-12 h-12 text-purple-400/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Ask questions about your data
              </h3>
              <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
                Use natural language to explore your dataset. Ask about totals,
                averages, trends, top performers, and more.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendQuery(s)}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 hover:border-purple-500/20 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 animate-fade-in ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] ${
                  msg.role === "user"
                    ? "bg-blue-600/20 border border-blue-500/20"
                    : "bg-white/[0.03] border border-white/5"
                } rounded-2xl px-4 py-3`}
              >
                <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </p>
                {msg.chart && (
                  <div className="mt-3 h-48">
                    <MiniChart chart={msg.chart} />
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  <span className="text-sm text-slate-400">Analyzing...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) sendQuery(input);
              }}
              placeholder="Ask about your data..."
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/30"
            />
            <button
              onClick={() => sendQuery(input)}
              disabled={loading || !input.trim()}
              className="p-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniChart({
  chart,
}: {
  chart: {
    type: string;
    title: string;
    xKey?: string;
    yKey?: string;
    dataKey?: string;
    data: Record<string, unknown>[];
  };
}) {
  const axisStyle = { fontSize: 9, fill: "#64748b" };

  if (chart.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey={chart.xKey} tick={axisStyle} />
          <YAxis tick={axisStyle} />
          <Tooltip />
          <Bar dataKey={chart.yKey!} radius={[3, 3, 0, 0]}>
            {chart.data.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey={chart.xKey} tick={axisStyle} />
          <YAxis tick={axisStyle} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey={chart.yKey!}
            stroke="#3b82f6"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chart.data}
            dataKey={chart.dataKey || "count"}
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={70}
            innerRadius={35}
            stroke="none"
          >
            {chart.data.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="flex items-center justify-center h-full">
      <BarChart3 className="w-8 h-8 text-slate-600" />
    </div>
  );
}
