"use client";

import React, { useState, useCallback } from "react";
import type { ViewType } from "../PlatformShell";
import { useToast } from "../Toast";
import {
  Upload,
  FileSpreadsheet,
  Sparkles,
  BarChart3,
  Brain,
  Shield,
  Zap,
  TrendingUp,
  Database,
  MessageSquare,
  Loader2,
} from "lucide-react";

const MAX_ROWS = 100000;
const BATCH_BYTES = 2_500_000;
const MAX_SEND_BYTES = 85_000_000;

type LargeResult = { id: string; limitInfo?: { totalRows: number; analyzedRows: number; truncated: boolean } };

// Streams a big delimited file in the browser (nothing larger than ~2.5MB is ever sent),
// forwards the first MAX_ROWS rows in batches, and counts every row in the file.
async function uploadLargeFile(file: File, onProgress: (pct: number, status: string) => void): Promise<LargeResult> {
  const Papa = (await import("papaparse")).default;
  const uploadId = crypto.randomUUID();
  const post = async (body: Record<string, unknown>) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch("/api/datasets/chunked", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadId, ...body }) });
        const json = await res.json().catch(() => ({}));
        if (res.ok) return json;
        if (res.status < 500 || attempt >= 2) throw Object.assign(new Error(json.error || "Upload failed"), { fatal: true, full: json.full });
      } catch (e) {
        if ((e as { fatal?: boolean }).fatal || attempt >= 2) throw e;
      }
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  };
  let batch: Record<string, unknown>[] = [];
  let batchBytes = 0, sentBytes = 0, sentRows = 0, totalRows = 0, idx = 0, full = false;
  let chain: Promise<unknown> = Promise.resolve();
  let failure: unknown = null;
  const flush = () => {
    if (!batch.length) return;
    const rows = batch, i = idx++;
    batch = []; batchBytes = 0;
    chain = chain.then(() => (failure ? undefined : post({ op: "batch", idx: i, rows }))).catch((e) => {
      if ((e as { full?: boolean }).full) full = true; else failure = e;
    });
  };
  await new Promise<void>((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true, skipEmptyLines: true, dynamicTyping: false,
      delimiter: file.name.toLowerCase().endsWith(".tsv") ? "\t" : ",",
      chunkSize: 4 * 1024 * 1024,
      chunk: (res) => {
        for (const row of res.data) {
          totalRows++;
          if (sentRows < MAX_ROWS && !full && sentBytes < MAX_SEND_BYTES) {
            const len = JSON.stringify(row).length;
            batch.push(row); batchBytes += len; sentBytes += len; sentRows++;
            if (batchBytes >= BATCH_BYTES) flush();
          }
        }
        const cursor = res.meta.cursor || 0;
        onProgress(10 + Math.min(65, Math.round((cursor / file.size) * 65)), `Reading file... ${Math.min(100, Math.round((cursor / file.size) * 100))}% (${totalRows.toLocaleString()} rows)`);
      },
      complete: () => resolve(),
      error: (err: Error) => reject(err),
    });
  });
  flush();
  await chain;
  if (failure) throw failure;
  if (totalRows === 0) throw new Error("No data found in file");
  onProgress(85, "Analyzing & generating insights...");
  return post({ op: "finish", fileName: file.name, sizeBytes: file.size, totalRows });
}

interface LandingViewProps {
  onNavigate: (view: ViewType, datasetId?: string) => void;
}

