export type VehicleMake = {
  id: string;
  name: string;
  country: string;
  popular?: boolean;
};

export type VehicleModel = {
  id: string;
  makeId: string;
  name: string;
};

export type VehicleGeneration = {
  id: string;
  modelId: string;
  name: string;
  shortName: string;
  yearStart: number;
  yearEnd: number;
  years: number[];
  bodyTypes: ("SUV" | "SEDAN" | "CROSSOVER" | "HATCHBACK" | "ESTATE" | "COUPE" | "LIFTBACK")[];
  defaultBodyType: "SUV" | "SEDAN" | "CROSSOVER" | "HATCHBACK" | "ESTATE" | "COUPE" | "LIFTBACK";
};

export type VehicleEngine = {
  id: string;
  generationId: string;
  name: string;
  displacement: string;
  powerHp: number;
  fuel: "Бензин" | "Дизель" | "Гибрид";
};

export type VehicleModification = {
  id: string;
  generationId: string;
  engineId?: string;
  name: string;
  transmission: "АКПП" | "МКПП" | "Робот" | "Вариатор";
  drivetrain: "Передний (FWD)" | "Полный (4WD/AWD)" | "Задний (RWD)";
};

// 1. MAKES
export const VEHICLE_MAKES: VehicleMake[] = [
  { id: "kia", name: "Kia", country: "Южная Корея", popular: true },
  { id: "hyundai", name: "Hyundai", country: "Южная Корея", popular: true },
  { id: "toyota", name: "Toyota", country: "Япония", popular: true },
  { id: "volkswagen", name: "Volkswagen", country: "Германия", popular: true },
  { id: "skoda", name: "Skoda", country: "Чехия", popular: true },
  { id: "bmw", name: "BMW", country: "Германия", popular: true },
];

// 2. MODELS
export const VEHICLE_MODELS: VehicleModel[] = [
  // Kia
  { id: "kia-sportage", makeId: "kia", name: "Sportage" },
  { id: "kia-rio", makeId: "kia", name: "Rio" },
  { id: "kia-k5", makeId: "kia", name: "K5" },
  { id: "kia-sorento", makeId: "kia", name: "Sorento" },

  // Hyundai
  { id: "hyundai-tucson", makeId: "hyundai", name: "Tucson" },
  { id: "hyundai-solaris", makeId: "hyundai", name: "Solaris" },
  { id: "hyundai-creta", makeId: "hyundai", name: "Creta" },
  { id: "hyundai-santa-fe", makeId: "hyundai", name: "Santa Fe" },

  // Toyota
  { id: "toyota-camry", makeId: "toyota", name: "Camry" },
  { id: "toyota-rav4", makeId: "toyota", name: "RAV4" },
  { id: "toyota-corolla", makeId: "toyota", name: "Corolla" },
  { id: "toyota-land-cruiser-prado", makeId: "toyota", name: "Land Cruiser Prado" },

  // Volkswagen
  { id: "vw-tiguan", makeId: "volkswagen", name: "Tiguan" },
  { id: "vw-polo", makeId: "volkswagen", name: "Polo" },
  { id: "vw-passat", makeId: "volkswagen", name: "Passat" },

  // Skoda
  { id: "skoda-octavia", makeId: "skoda", name: "Octavia" },
  { id: "skoda-kodiaq", makeId: "skoda", name: "Kodiaq" },
  { id: "skoda-rapid", makeId: "skoda", name: "Rapid" },

  // BMW
  { id: "bmw-3-series", makeId: "bmw", name: "3 серия" },
  { id: "bmw-5-series", makeId: "bmw", name: "5 серия" },
  { id: "bmw-x5", makeId: "bmw", name: "X5" },
];

function generateYearsRange(start: number, end: number): number[] {
  const years: number[] = [];
  for (let y = end; y >= start; y--) {
    years.push(y);
  }
  return years;
}

