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
    version: "2.40.0",
    license: "ISC",
    licenseUrl: "https://opensource.org/licenses/ISC",
    homepage: "https://github.com/MeterApp/vehicle-db",
    description:
      "Open-source offline international vehicle database compiled from global transportation registries (NHTSA, DVLA, EEA, RDW, Senatran, JPJ) covering model production years.",
  },
];
