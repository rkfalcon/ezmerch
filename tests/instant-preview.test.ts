import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { composePreview } from "../lib/lineup/instant-preview";

test("instant preview uses provider print-area coordinates and correct layer order", async () => {
  const logo = await sharp({
    create: { width: 10, height: 10, channels: 4, background: "#ff0000" },
  })
    .png()
    .toBuffer();
  const garment = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
  const layout = {
    template_id: 1,
    image_url: "",
    template_width: 100,
    template_height: 100,
    print_area_width: 40,
    print_area_height: 40,
    print_area_left: 50,
    print_area_top: 10,
    is_template_on_front: true,
  };
  const image = await composePreview(logo, layout, garment, null, 1, "front");
  const { data, info } = await sharp(image)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixel = (x: number, y: number) => [
    ...data.subarray(
      (y * info.width + x) * info.channels,
      (y * info.width + x) * info.channels + 3,
    ),
  ];
  assert.ok(pixel(70, 30)[0] > 230 && pixel(70, 30)[1] < 30);
  assert.ok(pixel(10, 80).every((v) => v > 230));
  await assert.rejects(
    composePreview(
      logo,
      { ...layout, print_area_left: 99 },
      garment,
      null,
      1,
      "front",
    ),
    /dimensions/,
  );
});
