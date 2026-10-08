import type { ColumnMeta, DataProfile, CleaningReport, CleaningAction, KPI, Insight, Relationship } from "@/db/schema";

// A strict parser shared by profiling, cleaning, KPIs, charts and queries.
// US-style grouping/currency supported; ambiguous locale formats are rejected.
export function parseNumeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let text = value.trim().replace(/^[$£€₹]\s*/, "");
  if (!/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text) &&
      !/^[+-]?\.\d+(?:[eE][+-]?\d+)?$/.test(text)) return null;
  text = text.replace(/,/g, "");
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

// ─── DATA PROFILING ───────────────────────────────────────────────

export function profileData(
  rows: Record<string, unknown>[],
  columns: string[]
): { columnMetas: ColumnMeta[]; profile: DataProfile } {
  const totalRows = rows.length;
  const columnMetas: ColumnMeta[] = [];

  const dateColumns: string[] = [];
  const numericColumns: string[] = [];
  const categoricalColumns: string[] = [];
  const currencyColumns: string[] = [];
  const locationColumns: string[] = [];
  const customerColumns: string[] = [];
  const productColumns: string[] = [];
  const revenueColumns: string[] = [];
  const statusColumns: string[] = [];

  let totalNulls = 0;
  const totalCells = totalRows * columns.length;

  for (const col of columns) {
    const values = rows.map((r) => r[col]);
    const nonNull = values.filter(
      (v) => v !== null && v !== undefined && String(v).trim() !== ""
    );
    const nullCount = totalRows - nonNull.length;
    totalNulls += nullCount;
    const strValues = nonNull.map((v) => String(v));
    const uniqueSet = new Set(strValues);
    const uniqueCount = uniqueSet.size;

    const numericVals = nonNull
      .map(parseNumeric)
      .filter((n): n is number => n !== null);

    const isDate = detectDateColumn(col, strValues);
    const isNumeric = !isDate && nonNull.length > 0 && numericVals.length === nonNull.length;

    const meta: ColumnMeta = {
      name: col,
      type: isNumeric ? "number" : isDate ? "date" : "string",
      nullCount,
      nullPercent: totalRows > 0 ? (nullCount / totalRows) * 100 : 0,
      uniqueCount,
      uniquePercent: totalRows > 0 ? (uniqueCount / totalRows) * 100 : 0,
      duplicatePercent:
        totalRows > 0
          ? ((nonNull.length - uniqueCount) / Math.max(nonNull.length, 1)) * 100
          : 0,
      topValues: getTopValues(strValues, 15),
      sample: strValues.slice(0, 3),
    };

    if (isNumeric && numericVals.length > 0) {
      meta.min = numericVals.reduce((a, b) => Math.min(a, b));
      meta.max = numericVals.reduce((a, b) => Math.max(a, b));
      meta.mean = numericVals.reduce((a, b) => a + b, 0) / numericVals.length;
      const sorted = [...numericVals].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      meta.median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      const variance =
        numericVals.reduce((sum, v) => sum + (v - meta.mean!) ** 2, 0) /
        numericVals.length;
      meta.stdDev = Math.sqrt(variance);
    }

    // Semantic classification
    const colLower = col.toLowerCase();
    meta.semanticType = classifyColumn(colLower, meta, uniqueCount, totalRows);

    if (isDate) dateColumns.push(col);
    if (isNumeric) numericColumns.push(col);
    if (!isNumeric && !isDate) categoricalColumns.push(col);

    if (isCurrencyField(colLower)) currencyColumns.push(col);
    if (isLocationField(colLower)) locationColumns.push(col);
    if (isCustomerField(colLower)) customerColumns.push(col);
    if (isProductField(colLower)) productColumns.push(col);
    if (isRevenueField(colLower)) revenueColumns.push(col);
    if (isStatusField(colLower, uniqueCount)) statusColumns.push(col);

    // Key detection
    if (uniqueCount === totalRows && nullCount === 0) {
      meta.isKey = true;
      meta.keyType = "primary";
    } else if (
      uniqueCount === totalRows &&
      nullCount < totalRows * 0.05
    ) {
      meta.isKey = true;
      meta.keyType = "candidate";
    }

    columnMetas.push(meta);
  }

  const completeness =
    totalCells > 0 ? ((totalCells - totalNulls) / totalCells) * 100 : 0;
  const relationships = detectRelationships(columnMetas);
  const qualityScore = calculateQualityScore(
    completeness,
    columnMetas,
    totalRows
  );

  const profile: DataProfile = {
    totalRows,
    totalColumns: columns.length,
    completeness,
    consistency: completeness,
    uniqueness:
      columns.length ? columnMetas.reduce((s, c) => s + c.uniquePercent, 0) / columns.length : 0,
    qualityScore,
    dateColumns,
    numericColumns,
    categoricalColumns,
    currencyColumns,
    locationColumns,
    customerColumns,
    productColumns,
    revenueColumns,
    statusColumns,
    relationships,
  };

  return { columnMetas, profile };
}

