import sharp from "sharp";
import { compareLogoArtwork } from "../lib/lineup/visual-comparison";
async function logo(text: string, size: number) {
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 600 600"><rect x="40" y="40" width="520" height="520" rx="90" fill="#183b56"/><circle cx="300" cy="235" r="100" fill="#ff9f43"/><text x="300" y="430" text-anchor="middle" font-family="Arial" font-size="64" font-weight="bold" fill="white">${text}</text></svg>`,
    ),
  )
    .png()
    .toBuffer();
}
async function main() {
  const source = await logo("EZMERCH", 600);
  const same = await compareLogoArtwork(source, await logo("EZMERCH", 2400));
  console.log(JSON.stringify({ case: "matching logo", ...same }));
  const changed = await compareLogoArtwork(source, await logo("EZMFRCH", 2400));
  console.log(JSON.stringify({ case: "changed letter", ...changed }));
  if (same.status !== "passed" || changed.status !== "review")
    process.exitCode = 1;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
