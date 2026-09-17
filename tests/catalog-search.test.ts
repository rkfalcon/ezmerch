import test from "node:test";
import assert from "node:assert/strict";
import { categorizeProduct, matchesCatalogSearch } from "../lib/printful-categories";
test("product categories distinguish baseball caps, tees, and brand names", () => {
  for (const title of ["Youth Baseball Cap | Valucap VC300Y", "5 Panel Mid-Profile Baseball Cap | Otto Cap 31-069", "Performance Hat | Adidas"]) assert.equal(categorizeProduct(title), "Hats & Beanies");
  assert.equal(categorizeProduct("Unisex Baseball Tee | Bella + Canvas"), "T-Shirts");
  assert.equal(categorizeProduct("Long Sleeve T-Shirt | Bella + Canvas"), "Long Sleeve Shirts");
  assert.equal(categorizeProduct("T-Shirt Dress"), "Dresses & Skirts");
  assert.equal(categorizeProduct("Unisex Knitted V-Neck Vest"), "Outerwear");
  assert.equal(categorizeProduct("Teddy Bear with a T-shirt"), "Home & Living");
  assert.equal(categorizeProduct("Capri Leggings"), "Pants & Shorts");
  assert.equal(categorizeProduct("Premium Polo | Bella + Canvas"), "Polo Shirts");
});
test("brand search supports partial names, punctuation, and Custom Colors alias", () => {
  const comfort={title:"Coastal Washed Cap | Comfort Colors® CCWC0",brand:"Comfort Colors",model:"CCWC0"};
  for(const query of ["custom", "Custom Colors", "comfort", "comfort ccwc0"]) assert.ok(matchesCatalogSearch(comfort, query));
  assert.ok(matchesCatalogSearch({title:"Custom Shaped Pillow"},"custom"));
  assert.ok(matchesCatalogSearch({title:"Unisex Staple Tee",brand:"Bella + Canvas",model:"3001"},"Bella"));
  assert.ok(matchesCatalogSearch({title:"Unisex Staple Tee",brand:"Bella + Canvas",model:"3001"},"bella canvas"));
  assert.equal(matchesCatalogSearch(comfort,"Bella"),false);
});