export function LandingView({ onNavigate }: LandingViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const { toast } = useToast();

  const handleUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadProgress(10);
      setUploadStatus("Reading file...");

      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        if (file.size > 3 * 1024 * 1024) {
          if (!["csv", "tsv", "txt"].includes(ext)) throw new Error("Files over 3MB must be CSV, TSV or TXT (save big Excel/JSON files as CSV first).");
          const data = await uploadLargeFile(file, (pct, status) => { setUploadProgress(pct); setUploadStatus(status); });
          setUploadProgress(100);
          setUploadStatus("Analysis complete!");
          if (data.limitInfo?.truncated) {
            toast("warning",
              `File has ${data.limitInfo.totalRows.toLocaleString()} rows. ` +
              `Only first ${data.limitInfo.analyzedRows.toLocaleString()} were loaded for analysis. ` +
              `The remaining ${(data.limitInfo.totalRows - data.limitInfo.analyzedRows).toLocaleString()} rows are not available for analysis.`
            );
          }
          setTimeout(() => { onNavigate("dataset", data.id); }, 600);
          return;
        }
        const formData = new FormData();
        formData.append("file", file);

        setUploadProgress(20);
        setUploadStatus("Reading file...");

        const res = await fetch("/api/datasets", {
          method: "POST",
          body: formData,
        });

        setUploadProgress(60);
        setUploadStatus("Analyzing & profiling...");

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Upload failed");
        }

        setUploadProgress(85);
        setUploadStatus("Generating insights & KPIs...");

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Upload failed");
        }

        const data = await res.json();
        setUploadProgress(100);
        setUploadStatus("Analysis complete!");

        if (data.limitInfo?.truncated) {
          toast("warning",
            `File has ${data.limitInfo.totalRows.toLocaleString()} rows. ` +
            `Only first ${data.limitInfo.maxRows.toLocaleString()} were loaded. ` +
            `The remaining ${(data.limitInfo.totalRows - data.limitInfo.maxRows).toLocaleString()} rows are not available for analysis.`
          );
        }

        setTimeout(() => {
          onNavigate("dataset", data.id);
        }, 600);
      } catch (err) {
        setUploadStatus(
          `Error: ${err instanceof Error ? err.message : "Upload failed"}`
        );
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          setUploadStatus("");
        }, 3000);
      }
    },
    [onNavigate, toast]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const features = [
    {
      icon: Brain,
      title: "Data Profiling",
      desc: "Auto-detect keys, types, relationships & data quality",
      color: "from-blue-500 to-blue-600",
    },
    {
      icon: Sparkles,
      title: "Domain Detection",
      desc: "Sales, Finance, Healthcare, E-Commerce & 12+ domains",
      color: "from-purple-500 to-purple-600",
    },
    {
      icon: Shield,
      title: "Auto Data Cleaning",
      desc: "Fix missing values, duplicates & format issues",
      color: "from-emerald-500 to-emerald-600",
    },
    {
      icon: TrendingUp,
      title: "Smart KPIs",
      desc: "Context-aware KPI generation based on your data",
      color: "from-amber-500 to-amber-600",
    },
    {
      icon: BarChart3,
      title: "Auto Dashboards",
      desc: "Intelligent chart recommendations & visualizations",
      color: "from-cyan-500 to-cyan-600",
    },
    {
      icon: MessageSquare,
      title: "Natural Language",
      desc: "Ask questions in plain English, get visual answers",
      color: "from-rose-500 to-rose-600",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-12">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              Data Exploration & Analytics
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-extrabold text-center mb-6 leading-tight">
            <span className="gradient-text">Intelligent Analytics</span>
            <br />
            <span className="text-white">for Every Dataset</span>
          </h1>

          <p className="text-lg text-slate-400 text-center max-w-2xl mx-auto mb-12 leading-relaxed">
            Upload any data file and get instant computed profiling, domain
            detection, automated KPIs, smart insights, and interactive
            dashboards — all in seconds.
          </p>

          {/* Upload Zone */}
          <div className="max-w-2xl mx-auto mb-16">
            {isUploading ? (
              <div className="glass-card p-8 text-center animate-fade-in">
                <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
                <p className="text-white font-semibold mb-2">{uploadStatus}</p>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {uploadProgress}% complete
                </p>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                className={`glass-card-hover p-10 text-center cursor-pointer transition-all duration-300 ${
                  isDragging
                    ? "border-blue-500/50 bg-blue-500/5 scale-[1.02]"
                    : ""
                }`}
                onClick={() =>
                  document.getElementById("file-upload")?.click()
                }
              >
                <input
                  id="file-upload"
                  type="file"
                  className="sr-only"
                  accept=".csv,.xlsx,.json,.tsv,.txt"
                  onChange={onFileSelect}
                />
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Drop your data file here
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  or click to browse
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {["CSV", "XLSX", "JSON", "TSV", "TXT"].map((fmt) => (
                    <span
                      key={fmt}
                      className="px-2.5 py-1 rounded-md bg-white/5 text-xs text-slate-400 font-mono"
                    >
                      .{fmt.toLowerCase()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Or try sample */}
            {!isUploading && (
              <div className="text-center mt-4 animate-fade-in">
                <span className="text-xs text-slate-500 mr-2">or</span>
                <button
                  onClick={async () => {
                    setIsUploading(true);
                    setUploadProgress(20);
                    setUploadStatus("Generating sample sales data...");
                    try {
                      const res = await fetch("/api/datasets/sample", { method: "POST" });
                      setUploadProgress(80);
                      setUploadStatus("Building dashboards...");
                      const data = await res.json();
                      setUploadProgress(100);
                      setUploadStatus("Ready!");
                      setTimeout(() => onNavigate("dataset", data.id), 500);
                    } catch {
                      setUploadStatus("Error generating sample");
                      setTimeout(() => {
                        setIsUploading(false);
                        setUploadProgress(0);
                        setUploadStatus("");
                      }, 2000);
                    }
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 font-medium transition-colors"
                >
                  Try with sample sales data (500 rows)
                </button>
              </div>
            )}
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="glass-card-hover p-5 animate-slide-up"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-3 opacity-80`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">
                    {f.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "File Formats", value: "6+", icon: FileSpreadsheet },
              { label: "Auto KPIs", value: "∞", icon: Zap },
              { label: "Chart Types", value: "12+", icon: BarChart3 },
              { label: "Domains", value: "16+", icon: Database },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={i}
                  className="glass-card p-4 text-center"
                >
                  <Icon className="w-5 h-5 text-slate-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold gradient-text">
                    {s.value}
                  </div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
