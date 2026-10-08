import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import Papa from "papaparse";

export async function GET() {
  try {
    const allDatasets = await db
      .select({
        id: datasets.id,
        name: datasets.name,
        fileName: datasets.fileName,
        fileType: datasets.fileType,
        rowCount: datasets.rowCount,
        columnCount: datasets.columnCount,
        domain: datasets.domain,
        domainConfidence: datasets.domainConfidence,
        status: datasets.status,
        createdAt: datasets.createdAt,
      })
      .from(datasets)
      .orderBy(desc(datasets.createdAt));
    return NextResponse.json(allDatasets);
  } catch {
    return NextResponse.json({ error: "Failed to fetch datasets" }, { status: 500 });
  }
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_ANALYZED_ROWS = 100000; // Excel pivot-level: 100K rows typical analyst limit

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max size is 50MB.` },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "File is empty" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    const fileName = file.name;
    const fileType = fileName.split(".").pop()?.toLowerCase() || "csv";

    let rows: Record<string, unknown>[] = [];
    let columns: string[] = [];

    if (fileType === "csv" || fileType === "tsv" || fileType === "txt") {
      const delimiter = fileType === "tsv" ? "\t" : ",";
      const result = Papa.parse(text, {
        header: true,
        dynamicTyping: false,
        skipEmptyLines: true,
        delimiter,
      });
      rows = result.data as Record<string, unknown>[];
      columns = result.meta.fields || [];
    } else if (fileType === "json") {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        rows = parsed;
        columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      } else if (parsed.data && Array.isArray(parsed.data)) {
        rows = parsed.data;
        columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      }
    } else if (fileType === "xlsx") {
      const { Workbook } = await import("exceljs");
      const workbook = new Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) return NextResponse.json({ error: "No worksheet found" }, { status: 400 });
      sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, index) => { columns[index-1] = String(cell.text || `column_${index}`); });
      if (new Set(columns).size !== columns.length) return NextResponse.json({ error: "Duplicate column headers" }, { status: 400 });
      sheet.eachRow((row, index) => {
        if (index === 1) return;
        const record: Record<string, unknown> = {};
        columns.forEach((name, i) => { const cell = row.getCell(i+1); const val = cell.value; record[name] = val instanceof Date ? val.toISOString() : typeof val === "object" && val !== null ? ("result" in val ? val.result : cell.text) : val; });
        rows.push(record);
      });
    } else if (fileType === "xls") {
      return NextResponse.json({ error: "Legacy .xls disabled because its previous parser is vulnerable. Save as .xlsx or CSV." }, { status: 400 });
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${fileType}` },
        { status: 400 }
      );
    }

    if (rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))) return NextResponse.json({ error: "Rows must be JSON objects" }, { status: 400 });
    columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    if (columns.some((c) => ["__proto__", "prototype", "constructor"].includes(c))) return NextResponse.json({ error: "Unsupported column name" }, { status: 400 });
    if (rows.length === 0) {
      return NextResponse.json({ error: "No data found in file" }, { status: 400 });
    }

    // Enforce row limit — protect memory & performance
    const rowsTruncated = rows.length > MAX_ANALYZED_ROWS;
    const storedRows = rows.slice(0, MAX_ANALYZED_ROWS);

    // Import analytics engine
    const {
      profileData,
      detectDomain,
      cleanData,
      generateKPIs,
      generateInsights,
    } = await import("@/lib/analytics-engine");

    // Profile data
    const { columnMetas: rawMetas } = profileData(storedRows, columns);

    // Detect domain
    const { domain, confidence } = detectDomain(columns, storedRows);

    // Clean data
    const { cleanedRows, report } = cleanData(storedRows, rawMetas);

    // Generate KPIs
    const { columnMetas, profile } = profileData(cleanedRows, columns);
    const kpis = generateKPIs(cleanedRows, profile, columnMetas, domain);

    // Generate insights
    const insights = generateInsights(cleanedRows, profile, columnMetas, domain);

    // Save to database
    const datasetId = uuidv4();
    await db.insert(datasets).values({
      id: datasetId,
      name: fileName.replace(/\.[^.]+$/, ""),
      fileName,
      fileType,
      rowCount: rows.length,
      columnCount: columns.length,
      sizeBytes: buffer.byteLength,
      domain,
      domainConfidence: confidence,
      status: "analyzed",
      columns: columnMetas,
      profile,
      rawData: storedRows,
      cleanedData: cleanedRows,
      cleaningReport: report,
      kpis,
      insights,
    });

    return NextResponse.json({
      id: datasetId,
      name: fileName.replace(/\.[^.]+$/, ""),
      rowCount: rows.length,
      columnCount: columns.length,
      domain,
      domainConfidence: confidence,
      status: "analyzed",
      limitInfo: {
        maxRows: MAX_ANALYZED_ROWS,
        totalRows: rows.length,
        analyzedRows: storedRows.length,
        truncated: rowsTruncated,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 }
    );
  }
}