// 3. GENERATIONS
export const VEHICLE_GENERATIONS: VehicleGeneration[] = [
  // Kia Sportage
  {
    id: "kia-sportage-4-restyling",
    modelId: "kia-sportage",
    name: "IV (QL) Рестайлинг",
    shortName: "IV (QL) Рестайлинг",
    yearStart: 2018,
    yearEnd: 2022,
    years: generateYearsRange(2018, 2022),
    bodyTypes: ["SUV"],
    defaultBodyType: "SUV",
  },
  {
    id: "kia-sportage-4-pre",
    modelId: "kia-sportage",
    name: "IV (QL) Дорестайлинг",
    shortName: "IV (QL)",
    yearStart: 2015,
    yearEnd: 2018,
    years: generateYearsRange(2015, 2018),
    bodyTypes: ["SUV"],
    defaultBodyType: "SUV",
  },
  {
    id: "kia-sportage-3",
    modelId: "kia-sportage",
    name: "III (SL)",
    shortName: "III (SL)",
    yearStart: 2010,
    yearEnd: 2016,
    years: generateYearsRange(2010, 2016),
    bodyTypes: ["SUV"],
    defaultBodyType: "SUV",
  },

  // Kia Rio
  {
    id: "kia-rio-4",
    modelId: "kia-rio",
    name: "IV (FB)",
    shortName: "IV (FB)",
    yearStart: 2017,
    yearEnd: 2024,
    years: generateYearsRange(2017, 2024),
    bodyTypes: ["SEDAN", "HATCHBACK"],
    defaultBodyType: "SEDAN",
  },

  // Kia K5
  {
    id: "kia-k5-3",
    modelId: "kia-k5",
    name: "III (DL3)",
    shortName: "III (DL3)",
    yearStart: 2020,
    yearEnd: 2025,
    years: generateYearsRange(2020, 2025),
    bodyTypes: ["SEDAN"],
    defaultBodyType: "SEDAN",
  },

  // Hyundai Tucson
  {
    id: "hyundai-tucson-4",
    modelId: "hyundai-tucson",
    name: "IV (NX4)",
    shortName: "IV (NX4)",
    yearStart: 2020,
    yearEnd: 2025,
    years: generateYearsRange(2020, 2025),
    bodyTypes: ["SUV"],
    defaultBodyType: "SUV",
  },
  {
    id: "hyundai-tucson-3-restyling",
    modelId: "hyundai-tucson",
    name: "III (TL) Рестайлинг",
    shortName: "III (TL)",
    yearStart: 2018,
    yearEnd: 2021,
    years: generateYearsRange(2018, 2021),
    bodyTypes: ["SUV"],
    defaultBodyType: "SUV",
  },

  // Hyundai Solaris
  {
    id: "hyundai-solaris-2-restyling",
    modelId: "hyundai-solaris",
    name: "II Рестайлинг",
    shortName: "II Рестайлинг",
    yearStart: 2020,
    yearEnd: 2024,
    years: generateYearsRange(2020, 2024),
    bodyTypes: ["SEDAN"],
    defaultBodyType: "SEDAN",
  },

  // Toyota Camry
  {
    id: "toyota-camry-xv70-restyling",
    modelId: "toyota-camry",
    name: "VIII (XV70) Рестайлинг",
    shortName: "VIII (XV70)",
    yearStart: 2021,
    yearEnd: 2024,
    years: generateYearsRange(2021, 2024),
    bodyTypes: ["SEDAN"],
    defaultBodyType: "SEDAN",
  },
  {
    id: "toyota-camry-xv70-pre",
    modelId: "toyota-camry",
    name: "VIII (XV70) Дорестайлинг",
    shortName: "VIII (XV70)",
    yearStart: 2017,
    yearEnd: 2021,
    years: generateYearsRange(2017, 2021),
    bodyTypes: ["SEDAN"],
    defaultBodyType: "SEDAN",
  },
  {
    id: "toyota-camry-xv50",
    modelId: "toyota-camry",
    name: "VII (XV50)",
    shortName: "VII (XV50)",
    yearStart: 2011,
    yearEnd: 2017,
    years: generateYearsRange(2011, 2017),
    bodyTypes: ["SEDAN"],
    defaultBodyType: "SEDAN",
  },

  // Toyota RAV4
  {
    id: "toyota-rav4-5",
    modelId: "toyota-rav4",
    name: "V (XA50)",
    shortName: "V (XA50)",
    yearStart: 2019,
    yearEnd: 2025,
    years: generateYearsRange(2019, 2025),
    bodyTypes: ["SUV"],
    defaultBodyType: "SUV",
  },

  // Volkswagen Tiguan
  {
    id: "vw-tiguan-2-restyling",
    modelId: "vw-tiguan",
    name: "II Рестайлинг",
    shortName: "II Рестайлинг",
    yearStart: 2020,
    yearEnd: 2024,
    years: generateYearsRange(2020, 2024),
    bodyTypes: ["SUV"],
    defaultBodyType: "SUV",
  },
  {
    id: "vw-tiguan-2-pre",
    modelId: "vw-tiguan",
    name: "II Дорестайлинг",
    shortName: "II",
    yearStart: 2016,
    yearEnd: 2020,
    years: generateYearsRange(2016, 2020),
    bodyTypes: ["SUV"],
    defaultBodyType: "SUV",
  },

  // Volkswagen Polo
  {
    id: "vw-polo-6",
    modelId: "vw-polo",
    name: "VI (Лифтбек)",
    shortName: "VI",
    yearStart: 2020,
    yearEnd: 2024,
    years: generateYearsRange(2020, 2024),
    bodyTypes: ["LIFTBACK"],
    defaultBodyType: "LIFTBACK",
  },

  // Skoda Octavia
  {
    id: "skoda-octavia-a8",
    modelId: "skoda-octavia",
    name: "IV (A8)",
    shortName: "IV (A8)",
    yearStart: 2020,
    yearEnd: 2025,
    years: generateYearsRange(2020, 2025),
    bodyTypes: ["LIFTBACK", "ESTATE"],
    defaultBodyType: "LIFTBACK",
  },
  {
    id: "skoda-octavia-a7",
    modelId: "skoda-octavia",
    name: "III (A7) Рестайлинг",
    shortName: "III (A7)",
    yearStart: 2017,
    yearEnd: 2020,
    years: generateYearsRange(2017, 2020),
    bodyTypes: ["LIFTBACK", "ESTATE"],
    defaultBodyType: "LIFTBACK",
  },

  // BMW 3 Series
  {
    id: "bmw-3-g20",
    modelId: "bmw-3-series",
    name: "VII (G20)",
    shortName: "VII (G20)",
    yearStart: 2018,
    yearEnd: 2025,
    years: generateYearsRange(2018, 2025),
    bodyTypes: ["SEDAN"],
    defaultBodyType: "SEDAN",
  },

  // BMW 5 Series
  {
    id: "bmw-5-g30",
    modelId: "bmw-5-series",
    name: "VII (G30) Рестайлинг",
    shortName: "VII (G30)",
    yearStart: 2020,
    yearEnd: 2023,
    years: generateYearsRange(2020, 2023),
    bodyTypes: ["SEDAN"],
    defaultBodyType: "SEDAN",
  },
];