function detectDateColumn(_name: string, values: string[]): boolean {
  if (!values.length) return false;
  // Do not let numeric IDs, partial numbers or column-name substrings become dates.
  return values.every((v) => /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(v.trim()) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v.slice(0,10));
}

function classifyColumn(
  col: string,
  meta: ColumnMeta,
  uniqueCount: number,
  totalRows: number
): string {
  if (
    col.includes("id") &&
    (col.endsWith("id") || col.startsWith("id")) &&
    uniqueCount > totalRows * 0.8
  )
    return "identifier";
  if (isRevenueField(col)) return "revenue";
  if (isCurrencyField(col)) return "currency";
  if (isCustomerField(col)) return "customer";
  if (isProductField(col)) return "product";
  if (isLocationField(col)) return "location";
  if (isStatusField(col, uniqueCount)) return "status";
  if (meta.type === "number") return "measure";
  if (meta.type === "date") return "temporal";
  return "dimension";
}

function isCurrencyField(col: string): boolean {
  return /price|cost|amount|revenue|sales|total|fee|charge|payment|balance|salary|wage|budget|spend/i.test(
    col
  );
}
function isLocationField(col: string): boolean {
  return /city|state|country|region|zip|postal|address|location|lat|lon|geo|territory|area|province/i.test(
    col
  );
}
function isCustomerField(col: string): boolean {
  return /customer|client|user|buyer|member|subscriber|account_name|company/i.test(
    col
  );
}
function isProductField(col: string): boolean {
  return /product|item|sku|service|model|brand|category/i.test(col);
}
function isRevenueField(col: string): boolean {
  return /revenue|sales|income|profit|earnings|turnover|gmv/i.test(col);
}
function isStatusField(col: string, uniqueCount: number): boolean {
  return (
    (/status|state|stage|type|category|priority|level/i.test(col) &&
      uniqueCount < 20) ||
    uniqueCount <= 5
  );
}

function getTopValues(
  values: string[],
  n: number
): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value, count]) => ({ value, count }));
}

function detectRelationships(columns: ColumnMeta[]): Relationship[] {
  const rels: Relationship[] = [];
  const idCols = columns.filter(
    (c) => c.semanticType === "identifier" || c.isKey
  );

  for (const id of idCols) {
    for (const other of columns) {
      if (other.name === id.name) continue;
      if (
        other.name.toLowerCase().includes(id.name.toLowerCase().replace("_id", "").replace("id", ""))
      ) {
        rels.push({
          from: id.name,
          to: other.name,
          type: "lookup",
          confidence: 0.7,
        });
      }
    }
  }
  return rels;
}

