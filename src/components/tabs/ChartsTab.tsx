"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Loader2, BarChart3 } from "lucide-react";

interface ChartRecommendation {
  type: string;
  title: string;
  xKey?: string;
  yKey?: string;
  dataKey?: string;
  data: Record<string, unknown>[];
}

interface ChartsTabProps {
  datasetId: string;
}

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

const CustomTooltipContent = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="glass-card p-3 text-xs border border-white/10" style={{ borderRadius: 8 }}>
      <p className="text-slate-300 font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

export function ChartsTab({ datasetId }: ChartsTabProps) {
  const [charts, setCharts] = useState<ChartRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/datasets/${datasetId}/charts`)
      .then((r) => r.json())
      .then((data) => setCharts(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [datasetId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (charts.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">
          No charts could be generated. Upload data with numeric and categorical columns.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {charts.map((chart, i) => (
          <div
            key={i}
            className="glass-card p-6 animate-slide-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <h3 className="text-sm font-semibold text-white mb-4">
              {chart.title}
            </h3>
            <div className="h-72 chart-container">
              <ChartRenderer chart={chart} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartRenderer({ chart }: { chart: ChartRecommendation }) {
  const { type, data, xKey, yKey, dataKey } = chart;

  if (data.length === 0) {
    return <p className="text-slate-500 text-xs text-center py-10">No data</p>;
  }

  const axisStyle = { fontSize: 10, fill: "#64748b" };

  switch (type) {
    case "bar":
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey={xKey}
              tick={axisStyle}
              angle={-35}
              textAnchor="end"
              height={50}
            />
            <YAxis tick={axisStyle} />
            <Tooltip content={<CustomTooltipContent />} />
            <Bar dataKey={yKey!} radius={[4, 4, 0, 0]}>
              {data.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case "line":
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={xKey} tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip content={<CustomTooltipContent />} />
            <Line
              type="monotone"
              dataKey={yKey!}
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 3 }}
              activeDot={{ r: 5, fill: "#8b5cf6" }}
            />
          </LineChart>
        </ResponsiveContainer>
      );

    case "area": {
      const keys = Object.keys(data[0]).filter((k) => k !== "index" && k !== xKey);
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={xKey || "index"} tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip content={<CustomTooltipContent />} />
            {keys.map((key, idx) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[idx % COLORS.length]}
                fill={COLORS[idx % COLORS.length]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    case "pie":
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey={dataKey || "count"}
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={50}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltipContent />} />
            <Legend
              wrapperStyle={{ fontSize: 10, color: "#94a3b8" }}
            />
          </PieChart>
        </ResponsiveContainer>
      );

    case "scatter":
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={xKey} tick={axisStyle} name={xKey} />
            <YAxis dataKey={yKey} tick={axisStyle} name={yKey} />
            <Tooltip content={<CustomTooltipContent />} />
            <Scatter data={data} fill="#8b5cf6" />
          </ScatterChart>
        </ResponsiveContainer>
      );

    default:
      return <p className="text-slate-500 text-xs">Unsupported chart type</p>;
  }
}
