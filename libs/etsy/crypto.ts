import crypto from "crypto";

function getKey() {
  const hex = process.env.ETSY_TOKEN_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ETSY_TOKEN_KEY debe ser hex de 32 bytes (64 caracteres)");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plain: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string) {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}