export type CartItem = {
  id: string;
  partId: string | number;
  title: string;
  oem: string;
  brand: string;
  condition: string;
  price: number | null;
  photo: string;
  quantity: number;
};

export const CART_STORAGE_KEY = "zaptut_cart_items";

export function loadCartFromStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCartToStorage(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error("Failed to save cart to localStorage:", err);
  }
}

export function clearCartStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch {}
}