// 4. ENGINES
export const VEHICLE_ENGINES: VehicleEngine[] = [
  // Kia Sportage IV
  {
    id: "eng-kia-sp4-20-mpi",
    generationId: "kia-sportage-4-restyling",
    name: "2.0 MPI (150 л.с., Бензин, G4NA)",
    displacement: "2.0L",
    powerHp: 150,
    fuel: "Бензин",
  },
  {
    id: "eng-kia-sp4-24-gdi",
    generationId: "kia-sportage-4-restyling",
    name: "2.4 GDI (184 л.с., Бензин, G4KJ)",
    displacement: "2.4L",
    powerHp: 184,
    fuel: "Бензин",
  },
  {
    id: "eng-kia-sp4-20-crdi",
    generationId: "kia-sportage-4-restyling",
    name: "2.0 CRDi (185 л.с., Дизель, D4HA)",
    displacement: "2.0L",
    powerHp: 185,
    fuel: "Дизель",
  },
  {
    id: "eng-kia-sp4-pre-20-mpi",
    generationId: "kia-sportage-4-pre",
    name: "2.0 MPI (150 л.с., Бензин, G4NA)",
    displacement: "2.0L",
    powerHp: 150,
    fuel: "Бензин",
  },
  {
    id: "eng-kia-sp3-20-mpi",
    generationId: "kia-sportage-3",
    name: "2.0 MPI (150 л.с., Бензин, G4KD)",
    displacement: "2.0L",
    powerHp: 150,
    fuel: "Бензин",
  },

  // Kia Rio IV
  {
    id: "eng-kia-rio4-16",
    generationId: "kia-rio-4",
    name: "1.6 MPI (123 л.с., Бензин, G4FG)",
    displacement: "1.6L",
    powerHp: 123,
    fuel: "Бензин",
  },
  {
    id: "eng-kia-rio4-14",
    generationId: "kia-rio-4",
    name: "1.4 MPI (100 л.с., Бензин, G4LC)",
    displacement: "1.4L",
    powerHp: 100,
    fuel: "Бензин",
  },

  // Kia K5 III
  {
    id: "eng-kia-k5-20",
    generationId: "kia-k5-3",
    name: "2.0 MPI (150 л.с., Бензин, G4NA)",
    displacement: "2.0L",
    powerHp: 150,
    fuel: "Бензин",
  },
  {
    id: "eng-kia-k5-25",
    generationId: "kia-k5-3",
    name: "2.5 GDI (194 л.с., Бензин, G4KN)",
    displacement: "2.5L",
    powerHp: 194,
    fuel: "Бензин",
  },

  // Hyundai Tucson IV / III
  {
    id: "eng-hyundai-tuc4-20",
    generationId: "hyundai-tucson-4",
    name: "2.0 MPI (150 л.с., Бензин, G4NL)",
    displacement: "2.0L",
    powerHp: 150,
    fuel: "Бензин",
  },
  {
    id: "eng-hyundai-tuc4-25",
    generationId: "hyundai-tucson-4",
    name: "2.5 GDI (190 л.с., Бензин, G4KN)",
    displacement: "2.5L",
    powerHp: 190,
    fuel: "Бензин",
  },
  {
    id: "eng-hyundai-tuc3-20",
    generationId: "hyundai-tucson-3-restyling",
    name: "2.0 MPI (150 л.с., Бензин, G4NA)",
    displacement: "2.0L",
    powerHp: 150,
    fuel: "Бензин",
  },

  // Hyundai Solaris II
  {
    id: "eng-hyundai-sol2-16",
    generationId: "hyundai-solaris-2-restyling",
    name: "1.6 MPI (123 л.с., Бензин, G4FG)",
    displacement: "1.6L",
    powerHp: 123,
    fuel: "Бензин",
  },

  // Toyota Camry XV70
  {
    id: "eng-toyota-camry-20",
    generationId: "toyota-camry-xv70-restyling",
    name: "2.0 (150 л.с., Бензин, M20A-FKS)",
    displacement: "2.0L",
    powerHp: 150,
    fuel: "Бензин",
  },
  {
    id: "eng-toyota-camry-25",
    generationId: "toyota-camry-xv70-restyling",
    name: "2.5 (200 л.с., Бензин, A25A-FKS)",
    displacement: "2.5L",
    powerHp: 200,
    fuel: "Бензин",
  },
  {
    id: "eng-toyota-camry-35",
    generationId: "toyota-camry-xv70-restyling",
    name: "3.5 (249 л.с., Бензин, 2GR-FKS)",
    displacement: "3.5L",
    powerHp: 249,
    fuel: "Бензин",
  },
  {
    id: "eng-toyota-camry-xv50-25",
    generationId: "toyota-camry-xv50",
    name: "2.5 (181 л.с., Бензин, 2AR-FE)",
    displacement: "2.5L",
    powerHp: 181,
    fuel: "Бензин",
  },

  // Toyota RAV4
  {
    id: "eng-toyota-rav4-20",
    generationId: "toyota-rav4-5",
    name: "2.0 (149 л.с., Бензин, M20A-FKS)",
    displacement: "2.0L",
    powerHp: 149,
    fuel: "Бензин",
  },
  {
    id: "eng-toyota-rav4-25",
    generationId: "toyota-rav4-5",
    name: "2.5 (199 л.с., Бензин, A25A-FKS)",
    displacement: "2.5L",
    powerHp: 199,
    fuel: "Бензин",
  },

  // VW Tiguan II
  {
    id: "eng-vw-tiguan-14",
    generationId: "vw-tiguan-2-restyling",
    name: "1.4 TSI (150 л.с., Бензин, CZDA)",
    displacement: "1.4L",
    powerHp: 150,
    fuel: "Бензин",
  },
  {
    id: "eng-vw-tiguan-20-180",
    generationId: "vw-tiguan-2-restyling",
    name: "2.0 TSI (180 л.с., Бензин, CHHB)",
    displacement: "2.0L",
    powerHp: 180,
    fuel: "Бензин",
  },
  {
    id: "eng-vw-tiguan-20-220",
    generationId: "vw-tiguan-2-restyling",
    name: "2.0 TSI (220 л.с., Бензин, CHHA)",
    displacement: "2.0L",
    powerHp: 220,
    fuel: "Бензин",
  },

  // VW Polo VI
  {
    id: "eng-vw-polo-16-110",
    generationId: "vw-polo-6",
    name: "1.6 MPI (110 л.с., Бензин, CWVA)",
    displacement: "1.6L",
    powerHp: 110,
    fuel: "Бензин",
  },
  {
    id: "eng-vw-polo-14-tsi",
    generationId: "vw-polo-6",
    name: "1.4 TSI (125 л.с., Бензин, CZCA)",
    displacement: "1.4L",
    powerHp: 125,
    fuel: "Бензин",
  },

  // Skoda Octavia IV (A8)
  {
    id: "eng-skoda-oct-14-tsi",
    generationId: "skoda-octavia-a8",
    name: "1.4 TSI (150 л.с., Бензин, DJKA)",
    displacement: "1.4L",
    powerHp: 150,
    fuel: "Бензин",
  },
  {
    id: "eng-skoda-oct-20-tsi",
    generationId: "skoda-octavia-a8",
    name: "2.0 TSI (190 л.с., Бензин, DKZA)",
    displacement: "2.0L",
    powerHp: 190,
    fuel: "Бензин",
  },

  // BMW 3 G20
  {
    id: "eng-bmw-320i",
    generationId: "bmw-3-g20",
    name: "320i 2.0 (184 л.с., Бензин, B48)",
    displacement: "2.0L",
    powerHp: 184,
    fuel: "Бензин",
  },
  {
    id: "eng-bmw-320d",
    generationId: "bmw-3-g20",
    name: "320d 2.0d (190 л.с., Дизель, B47)",
    displacement: "2.0L",
    powerHp: 190,
    fuel: "Дизель",
  },

  // BMW 5 G30
  {
    id: "eng-bmw-520d",
    generationId: "bmw-5-g30",
    name: "520d 2.0d (190 л.с., Дизель, B47)",
    displacement: "2.0L",
    powerHp: 190,
    fuel: "Дизель",
  },
  {
    id: "eng-bmw-530i",
    generationId: "bmw-5-g30",
    name: "530i 2.0 (249 л.с., Бензин, B48)",
    displacement: "2.0L",
    powerHp: 249,
    fuel: "Бензин",
  },
];

