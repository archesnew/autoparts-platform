import { XMLParser } from "fast-xml-parser";
import * as XLSX from "xlsx";

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
  // Decode UTF-8 or CP1251 (basic detection)
  let text: string;
  try {
    text = buffer.toString("utf8");
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1); // strip BOM
    }
  } catch {
    text = buffer.toString("latin1");
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Detect delimiter from first line
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
    // Security: do NOT resolve entities or external DTDs
    processEntities: false,
  });

  const parsed = parser.parse(xmlContent);
  if (!parsed || typeof parsed !== "object") return [];

  // YML standard: yml_catalog -> shop -> offers -> offer
  if (parsed.yml_catalog?.shop?.offers?.offer) {
    const rawOffers = parsed.yml_catalog.shop.offers.offer;
    return Array.isArray(rawOffers) ? rawOffers : [rawOffers];
  }

  // Avito / Drom / Standard feeds: items -> item, parts -> part, offers -> offer
  const root = parsed.items || parsed.parts || parsed.offers || parsed.catalog || parsed;
  const items = root.item || root.part || root.offer || root.product;

  if (items) {
    return Array.isArray(items) ? items : [items];
  }

  // If root is an array of objects
  if (Array.isArray(root)) return root;

  // Search first array in root
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

/** Safe XLSX parser without macro or formula evaluation */
export function parseXlsx(buffer: Buffer): RawFeedItem[] {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellFormula: false,
    cellHTML: false,
    dense: false,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<RawFeedItem>(worksheet, {
    defval: "",
    raw: false,
  });

  // Lowercase keys
  return rows.map((row) => {
    const normalized: RawFeedItem = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[k.trim().toLowerCase()] = typeof v === "string" ? v.trim() : v;
    }
    return normalized;
  });
}

/** Unified feed entry point */
export function parseFeedBuffer(
  fileName: string,
  buffer: Buffer,
  forcedFormat?: "YML" | "XML" | "CSV" | "XLSX"
): ParsedFeedResult {
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
      rows = parseXlsx(buffer);
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
