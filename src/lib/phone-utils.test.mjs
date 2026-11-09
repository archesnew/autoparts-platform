import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeToE164,
  formatPhoneDisplay,
  isValidE164,
  detectCountryFromE164,
  maskNationalDigits,
} from "./phone-utils.ts";

test("phone-utils: Russian phone normalization to E.164", () => {
  assert.equal(normalizeToE164("+7 (999) 123-45-67"), "+79991234567");
  assert.equal(normalizeToE164("89991234567"), "+79991234567");
  assert.equal(normalizeToE164("79991234567"), "+79991234567");
  assert.equal(normalizeToE164("9991234567", "RU"), "+79991234567");
  assert.equal(normalizeToE164("8 (495) 777-88-99"), "+74957778899");
  assert.equal(detectCountryFromE164("+79991234567"), "RU");
  assert.equal(isValidE164("+79991234567"), true);
});

test("phone-utils: Belarus phone normalization to E.164", () => {
  assert.equal(normalizeToE164("+375 (29) 123-45-67"), "+375291234567");
  assert.equal(normalizeToE164("80291234567"), "+375291234567");
  assert.equal(normalizeToE164("375291234567"), "+375291234567");
  assert.equal(normalizeToE164("291234567", "BY"), "+375291234567");
  assert.equal(detectCountryFromE164("+375291234567"), "BY");
  assert.equal(isValidE164("+375291234567"), true);
});

test("phone-utils: Poland phone normalization to E.164", () => {
  assert.equal(normalizeToE164("+48 123 456 789"), "+48123456789");
  assert.equal(normalizeToE164("48123456789"), "+48123456789");
  assert.equal(normalizeToE164("123456789", "PL"), "+48123456789");
  assert.equal(detectCountryFromE164("+48123456789"), "PL");
  assert.equal(isValidE164("+48123456789"), true);
});

test("phone-utils: formatPhoneDisplay", () => {
  assert.equal(formatPhoneDisplay("+79991234567"), "+7 (999) 123-45-67");
  assert.equal(formatPhoneDisplay("+375291234567"), "+375 (29) 123-45-67");
  assert.equal(formatPhoneDisplay("+48123456789"), "+48 123 456 789");
});

test("phone-utils: maskNationalDigits", () => {
  assert.equal(maskNationalDigits("9991234567", "RU"), "(999) 123-45-67");
  assert.equal(maskNationalDigits("291234567", "BY"), "(29) 123-45-67");
  assert.equal(maskNationalDigits("123456789", "PL"), "123 456 789");
});
