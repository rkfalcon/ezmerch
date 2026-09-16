import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bannerColor,
  bannerTextColor,
  validateBannerSettings,
} from "../lib/store-banner";

test("banner defaults preserve the old primary tint and choose readable text", () => {
  assert.equal(bannerColor(null, "#000000"), "#efefef");
  assert.equal(bannerColor(null, "#ffffff"), "#ffffff");
  assert.equal(bannerColor("#153D32", "#000000"), "#153D32");
  assert.equal(bannerTextColor("#000000"), "#ffffff");
  assert.equal(bannerTextColor("#ffffff"), "#000000");
  assert.equal(bannerTextColor("#153D32"), "#ffffff");
});
test("banner settings validate colors and length while allowing owners to hide the subtitle", () => {
  assert.deepEqual(validateBannerSettings("#ABCDEF", " Hello "), {
    banner_color: "#abcdef",
    banner_subtitle: "Hello",
  });
  assert.equal(validateBannerSettings("#000000", "").banner_subtitle, "");
  assert.throws(
    () => validateBannerSettings("red", "Hi"),
    /valid banner color/,
  );
  assert.throws(
    () => validateBannerSettings("#ffffff", "x".repeat(241)),
    /240/,
  );
  assert.throws(() => validateBannerSettings(null, "Hi"), /valid banner color/);
});
