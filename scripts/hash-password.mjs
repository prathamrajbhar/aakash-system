// Usage: node scripts/hash-password.mjs            (prompts, no echo is not possible in plain node; pass via env)
//        AAKASH_NEW_PASSWORD='...' node scripts/hash-password.mjs
// Prints AAKASH_PASSWORD_HASH and a fresh AAKASH_SESSION_SECRET for .env.
import { randomBytes, scryptSync } from "node:crypto";

const password = process.env.AAKASH_NEW_PASSWORD;
if (!password || password.length < 12) {
  console.error("Set AAKASH_NEW_PASSWORD to a password of at least 12 characters.");
  process.exit(1);
}
const salt = randomBytes(16);
console.log(`AAKASH_PASSWORD_HASH=scrypt:${salt.toString("base64url")}:${scryptSync(password, salt, 64).toString("base64url")}`);
console.log(`AAKASH_SESSION_SECRET=${randomBytes(32).toString("hex")}`);
