const crypto = require("node:crypto");

const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

function verifyPassword(password, storedHash) {
  if (typeof storedHash !== "string") return false;
  const [algorithm, saltValue, hashValue] = storedHash.split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(hashValue, "base64url");
    const actual = crypto.scryptSync(String(password), salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
