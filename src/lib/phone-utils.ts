export type CountryCode = "RU" | "BY" | "PL" | "OTHER";
export type SupportedCountryCode = CountryCode;

export type CountryInfo = {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
  placeholder: string;
  mask: string;
  nationalDigits: number; // number of digits after dial code
};

export const SUPPORTED_COUNTRIES: CountryInfo[] = [
  {
    code: "RU",
    name: "Россия",
    dialCode: "+7",
    flag: "🇷🇺",
    placeholder: "(999) 000-00-00",
    mask: "+7 (___) ___-__-__",
    nationalDigits: 10,
  },
  {
    code: "BY",
    name: "Беларусь",
    dialCode: "+375",
    flag: "🇧🇾",
    placeholder: "(29) 000-00-00",
    mask: "+375 (__) ___-__-__",
    nationalDigits: 9,
  },
  {
    code: "PL",
    name: "Польша",
    dialCode: "+48",
    flag: "🇵🇱",
    placeholder: "123 456 789",
    mask: "+48 ___ ___ ___",
    nationalDigits: 9,
  },
];

/**
 * Normalizes any phone input string into strict E.164 format (+[country_code][number]).
 *
 * Defaults or selected country can be provided as a hint if user typed local number without dial code.
 */
export function normalizeToE164(input: string, countryHint: CountryCode = "RU"): string | null {
  if (!input || typeof input !== "string") return null;

  const raw = input.trim();
  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) return null;

  // 1. If starts with "+"
  if (raw.startsWith("+")) {
    if (digitsOnly.startsWith("7") && digitsOnly.length === 11) {
      return `+${digitsOnly}`;
    }
    if (digitsOnly.startsWith("375") && digitsOnly.length === 12) {
      return `+${digitsOnly}`;
    }
    if (digitsOnly.startsWith("48") && digitsOnly.length === 11) {
      return `+${digitsOnly}`;
    }
    // Generic E.164 (8 to 15 digits)
    if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
      return `+${digitsOnly}`;
    }
    return null;
  }

  // 2. Belarus (+375) domestic trunk prefix starts with '80' (11 digits, e.g. 80291234567)
  if (digitsOnly.startsWith("80") && digitsOnly.length === 11) {
    return `+375${digitsOnly.slice(2)}`;
  }
  if (digitsOnly.startsWith("375") && digitsOnly.length === 12) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.length === 9 && countryHint === "BY") {
    return `+375${digitsOnly}`;
  }

  // 3. Russia (+7) domestic conventions:
  // Starts with '8' or '7' and 11 digits
  if ((digitsOnly.startsWith("8") || digitsOnly.startsWith("7")) && digitsOnly.length === 11) {
    return `+7${digitsOnly.slice(1)}`;
  }
  // If 10 digits and RU hint (e.g. 9991234567)
  if (digitsOnly.length === 10 && countryHint === "RU") {
    return `+7${digitsOnly}`;
  }

  // 4. Poland (+48) conventions:
  if (digitsOnly.startsWith("48") && digitsOnly.length === 11) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.length === 9 && countryHint === "PL") {
    return `+48${digitsOnly}`;
  }

  // 5. Fallback based on country hint:
  if (countryHint === "RU" && digitsOnly.length === 10) {
    return `+7${digitsOnly}`;
  }
  if (countryHint === "BY" && digitsOnly.length === 9) {
    return `+375${digitsOnly}`;
  }
  if (countryHint === "PL" && digitsOnly.length === 9) {
    return `+48${digitsOnly}`;
  }

  if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
    return `+${digitsOnly}`;
  }

  return null;
}

/**
 * Detect country code from E.164 phone number
 */
export function detectCountryFromE164(e164: string): CountryCode {
  if (e164.startsWith("+7")) return "RU";
  if (e164.startsWith("+375")) return "BY";
  if (e164.startsWith("+48")) return "PL";
  return "OTHER";
}

/**
 * Validates whether an E.164 phone number is structurally valid for target market
 */
export function isValidE164(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  if (!phone.startsWith("+")) return false;
  const digits = phone.slice(1);
  if (!/^\d+$/.test(digits)) return false;

  if (phone.startsWith("+7")) {
    return digits.length === 11 && ["9", "4", "8", "3"].includes(digits[1]);
  }
  if (phone.startsWith("+375")) {
    return digits.length === 12;
  }
  if (phone.startsWith("+48")) {
    return digits.length === 11;
  }

  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Formats E.164 phone into display format for UI
 */
export function formatPhoneDisplay(e164: string): string {
  if (!e164) return "";
  const norm = normalizeToE164(e164);
  if (!norm) return e164;

  if (norm.startsWith("+7") && norm.length === 12) {
    const d = norm.slice(2);
    return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
  }
  if (norm.startsWith("+375") && norm.length === 13) {
    const d = norm.slice(4);
    return `+375 (${d.slice(0, 2)}) ${d.slice(2, 5)}-${d.slice(5, 7)}-${d.slice(7, 9)}`;
  }
  if (norm.startsWith("+48") && norm.length === 12) {
    const d = norm.slice(3);
    return `+48 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`;
  }

  return norm;
}

/**
 * Masks national digits input on the fly as user types
 */
export function maskNationalDigits(digits: string, country: CountryCode): string {
  const clean = digits.replace(/\D/g, "");

  if (country === "RU") {
    const trimmed = clean.slice(0, 10);
    if (!trimmed) return "";
    let res = "(" + trimmed.slice(0, 3);
    if (trimmed.length > 3) res += ") " + trimmed.slice(3, 6);
    if (trimmed.length > 6) res += "-" + trimmed.slice(6, 8);
    if (trimmed.length > 8) res += "-" + trimmed.slice(8, 10);
    return res;
  }

  if (country === "BY") {
    const trimmed = clean.slice(0, 9);
    if (!trimmed) return "";
    let res = "(" + trimmed.slice(0, 2);
    if (trimmed.length > 2) res += ") " + trimmed.slice(2, 5);
    if (trimmed.length > 5) res += "-" + trimmed.slice(5, 7);
    if (trimmed.length > 7) res += "-" + trimmed.slice(7, 9);
    return res;
  }

  if (country === "PL") {
    const trimmed = clean.slice(0, 9);
    if (!trimmed) return "";
    let res = trimmed.slice(0, 3);
    if (trimmed.length > 3) res += " " + trimmed.slice(3, 6);
    if (trimmed.length > 6) res += " " + trimmed.slice(6, 9);
    return res;
  }

  return clean.slice(0, 15);
}
