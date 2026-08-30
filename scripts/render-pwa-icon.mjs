import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const svg = readFileSync(path.join(root, "public", "icon.svg"));

function png(size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "#07090f",
  });
  return resvg.render().asPng();
}

writeFileSync(path.join(root, "public", "icon-512.png"), png(512));
writeFileSync(path.join(root, "public", "icon-192.png"), png(192));
writeFileSync(path.join(root, "public", "apple-touch-icon.png"), png(180));
console.log("wrote icon-512.png, icon-192.png, apple-touch-icon.png");
