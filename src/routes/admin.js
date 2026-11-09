const express = require("express");
const router = express.Router();
const { requireRole } = require("../middleware/auth");

router.use(requireRole("admin"));
router.use(require("./admin/accounts"));
router.use(require("./admin/orders"));
router.use(require("./admin/employees"));
router.use(require("./admin/cars"));
router.use(require("./admin/clients"));
router.use(require("./admin/works"));
router.use(require("./admin/parts"));
router.use(require("./admin/payments"));

module.exports = router;
