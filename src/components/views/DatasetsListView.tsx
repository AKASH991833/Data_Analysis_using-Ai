"use client";

import React, { useEffect, useState } from "react";
import type { ViewType } from "../PlatformShell";
import {
  Database,
  FileSpreadsheet,
  ArrowRight,
  Trash2,
  Loader2,
  Clock,
  Rows3,
  Columns3,
  Globe,
} from "lucide-react";
import { useToast } from "@/components/Toast";

interface DatasetsListViewProps {
  onNavigate: (view: ViewType, datasetId?: string) => void;
}

interface DatasetSummary {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  rowCount: number;
  columnCount: number;
  domain: string | null;
  domainConfidence: number | null;
  status: string | null;
  createdAt: string;
}

export function DatasetsListView({ onNavigate }: DatasetsListViewProps) {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/datasets")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((data) => setDatasets(data))
      .catch(() => toast("error", "Could not load datasets"))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this dataset?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/datasets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDatasets((prev) => prev.filter((d) => d.id !== id));
      toast("success", "Dataset deleted successfully");
    } catch {
      toast("error", "Failed to delete dataset");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Database className="w-6 h-6 text-blue-400" />
            Datasets
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {datasets.length} dataset{datasets.length !== 1 ? "s" : ""} uploaded
          </p>
        </div>
        <button
          onClick={() => onNavigate("landing")}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold hover:from-blue-500 hover:to-purple-500 transition-all"
        >
          + Upload New
        </button>
      </div>

      {datasets.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <FileSpreadsheet className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            No datasets yet
          </h3>
          <p className="text-sm text-slate-400 mb-6">
            Upload your first data file to get started with AI analytics
          </p>
          <button
            onClick={() => onNavigate("landing")}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:from-blue-500 hover:to-purple-500 transition-all"
          >
            Upload Data
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {datasets.map((ds, i) => (
            <div
              key={ds.id}
              onClick={() => onNavigate("dataset", ds.id)}
              className="glass-card-hover p-5 cursor-pointer animate-slide-up group"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                </div>
                  <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleDelete(ds.id, e)}
                    disabled={deleting === ds.id}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  >
                    {deleting === ds.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                </div>
              </div>

              <h3 className="text-sm font-semibold text-white mb-1 truncate">
                {ds.name}
              </h3>
              <p className="text-xs text-slate-500 mb-3 truncate">
                {ds.fileName}
              </p>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Rows3 className="w-3 h-3" />
                  {(ds.rowCount || 0).toLocaleString()} rows
                </span>
                <span className="flex items-center gap-1">
                  <Columns3 className="w-3 h-3" />
                  {ds.columnCount} cols
                </span>
              </div>

              {ds.domain && (
                <div className="mt-3 flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-purple-400" />
                  <span className="text-xs font-medium text-purple-300">
                    {ds.domain}
                  </span>
                  {ds.domainConfidence && (
                    <span className="text-xs text-slate-500">
                      ({(ds.domainConfidence * 100).toFixed(0)}%)
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                {new Date(ds.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
