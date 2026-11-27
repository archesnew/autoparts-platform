/**
 * Builds local versioned snapshots in data/vehicle-snapshots/ from:
 *   1. VehiclesDB (https://github.com/vehiclesdb/vehiclesdb, CC BY 4.0)
 *   2. MeterApp Vehicle DB (https://github.com/MeterApp/vehicle-db, ISC + open public sources)
 *
 * Strictly excludes motorcycles, mopeds, buses, auto-rickshaws, and heavy-duty commercial trucks/cranes.
 * Preserves year semantics (MODEL_YEAR / PRODUCTION_YEAR / REGISTRATION_YEAR / CATALOG_YEAR) and provenance.
 *
 * Run: node scripts/build-vehicle-snapshots.mjs
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const SCRATCH =
  "C:\\Users\\Chessie\\.gemini\\antigravity\\brain\\406883d0-c503-4651-ad14-68931a440aa6\\scratch\\vdb_audit";
const OUT_DIR = join(process.cwd(), "data", "vehicle-snapshots");
mkdirSync(OUT_DIR, { recursive: true });

async function getSourceFile(localName, remoteUrl) {
  const localPath = join(SCRATCH, localName);
  if (existsSync(localPath)) {
    return readFileSync(localPath, "utf8");
  }
  console.log(`Downloading ${remoteUrl}...`);
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`Failed ${remoteUrl}: ${res.status}`);
  return await res.text();
}

// Year semantics classification per MeterApp source_id
const METERAPP_YEAR_SEMANTICS = {
  "nhtsa-vpic": "MODEL_YEAR",
  "fueleconomy-us": "MODEL_YEAR",
  "fueleconomy-maserati-us": "MODEL_YEAR",
  "hyundai-brazil-catalog": "MODEL_YEAR",
  "manufacturer-reviewed": "MODEL_YEAR",
  "changan-manufacturer-model-years": "MODEL_YEAR",
  "sgmw-manufacturer-model-years": "MODEL_YEAR",
  "uk-dft-vehicle-licensing": "PRODUCTION_YEAR",
  "senatran-br-renavam": "PRODUCTION_YEAR",
  "rdw-nl-vehicle-register": "REGISTRATION_YEAR",
  "eea-co2-monitoring": "REGISTRATION_YEAR",
  "nzta-asia-pacific-mvr": "REGISTRATION_YEAR",
  "malaysia-jpj-registrations": "REGISTRATION_YEAR",
  "manufacturer-reviewed-catalog": "CATALOG_YEAR",
  "changan-manufacturer-catalog": "CATALOG_YEAR",
  "sgmw-manufacturer-catalog": "CATALOG_YEAR",
  "india-passenger-sales-catalog": "CATALOG_YEAR",
  "india-commercial-sales-catalog": "CATALOG_YEAR",
};

const SEMANTIC_PRIORITY = [
  "MODEL_YEAR",
  "PRODUCTION_YEAR",
  "REGISTRATION_YEAR",
  "CATALOG_YEAR",
];

// Heavy truck / bus / crane / defense / coachbuilder makes to exclude from Passenger & LCV catalog
const HEAVY_ONLY_MAKE_PATTERNS = [
  /freightliner/i, /kenworth/i, /peterbilt/i, /western star/i, /international/i,
  /navistar/i, /sterling truck/i, /oshkosh/i, /liebherr/i, /grove/i, /terex/i,
  /pierce/i, /spartan/i, /e-one/i, /blue bird/i, /thomas built/i, /new flyer/i,
  /gillig/i, /prevost/i, /motor coach/i, /scania/i, /ashok leyland/i, /eicher/i,
  /bharatbenz/i, /shaolin bus/i, /lion electric/i, /kamaz/i, /ural/i, /maz\b/i,
  /belaz/i, /kraz/i, /volvo truck/i, /mack/i, /hino/i, /fuso truck/i, /ud trucks/i,
  /alexander dennis/i, /optare/i, /wrightbus/i, /van hool/i, /setra/i, /neoplan/i,
  /irizar/i, /solaris bus/i, /giottiline/i, /sun living/i, /westfalia/i, /sunlight/i,
  /adria mobil/i, /knaus/i, /burstner/i, /hymer/i, /dethleffs/i, /trigano/i,
  /collins/i, /utilimaster/i, /frontline/i, /marcopolo/i, /caio/i,
];

const HEAVY_MODEL_KEYWORDS = [
  /tractor/i, /chassis\s*cab/i, /cab-chassis/i, /dump\b/i, /pumper/i, /crane/i,
  /refuse/i, /ambulance/i, /airport/i, /concrete/i, /heavy/i, /school\s*bus/i,
  /motor\s*home/i, /motorhome/i, /bus\b/i, /coach/i, /low\s*coe/i, /high\s*coe/i,
  /box\s*truck/i, /step\s*van\s*chassis/i, /semi/i, /trailer/i,
];

function cleanSlug(str) {
  return str
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "-and-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCaseMake(name) {
  const KEEP_UPPER = new Set([
    "BMW", "BYD", "GAZ", "UAZ", "ZAZ", "GMC", "RAM", "MG", "JAC", "BAIC", "FAW",
    "GAC", "SAIC", "DS", "TVR", "LDV", "MAN", "NIO", "SWM", "KYC", "VAZ",
  ]);
  const SPECIAL = {
    "MERCEDES-BENZ": "Mercedes-Benz",
    "MERCEDES BENZ": "Mercedes-Benz",
    "ALFA ROMEO": "Alfa Romeo",
    "ASTON MARTIN": "Aston Martin",
    "LAND ROVER": "Land Rover",
    "RANGE ROVER": "Land Rover",
    "ROLLS-ROYCE": "Rolls-Royce",
    "ROLLS ROYCE": "Rolls-Royce",
    "LI AUTO": "Li Auto",
    "GREAT WALL": "Great Wall",
    "LYNK & CO": "Lynk & Co",
    "ŠKODA": "Skoda",
    "SKODA": "Skoda",
    "VW": "Volkswagen",
    "LADA-VAZ": "Lada",
    "AVTOVAZ": "Lada",
  };
  const up = name.trim().toUpperCase();
  if (SPECIAL[up]) return SPECIAL[up];
  if (KEEP_UPPER.has(up)) return up;
  return name
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-\/])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

function isCleanModelName(name) {
  if (!name || name.length < 1 || name.length > 48) return false;
  if (/^\([^)]*\)$/.test(name)) return false; // e.g. "( ALFA ROMEO 155 )"
  if (name.includes("/") && name.length > 20) return false;
  // Filter excessive multi-word trim sentences (>5 spaces usually indicates noisy registration row)
  if ((name.match(/\s+/g) || []).length > 4) return false;
  if (HEAVY_MODEL_KEYWORDS.some((rx) => rx.test(name))) return false;
  return true;
}

async function main() {
  console.log("Loading upstream JSON snapshots...");
  const [carMakesRaw, carModelsRaw, vanMakesRaw, vanModelsRaw, meterRaw, vdbAttrib, meterReadme] =
    await Promise.all([
      getSourceFile("vdb-car-makes.json", "https://raw.githubusercontent.com/vehiclesdb/vehiclesdb/main/catalog/car/makes.json"),
      getSourceFile("vdb-car-models.json", "https://raw.githubusercontent.com/vehiclesdb/vehiclesdb/main/catalog/car/models.json"),
      getSourceFile("vdb-van-makes.json", "https://raw.githubusercontent.com/vehiclesdb/vehiclesdb/main/catalog/van/makes.json"),
      getSourceFile("vdb-van-models.json", "https://raw.githubusercontent.com/vehiclesdb/vehiclesdb/main/catalog/van/models.json"),
      getSourceFile("meterapp-compact.json", "https://raw.githubusercontent.com/MeterApp/vehicle-db/main/data/compact.json"),
      getSourceFile("vdb-ATTRIBUTION.md", "https://raw.githubusercontent.com/vehiclesdb/vehiclesdb/main/ATTRIBUTION.md"),
      getSourceFile("meter-README.md", "https://raw.githubusercontent.com/MeterApp/vehicle-db/main/README.md"),
    ]);

  const carMakes = JSON.parse(carMakesRaw);
  const carModels = JSON.parse(carModelsRaw);
  const vanMakes = JSON.parse(vanMakesRaw);
  const vanModels = JSON.parse(vanModelsRaw);
  const meter = JSON.parse(meterRaw);

  // 1. VehiclesDB compact snapshot (car + van only, excluding moto/moped/truck/bus)
  const vdbMakesMap = new Map();
  for (const m of carMakes) {
    vdbMakesMap.set(m.id, {
      id: m.id,
      name: m.name === "Škoda" ? "Skoda" : m.name,
      nativeName: m.name,
      kinds: ["car"],
      countries: m.countries || [],
      popularity: m.popularity || null,
    });
  }
  for (const m of vanMakes) {
    if (HEAVY_ONLY_MAKE_PATTERNS.some((rx) => rx.test(m.name))) continue;
    const existing = vdbMakesMap.get(m.id);
    if (existing) {
      if (!existing.kinds.includes("van")) existing.kinds.push("van");
    } else {
      vdbMakesMap.set(m.id, {
        id: m.id,
        name: m.name === "Škoda" ? "Skoda" : m.name,
        nativeName: m.name,
        kinds: ["van"],
        countries: m.countries || [],
        popularity: m.popularity || null,
      });
    }
  }

  const vdbModelsClean = [];
  const pushVdbModels = (list, kind) => {
    for (const m of list) {
      if (!vdbMakesMap.has(m.make_id)) continue;
      vdbModelsClean.push({
        id: m.id,
        makeId: m.make_id,
        slug: m.slug,
        name: m.name,
        kind,
        bodyTypes: m.body_types || [],
        regions: m.regions || [],
        countries: m.countries || [],
        yearFrom: m.registration_years?.first ?? null,
        yearTo: m.registration_years?.last ?? null,
        yearSemantics: m.registration_years ? "REGISTRATION_YEAR" : null,
        popularityDecile: m.popularity?.mass_decile ?? m.popularity?.global_decile ?? null,
        uaDecile: m.popularity?.by_country?.ua?.decile ?? null,
        formerIds: m.former_ids || [],
        sources: m.sources || [],
      });
    }
  };
  pushVdbModels(carModels, "car");
  pushVdbModels(vanModels, "van");

  const vdbSnapshot = {
    source: "vehiclesdb/vehiclesdb",
    version: "2026.11.4",
    license: "CC-BY-4.0",
    attribution: "Vehicle data by VehiclesDB (https://vehiclesdb.com), CC BY 4.0",
    generatedAt: new Date().toISOString(),
    makes: [...vdbMakesMap.values()],
    models: vdbModelsClean,
  };
  writeFileSync(join(OUT_DIR, "vehiclesdb-snapshot.json"), JSON.stringify(vdbSnapshot));
  console.log(`Saved vehiclesdb-snapshot.json: ${vdbSnapshot.makes.length} makes, ${vdbSnapshot.models.length} models`);

  // 2. MeterApp compact snapshot (Passenger Car=2, MPV=7, plus light commercial vans/pickups from clean makes)
  const makeById = new Map(meter.makes.map((m) => [m.make_id, m.make_name]));
  const aggregated = new Map(); // key: cleanMakeSlug|cleanModelSlug

  const sourceList = meter.sources;
  for (const row of meter.models) {
    const [year, makeId, _modelId, nameIdx, typeId, sourceMask] = row;
    // Allowed types: 2 (Passenger Car), 7 (MPV), and 3 (Truck/LCV strictly filtered)
    if (typeId !== 2 && typeId !== 7 && typeId !== 3) continue;

    const rawMakeName = makeById.get(makeId);
    const rawModelName = meter.modelNames[nameIdx];
    if (!rawMakeName || !rawModelName) continue;
    if (HEAVY_ONLY_MAKE_PATTERNS.some((rx) => rx.test(rawMakeName))) continue;
    if (!isCleanModelName(rawModelName)) continue;

    const cleanMakeName = titleCaseMake(rawMakeName);
    const makeSlug = cleanSlug(cleanMakeName);
    if (!makeSlug || makeSlug.length < 2) continue;

    // For typeId 3 (Truck/LCV), only include if the make is an already-known car/van brand or passenger/LCV name
    if (typeId === 3 && !vdbMakesMap.has(makeSlug) && !["gaz", "uaz", "ram", "gmc", "ford", "chevrolet", "toyota", "nissan", "isuzu", "iveco"].includes(makeSlug)) {
      continue;
    }

    const modelSlug = cleanSlug(rawModelName);
    if (!modelSlug) continue;

    // Decode bitmask sources
    const rowSources = [];
    for (let i = 0; i < sourceList.length; i++) {
      if ((sourceMask & (2 ** i)) !== 0) {
        rowSources.push(sourceList[i].source_id);
      }
    }

    const key = `${makeSlug}|${modelSlug}`;
    let entry = aggregated.get(key);
    if (!entry) {
      entry = {
        makeSlug,
        makeName: cleanMakeName,
        modelSlug,
        modelName: rawModelName.trim(),
        category: typeId === 3 ? "LCV" : typeId === 7 ? "CAR" : "CAR",
        yearFrom: year,
        yearTo: year,
        sources: new Set(rowSources),
      };
      aggregated.set(key, entry);
    } else {
      if (year < entry.yearFrom) entry.yearFrom = year;
      if (year > entry.yearTo) entry.yearTo = year;
      for (const s of rowSources) entry.sources.add(s);
    }
  }

  const meterModelsClean = [];
  const meterMakesClean = new Map();
  for (const e of aggregated.values()) {
    const srcArr = [...e.sources];
    const semanticsSet = new Set(
      srcArr.map((s) => METERAPP_YEAR_SEMANTICS[s]).filter(Boolean)
    );
    let yearSemantics = "MIXED";
    if (semanticsSet.size === 1) {
      yearSemantics = [...semanticsSet][0];
    } else {
      for (const p of SEMANTIC_PRIORITY) {
        if (semanticsSet.has(p)) {
          yearSemantics = p;
          break;
        }
      }
    }

    if (!meterMakesClean.has(e.makeSlug)) {
      meterMakesClean.set(e.makeSlug, { id: e.makeSlug, name: e.makeName });
    }
    meterModelsClean.push({
      makeId: e.makeSlug,
      makeName: e.makeName,
      slug: e.modelSlug,
      name: e.modelName,
      category: e.category,
      yearFrom: e.yearFrom,
      yearTo: e.yearTo,
      yearSemantics,
      sourceSemantics: [...semanticsSet],
      sources: srcArr,
    });
  }

  const meterSnapshot = {
    source: "MeterApp/vehicle-db",
    version: "2.42.0",
    license: "ISC (code); open public registries & factual product catalogs (data)",
    generatedAt: new Date().toISOString(),
    sourcesMeta: meter.sources.map((s) => ({
      sourceId: s.source_id,
      name: s.source_name,
      license: s.license,
      url: s.source_url,
      yearSemantics: METERAPP_YEAR_SEMANTICS[s.source_id] || "MIXED",
    })),
    makes: [...meterMakesClean.values()],
    models: meterModelsClean,
  };
  writeFileSync(join(OUT_DIR, "meterapp-snapshot.json"), JSON.stringify(meterSnapshot));
  console.log(`Saved meterapp-snapshot.json: ${meterSnapshot.makes.length} makes, ${meterSnapshot.models.length} models`);

  // 3. ATTRIBUTION.md preserving CC-BY 4.0 and upstream notices
  const attribDoc = `# ZAPTUT.PRO Vehicle Database Attribution & Licenses

This directory contains local, commercially-permissible snapshots imported into the ZAPTUT.PRO PostgreSQL vehicle directory.

## 1. VehiclesDB (CC BY 4.0)
- **Repository:** https://github.com/vehiclesdb/vehiclesdb (Version 2026.11.4)
- **Attribution:** Vehicle data by [VehiclesDB](https://vehiclesdb.com), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Upstream Official Register Notices (per ATTRIBUTION.md):**
${vdbAttrib.trim()}

---

## 2. MeterApp Vehicle DB (ISC + Open Public Data)
- **Repository:** https://github.com/MeterApp/vehicle-db (Version 2.42.0)
- **Code License:** ISC
- **Data Licenses & Provenance (all verified permissible for commercial automotive catalog/compatibility use):**
${meter.sources
  .map(
    (s) =>
      `- **${s.source_name}** (\`${s.source_id}\`): ${s.license} — ${s.source_url} _(Year semantics: ${METERAPP_YEAR_SEMANTICS[s.source_id] || "MIXED"})_`
  )
  .join("\n")}
`;
  writeFileSync(join(OUT_DIR, "ATTRIBUTION.md"), attribDoc, "utf8");
  console.log("Saved data/vehicle-snapshots/ATTRIBUTION.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
