/* Vita Plena — icon and splash sources.
   One drawing, the household's mark (a flared cross with a gold roundel on a
   Marian blue field), rendered at every size the web app and the native shells
   need. Run `node scripts/build-icons.mjs`, then `npx capacitor-assets generate`
   turns assets/ into the iOS asset catalog and the Android mipmaps/drawables.

   Outputs
     public/icon.svg, public/icons/*.png       the web app + PWA
     assets/icon-only.png                      1024²  iOS app icon (Apple rounds the corners)
     assets/icon-foreground.png                1024²  Android adaptive icon, transparent
     assets/icon-background.png                1024²  Android adaptive icon, the blue field
     assets/splash.png, assets/splash-dark.png 2732²  launch screens */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const BLUE = "#1F4E8C", DEEP = "#16386A", CREAM = "#F5F0E6", GOLD = "#C9A227";

/** The mark on a rounded blue field, `size` px, corner radius as a fraction. */
function iconSvg({ size = 512, radius = 0.22, field = true, scale = 1 } = {}) {
  const r = Math.round(size * radius);
  const s = size / 512, k = scale; // the original drawing is on a 512 grid
  const t = `translate(${size / 2} ${size / 2}) scale(${s * k}) translate(-256 -256)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BLUE}"/><stop offset="1" stop-color="${DEEP}"/></linearGradient></defs>
  ${field ? `<rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>` : ""}
  <g transform="${t}">
    <path fill="${CREAM}" d="M232 96h48v104h104v48H280v168h-48V248H128v-48h104z"/>
    <circle cx="256" cy="224" r="22" fill="${GOLD}"/>
  </g>
</svg>`;
}

/** A solid blue square (the adaptive-icon background, or a splash field). */
const fieldSvg = (size, color = DEEP) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BLUE}"/><stop offset="1" stop-color="${color}"/></linearGradient></defs><rect width="${size}" height="${size}" fill="url(#g)"/></svg>`;

const png = (svg, out) => sharp(Buffer.from(svg)).png().toFile(out);

await mkdir("assets", { recursive: true });
await mkdir("public/icons", { recursive: true });

// the web
await writeFile("public/icon.svg", iconSvg({ size: 512 }));
await png(iconSvg({ size: 192 }), "public/icons/icon-192.png");
await png(iconSvg({ size: 512 }), "public/icons/icon-512.png");
await png(iconSvg({ size: 180 }), "public/icons/apple-touch-icon.png");
await png(iconSvg({ size: 32, radius: 0.18 }), "public/icons/favicon-32.png");
await png(iconSvg({ size: 64, radius: 0.18 }), "public/icons/favicon-64.png");
// maskable: no rounded corners, the mark within the inner 80% safe zone
await png(iconSvg({ size: 512, radius: 0, scale: 0.8 }), "public/icons/icon-maskable-512.png");

// native icons
// App Store Connect rejects an icon with an alpha channel, so this one is flattened.
await sharp(Buffer.from(iconSvg({ size: 1024, radius: 0 }))).removeAlpha().png().toFile("assets/icon-only.png");
await png(iconSvg({ size: 1024, field: false, scale: 0.62 }), "assets/icon-foreground.png");
await png(fieldSvg(1024), "assets/icon-background.png");

// splash: the mark small in the middle of a blue field, no field behind it
await png(`<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732">
  ${fieldSvg(2732).replace(/^<svg[^>]*>|<\/svg>$/g, "")}
  <g transform="translate(1366 1366) scale(1.1) translate(-256 -256)">
    <path fill="${CREAM}" d="M232 96h48v104h104v48H280v168h-48V248H128v-48h104z"/>
    <circle cx="256" cy="224" r="22" fill="${GOLD}"/>
  </g>
</svg>`, "assets/splash.png");
await sharp("assets/splash.png").toFile("assets/splash-dark.png");

console.log("icons written: public/icon.svg, public/icons/*, assets/*");
