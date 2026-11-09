const express = require("express");
const router = express.Router();
const { query } = require("../../config/db");
const { route } = require("../../utils/validators");

router.get(
  "/parts",
  route(async (_req, res) => {
    res.json(
      await query(
        "SELECT part_id, name, part_type, article, manufacturer, stock_quantity, price FROM parts ORDER BY name"
      )
    );
  })
);

module.exports = router;
