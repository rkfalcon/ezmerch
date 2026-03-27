// Map Printful product types to user-friendly categories
// Based on Printful's type_name field

export const PRODUCT_CATEGORIES: Record<string, string[]> = {
  "T-Shirts": [
    "T-Shirt",
    "Crop Tee",
    "Crew Neck T-Shirt",
    "Athletic T-Shirt",
    "Performance",
    "Cotton Crew",
    "V-Neck",
    "Ringer",
    "Baseball",
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
  const titleLower = title.toLowerCase();

  for (const [category, keywords] of Object.entries(PRODUCT_CATEGORIES)) {
    for (const keyword of keywords) {
      if (titleLower.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  return "Other";
}

export function getCategoryList(): string[] {
  return [...Object.keys(PRODUCT_CATEGORIES), "Other"];
}
