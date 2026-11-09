export type VehicleCompleteness = "FULL" | "STANDARD" | "BASIC" | "PARTIAL";

export type VehicleCategory = "PASSENGER" | "COMMERCIAL" | "MOTO" | "LCV" | "TRUCK";

export interface SourceMetadata {
  id: string;
  name: string;
  version: string;
  license: string;
  licenseUrl?: string;
  homepage?: string;
  description: string;
}

export interface RawVehicleMake {
  id: string; // canonical slug
  name: string;
  nameRu?: string;
  country?: string;
  isPopular?: boolean;
  category?: VehicleCategory;
  completenessStatus?: VehicleCompleteness;
  aliases?: string[];
  sourceId: string;
}

export interface RawVehicleModel {
  id: string; // canonical slug e.g. "toyota-camry"
  makeId: string;
  name: string;
  nameRu?: string;
  yearFrom?: number;
  yearTo?: number;
  isPopular?: boolean;
  category?: string;
  completenessStatus?: VehicleCompleteness;
  aliases?: string[];
  sourceId: string;
}

export interface RawVehicleGeneration {
  id: string; // canonical slug
  modelId: string;
  name: string;
  shortName?: string;
  code?: string;
  yearStart: number;
  yearEnd?: number;
  isRestyling?: boolean;
  defaultBodyType?: string;
  bodyTypes?: string[];
  years?: number[];
  completenessStatus?: VehicleCompleteness;
  aliases?: string[];
  sourceId: string;
}

export interface RawVehicleEngine {
  id: string;
  generationId: string;
  name: string;
  code?: string;
  fuelType?: "PETROL" | "DIESEL" | "HYBRID" | "ELECTRIC" | "LPG";
  displacementCc?: number;
  powerHp?: number;
  powerKw?: number;
  sourceId: string;
}

export interface RawVehicleModification {
  id: string;
  generationId: string;
  engineId?: string;
  name: string;
  bodyType?: string;
  transmission?: string;
  drivetrain?: string;
  yearFrom?: number;
  yearTo?: number;
  completenessStatus?: VehicleCompleteness;
  sourceId: string;
}

export interface ImportStats {
  dataSources: number;
  makes: number;
  models: number;
  generations: number;
  years: number;
  engines: number;
  modifications: number;
  aliases: number;
  sourceRecords: number;
  linkedCustomerVehicles: number;
  duplicatesResolved: number;
  durationMs: number;
}
