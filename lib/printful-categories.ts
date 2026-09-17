// Map Printful product types to user-friendly categories
// Based on Printful's type_name field

export const PRODUCT_CATEGORIES: Record<string, string[]> = {
  "T-Shirts": [
    "T-Shirt",
    "Crop Tee",
    "Crew Neck T-Shirt",
    "Athletic T-Shirt",
    "Baseball Tee",
    "Tee",
  ],
  "Long Sleeve Shirts": [
    "Long Sleeve",
    "3/4 Sleeve",
    "Henley",
  ],
  "Hoodies & Sweatshirts": [
    "Hoodie",
    "Sweatshirt",
    "Pullover",
    "Quarter-Zip",
    "Zip Up",
    "Crewneck",
  ],
  "Tank Tops": [
    "Tank Top",
    "Racerback",
    "Muscle",
  ],
  "Hats & Beanies": [
    "Hat",
    "Cap",
    "Beanie",
    "Visor",
    "Snapback",
    "Trucker",
    "Bucket Hat",
    "Dad Hat",
  ],
  "Pants & Shorts": [
    "Jogger",
    "Shorts",
    "Legging",
    "Sweatpant",
    "Biker Short",
  ],
  "Dresses & Skirts": [
    "Dress",
    "Skirt",
  ],
  "Bags & Accessories": [
    "Tote",
    "Backpack",
    "Duffle",
    "Fanny Pack",
    "Bag",
    "Luggage",
    "Crossbody",
    "Gym Bag",
  ],
  "Phone Cases": [
    "Phone Case",
    "iPhone",
    "Samsung",
    "Case for",
  ],
  "Mugs & Drinkware": [
    "Mug",
    "Tumbler",
    "Water Bottle",
    "Drinkware",
    "Glass",
  ],
  "Home & Living": [
    "Pillow",
    "Blanket",
    "Towel",
    "Shower Curtain",
    "Rug",
    "Canvas",
    "Poster",
    "Flag",
    "Ornament",
    "Candle",
    "Clock",
    "Coaster",
  ],
  "Stickers & Patches": [
    "Sticker",
    "Patch",
    "Magnet",
    "Pin",
  ],
  "Kids & Baby": [
    "Kids",
    "Baby",
    "Toddler",
    "Infant",
    "Onesie",
    "Youth",
  ],
  "Swimwear & Activewear": [
    "Swimsuit",
    "Rash Guard",
    "Sports Bra",
    "Bikini",
  ],
  "Outerwear": [
    "Jacket",
    "Windbreaker",
    "Vest",
    "Coat",
    "Bomber",
    "Parka",
  ],
  "Polo Shirts": [
    "Polo",
  ],
};

export function categorizeProduct(title: string): string {
  // Ignore brand/model text: e.g. Bella + Canvas is not a canvas print.
  const titleLower = title.split("|")[0].toLowerCase();
  if (/\bteddy bear\b/.test(titleLower)) return "Home & Living";
  const priority = ["Dresses & Skirts", "Long Sleeve Shirts", "Hats & Beanies", "Polo Shirts", ...Object.keys(PRODUCT_CATEGORIES)];

  for (const category of new Set(priority)) {
    const keywords = PRODUCT_CATEGORIES[category];
    for (const keyword of keywords) {
      const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}s?\\b`).test(titleLower)) {
        return category;
      }
    }
  }

  return "Other";
}

export function getCategoryList(): string[] {
  return [...Object.keys(PRODUCT_CATEGORIES), "Other"];
}

/** Match every query word across name, brand and model, ignoring punctuation. */
export function matchesCatalogSearch(product: { title: string; brand?: string; model?: string }, query: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const text = normalize(`${product.title} ${product.brand ?? ""} ${product.model ?? ""}`);
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.every((term) => text.includes(term))) return true;
  // Support the common mistaken name without hiding genuine "custom" products.
  return text.includes("comfort colors") && terms.every((term) => text.includes(term === "custom" ? "comfort" : term));
}
