# -*- coding: utf-8 -*-
"""
transform.py — читает CSV из csv_out/, преобразует под схему autoservice
и заливает напрямую в MariaDB. Старые ДАННЫЕ удаляются, схема не трогается.
"""

import os
import csv
import random
import hashlib
from datetime import datetime, timedelta
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv

# ---------- настройки ----------
BASE = Path(__file__).parent
CSV_DIR = BASE / "csv_out"
USD_TO_RUB = 90
PLATE_REGION = "12"  # московский код как в твоём старом сиде

load_dotenv(BASE / ".env")

DB = dict(
    host=os.getenv("DB_HOST", "127.0.0.1"),
    port=int(os.getenv("DB_PORT", "3306")),
    user=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASSWORD", ""),
    database=os.getenv("DB_NAME", "autoservice"),
)

random.seed(42)  # повторяемость

# ---------- генераторы русских данных ----------
MALE_NAMES = ["Александр","Дмитрий","Максим","Сергей","Андрей","Алексей","Артём","Илья","Кирилл","Михаил",
              "Никита","Матвей","Роман","Егор","Арсений","Иван","Денис","Евгений","Даниил","Тимур"]
FEMALE_NAMES = ["Анна","Мария","Елена","Ольга","Наталья","Ирина","Татьяна","Светлана","Юлия","Екатерина",
                "Дарья","Алина","Ксения","Виктория","Полина","Софья","Валерия","Вероника","Маргарита","Алиса"]
SURNAMES_M = ["Иванов","Смирнов","Кузнецов","Соколов","Попов","Лебедев","Козлов","Новиков","Морозов","Петров",
              "Волков","Соловьёв","Васильев","Зайцев","Павлов","Семёнов","Голубев","Виноградов","Богданов","Воробьёв"]
SURNAMES_F = ["Иванова","Смирнова","Кузнецова","Соколова","Попова","Лебедева","Козлова","Новикова","Морозова","Петрова",
              "Волкова","Соловьёва","Васильева","Зайцева","Павлова","Семёнова","Голубева","Виноградова","Богданова","Воробьёва"]
PATRONYM_M = ["Александрович","Дмитриевич","Сергеевич","Андреевич","Алексеевич","Михайлович","Иванович","Петрович",
              "Николаевич","Владимирович","Олегович","Юрьевич","Викторович","Игоревич","Максимович"]
PATRONYM_F = ["Александровна","Дмитриевна","Сергеевна","Андреевна","Алексеевна","Михайловна","Ивановна","Петровна",
              "Николаевна","Владимировна","Олеговна","Юрьевна","Викторовна","Игоревна","Максимовна"]

LATIN_VIN = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"  # без I, O, Q
LATIN_PLATE = "АВЕКМНОРСТУХ"  # русские буквы, допустимые на номерах (по факту визуально латинские)

def gen_fio():
    male = random.random() < 0.6
    if male:
        return f"{random.choice(SURNAMES_M)} {random.choice(MALE_NAMES)} {random.choice(PATRONYM_M)}"
    return f"{random.choice(SURNAMES_F)} {random.choice(FEMALE_NAMES)} {random.choice(PATRONYM_F)}"

def gen_phone():
    return f"+7 9{random.randint(10,99):02d} {random.randint(100,999)}-{random.randint(10,99):02d}-{random.randint(10,99):02d}"

def gen_email(fio):
    parts = fio.split()
    translit = {
        "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"zh","з":"z","и":"i","й":"y",
        "к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f",
        "х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya",
    }
    def tr(s):
        return "".join(translit.get(c.lower(), c.lower()) for c in s)
    domains = ["mail.ru","yandex.ru","gmail.com","inbox.ru","list.ru"]
    return f"{tr(parts[1])}.{tr(parts[0])}@{random.choice(domains)}"

def gen_vin():
    return "".join(random.choice(LATIN_VIN) for _ in range(17))

def gen_plate():
    return f"{random.choice(LATIN_PLATE)}{random.randint(100,999)}{random.choice(LATIN_PLATE)}{random.choice(LATIN_PLATE)}{PLATE_REGION}"

