import type { SourceMetadata } from "./types";

export const VEHICLE_DATA_SOURCES: SourceMetadata[] = [
  {
    id: "zaptut-regional",
    name: "ZAPTUT Regional Market Taxonomy (RU/BY/PL/CN)",
    version: "2026.11",
    license: "Proprietary / ZAPTUT Open Core Dataset",
    licenseUrl: "https://zaptut.pro/licenses/vehicle-data",
    homepage: "https://zaptut.pro",
    description:
      "Deep regional taxonomy for Russia, Belarus, Poland and top Chinese imports. Includes historical AvtoVAZ/Lada, GAZ, UAZ, Moskvich, Belgee, Haval, Geely, Chery, Changan, Exeed, Omoda, Tank, Li Auto, Zeekr, Voyah, plus Cyrillic transliterations and slang aliases.",
  },
  {
    id: "vehiclesdb",
    name: "VehiclesDB International Automotive Catalog",
    version: "2026.11",
    license: "CC-BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    homepage: "https://vehiclesdb.com",
    description:
      "Corroborated vehicle taxonomy based on official multi-country government registers (UK DfT, NL RDW, DE KBA, ES DGT, US EPA). Provides verified makes, models, body types, and country availability.",
  },
  {
    id: "meterapp",
    name: "MeterApp Vehicle DB Global Catalog",
    version: "2.42.0",
    license: "ISC (code); open public registers & manufacturer catalogs (data)",
    licenseUrl: "https://opensource.org/licenses/ISC",
    homepage: "https://github.com/MeterApp/vehicle-db",
    description:
      "Open-source offline international vehicle database compiled from global transportation registries (NHTSA, UK DfT OGL v3.0, EEA CO2 CC-BY 4.0, NL RDW Public Domain, NZTA & Malaysia JPJ CC-BY 4.0, Brazil SENATRAN Public Domain) and dated manufacturer catalogs.",
  },
  {
    id: "manufacturer-verified",
    name: "Verified Manufacturer Official Line-ups (CN/RU/CIS)",
    version: "2026.11",
    license: "Factual product names with source attribution",
    homepage: "https://zaptut.pro/about#vehicle-data",
    description:
      "Targeted verification of high-demand CIS/Chinese models (Exeed TXL/VX/RX, Geely Tugella, Li Auto L6/L7, Zeekr 007) where public fleet registers lack model-level coverage, backed by official manufacturer specification sheets.",
  },
];
