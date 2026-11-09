export type BodyType =
  | "SEDAN"
  | "SUV"
  | "CROSSOVER"
  | "HATCHBACK"
  | "ESTATE"
  | "COUPE"
  | "LIFTBACK";

export const BODY_TYPE_LABELS: Record<BodyType, string> = {
  SEDAN: "Седан",
  SUV: "Внедорожник",
  CROSSOVER: "Кроссовер",
  HATCHBACK: "Хэтчбек",
  ESTATE: "Универсал",
  COUPE: "Купе",
  LIFTBACK: "Лифтбек",
};

export type CarColorPreset = {
  name: string;
  hex: string;
  code?: string;
};

export const POPULAR_CAR_COLORS: CarColorPreset[] = [
  { name: "Черный металлик (Black Pearl)", hex: "#151719", code: "ABP" },
  { name: "Белый перламутр (Snow White)", hex: "#EAECEE", code: "SWP" },
  { name: "Серый графит (Graphite Gray)", hex: "#4B5156", code: "H8G" },
  { name: "Серебристый (Steel Silver)", hex: "#9BA2A7", code: "KCS" },
  { name: "Глубокий синий (Deep Blue)", hex: "#1A355B", code: "D9B" },
  { name: "Красный рубин (Infra Red)", hex: "#8A1C24", code: "AA4" },
  { name: "Мокрый асфальт (Dark Charcoal)", hex: "#2E3338", code: "M7S" },
  { name: "Бронзовый металлик (Dark Bronze)", hex: "#3B2E24", code: "B6S" },
];

export type VehicleVisualAsset = {
  id: string;
  make: string;
  model: string;
  generation?: string;
  bodyType: BodyType;
  isExact: boolean;
  viewBox: string;
  bodyPaths: string[];
  windowPaths: string[];
  wheelOuterPaths: string[];
  wheelRimPaths: string[];
  detailPaths: string[];
  lightPaths: string[];
};

/**
 * Matcher: make + model + generation + bodyType -> visual asset
 */
export function resolveVehicleVisual(params: {
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  bodyType?: string | null;
}): { assetId: string; bodyType: BodyType; isExact: boolean } {
  const normMake = (params.make || "").trim().toLowerCase();
  const normModel = (params.model || "").trim().toLowerCase();
  const normGen = (params.generation || "").trim().toLowerCase();
  const normBody = (params.bodyType || "").trim().toUpperCase() as BodyType;

  // 1. Kia Sportage
  if (normMake.includes("kia") && normModel.includes("sportage")) {
    const isGen5 = normGen.includes("5") || normGen.includes("nq5") || normGen.includes("v");
    return {
      assetId: isGen5 ? "kia-sportage-nq5" : "kia-sportage-ql",
      bodyType: "SUV",
      isExact: true,
    };
  }

  // 2. Hyundai Tucson
  if (normMake.includes("hyundai") && normModel.includes("tucson")) {
    const isGen4 = normGen.includes("4") || normGen.includes("nx4") || normGen.includes("iv");
    return {
      assetId: isGen4 ? "hyundai-tucson-nx4" : "hyundai-tucson-tl",
      bodyType: "SUV",
      isExact: true,
    };
  }

  // 3. Volkswagen Tiguan
  if ((normMake.includes("volkswagen") || normMake.includes("vw")) && normModel.includes("tiguan")) {
    return {
      assetId: "vw-tiguan-mk2",
      bodyType: "SUV",
      isExact: true,
    };
  }

  // 4. Toyota Camry
  if (normMake.includes("toyota") && normModel.includes("camry")) {
    return {
      assetId: "toyota-camry-xv70",
      bodyType: "SEDAN",
      isExact: true,
    };
  }

  // 5. BMW 3 Series
  if (normMake.includes("bmw") && (normModel.includes("3") || normModel.includes("m3"))) {
    return {
      assetId: "bmw-3-g20",
      bodyType: "SEDAN",
      isExact: true,
    };
  }

  // 6. Skoda Octavia
  if (normMake.includes("skoda") && normModel.includes("octavia")) {
    return {
      assetId: "skoda-octavia-a8",
      bodyType: "LIFTBACK",
      isExact: true,
    };
  }

  // Fallback to bodyType silhouette or neutral profile
  const fallbackBody: BodyType =
    normBody && BODY_TYPE_LABELS[normBody]
      ? normBody
      : normModel.includes("cross") || normModel.includes("x") || normModel.includes("rav")
        ? "SUV"
        : "SEDAN";

  return {
    assetId: `neutral-${fallbackBody.toLowerCase()}`,
    bodyType: fallbackBody,
    isExact: false,
  };
}