// 5. MODIFICATIONS
export const VEHICLE_MODIFICATIONS: VehicleModification[] = [
  // Kia Sportage IV (QL) Рестайлинг
  {
    id: "mod-kia-sp4-20-at-4wd",
    generationId: "kia-sportage-4-restyling",
    engineId: "eng-kia-sp4-20-mpi",
    name: "2.0 MPI AT 4WD (150 л.с.)",
    transmission: "АКПП",
    drivetrain: "Полный (4WD/AWD)",
  },
  {
    id: "mod-kia-sp4-20-at-2wd",
    generationId: "kia-sportage-4-restyling",
    engineId: "eng-kia-sp4-20-mpi",
    name: "2.0 MPI AT 2WD (150 л.с.)",
    transmission: "АКПП",
    drivetrain: "Передний (FWD)",
  },
  {
    id: "mod-kia-sp4-20-mt-2wd",
    generationId: "kia-sportage-4-restyling",
    engineId: "eng-kia-sp4-20-mpi",
    name: "2.0 MPI MT 2WD (150 л.с.)",
    transmission: "МКПП",
    drivetrain: "Передний (FWD)",
  },
  {
    id: "mod-kia-sp4-24-at-4wd",
    generationId: "kia-sportage-4-restyling",
    engineId: "eng-kia-sp4-24-gdi",
    name: "2.4 GDI AT 4WD (184 л.с.)",
    transmission: "АКПП",
    drivetrain: "Полный (4WD/AWD)",
  },
  {
    id: "mod-kia-sp4-20-crdi-at-4wd",
    generationId: "kia-sportage-4-restyling",
    engineId: "eng-kia-sp4-20-crdi",
    name: "2.0 CRDi AT 4WD (185 л.с.)",
    transmission: "АКПП",
    drivetrain: "Полный (4WD/AWD)",
  },

  // Kia Sportage IV Дорестайлинг
  {
    id: "mod-kia-sp4-pre-20-at-4wd",
    generationId: "kia-sportage-4-pre",
    engineId: "eng-kia-sp4-pre-20-mpi",
    name: "2.0 MPI AT 4WD (150 л.с.)",
    transmission: "АКПП",
    drivetrain: "Полный (4WD/AWD)",
  },

  // Kia Sportage III
  {
    id: "mod-kia-sp3-20-at-4wd",
    generationId: "kia-sportage-3",
    engineId: "eng-kia-sp3-20-mpi",
    name: "2.0 MPI AT 4WD (150 л.с.)",
    transmission: "АКПП",
    drivetrain: "Полный (4WD/AWD)",
  },

  // Kia Rio IV
  {
    id: "mod-kia-rio4-16-at",
    generationId: "kia-rio-4",
    engineId: "eng-kia-rio4-16",
    name: "1.6 AT (123 л.с.)",
    transmission: "АКПП",
    drivetrain: "Передний (FWD)",
  },
  {
    id: "mod-kia-rio4-16-mt",
    generationId: "kia-rio-4",
    engineId: "eng-kia-rio4-16",
    name: "1.6 MT (123 л.с.)",
    transmission: "МКПП",
    drivetrain: "Передний (FWD)",
  },

  // Kia K5 III
  {
    id: "mod-kia-k5-20-at",
    generationId: "kia-k5-3",
    engineId: "eng-kia-k5-20",
    name: "2.0 AT (150 л.с.)",
    transmission: "АКПП",
    drivetrain: "Передний (FWD)",
  },
  {
    id: "mod-kia-k5-25-at",
    generationId: "kia-k5-3",
    engineId: "eng-kia-k5-25",
    name: "2.5 AT (194 л.с.)",
    transmission: "АКПП",
    drivetrain: "Передний (FWD)",
  },

  // Hyundai Tucson IV
  {
    id: "mod-hyundai-tuc4-20-at-4wd",
    generationId: "hyundai-tucson-4",
    engineId: "eng-hyundai-tuc4-20",
    name: "2.0 MPI AT 4WD (150 л.с.)",
    transmission: "АКПП",
    drivetrain: "Полный (4WD/AWD)",
  },
  {
    id: "mod-hyundai-tuc4-25-at-4wd",
    generationId: "hyundai-tucson-4",
    engineId: "eng-hyundai-tuc4-25",
    name: "2.5 GDI AT 4WD (190 л.с.)",
    transmission: "АКПП",
    drivetrain: "Полный (4WD/AWD)",
  },

  // Hyundai Tucson III
  {
    id: "mod-hyundai-tuc3-20-at-4wd",
    generationId: "hyundai-tucson-3-restyling",
    engineId: "eng-hyundai-tuc3-20",
    name: "2.0 MPI AT 4WD (150 л.с.)",
    transmission: "АКПП",
    drivetrain: "Полный (4WD/AWD)",
  },

  // Hyundai Solaris II
  {
    id: "mod-hyundai-sol2-16-at",
    generationId: "hyundai-solaris-2-restyling",
    engineId: "eng-hyundai-sol2-16",
    name: "1.6 AT (123 л.с.)",
    transmission: "АКПП",
    drivetrain: "Передний (FWD)",
  },

  // Toyota Camry XV70
  {
    id: "mod-toyota-camry-20-cvt",
    generationId: "toyota-camry-xv70-restyling",
    engineId: "eng-toyota-camry-20",
    name: "2.0 CVT (150 л.с.)",
    transmission: "Вариатор",
    drivetrain: "Передний (FWD)",
  },
  {
    id: "mod-toyota-camry-25-at",
    generationId: "toyota-camry-xv70-restyling",
    engineId: "eng-toyota-camry-25",
    name: "2.5 AT (200 л.с.)",
    transmission: "АКПП",
    drivetrain: "Передний (FWD)",
  },
  {
    id: "mod-toyota-camry-35-at",
    generationId: "toyota-camry-xv70-restyling",
    engineId: "eng-toyota-camry-35",
    name: "3.5 AT (249 л.с.)",
    transmission: "АКПП",
    drivetrain: "Передний (FWD)",
  },

  // Toyota RAV4 V
  {
    id: "mod-toyota-rav4-20-cvt-4wd",
    generationId: "toyota-rav4-5",
    engineId: "eng-toyota-rav4-20",
    name: "2.0 CVT 4WD (149 л.с.)",
    transmission: "Вариатор",
    drivetrain: "Полный (4WD/AWD)",
  },
  {
    id: "mod-toyota-rav4-25-at-4wd",
    generationId: "toyota-rav4-5",
    engineId: "eng-toyota-rav4-25",
    name: "2.5 AT 4WD (199 л.с.)",
    transmission: "АКПП",
    drivetrain: "Полный (4WD/AWD)",
  },

  // VW Tiguan II
  {
    id: "mod-vw-tiguan-14-dsg-4wd",
    generationId: "vw-tiguan-2-restyling",
    engineId: "eng-vw-tiguan-14",
    name: "1.4 TSI DSG 4WD (150 л.с.)",
    transmission: "Робот",
    drivetrain: "Полный (4WD/AWD)",
  },
  {
    id: "mod-vw-tiguan-20-dsg-4wd-180",
    generationId: "vw-tiguan-2-restyling",
    engineId: "eng-vw-tiguan-20-180",
    name: "2.0 TSI DSG 4WD (180 л.с.)",
    transmission: "Робот",
    drivetrain: "Полный (4WD/AWD)",
  },

  // VW Polo VI
  {
    id: "mod-vw-polo-16-at",
    generationId: "vw-polo-6",
    engineId: "eng-vw-polo-16-110",
    name: "1.6 AT (110 л.с.)",
    transmission: "АКПП",
    drivetrain: "Передний (FWD)",
  },

  // Skoda Octavia IV
  {
    id: "mod-skoda-oct-14-at",
    generationId: "skoda-octavia-a8",
    engineId: "eng-skoda-oct-14-tsi",
    name: "1.4 TSI AT (150 л.с.)",
    transmission: "АКПП",
    drivetrain: "Передний (FWD)",
  },
  {
    id: "mod-skoda-oct-20-dsg",
    generationId: "skoda-octavia-a8",
    engineId: "eng-skoda-oct-20-tsi",
    name: "2.0 TSI DSG (190 л.с.)",
    transmission: "Робот",
    drivetrain: "Передний (FWD)",
  },

  // BMW 3 G20
  {
    id: "mod-bmw-320i-xdrive",
    generationId: "bmw-3-g20",
    engineId: "eng-bmw-320i",
    name: "320i xDrive AT (184 л.с.)",
    transmission: "АКПП",
    drivetrain: "Полный (4WD/AWD)",
  },
  {
    id: "mod-bmw-320d-xdrive",
    generationId: "bmw-3-g20",
    engineId: "eng-bmw-320d",
    name: "320d xDrive AT (190 л.с.)",
    transmission: "АКПП",
    drivetrain: "Полный (4WD/AWD)",
  },

  // BMW 5 G30
  {
    id: "mod-bmw-520d-xdrive",
    generationId: "bmw-5-g30",
    engineId: "eng-bmw-520d",
    name: "520d xDrive AT (190 л.с.)",
    transmission: "АКПП",
    drivetrain: "Полный (4WD/AWD)",
  },
  {
    id: "mod-bmw-530i-xdrive",
    generationId: "bmw-5-g30",
    engineId: "eng-bmw-530i",
    name: "530i xDrive AT (249 л.с.)",
    transmission: "АКПП",
    drivetrain: "Полный (4WD/AWD)",
  },
];

