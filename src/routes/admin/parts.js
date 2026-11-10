const express = require("express");
const router = express.Router();
const { query } = require("../../config/db");
const { route, httpError, positiveId } = require("../../utils/validators");
const { part } = require("../../utils/record-validation");

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

router.post("/parts", route(async (req,res) => {
  const d=part(req.body || {});
  const r=await query("INSERT INTO parts (name,part_type,article,manufacturer,stock_quantity,price) VALUES (?,?,?,?,?,?)",Object.values(d));
  res.status(201).json({ok:true,part_id:Number(r.insertId)});
}));
router.put("/parts/:id",route(async(req,res)=>{
  const id=positiveId(req.params.id,"запчасти"), d=part(req.body || {});
  const r=await query("UPDATE parts SET name=?,part_type=?,article=?,manufacturer=?,stock_quantity=?,price=? WHERE part_id=?",[...Object.values(d),id]);
  if(!r.affectedRows)throw httpError(404,"Запчасть не найдена.");res.json({ok:true});
}));
router.delete("/parts/:id",route(async(req,res)=>{
  const id=positiveId(req.params.id,"запчасти");
  const use=await query("SELECT order_part_id FROM order_parts WHERE part_id=? LIMIT 1",[id]);
  if(use.length)throw httpError(409,"Нельзя удалить запчасть с историей использования.");
  const r=await query("DELETE FROM parts WHERE part_id=?",[id]);if(!r.affectedRows)throw httpError(404,"Запчасть не найдена.");res.json({ok:true});
}));
module.exports = router;