function calculateQualityScore(
  completeness: number,
  columns: ColumnMeta[],
  totalRows: number
): number {
  if (!columns.length || !totalRows) return 0;
  const avgNull =
    columns.reduce((s, c) => s + c.nullPercent, 0) / columns.length;
  const avgDup =
    columns.reduce((s, c) => s + c.duplicatePercent, 0) / columns.length;

  let score = completeness * 0.4;
  score += Math.max(0, 100 - avgNull) * 0.3;
  score += Math.max(0, 100 - avgDup) * 0.2;
  score += (totalRows > 10 ? 10 : totalRows) * 1; // volume bonus

  return Math.min(100, Math.max(0, score));
}

// ─── DOMAIN DETECTION ─────────────────────────────────────────────

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  Sales: ["sales", "revenue", "deal", "pipeline", "quota", "commission", "lead", "opportunity", "close"],
  Marketing: ["campaign", "impression", "click", "ctr", "conversion", "ad", "channel", "engagement", "reach"],
  Healthcare: ["patient", "diagnosis", "treatment", "hospital", "doctor", "prescription", "medical", "health"],
  Finance: ["transaction", "account", "balance", "interest", "debit", "credit", "investment", "portfolio"],
  Banking: ["loan", "mortgage", "deposit", "withdrawal", "branch", "atm", "banking"],
  Insurance: ["policy", "premium", "claim", "coverage", "underwriting", "insured"],
  Logistics: ["shipment", "tracking", "warehouse", "delivery", "freight", "carrier", "route"],
  Manufacturing: ["production", "assembly", "quality", "defect", "batch", "raw_material", "machine"],
  Education: ["student", "course", "grade", "enrollment", "teacher", "school", "class", "gpa"],
  Retail: ["store", "sku", "inventory", "pos", "receipt", "shelf", "aisle"],
  "E-Commerce": ["order", "cart", "checkout", "shipping", "product", "review", "rating", "wishlist"],
  "Human Resources": ["employee", "salary", "department", "hiring", "resignation", "leave", "payroll", "attendance"],
  "AC Service": ["technician", "service", "installation", "warranty", "amc", "ac", "hvac", "compressor", "refrigerant"],
  "Real Estate": ["property", "listing", "rent", "tenant", "lease", "sqft", "bedroom", "mortgage"],
  Hospitality: ["booking", "reservation", "guest", "hotel", "room", "check_in", "checkout", "occupancy"],
  Telecom: ["subscriber", "plan", "data_usage", "call", "sms", "network", "roaming", "tower"],
};

export function detectDomain(
  columns: string[],
  rows: Record<string, unknown>[]
): { domain: string; confidence: number } {
  const allText = [
    ...columns.map((c) => c.toLowerCase()),
    ...rows
      .slice(0, 50)
      .flatMap((r) =>
        Object.values(r)
          .filter((v) => typeof v === "string")
          .map((v) => String(v).toLowerCase())
      ),
  ].join(" ");

  let bestDomain = "General Analytics";
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (allText.includes(kw)) score++;
    }
    const normalized = score / keywords.length;
    if (normalized > bestScore) {
      bestScore = normalized;
      bestDomain = domain;
    }
  }

  return {
    domain: bestScore > 0.15 ? bestDomain : "General Analytics",
    confidence: Math.min(bestScore * 3, 1),
  };
}

// ─── DATA CLEANING ────────────────────────────────────────────────

