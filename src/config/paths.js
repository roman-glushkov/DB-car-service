const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "../..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const UPLOADS_DIR = path.join(ROOT_DIR, "uploads");

module.exports = { ROOT_DIR, PUBLIC_DIR, UPLOADS_DIR };
