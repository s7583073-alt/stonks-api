// Guárdalo como: netlify/functions/stonks.js
const sharp = require("sharp");

// ================= AJUSTES =================
// Imagen de la plantilla (ya apunta a tu repo)
const TEMPLATE_URL = "https://raw.githubusercontent.com/s7583073-alt/stonks-api/main/601448566dfbe10018e00c5d.png";
// Posición de la cabeza nueva: esquina superior izquierda (x, y) y tamaño en píxeles.
// Puedes probar otros números sin editar el código agregando &x=...&y=...&size=... al enlace.
const HEAD = { x: 600, y: 120, size: 220 };
// true = avatar redondo, false = cuadrado
const ROUND = true;
// ===========================================

let templateCache = null;

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo descargar: " + url);
  return Buffer.from(await res.arrayBuffer());
}

function text(code, msg) {
  return { statusCode: code, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: msg };
}

function num(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

exports.handler = async (event) => {
  try {
    const q = event.queryStringParameters || {};

    if (!templateCache) templateCache = await download(TEMPLATE_URL);
    const meta = await sharp(templateCache).metadata();

    // ?info=1 -> muestra el tamaño de la plantilla
    if (q.info) return text(200, `Plantilla: ${meta.width} x ${meta.height} px`);

    if (!q.avatar) return text(400, "Falta ?avatar=URL");
    let u;
    try { u = new URL(q.avatar); } catch { return text(400, "Avatar inválido"); }
    // Seguridad: solo avatares de Discord
    if (!["cdn.discordapp.com", "media.discordapp.net"].includes(u.hostname)) {
      return text(400, "Solo se permiten avatares de Discord");
    }
    u.search = "?size=256";

    // Posición y tamaño (se pueden cambiar con &x= &y= &size=), siempre dentro de la imagen
    const size = Math.max(10, Math.min(num(q.size, HEAD.size), meta.width, meta.height));
    const x = Math.max(0, Math.min(num(q.x, HEAD.x), meta.width - size));
    const y = Math.max(0, Math.min(num(q.y, HEAD.y), meta.height - size));

    const avatarBuf = await download(u.toString());

    let face = sharp(avatarBuf).resize(size, size, { fit: "cover" });
    if (ROUND) {
      const mask = Buffer.from(
        `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`
      );
      face = face.composite([{ input: mask, blend: "dest-in" }]);
    }
    const faceBuf = await face.png().toBuffer();

    const out = await sharp(templateCache)
      .composite([{ input: faceBuf, left: x, top: y }])
      .png()
      .toBuffer();

    return {
      statusCode: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" },
      body: out.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    return text(500, "Error: " + e.message);
  }
};
