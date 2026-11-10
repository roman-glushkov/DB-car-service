const { httpError, cleanText, positiveId } = require("./validators");
function text(value, label, max = 150, required = true) {
  const result = cleanText(value, max + 1);
  if (result.length > max || (required && !result)) throw httpError(400, `Поле «${label}» должно содержать от 1 до ${max} символов.`);
  return result || null;
}
function number(value, label, { min = 0, max = 999999999, integer = false, nullable = false } = {}) {
  if (nullable && (value == null || value === "")) return null;
  if (value == null || value === "" || (typeof value === "string" && !value.trim())) throw httpError(400, `Заполните поле «${label}».`);
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max || (integer && !Number.isSafeInteger(result))) throw httpError(400, `Некорректное значение поля «${label}».`);
  return result;
}
function vin(value) {
  const v = String(value ?? "").trim().toUpperCase();
  if (!v) return null;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) throw httpError(400, "VIN: ровно 17 латинских букв/цифр, без I, O, Q.");
  return v;
}
function email(value, required = false) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v && !required) return null;
  if (v.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw httpError(400, "Некорректный email.");
  return v;
}
function phone(value) {
  const v = text(value, "Телефон", 20);
  if (!/^[+\d()\s-]+$/.test(v) || v.replace(/\D/g, "").length < 10 || v.replace(/\D/g, "").length > 15) throw httpError(400, "Телефон: от 10 до 15 цифр.");
  return v;
}
function car(body) {
  return {
    client_id: positiveId(body.client_id, "клиента"),
    brand: text(body.brand, "Марка", 50),
    model: text(body.model, "Модель", 50),
    vin: vin(body.vin),
    license_plate: text(body.license_plate, "Госномер", 15, false)?.toUpperCase() || null,
    year: number(body.year, "Год выпуска", { min: 1886, max: new Date().getFullYear() + 1, integer: true, nullable: true })
  };
}
function part(body) {
  return {
    name: text(body.name, "Название", 150),
    part_type: text(body.part_type, "Тип запчасти", 100, false),
    article: text(body.article, "Артикул", 50, false),
    manufacturer: text(body.manufacturer, "Производитель", 100, false),
    stock_quantity: number(body.stock_quantity, "Остаток", { integer: true }),
    price: number(body.price, "Цена", { max: 99999999.99 })
  };
}
module.exports = { text, number, vin, email, phone, car, part };
