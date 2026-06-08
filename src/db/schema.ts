import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  json,
  int,
  float,
  boolean,
} from "drizzle-orm/mysql-core";

export const datasets = mysqlTable("datasets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  rowCount: int("row_count").default(0),
  columnCount: int("column_count").default(0),
  sizeBytes: int("size_bytes").default(0),
  domain: text("domain"),
  domainConfidence: float("domain_confidence"),
  status: text("status").default("uploaded"),
  columns: json("columns").$type<ColumnMeta[]>(),
  profile: json("profile").$type<DataProfile>(),
  rawData: json("raw_data").$type<Record<string, unknown>[]>(),
  cleanedData: json("cleaned_data").$type<Record<string, unknown>[]>(),
  cleaningReport: json("cleaning_report").$type<CleaningReport>(),
  kpis: json("kpis").$type<KPI[]>(),
  insights: json("insights").$type<Insight[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dashboards = mysqlTable("dashboards", {
  id: varchar("id", { length: 36 }).primaryKey(),
  datasetId: varchar("dataset_id", { length: 36 }),
  name: text("name").notNull(),
  description: text("description"),
  widgets: json("widgets").$type<DashboardWidget[]>(),
  layout: json("layout"),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const queries = mysqlTable("queries", {
  id: varchar("id", { length: 36 }).primaryKey(),
  datasetId: varchar("dataset_id", { length: 36 }),
  question: text("question").notNull(),
  answer: text("answer"),
  chartConfig: json("chart_config"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Types
export interface ColumnMeta {
  name: string;
  type: string;
  semanticType?: string;
  nullCount: number;
  nullPercent: number;
  uniqueCount: number;
  uniquePercent: number;
  duplicatePercent: number;
  min?: string | number;
  max?: string | number;
  mean?: number;
  median?: number;
  stdDev?: number;
  topValues?: { value: string; count: number }[];
  isKey?: boolean;
  keyType?: string;
  sample?: string[];
}

export interface DataProfile {
  totalRows: number;
  totalColumns: number;
  completeness: number;
  consistency: number;
  uniqueness: number;
  qualityScore: number;
  dateColumns: string[];
  numericColumns: string[];
  categoricalColumns: string[];
  currencyColumns: string[];
  locationColumns: string[];
  customerColumns: string[];
  productColumns: string[];
  revenueColumns: string[];
  statusColumns: string[];
  relationships: Relationship[];
}

export interface Relationship {
  from: string;
  to: string;
  type: string;
  confidence: number;
}

export interface CleaningReport {
  totalIssues: number;
  fixedIssues: number;
  qualityBefore: number;
  qualityAfter: number;
  actions: CleaningAction[];
}

export interface CleaningAction {
  column: string;
  issue: string;
  action: string;
  affected: number;
}

export interface KPI {
  name: string;
  value: string | number;
  change?: number;
  trend?: string;
  icon?: string;
  color?: string;
}

export interface Insight {
  title: string;
  description: string;
  confidence: number;
  impact: "high" | "medium" | "low";
  type: "trend" | "anomaly" | "recommendation" | "correlation";
  action?: string;
}

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  x: number;
  y: number;
  w: number;
  h: number;
}
