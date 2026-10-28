// Guárdalo como: netlify/functions/stonks.js
const sharp = require("sharp");

// ================= AJUSTES =================
// Imagen de la plantilla (súbela a tu repo y pega aquí su enlace "raw")
const TEMPLATE_URL = "https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/stonks.png";
// Posición de la cabeza nueva: esquina superior izquierda (x, y) y tamaño en píxeles
const HEAD = { x: 300, y: 80, size: 220 };
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

exports.handler = async (event) => {
  try {
    const avatar = event.queryStringParameters && event.queryStringParameters.avatar;
    if (!avatar) return text(400, "Falta ?avatar=URL");

    let u;
    try { u = new URL(avatar); } catch { return text(400, "Avatar inválido"); }
    // Seguridad: solo avatares de Discord
    if (!["cdn.discordapp.com", "media.discordapp.net"].includes(u.hostname)) {
      return text(400, "Solo se permiten avatares de Discord");
    }
    u.search = "?size=256";

    if (!templateCache) templateCache = await download(TEMPLATE_URL);
    const avatarBuf = await download(u.toString());

    const { x, y, size } = HEAD;
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
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
      body: out.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    return text(500, "Error: " + e.message);
  }
};