def read_csv(name):
    path = CSV_DIR / name
    if not path.exists():
        print(f"[WARN] нет файла {path}")
        return []
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def parse_date(s):
    if not s:
        return None
    for fmt in ("%m/%d/%Y %I:%M:%S %p", "%m/%d/%Y", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s.strip(), fmt)
        except ValueError:
            continue
    return None

def to_rub(v):
    try:
        return round(float(v) * USD_TO_RUB, 2)
    except (TypeError, ValueError):
        return 0.0

# ---------- перевод доменов ----------
DOMAIN_RU = {
    "ACCESSORIES": "Аксессуары",
    "ADMINISTRATIVE": "Административные услуги",
    "AIR_CONDITIONING": "Кондиционер",
    "BATTERY_SYSTEM": "Аккумулятор и питание",
    "BRAKE_SYSTEM": "Тормозная система",
    "COOLING_SYSTEM": "Система охлаждения",
    "DRIVETRAIN": "Трансмиссия и привод",
    "ENGINE_SYSTEM": "Двигатель",
    "EXHAUST_SYSTEM": "Выхлопная система",
    "FILTRATION": "Фильтрация",
    "FUEL_SYSTEM": "Топливная система",
    "HVAC": "Климат-контроль",
    "IGNITION_SYSTEM": "Система зажигания",
    "INSPECTION": "Диагностика и осмотр",
    "LIGHTING": "Освещение",
    "STEERING": "Рулевое управление",
    "SUSPENSION": "Подвеска",
    "TIRE_WHEEL": "Шины и колёса",
    "TRANSMISSION": "КПП",
    "WIPER_SYSTEM": "Стеклоочистители",
    "OTHER": "Прочее",
}

# ---------- чистка БД ----------
def wipe(conn):
    cur = conn.cursor()
    cur.execute("SET FOREIGN_KEY_CHECKS=0")
    for t in ["payments","order_parts","order_works","orders","parts","work_types","employees","cars","clients"]:
        cur.execute(f"DELETE FROM {t}")
        cur.execute(f"ALTER TABLE {t} AUTO_INCREMENT=1")
    cur.execute("SET FOREIGN_KEY_CHECKS=1")
    conn.commit()
    cur.close()
    print("[OK] старые данные удалены")

