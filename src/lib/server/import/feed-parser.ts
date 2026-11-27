import { XMLParser } from "fast-xml-parser";
import ExcelJS from "exceljs";

export type RawFeedItem = Record<string, unknown>;

export type ParsedFeedResult = {
  format: "YML" | "XML" | "CSV" | "XLSX";
  rows: RawFeedItem[];
  rawRowCount: number;
};

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

/** Detect format from file name and buffer contents */
export function detectFormat(fileName: string, buffer: Buffer): "YML" | "XML" | "CSV" | "XLSX" {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "yml") return "YML";
  if (ext === "xml") return "XML";
  if (ext === "xlsx" || ext === "xls") return "XLSX";
  if (ext === "csv") return "CSV";

  // Check magic bytes / content
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return "XLSX"; // Zip PK magic bytes
  }

  const sample = buffer.slice(0, 1000).toString("utf8").trim();
  if (sample.startsWith("<?xml") || sample.includes("<yml_catalog")) {
    return sample.includes("<yml_catalog") ? "YML" : "XML";
  }

  return "CSV";
}

/** Safe, streaming CSV parser supporting ;, ,, \t and quotes */
export function parseCsv(buffer: Buffer): RawFeedItem[] {
  let text: string;
  try {
    text = buffer.toString("utf8");
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }
  } catch {
    text = buffer.toString("latin1");
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const countSemi = (firstLine.match(/;/g) || []).length;
  const countComma = (firstLine.match(/,/g) || []).length;
  const countTab = (firstLine.match(/\t/g) || []).length;

  let delimiter = ",";
  if (countSemi > countComma && countSemi > countTab) delimiter = ";";
  else if (countTab > countComma && countTab > countSemi) delimiter = "\t";

  function splitLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());
  const rows: RawFeedItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i]);
    const row: RawFeedItem = {};
    let hasAnyValue = false;
    headers.forEach((header, idx) => {
      if (header) {
        const val = values[idx] ? values[idx].replace(/^["']|["']$/g, "").trim() : "";
        if (val) hasAnyValue = true;
        row[header] = val;
      }
    });
    if (hasAnyValue) {
      rows.push(row);
    }
  }

  return rows;
}

/** Safe XML/YML parser with XXE & external DTD strictly disabled */
export function parseXmlOrYml(buffer: Buffer): RawFeedItem[] {
  const xmlContent = buffer.toString("utf8");

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    parseTagValue: true,
    processEntities: false,
  });

  const parsed = parser.parse(xmlContent);
  if (!parsed || typeof parsed !== "object") return [];

  if (parsed.yml_catalog?.shop?.offers?.offer) {
    const rawOffers = parsed.yml_catalog.shop.offers.offer;
    return Array.isArray(rawOffers) ? rawOffers : [rawOffers];
  }

  const root = parsed.items || parsed.parts || parsed.offers || parsed.catalog || parsed;
  const items = root.item || root.part || root.offer || root.product;

  if (items) {
    return Array.isArray(items) ? items : [items];
  }

  if (Array.isArray(root)) return root;

  for (const key of Object.keys(parsed)) {
    const val = parsed[key];
    if (val && typeof val === "object") {
      for (const subKey of Object.keys(val)) {
        if (Array.isArray(val[subKey])) {
          return val[subKey];
        }
      }
    }
  }

  return [];
}

function extractSafeCellValue(raw: ExcelJS.CellValue): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (raw instanceof Date) return raw.toISOString();

  if (typeof raw === "object") {
    // RichText cell
    if ("richText" in raw && Array.isArray(raw.richText)) {
      return raw.richText
        .map((part) => (typeof part.text === "string" ? part.text : ""))
        .join("")
        .trim();
    }
    // Hyperlink cell
    if ("text" in raw && typeof raw.text === "string") {
      return raw.text.trim();
    }
    // Formula cell: read cached scalar result only; never evaluate formulas
    if ("result" in raw && raw.result !== undefined && raw.result !== null) {
      if (typeof raw.result === "object" && "error" in raw.result) {
        return "";
      }
      return String(raw.result).trim();
    }
  }

  return "";
}

/** Safe XLSX parser using ExcelJS (no macro or formula evaluation, full Cyrillic UTF-8 support) */
export async function parseXlsx(buffer: Buffer): Promise<RawFeedItem[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0]);

  const worksheet = workbook.worksheets.find((ws) => ws.rowCount > 0) ?? workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount === 0) return [];

  let headers: string[] | null = null;
  const rows: RawFeedItem[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const colCount = Math.max(row.cellCount, headers?.length || 0);
    const values: string[] = [];
    for (let colIdx = 1; colIdx <= colCount; colIdx++) {
      values.push(extractSafeCellValue(row.getCell(colIdx).value));
    }

    if (!headers) {
      // First non-empty row becomes normalized lowercase headers
      const hasHeaderText = values.some((v) => v.length > 0);
      if (hasHeaderText) {
        headers = values.map((v) => v.trim().toLowerCase());
      }
      return;
    }

    const item: RawFeedItem = {};
    let hasValue = false;
    headers.forEach((headerKey, idx) => {
      if (!headerKey) return;
      const cellStr = values[idx] ?? "";
      if (cellStr !== "") hasValue = true;
      item[headerKey] = cellStr;
    });

    if (hasValue) {
      rows.push(item);
    }
  });

  return rows;
}

/** Unified feed entry point */
export async function parseFeedBuffer(
  fileName: string,
  buffer: Buffer,
  forcedFormat?: "YML" | "XML" | "CSV" | "XLSX"
): Promise<ParsedFeedResult> {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Размер файла превышает лимит ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} МБ`);
  }

  const format = forcedFormat || detectFormat(fileName, buffer);
  let rows: RawFeedItem[] = [];

  switch (format) {
    case "YML":
    case "XML":
      rows = parseXmlOrYml(buffer);
      break;
    case "CSV":
      rows = parseCsv(buffer);
      break;
    case "XLSX":
      rows = await parseXlsx(buffer);
      break;
    default:
      rows = parseCsv(buffer);
  }

  return {
    format,
    rows,
    rawRowCount: rows.length,
  };
}