export function cleanData(
  rows: Record<string, unknown>[],
  columnMetas: ColumnMeta[]
): { cleanedRows: Record<string, unknown>[]; report: CleaningReport } {
  const actions: CleaningAction[] = [];
  let totalIssues = 0;
  let fixedIssues = 0;
  const qualityBefore = calculateRowQuality(rows, columnMetas);

  const cleaned = rows.map((row) => ({ ...row }));

  for (const meta of columnMetas) {
    // Fix missing values
    if (meta.nullCount > 0) {
      totalIssues += meta.nullCount;
      let fillValue: unknown = null;

      if (meta.semanticType === "identifier" || meta.type === "date") continue;
      if (meta.type === "number" && meta.mean !== undefined) {
        fillValue = Math.round(meta.mean * 100) / 100;
      } else if (meta.topValues && meta.topValues.length > 0) {
        fillValue = meta.topValues[0].value;
      }

      if (fillValue !== null) {
        let fixed = 0;
        for (const row of cleaned) {
          if (
            row[meta.name] === null ||
            row[meta.name] === undefined ||
            String(row[meta.name]).trim() === ""
          ) {
            row[meta.name] = fillValue;
            fixed++;
          }
        }
        fixedIssues += fixed;
        if (fixed > 0) {
          actions.push({
            column: meta.name,
            issue: "Missing values",
            action:
              meta.type === "number"
                ? `Filled with mean (${fillValue})`
                : `Filled with mode (${fillValue})`,
            affected: fixed,
          });
        }
      }
    }

    // Trim whitespace for string columns
    if (meta.type === "string") {
      let trimmed = 0;
      for (const row of cleaned) {
        const val = row[meta.name];
        if (typeof val === "string" && val !== val.trim()) {
          row[meta.name] = val.trim();
          trimmed++;
        }
      }
      if (trimmed > 0) {
        totalIssues += trimmed;
        fixedIssues += trimmed;
        actions.push({
          column: meta.name,
          issue: "Whitespace",
          action: "Trimmed leading/trailing whitespace",
          affected: trimmed,
        });
      }
    }

    // Fix number formatting
    if (meta.type === "number") {
      let formatted = 0;
      for (const row of cleaned) {
        const val = row[meta.name];
        if (typeof val === "string") {
          const num = parseNumeric(val);
          if (num !== null) {
            row[meta.name] = num;
            formatted++;
          }
        }
      }
      if (formatted > 0) {
        totalIssues += formatted;
        fixedIssues += formatted;
        actions.push({
          column: meta.name,
          issue: "Type mismatch",
          action: "Converted to numeric",
          affected: formatted,
        });
      }
    }
  }

  // Detect and mark duplicates
  const seen = new Set<string>();
  let dupCount = 0;
  const deduped: Record<string, unknown>[] = [];
  for (const row of cleaned) {
    const key = JSON.stringify(row);
    if (seen.has(key)) {
      dupCount++;
    } else {
      seen.add(key);
      deduped.push(row);
    }
  }
  if (dupCount > 0) {
    totalIssues += dupCount;
    fixedIssues += dupCount;
    actions.push({
      column: "ALL",
      issue: "Duplicate rows",
      action: "Removed exact duplicates",
      affected: dupCount,
    });
  }

  const qualityAfter = calculateRowQuality(deduped, columnMetas);

  return {
    cleanedRows: deduped,
    report: {
      totalIssues,
      fixedIssues,
      qualityBefore,
      qualityAfter,
      actions,
    },
  };
}

function calculateRowQuality(
  rows: Record<string, unknown>[],
  metas: ColumnMeta[]
): number {
  if (rows.length === 0 || metas.length === 0) return 0;
  const total = rows.length * metas.length;
  let filled = 0;
  for (const row of rows) {
    for (const m of metas) {
      if (
        row[m.name] !== null &&
        row[m.name] !== undefined &&
        String(row[m.name]).trim() !== ""
      )
        filled++;
    }
  }
  return Math.round((filled / total) * 100);
}

// ─── KPI GENERATION ───────────────────────────────────────────────