# ---------- главное ----------
def main():
    print("=== читаю CSV ===")
    customers = read_csv("sample_customers.csv") or read_csv("customers.csv")
    vehicles  = read_csv("sample_vehicles.csv")  or read_csv("vehicles.csv")
    invoices  = read_csv("sample_invoices.csv")  or read_csv("invoices.csv")
    history   = read_csv("sample_service_history.csv") or read_csv("service_history.csv")
    domains   = read_csv("sample_service_domains.csv") or read_csv("service_domains.csv")
    biztypes  = read_csv("sample_service_business_types.csv") or read_csv("service_business_types.csv")
    cats      = read_csv("sample_invoice_line_categories.csv") or read_csv("invoice_line_categories.csv")

    print(f"  customers: {len(customers)}, vehicles: {len(vehicles)}, invoices: {len(invoices)}, history: {len(history)}")

    print("=== подключаюсь к MariaDB ===")
    conn = mysql.connector.connect(**DB)
    conn.autocommit = False
    cur = conn.cursor()
    print(f"  {DB['user']}@{DB['host']}:{DB['port']}/{DB['database']}")

    wipe(conn)

    # ----- сотрудники -----
    positions = ["Мастер-приёмщик","Автомеханик","Автомеханик","Диагност","Электрик","Кузовщик","Шиномонтажник","Слесарь"]
    cur.execute("DELETE FROM employees")
    cur.execute("ALTER TABLE employees AUTO_INCREMENT=1")
    for i, pos in enumerate(positions):
        fio = gen_fio()
        cur.execute(
            "INSERT INTO employees(full_name, position, phone, is_active) VALUES (%s,%s,%s,%s)",
            (fio, pos, gen_phone(), 0 if i >= 7 else 1)
        )
    conn.commit()
    cur.execute("SELECT employee_id FROM employees")
    employee_ids = [r[0] for r in cur.fetchall()]
    print(f"[OK] сотрудников: {len(employee_ids)}")

    # ----- виды работ из service_domains -----
    domain_map = {}
    for d in domains:
        code = d.get("service_domain_name","").strip()
        if not code:
            continue
        ru = DOMAIN_RU.get(code, code.replace("_"," ").title())
        price = round(random.uniform(800, 8000), 2)
        dur = random.choice([30,40,45,60,90,120,150])
        cur.execute(
            "INSERT INTO work_types(name, default_price, estimated_duration) VALUES (%s,%s,%s)",
            (ru, price, dur)
        )
        domain_map[d["service_domain_id"]] = cur.lastrowid
    conn.commit()
    print(f"[OK] видов работ: {len(domain_map)}")

    # ----- запчасти из invoice_line_categories (ITEM) -----
    part_map = {}
    parts_added = 0
    for c in cats:
        if c.get("item_service_flag","").upper() != "ITEM":
            continue
        if c.get("active_flag","").lower() not in ("true","1"):
            continue
        if c.get("service_complexity_level","").upper() == "ADMINISTRATIVE":
            continue
        name = c.get("invoice_line_category_name","").strip()
        if not name or name in ("CHARITABLE_DONATION","ENVIRONMENTAL_SURCHARGE_FEE","GIFT_CARD_SALE",
                                "GIFT_CERTIFICATE_SALE","LOAN_PROCESSING_FEE","FILTER_CREDIT",
                                "OIL_PURCHASE_CREDIT","GENERAL_SUPPLY_ITEM"):
            continue
        ru_name = name.replace("_"," ").title()
        part_type = DOMAIN_RU.get("", "")  # временно
        dom_id = c.get("service_domain_id","")
        # найдём название домена
        dom_name = ""
        for d in domains:
            if d["service_domain_id"] == dom_id:
                dom_name = DOMAIN_RU.get(d["service_domain_name"], d["service_domain_name"])
                break
        price = round(random.uniform(200, 15000), 2)
        stock = random.randint(2, 40)
        cur.execute(
            "INSERT INTO parts(name, part_type, article, manufacturer, stock_quantity, price) VALUES (%s,%s,%s,%s,%s,%s)",
            (ru_name, dom_name or "Прочее", f"ART-{parts_added+1:04d}", random.choice(["Bosch","Mann","Brembo","NGK","Mahle","Febi","SKF"]), stock, price)
        )
        part_map[c["invoice_line_category_code"]] = cur.lastrowid
        parts_added += 1
    conn.commit()
    print(f"[OK] запчастей: {parts_added}")

    # ----- клиенты и машины -----
    car_map = {}  # vehicle_id -> car_id
    client_map = {}  # customer_vehicle_id -> client_id
    clients_added = 0
    cars_added = 0

    # берём машины по vehicle_id
    veh_by_id = {v["vehicle_id"]: v for v in vehicles}

    for c in customers:
        cv_id = c["customer_vehicle_id"]
        veh_id = c.get("vehicle_id") or cv_id
        veh = veh_by_id.get(veh_id)
        if not veh:
            continue

        # клиент
        fio = gen_fio()
        email = gen_email(fio)
        first = parse_date(c.get("first_visit_date")) or datetime(2024,1,1)
        cur.execute(
            "INSERT INTO clients(full_name, phone, email, created_at) VALUES (%s,%s,%s,%s)",
            (fio, gen_phone(), email, first)
        )
        client_id = cur.lastrowid
        client_map[cv_id] = client_id
        clients_added += 1

        # машина
        try:
            year = int(veh.get("vehicle_year") or 0) or None
        except ValueError:
            year = None
        brand = (veh.get("vehicle_make") or "").strip().title() or "Unknown"
        model = (veh.get("vehicle_model") or "").strip().title() or "Unknown"
        cur.execute(
            """INSERT INTO cars(client_id, vin, license_plate, brand, model, year, photo_path)
               VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (client_id, gen_vin(), gen_plate(), brand, model, year, None)
        )
        car_id = cur.lastrowid
        car_map[veh_id] = car_id
        cars_added += 1

    conn.commit()
    print(f"[OK] клиентов: {clients_added}, машин: {cars_added}")

    # ----- заказы, работы, запчасти, оплаты -----
    statuses = [1,2,3,4,5,6,7]
    orders_added = 0
    works_added = 0
    oparts_added = 0
    pays_added = 0

    # группируем service_history по invoice_id
    hist_by_inv = {}
    for h in history:
        hist_by_inv.setdefault(h["invoice_id"], []).append(h)

    # работаем по invoices
    for inv in invoices:
        veh_id = inv["vehicle_id"]
        car_id = car_map.get(veh_id)
        if not car_id:
            continue
        inv_date = parse_date(inv.get("invoice_date")) or datetime(2024,1,1)
        try:
            mileage = int(float(inv.get("vehicle_mileage") or 0))
        except ValueError:
            mileage = None

        # статус: большинство — Выдан (6), немного открытых
        if inv_date < datetime(2026,8,1):
            status_id = 6  # Выдан
        else:
            status_id = random.choice([1,2,3,4,5])

        emp = random.choice(employee_ids)
        planned = (inv_date + timedelta(days=random.randint(1,7))).date()
        finished = inv_date + timedelta(days=random.randint(1,5)) if status_id == 6 else None

        cur.execute(
            """INSERT INTO orders(car_id, employee_id, status_id, created_at, planned_finish_date,
                                  mileage, finished_at, complaint, diagnosis, comment)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (car_id, emp, status_id, inv_date, planned, mileage, finished,
             "Плановое обращение в сервис", None, None)
        )
        order_id = cur.lastrowid
        orders_added += 1

        # строки истории
        for h in hist_by_inv.get(inv["invoice_id"], []):
            flag = (h.get("invoice_line_category_code") or "").strip()
            service_flag = "SERVICE" if h.get("item_service_flag","").upper() == "SERVICE" else "ITEM"
            code = h.get("invoice_line_category_code","")
            labor = to_rub(h.get("service_labor_amount") or 0)
            parts_amt = to_rub(h.get("service_parts_amount") or 0)
            total = to_rub(h.get("invoice_line_total_amount") or 0)

            if service_flag == "SERVICE":
                # работа
                dom_id = h.get("service_domain_id","")
                wt_id = domain_map.get(dom_id)
                if not wt_id:
                    # fallback: любой
                    wt_id = random.choice(list(domain_map.values())) if domain_map else None
                if not wt_id:
                    continue
                price = labor if labor > 0 else max(total, 500)
                cur.execute(
                    "INSERT INTO order_works(order_id, work_type_id, employee_id, quantity, price) VALUES (%s,%s,%s,%s,%s)",
                    (order_id, wt_id, emp, 1, price)
                )
                works_added += 1
            else:
                # запчасть
                pid = part_map.get(code)
                if not pid:
                    continue
                price = parts_amt if parts_amt > 0 else max(total, 300)
                cur.execute(
                    "INSERT INTO order_parts(order_id, part_id, quantity, price) VALUES (%s,%s,%s,%s)",
                    (order_id, pid, 1, price)
                )
                oparts_added += 1

        # оплата
        if status_id == 6:
            net = to_rub(inv.get("invoice_net_sales") or inv.get("invoice_gross_sales") or 0)
            method = random.choice(["Банковская карта","Наличные","Перевод"])
            cur.execute(
                "INSERT INTO payments(order_id, amount, payment_date, payment_method) VALUES (%s,%s,%s,%s)",
                (order_id, net or 1000, inv_date, method)
            )
            pays_added += 1

        if orders_added % 200 == 0:
            conn.commit()
            print(f"  ... заказов: {orders_added}")

    conn.commit()
    cur.close()
    conn.close()

    print("\n=== ГОТОВО ===")
    print(f"  клиентов:  {clients_added}")
    print(f"  машин:     {cars_added}")
    print(f"  заказов:   {orders_added}")
    print(f"  работ:     {works_added}")
    print(f"  запчастей: {parts_added} (в справочнике)")
    print(f"  строк запчастей в заказах: {oparts_added}")
    print(f"  оплат:     {pays_added}")

if __name__ == "__main__":
    main()