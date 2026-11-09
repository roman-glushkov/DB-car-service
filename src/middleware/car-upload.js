const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const multer = require("multer");
const { ROOT_DIR } = require("../config/paths");
const { httpError } = require("../utils/validators");

const uploadDirectory = path.join(ROOT_DIR, "uploads", "cars");
fs.mkdirSync(uploadDirectory, { recursive: true });

const carPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => {
      const extensions = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      };
      callback(null, `${crypto.randomUUID()}${extensions[file.mimetype] || ".img"}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    callback(
      allowed.includes(file.mimetype) ? null : httpError(400, "Разрешены только JPG, PNG и WebP."),
      allowed.includes(file.mimetype)
    );
  },
});

module.exports = carPhotoUpload;