export function generateKPIs(
  rows: Record<string, unknown>[],
  profile: DataProfile,
  columnMetas: ColumnMeta[],
  domain: string
): KPI[] {
  const kpis: KPI[] = [];

  // Total records
  kpis.push({
    name: "Total Records",
    value: rows.length,
    icon: "database",
    color: "blue",
  });

  // Data quality
  kpis.push({
    name: "Data Quality",
    value: `${profile.qualityScore.toFixed(0)}%`,
    icon: "shield",
    color: profile.qualityScore >= 80 ? "green" : "amber",
  });

  // Generate numeric KPIs
  for (const col of profile.numericColumns.filter((col) => columnMetas.find((m) => m.name === col)?.semanticType !== "identifier").slice(0, 4)) {
    const meta = columnMetas.find((c) => c.name === col);
    if (!meta || meta.mean === undefined) continue;

    const values = rows
      .map((r) => parseNumeric(r[col]))
      .filter((n): n is number => n !== null);
    const total = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? total / values.length : 0;

    if (isRevenueField(col.toLowerCase())) {
      const revChange = computeChange(rows, profile.dateColumns, col, "sum");
      kpis.push({
        name: `Total ${formatColName(col)}`,
        value: total,
        icon: "dollar",
        color: "emerald",
        change: revChange.change,
        trend: revChange.trend,
      });
    }

    const avgChange = computeChange(rows, profile.dateColumns, col, "avg");
    kpis.push({
      name: `Avg ${formatColName(col)}`,
      value: Math.round(avg * 100) / 100,
      icon: "chart",
      color: "purple",
      change: avgChange.change,
      trend: avgChange.trend,
    });
  }

  // Categorical insights
  for (const col of profile.categoricalColumns.slice(0, 2)) {
    const meta = columnMetas.find((c) => c.name === col);
    if (!meta) continue;
    kpis.push({
      name: `Unique ${formatColName(col)}`,
      value: meta.uniqueCount,
      icon: "layers",
      color: "indigo",
    });
  }

  // Domain-specific KPIs
  if (domain === "AC Service" || domain === "Sales") {
    const statusCol = profile.statusColumns[0];
    if (statusCol) {
      const statuses = rows.map((r) => String(r[statusCol]));
      const completed = statuses.filter(
        (s) =>
          /complete|done|closed|resolved|success/i.test(s)
      ).length;
      kpis.push({
        name: "Completion Rate",
        value: `${((rows.length ? completed / rows.length : 0) * 100).toFixed(1)}%`,
        icon: "check",
        color: "green",
      });
    }
  }

  return kpis.slice(0, 8);
}