// Helper methods for cascading lookup
export function lookupMakes(query?: string): VehicleMake[] {
  if (!query || !query.trim()) return VEHICLE_MAKES;
  const q = query.trim().toLowerCase();
  return VEHICLE_MAKES.filter(
    (m) => m.name.toLowerCase().includes(q) || m.country.toLowerCase().includes(q)
  );
}

export function lookupModels(makeId: string, query?: string): VehicleModel[] {
  const models = VEHICLE_MODELS.filter((m) => m.makeId === makeId);
  if (!query || !query.trim()) return models;
  const q = query.trim().toLowerCase();
  return models.filter((m) => m.name.toLowerCase().includes(q));
}

export function lookupGenerations(modelId: string, query?: string): VehicleGeneration[] {
  const gens = VEHICLE_GENERATIONS.filter((g) => g.modelId === modelId);
  if (!query || !query.trim()) return gens;
  const q = query.trim().toLowerCase();
  return gens.filter(
    (g) => g.name.toLowerCase().includes(q) || g.shortName.toLowerCase().includes(q)
  );
}

export function lookupGenerationById(generationId: string): VehicleGeneration | undefined {
  return VEHICLE_GENERATIONS.find((g) => g.id === generationId);
}

export function lookupYears(generationId: string): number[] {
  const gen = lookupGenerationById(generationId);
  return gen ? gen.years : [];
}

