import { NextResponse } from "next/server";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { v4 as uuidv4 } from "uuid";
import {
  profileData,
  detectDomain,
  cleanData,
  generateKPIs,
  generateInsights,
} from "@/lib/analytics-engine";

function generateSampleData(): {
  rows: Record<string, unknown>[];
  columns: string[];
  name: string;
} {
  const regions = ["North", "South", "East", "West", "Central"];
  const products = ["Widget A", "Widget B", "Gadget X", "Gadget Y", "Module Z", "Component K"];
  const salesReps = ["Alice Johnson", "Bob Smith", "Carol Williams", "David Brown", "Eve Davis", "Frank Miller"];
  const statuses = ["Completed", "Pending", "In Progress", "Cancelled"];
  const channels = ["Online", "Retail", "Wholesale", "Direct"];

  const rows: Record<string, unknown>[] = [];

  for (let i = 0; i < 500; i++) {
    const date = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    const quantity = Math.floor(Math.random() * 50) + 1;
    const unitPrice = Math.round((Math.random() * 200 + 10) * 100) / 100;
    const revenue = Math.round(quantity * unitPrice * 100) / 100;
    const cost = Math.round(revenue * (0.4 + Math.random() * 0.3) * 100) / 100;

    rows.push({
      order_id: `ORD-${String(i + 1001).padStart(5, "0")}`,
      date: date.toISOString().split("T")[0],
      product: products[Math.floor(Math.random() * products.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      sales_rep: salesReps[Math.floor(Math.random() * salesReps.length)],
      channel: channels[Math.floor(Math.random() * channels.length)],
      quantity,
      unit_price: unitPrice,
      revenue,
      cost,
      profit: Math.round((revenue - cost) * 100) / 100,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      customer_rating: Math.round((Math.random() * 2 + 3) * 10) / 10,
    });
  }

  const columns = [
    "order_id", "date", "product", "region", "sales_rep", "channel",
    "quantity", "unit_price", "revenue", "cost", "profit", "status", "customer_rating",
  ];

  return { rows, columns, name: "Sample Sales Data" };
}

export async function POST() {
  try {
    const { rows, columns, name } = generateSampleData();

    const { columnMetas: rawMetas } = profileData(rows, columns);
    const { domain, confidence } = detectDomain(columns, rows);
    const { cleanedRows, report } = cleanData(rows, rawMetas);
    const { columnMetas, profile } = profileData(cleanedRows, columns);
    const kpis = generateKPIs(cleanedRows, profile, columnMetas, domain);
    const insights = generateInsights(cleanedRows, profile, columnMetas, domain);

    const datasetId = uuidv4();
    await db.insert(datasets).values({
      id: datasetId,
      name,
      fileName: "sample_sales_data.csv",
      fileType: "csv",
      rowCount: rows.length,
      columnCount: columns.length,
      sizeBytes: JSON.stringify(rows).length,
      domain,
      domainConfidence: confidence,
      status: "analyzed",
      columns: columnMetas,
      profile,
      rawData: rows,
      cleanedData: cleanedRows,
      cleaningReport: report,
      kpis,
      insights,
    });

    return NextResponse.json({
      id: datasetId,
      name,
      rowCount: rows.length,
      columnCount: columns.length,
      domain,
    });
  } catch (error) {
    console.error("Sample generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate sample data" },
      { status: 500 }
    );
  }
}