function formatColName(col: string): string {
  return col
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function computeChange(
  rows: Record<string, unknown>[],
  dateColumns: string[],
  column: string,
  aggFn: "sum" | "avg"
): { change?: number; trend?: "up" | "down" } {
  if (rows.length < 4 || !dateColumns.length) return {};

  let sorted = rows;
  if (dateColumns.length > 0) {
    const dateCol = dateColumns[0];
    sorted = [...rows].sort((a, b) => {
      const da = new Date(String(a[dateCol]));
      const db = new Date(String(b[dateCol]));
      return da.getTime() - db.getTime();
    });
  }

  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const calcVal = (data: Record<string, unknown>[]) => {
    const vals = data
      .map((r) => parseNumeric(r[column]))
      .filter((n): n is number => n !== null);
    if (vals.length === 0) return 0;
    if (aggFn === "sum") return vals.reduce((a, b) => a + b, 0);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const firstVal = calcVal(firstHalf);
  const secondVal = calcVal(secondHalf);

  if (firstVal === 0) return {};

  const change = Math.round(((secondVal - firstVal) / firstVal) * 1000) / 10;
  return { change, trend: change >= 0 ? "up" : "down" };
}

// ─── INSIGHT GENERATION ───────────────────────────────────────────

export function generateInsights(
  rows: Record<string, unknown>[], profile: DataProfile,
  columnMetas: ColumnMeta[], _domain: string
): Insight[] {
  // Confidence percentages are deliberately not displayed as measured accuracy.
  const insights: Insight[] = [];
  if (profile.completeness < 100) insights.push({
    title: "Missing cells", description: `${profile.completeness.toFixed(1)}% of cells are filled. Imputation can change results; compare raw and cleaned data.`,
    confidence: 0, impact: "high", type: "anomaly"
  });
  for (const meta of columnMetas.filter((m) => m.type === "number" && m.semanticType !== "identifier").slice(0, 4)) {
    const vals = rows.map((r) => parseNumeric(r[meta.name])).filter((v): v is number => v !== null);
    if (vals.length) insights.push({
      title: `${formatColName(meta.name)} summary`,
      description: `${vals.length} numeric values; total ${vals.reduce((a,b) => a+b,0).toLocaleString()}; mean ${(vals.reduce((a,b) => a+b,0)/vals.length).toFixed(2)}. Descriptive statistics, not a forecast.`,
      confidence: 0, impact: "low", type: "recommendation"
    });
  }
  return insights;
}

// ─── CHART RECOMMENDATIONS ───────────────────────────────────────

export interface ChartRecommendation {
  type: string;
  title: string;
  xKey?: string;
  yKey?: string;
  dataKey?: string;
  data: Record<string, unknown>[];
}

export function generateChartRecommendations(
  rows: Record<string, unknown>[],
  profile: DataProfile,
  columnMetas: ColumnMeta[]
): ChartRecommendation[] {
  const charts: ChartRecommendation[] = [];

  // Bar chart: top categorical by numeric
  if (profile.categoricalColumns.length > 0 && profile.numericColumns.length > 0) {
    const catCol = profile.categoricalColumns[0];
    const numCol = profile.revenueColumns.find((c) => profile.numericColumns.includes(c)) || profile.numericColumns.find((c) => columnMetas.find((m) => m.name === c)?.semanticType !== "identifier");
    if (!numCol) return charts;
    const groups = new Map<string, number>();
    for (const row of rows) {
      const key = String(row[catCol] ?? "Unknown");
      const val = parseNumeric(row[numCol]) ?? 0;
      groups.set(key, (groups.get(key) || 0) + val);
    }
    const sorted = Array.from(groups.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    charts.push({
      type: "bar",
      title: `${formatColName(numCol)} by ${formatColName(catCol)}`,
      xKey: catCol,
      yKey: numCol,
      data: sorted.map(([k, v]) => ({ [catCol]: k, [numCol]: Math.round(v * 100) / 100 })),
    });
  }

  // Pie chart: distribution of categorical
  if (profile.categoricalColumns.length > 0) {
    const catCol =
      profile.statusColumns[0] || profile.categoricalColumns[0];
    const meta = columnMetas.find((c) => c.name === catCol);
    if (meta && meta.topValues && meta.uniqueCount <= 15) {
      charts.push({
        type: "pie",
        title: `${formatColName(catCol)} Distribution`,
        dataKey: "count",
        data: meta.topValues.map((tv) => ({
          name: tv.value,
          count: tv.count,
        })),
      });
    }
  }

  // Line chart for time series
  if (profile.dateColumns.length > 0 && profile.numericColumns.length > 0) {
    const dateCol = profile.dateColumns[0];
    const numCol = profile.revenueColumns.find((c) => profile.numericColumns.includes(c)) || profile.numericColumns.find((c) => columnMetas.find((m) => m.name === c)?.semanticType !== "identifier");
    if (!numCol) return charts;

    const byMonth = new Map<string, number[]>();
    for (const row of rows) {
      const d = new Date(String(row[dateCol]));
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(parseNumeric(row[numCol]) ?? 0);
    }

    const sorted = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12);

    if (sorted.length > 2) {
      charts.push({
        type: "line",
        title: `${formatColName(numCol)} Monthly Total`,
        xKey: "month",
        yKey: numCol,
        data: sorted.map(([month, vals]) => ({
          month,
          [numCol]: Math.round(
            vals.reduce((a, b) => a + b, 0) * 100
          ) / 100,
        })),
      });
    }
  }

  // Area chart: cumulative numeric
  if (profile.numericColumns.length >= 2) {
    const measures = profile.numericColumns.filter((c) => columnMetas.find((m) => m.name === c)?.semanticType !== "identifier");
    if (measures.length < 2) return charts;
    const col1 = measures[0];
    const col2 = measures[1];
    const sampleRows = rows.slice(0, 20);
    charts.push({
      type: "area",
      title: `${formatColName(col1)} vs ${formatColName(col2)}`,
      xKey: "index",
      yKey: col1,
      data: sampleRows.map((r, i) => ({
        index: i + 1,
        [col1]: parseNumeric(r[col1]) ?? 0,
        [col2]: parseNumeric(r[col2]) ?? 0,
      })),
    });
  }

  // Scatter plot
  if (profile.numericColumns.length >= 2) {
    const measures = profile.numericColumns.filter((c) => columnMetas.find((m) => m.name === c)?.semanticType !== "identifier");
    if (measures.length < 2) return charts;
    const xCol = measures[0];
    const yCol = measures[1];
    charts.push({
      type: "scatter",
      title: `${formatColName(xCol)} vs ${formatColName(yCol)} Correlation`,
      xKey: xCol,
      yKey: yCol,
      data: rows.slice(0, 100).map((r) => ({
        [xCol]: parseNumeric(r[xCol]) ?? 0,
        [yCol]: parseNumeric(r[yCol]) ?? 0,
      })),
    });
  }

  return charts;
}

// ─── NATURAL LANGUAGE QUERY ───────────────────────────────────────

export type QueryPlan = {
  operation: "sum" | "average" | "median" | "min" | "max" | "count" | "top" | "distribution" | "trend";
  column?: string; groupBy?: string;
  filters?: { column: string; value: string }[];
};

export function executeQueryPlan(plan: QueryPlan, rows: Record<string, unknown>[], metas: ColumnMeta[]): { answer: string; chart?: ChartRecommendation } {
  const names = new Set(metas.map((m) => m.name));
  if ((plan.filters || []).some((f) => !names.has(f.column)) || (plan.groupBy && !names.has(plan.groupBy)))
    return { answer: "Unsupported column or filter. No calculation was run." };
  const selected = rows.filter((r) => (plan.filters || []).every((f) => String(r[f.column] ?? "").trim().toLowerCase() === f.value.trim().toLowerCase()));
  const scope = plan.filters?.length ? ` (${plan.filters.map((f) => `${f.column} = ${f.value}`).join(", ")})` : "";
  if (plan.operation === "count") return { answer: `${selected.length} records${scope}.` };
  if (!selected.length) return { answer: `No matching records${scope}.` };
  if (plan.operation === "distribution" && plan.groupBy) {
    const counts = new Map<string, number>();
    for (const row of selected) { const key = String(row[plan.groupBy] ?? "Missing"); counts.set(key, (counts.get(key) || 0) + 1); }
    return { answer: `${plan.groupBy} distribution${scope}:\n${[...counts].map(([k,v]) => `${k}: ${v}`).join("\n")}` };
  }
  const meta = metas.find((m) => m.name === plan.column && m.type === "number");
  if (!meta) return { answer: "Please name a numeric measure column. No calculation was run." };
  const vals = selected.map((r) => parseNumeric(r[meta.name])).filter((n): n is number => n !== null);
  if (!vals.length) return { answer: "No valid numeric values in the selected records." };
  if ((plan.operation === "top" || plan.operation === "trend") && plan.groupBy) {
    const groups = new Map<string, number>();
    for (const row of selected) {
      const number = parseNumeric(row[meta.name]); if (number === null) continue;
      let key = String(row[plan.groupBy] ?? "Missing");
      if (plan.operation === "trend") { if (!/^\d{4}-\d{2}-\d{2}/.test(key) || Number.isNaN(Date.parse(key))) continue; key = key.slice(0,7); }
      groups.set(key, (groups.get(key) || 0) + number);
    }
    const sorted = [...groups].sort(plan.operation === "top" ? (a,b) => b[1]-a[1] : (a,b) => a[0].localeCompare(b[0]));
    const data = (plan.operation === "top" ? sorted.slice(0,5) : sorted).map(([k,v]) => ({ [plan.groupBy!]: k, [meta.name]: v }));
    return { answer: `${plan.operation} ${meta.name} by ${plan.groupBy}${scope}:\n${data.map((r) => `${r[plan.groupBy!]}: ${Number(r[meta.name]).toLocaleString()}`).join("\n")}`,
      chart: { type: plan.operation === "top" ? "bar" : "line", title: `${meta.name} by ${plan.groupBy}`, xKey: plan.groupBy, yKey: meta.name, data } };
  }
  const sorted = [...vals].sort((a,b) => a-b), mid = Math.floor(vals.length/2);
  const result = plan.operation === "sum" ? vals.reduce((a,b)=>a+b,0) : plan.operation === "average" ? vals.reduce((a,b)=>a+b,0)/vals.length : plan.operation === "median" ? (vals.length%2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2) : plan.operation === "min" ? sorted[0] : plan.operation === "max" ? sorted.at(-1)! : null;
  if (result === null) return { answer: "This query needs a grouping column. No calculation was run." };
  return { answer: `The ${plan.operation} ${meta.name}${scope} is ${result.toLocaleString("en-US", { maximumFractionDigits: 6 })}.` };
}

export function processNLQuery(question: string, rows: Record<string, unknown>[], profile: DataProfile, metas: ColumnMeta[]): { answer: string; chart?: ChartRecommendation } {
  let q = question.toLowerCase().trim().replace(/[?!.]+$/, "");
  const filters: NonNullable<QueryPlan["filters"]> = [];
  // Exact equality clauses only. Never silently discard an unknown filter.
  const filter = q.match(/\s+(?:in|where|for)\s+(.+)$/);
  if (filter) {
    const text = filter[1].trim().replace(/^['"]|['"]$/g, "");
    const explicit = text.match(/^(.+?)\s*(?:=|is)\s*['"]?(.+?)['"]?$/);
    const candidates = explicit ? metas.filter((m) => m.name.toLowerCase() === explicit[1].trim()) : metas.filter((m) => rows.some((r) => String(r[m.name] ?? "").trim().toLowerCase() === text));
    if (candidates.length !== 1) return { answer: "I could not resolve that filter uniquely. Use where column = value. No calculation was run." };
    filters.push({ column: candidates[0].name, value: explicit ? explicit[2] : text }); q = q.slice(0, filter.index).trim();
  }
  if (/\b(and|or|excluding|between|greater|less|above|below|last|before|after)\b/.test(q)) return { answer: "That condition is not supported by the local parser. No calculation was run." };
  const mentions = metas.filter((m) => q.includes(m.name.toLowerCase()) || q.includes(m.name.toLowerCase().replace(/[_-]/g," ")));
  const numeric = mentions.filter((m) => m.type === "number");
  const candidates = metas.filter((m) => m.type === "number" && m.semanticType !== "identifier");
  const column = numeric.length === 1 ? numeric[0].name : numeric.length === 0 && candidates.length === 1 ? candidates[0].name : undefined;
  const groups = mentions.filter((m) => m.type !== "number");
  let operation: QueryPlan["operation"] | undefined;
  if (/\b(how many|count|number of records|total records)\b/.test(q)) operation = "count";
  else if (/\b(top|best|highest)\b/.test(q)) operation = "top";
  else if (/\b(trend|monthly|over time)\b/.test(q)) operation = "trend";
  else if (/\b(distribution|breakdown)\b/.test(q)) operation = "distribution";
  else if (/\b(median)\b/.test(q)) operation = "median";
  else if (/\b(average|avg|mean)\b/.test(q)) operation = "average";
  else if (/\b(total|sum)\b/.test(q)) operation = "sum";
  else if (/\b(minimum|min)\b/.test(q)) operation = "min";
  else if (/\b(maximum|max)\b/.test(q)) operation = "max";
  if (!operation) return { answer: "Local queries support count, sum, average, median, min/max, top, distribution and monthly totals with one exact-equality filter. Name the measure and group columns. No calculation was run." };
  const groupBy = operation === "trend" ? (groups.find((m) => m.type === "date")?.name || (profile.dateColumns.length === 1 ? profile.dateColumns[0] : undefined)) : groups.length === 1 ? groups[0].name : undefined;
  return executeQueryPlan({ operation, column, groupBy, filters }, rows, metas);
                                                                 }
