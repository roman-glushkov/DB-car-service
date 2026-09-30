USE autoservice;

SET FOREIGN_KEY_CHECKS=0;
DELETE FROM payments;
DELETE FROM order_parts;
DELETE FROM order_works;
DELETE FROM orders;
DELETE FROM parts;
DELETE FROM work_types;
DELETE FROM employees;
DELETE FROM cars;
DELETE FROM clients;
SET FOREIGN_KEY_CHECKS=1;

ALTER TABLE clients AUTO_INCREMENT=1;
ALTER TABLE cars AUTO_INCREMENT=1;
ALTER TABLE employees AUTO_INCREMENT=1;
ALTER TABLE orders AUTO_INCREMENT=1;
ALTER TABLE work_types AUTO_INCREMENT=1;
ALTER TABLE parts AUTO_INCREMENT=1;
ALTER TABLE payments AUTO_INCREMENT=1;
ALTER TABLE order_works AUTO_INCREMENT=1;
ALTER TABLE order_parts AUTO_INCREMENT=1;

INSERT INTO clients(full_name, phone, email) VALUES
('Иванов Дмитрий', '+7 917 441-20-11', 'd.ivanov@mail.ru'),
('Смирнова Анна', '+7 902 318-72-44', 'a.smirnova@mail.ru'),
('Петров Алексей', '+7 927 510-33-12', 'a.petrov@mail.ru'),
('Соколов Максим', '+7 905 802-11-08', 'm.sokolov@mail.ru'),
('Кузнецов Илья', '+7 917 120-49-01', 'i.kuznetsov@mail.ru');

INSERT INTO cars(client_id, vin, license_plate, brand, model, year) VALUES
(1, 'WBAKS410500A00001', 'А991МР12', 'BMW', 'X5', 2019),
(2, 'Z94C241BAKR000002', 'К483КХ12', 'Kia', 'Rio', 2021),
(3, 'XW7BF4FK20S000003', 'Т214РВ12', 'Toyota', 'Camry', 2020),
(4, 'WAUZZZ4G0JN000004', 'М712ТА12', 'Audi', 'A6', 2018),
(5, 'WDD2130421A000005', 'О221ЕР12', 'Mercedes-Benz', 'E-Class', 2022);

INSERT INTO employees(full_name, position, phone, is_active) VALUES
('Петров Алексей', 'Мастер-приёмщик', '+7 917 440-11-22', 1),
('Соколов Максим', 'Автомеханик', '+7 902 220-31-12', 1),
('Орлов Павел', 'Автомеханик', '+7 927 330-42-08', 1),
('Кузьмин Андрей', 'Диагност', '+7 917 550-11-08', 1),
('Васильев Роман', 'Автомеханик', '+7 905 881-72-44', 0);

INSERT INTO work_types(name, default_price, estimated_duration) VALUES
('Замена моторного масла', 2500, 60),
('Диагностика ходовой части', 1500, 45),
('Замена тормозных колодок', 3200, 90),
('Компьютерная диагностика', 1800, 40),
('Замена свечей зажигания', 2200, 60),
('Развал-схождение', 2900, 90),
('Замена аккумулятора', 800, 30),
('ТО по регламенту', 6500, 150);

INSERT INTO parts(name, part_type, article, manufacturer, stock_quantity, price) VALUES
('Масло 5W-30 4L', 'Моторное масло', 'MOB-530-4', 'Mobil', 18, 4900),
('Колодки передние BMW X5', 'Тормозная система', 'BP-5521', 'Brembo', 3, 12800),
('Фильтр масляный', 'Фильтр', 'OF-204', 'Mann', 24, 1100),
('Свеча зажигания', 'Система зажигания', 'SP-884', 'NGK', 6, 1350),
('Фильтр воздушный', 'Фильтр', 'AF-120', 'Mahle', 2, 1700),
('Антифриз G12+', 'Техническая жидкость', 'AFZ-5', 'Liqui Moly', 31, 1900);

INSERT INTO orders(car_id, employee_id, status_id, created_at, planned_finish_date, mileage, complaint, diagnosis) VALUES
(1, 4, 2, '2026-09-28 09:00:00', '2026-09-29', 84210, 'Стук в передней подвеске', 'Требуется диагностика ходовой'),
(2, 2, 3, '2026-09-28 10:30:00', '2026-09-28', 52400, 'Плановая замена масла', 'ТО'),
(3, 1, 5, '2026-09-27 13:00:00', '2026-09-28', 91700, 'Скрип тормозов', 'Износ передних колодок'),
(4, 1, 1, '2026-09-28 15:30:00', '2026-09-30', 126300, 'Проверить автомобиль перед поездкой', NULL),
(5, 3, 4, '2026-09-26 11:00:00', '2026-10-01', 38500, 'Ошибка двигателя', 'Ожидание заказанной детали');

INSERT INTO order_works(order_id, work_type_id, employee_id, quantity, price) VALUES
(1, 2, 4, 1, 1500),
(1, 4, 4, 1, 1800),
(2, 1, 2, 1, 2500),
(3, 3, 2, 1, 3200),
(4, 2, 4, 1, 1500),
(5, 4, 4, 1, 1800);

INSERT INTO order_parts(order_id, part_id, quantity, price) VALUES
(2, 1, 1, 4900),
(2, 3, 1, 1100),
(3, 2, 1, 12800),
(5, 6, 2, 1900);

INSERT INTO payments(order_id, amount, payment_date, payment_method) VALUES
(1, 3300, '2026-09-28 12:00:00', 'Банковская карта'),
(2, 8500, '2026-09-28 14:10:00', 'Наличные'),
(3, 16000, '2026-09-28 16:20:00', 'Банковская карта'),
(5, 3000, '2026-09-27 10:00:00', 'Перевод');
