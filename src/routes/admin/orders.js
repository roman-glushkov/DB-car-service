const express = require("express");
const router = express.Router();
router.use(require("./order-read"));
router.use(require("./order-write"));


module.exports = router;