export function lookupBodyTypes(generationId: string) {
  const gen = lookupGenerationById(generationId);
  return gen ? gen.bodyTypes : [];
}

export function lookupEngines(generationId: string, query?: string): VehicleEngine[] {
  const engines = VEHICLE_ENGINES.filter((e) => e.generationId === generationId);
  if (!query || !query.trim()) return engines;
  const q = query.trim().toLowerCase();
  return engines.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.displacement.toLowerCase().includes(q) ||
      e.fuel.toLowerCase().includes(q)
  );
}

export function lookupModifications(
  generationId: string,
  engineId?: string,
  query?: string
): VehicleModification[] {
  let mods = VEHICLE_MODIFICATIONS.filter((m) => m.generationId === generationId);
  if (engineId) {
    const byEngine = mods.filter((m) => m.engineId === engineId);
    if (byEngine.length > 0) mods = byEngine;
  }
  if (!query || !query.trim()) return mods;
  const q = query.trim().toLowerCase();
  return mods.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.transmission.toLowerCase().includes(q) ||
      m.drivetrain.toLowerCase().includes(q)
  );
}

// Reverse resolver: given make and model strings, find IDs if possible
export function resolveMakeIdByName(name: string): string | undefined {
  const norm = name.trim().toLowerCase();
  return VEHICLE_MAKES.find((m) => m.name.toLowerCase() === norm)?.id;
}

export function resolveModelIdByName(makeId: string, name: string): string | undefined {
  const norm = name.trim().toLowerCase();
  return VEHICLE_MODELS.find((m) => m.makeId === makeId && m.name.toLowerCase() === norm)?.id;
}
