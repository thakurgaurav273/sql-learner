#!/usr/bin/env node
// Generates db/seed/02_data.sql and db/seed/03_web_events.sql.
//
// The output is committed to git, so you normally never need to run this.
// It uses a seeded pseudo-random generator, so running it again produces
// exactly the same files. Edit the hand-written lists below and re-run
// `npm run seed:generate` if you want different practice data; the app
// notices the seed changed and rebuilds its template database on next start.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- deterministic PRNG (mulberry32) ----------
let seed = 20260101;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
function weightedPick(items, weightOf) {
  const total = items.reduce((s, it) => s + weightOf(it), 0);
  let r = rand() * total;
  for (const it of items) {
    r -= weightOf(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

// ---------- SQL helpers ----------
const q = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
};
function insert(table, columns, rows) {
  const lines = rows.map((r) => `  (${r.map(q).join(', ')})`);
  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${lines.join(',\n')};\n`;
}
const money = (n) => Math.round(n * 100) / 100;
const fmtMoney = (n) => money(n).toFixed(2);
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const fmtTs = (d) => `${fmtDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
const day = (s) => new Date(`${s}T00:00:00Z`);

// =====================================================================
// Hand-written reference data
// =====================================================================

const departments = [
  [1, 'Management', 6000000],
  [2, 'Kitchen & Production', 4500000],
  [3, 'Sales', 5200000],
  [4, 'Delivery & Logistics', 1800000],
  [5, 'Marketing', 1500000],
  [6, 'Quality Lab', null], // no employees, budget not decided -> NULLs
];

const stores = [
  [1, 'Park Street', 'Kolkata', '2019-03-01'],
  [2, 'Salt Lake', 'Kolkata', '2020-08-15'],
  [3, 'Howrah Maidan', 'Howrah', '2021-11-20'],
  [4, 'Indiranagar', 'Bengaluru', '2024-02-01'],
  [5, 'New Town', 'Kolkata', '2026-06-01'], // opened last month: no orders yet
];

// id, first, last, title, dept, manager, store, salary, hired
const employees = [
  [1, 'Ananya', 'Sen', 'Chief Executive Officer', 1, null, null, 300000, '2019-01-02'],
  [2, 'Rahul', 'Bose', 'Head of Production', 2, 1, null, 140000, '2019-01-15'],
  [3, 'Priya', 'Das', 'Head of Sales', 3, 1, null, 150000, '2019-02-01'],
  [4, 'Vikram', 'Iyer', 'Logistics Manager', 4, 1, null, 110000, '2020-06-01'],
  [5, 'Neha', 'Kapoor', 'Marketing Lead', 5, 1, null, 120000, '2021-03-15'],
  [6, 'Subhash', 'Ghosh', 'Master Confectioner', 2, 2, null, 90000, '2019-01-20'],
  [7, 'Moumita', 'Roy', 'Confectioner', 2, 6, null, 45000, '2019-05-10'],
  [8, 'Arif', 'Khan', 'Confectioner', 2, 6, null, 42000, '2022-07-01'],
  [9, 'Tania', 'Mukherjee', 'Store Manager', 3, 3, 1, 70000, '2019-02-20'],
  [10, 'Sourav', 'Pal', 'Store Manager', 3, 3, 2, 68000, '2020-08-01'],
  [11, 'Ritwik', 'Chatterjee', 'Store Manager', 3, 3, 3, 65000, '2021-11-01'],
  [12, 'Deepa', 'Nair', 'Store Manager', 3, 3, 4, 72000, '2024-01-10'],
  [13, 'Joy', 'Banerjee', 'Sales Associate', 3, 9, 1, 28000, '2019-03-01'],
  [14, 'Puja', 'Saha', 'Sales Associate', 3, 9, 1, 27000, '2022-01-05'],
  [15, 'Imran', 'Ali', 'Sales Associate', 3, 10, 2, 26000, '2020-09-01'],
  [16, 'Kiran', 'Rao', 'Sales Associate', 3, 12, 4, 30000, '2024-02-01'],
  [17, 'Babu', 'Mondal', 'Sales Associate', 3, 11, 3, 25000, '2021-12-01'],
  [18, 'Sanjay', 'Dutta', 'Delivery Executive', 4, 4, null, 22000, '2020-07-01'],
  [19, 'Lata', 'Kumari', 'Delivery Executive', 4, 4, null, 22000, '2023-04-01'],
  [20, 'Aditya', 'Verma', 'Digital Marketing Executive', 5, 5, null, 48000, '2023-09-01'],
  [21, 'Rhea', 'Fernandes', 'Data Analyst (Contract)', null, 5, null, 35000, '2025-08-01'], // no department
  [22, 'Nikhil', 'Jain', 'Store Manager', 3, 3, 5, 66000, '2026-05-01'],
];

const salaryGrades = [
  ['E1', 20000, 34999.99],
  ['E2', 35000, 59999.99],
  ['M1', 60000, 99999.99],
  ['M2', 100000, 199999.99],
  ['X1', 200000, 500000],
];

const categories = [
  [1, 'Sweets', null],
  [2, 'Syrup Sweets', 1],
  [3, 'Sandesh & Milk Sweets', 1],
  [4, 'Dry Sweets', 1],
  [5, 'Seasonal Specials', 1],
  [6, 'Sugar-Free', 1], // empty
  [7, 'Snacks', null],
  [8, 'Fried Snacks', 7],
  [9, 'Namkeen', 7],
  [10, 'Beverages', null],
  [11, 'Dairy', null],
  [12, 'Gift Hampers', null], // empty
];

// id, name, category, unit, price, cost, active, launched, months available (null = all year), never ordered?
const products = [
  [1, 'Rasgulla', 2, 'piece', 25, 9, true, '2019-03-01'],
  [2, 'Gulab Jamun', 2, 'piece', 30, 11, true, '2019-03-01'],
  [3, 'Chamcham', 2, 'piece', 35, 13, true, '2019-03-01'],
  [4, 'Pantua', 2, 'piece', 30, 12, false, '2019-03-01'], // discontinued but has old orders
  [5, 'Rajbhog', 2, 'piece', 45, 18, true, '2020-01-10'],
  [6, 'Sandesh', 3, 'piece', 40, 15, true, '2019-03-01'],
  [7, 'Rasmalai', 3, 'piece', 55, 22, true, '2019-03-01'],
  [8, 'Kalakand', 3, 'kg', 720, 380, true, '2019-03-01'],
  [9, 'Malai Chop', 3, 'piece', 50, 20, true, '2021-06-01'],
  [10, 'Kheer Kadam', 3, 'piece', 45, null, true, '2022-02-01'], // unknown cost
  [11, 'Kaju Katli', 4, 'kg', 1200, 780, true, '2019-03-01'],
  [12, 'Soan Papdi', 4, 'box', 250, 120, true, '2019-03-01'],
  [13, 'Besan Ladoo', 4, 'kg', 560, 300, true, '2019-03-01'],
  [14, 'Motichoor Ladoo', 4, 'kg', 520, 280, true, '2019-03-01'],
  [15, 'Nolen Gurer Sandesh', 5, 'piece', 60, 25, true, '2019-12-01'],
  [16, 'Aam Sandesh', 5, 'piece', 55, 24, true, '2020-04-01'],
  [17, 'Jolbhora', 5, 'piece', 70, null, true, '2026-06-15'], // brand new, never ordered
  [18, 'Singara', 8, 'piece', 15, 5, true, '2019-03-01'],
  [19, 'Kachori', 8, 'piece', 20, 7, true, '2019-03-01'],
  [20, 'Nimki', 8, 'pack', 80, 35, true, '2019-03-01'],
  [21, 'Chanachur', 9, 'pack', 90, 40, true, '2019-03-01'],
  [22, 'Aloo Bhujia', 9, 'pack', 110, 55, true, '2020-02-01'],
  [23, 'Masala Peanuts', 9, 'pack', 70, 30, false, '2020-02-01'], // discontinued
  [24, 'Mango Lassi', 10, 'cup', 80, 30, true, '2019-03-01'],
  [25, 'Masala Chai', 10, 'cup', 25, 6, true, '2019-03-01'],
  [26, 'Aam Panna', 10, 'cup', 60, 18, true, '2021-04-01'],
  [27, 'Filter Coffee', 10, 'cup', 40, 10, true, '2026-05-20'], // never ordered
  [28, 'Mishti Doi', 11, 'cup', 50, 20, true, '2019-03-01'],
  [29, 'Bhapa Doi', 11, 'cup', 65, 28, true, '2021-01-15'],
  [30, 'Gawa Ghee', 11, 'kg', 750, 520, false, '2019-03-01'], // never ordered
  [31, "Chef's Surprise Box", null, 'box', 199, null, true, '2026-06-20'], // no category, never ordered
];
const neverOrdered = new Set([17, 27, 30, 31]);
const seasonalMonths = { 15: [12, 1, 2], 16: [4, 5, 6, 7], 26: [3, 4, 5, 6] }; // product id -> months on sale
const popularity = { 1: 9, 2: 6, 6: 8, 7: 5, 28: 8, 18: 7, 19: 4, 25: 6, 11: 4, 12: 3, 24: 3, 15: 7, 16: 5 }; // default weight 2

const suppliers = [
  [1, 'Bardhaman Dairy Co-op', 'Bardhaman', '+91 342 255 0101'],
  [2, 'Joynagar Nolen Gur Traders', 'Joynagar', '+91 3218 220 344'],
  [3, 'Burrabazar Dry Fruits Mart', 'Kolkata', '+91 33 2268 1122'],
  [4, 'Shree Flour Mills', 'Howrah', null],
  [5, 'Darjeeling Leaf Co', 'Darjeeling', '+91 354 225 7788'],
  [6, 'Malda Mango Farms', 'Malda', null], // supplies nothing yet
];

// product, supplier, unit cost
const productSuppliers = [
  [1, 1, 6], [2, 1, 7], [3, 1, 8], [5, 1, 11], [6, 1, 9], [7, 1, 14], [8, 1, 260], [9, 1, 12],
  [10, 1, 15], [15, 1, 12], [15, 2, 8], [16, 1, 11], [28, 1, 12], [29, 1, 16], [30, 1, 480], [24, 1, 18],
  [11, 3, 690], [13, 3, 120], [13, 4, 90], [14, 4, 95], [12, 4, 60], [18, 4, 2], [19, 4, 3], [20, 4, 20],
  [21, 4, 22], [22, 4, 30], [25, 5, 4], [2, 4, 2],
];

// id, first, last, email?, phone?, city?, signup, referred_by
const customers = [
  [1, 'Aarav', 'Sharma', 'aarav.sharma@example.com', '+91 98300 11001', 'Kolkata', '2024-06-03', null],
  [2, 'Ishita', 'Banerjee', 'ishita.b@example.com', '+91 98300 11002', 'Kolkata', '2024-06-10', null],
  [3, 'Rahul', 'Gupta', 'rahul.gupta@example.com', null, 'Howrah', '2024-06-21', 1],
  [4, 'Sneha', 'Reddy', 'sneha.reddy@example.com', '+91 99000 11004', 'Bengaluru', '2024-07-02', null],
  [5, 'Arjun', 'Mehta', 'arjun.mehta@example.com', '+91 98300 11005', 'Kolkata', '2024-07-15', 2],
  [6, 'Kavya', 'Iyer', 'kavya.iyer@example.com', '+91 99000 11006', 'Bengaluru', '2024-08-01', 4],
  [7, 'Rohan', 'Das', 'rohan.das@example.com', '+91 98300 11007', 'Kolkata', '2024-08-19', null], // no orders
  [8, 'Meera', 'Sen', 'meera.sen@example.com', '+91 98300 11008', 'Kolkata', '2024-09-05', 2],
  [9, 'Sourav', 'Ghosh', null, '+91 98300 11009', 'Kolkata', '2024-09-12', null],
  [10, 'Ananya', 'Roy', 'ananya.roy@example.com', '+91 98300 11010', 'Howrah', '2024-09-30', 3],
  [11, 'Vivek', 'Agarwal', 'vivek.agarwal@example.com', '+91 98111 11011', 'Delhi', '2024-10-08', null],
  [12, 'Pooja', 'Chatterjee', 'pooja.c@example.com', '+91 98300 11012', 'Kolkata', '2024-10-14', 8],
  [13, 'Siddharth', 'Bose', 'sid.bose@example.com', null, 'Kolkata', '2024-10-20', null],
  [14, 'Tanvi', 'Joshi', 'tanvi.joshi@example.com', '+91 98200 11014', 'Mumbai', '2024-11-02', 11],
  [15, 'Debjani', 'Mitra', 'debjani.mitra@example.com', '+91 98300 11015', 'Kolkata', '2024-11-11', null], // no orders
  [16, 'Kunal', 'Kapoor', 'kunal.kapoor@example.com', '+91 98111 11016', 'Delhi', '2024-11-25', 11],
  [17, 'Riya', 'Das', 'riya.das@example.com', '+91 98300 11017', 'Kolkata', '2024-12-05', 7],
  [18, 'Amit', 'Paul', null, null, null, '2024-12-18', null], // almost no contact info
  [19, 'Nandini', 'Sen', 'nandini.sen@example.com', '+91 98300 11019', 'Howrah', '2025-01-07', 8],
  [20, 'Farhan', 'Qureshi', 'farhan.q@example.com', '+91 99000 11020', 'Bengaluru', '2025-01-19', 6],
  [21, 'Sneha', 'Ghosh', 'sneha.ghosh@example.com', '+91 98300 11021', 'Kolkata', '2025-02-02', 9],
  [22, 'Manish', 'Tiwari', 'manish.tiwari@example.com', '+91 98200 11022', 'Mumbai', '2025-02-14', null], // no orders
  [23, 'Priyanka', 'Dey', 'priyanka.dey@example.com', '+91 98300 11023', 'Kolkata', '2025-03-01', 2],
  [24, 'Abhishek', 'Nair', 'abhishek.nair@example.com', null, 'Bengaluru', '2025-03-18', 20],
  [25, 'Sayani', 'Basu', 'sayani.basu@example.com', '+91 98300 11025', 'Kolkata', '2025-04-02', 12],
  [26, 'Rahul', 'Banerjee', 'rahul.banerjee@example.com', '+91 98300 11026', 'Kolkata', '2025-04-14', 2],
  [27, 'Zoya', 'Sheikh', 'zoya.sheikh@example.com', '+91 98300 11027', 'Howrah', '2025-05-09', null],
  [28, 'Karthik', 'Subramanian', 'karthik.s@example.com', '+91 99000 11028', 'Bengaluru', '2025-06-01', 4],
  [29, 'Moumita', 'Halder', null, '+91 98300 11029', 'Kolkata', '2025-06-20', null],
  [30, 'Gaurav', 'Mishra', 'gaurav.mishra@example.com', '+91 98111 11030', 'Delhi', '2025-07-11', 16],
  [31, 'Tiyasha', 'Pal', 'tiyasha.pal@example.com', null, 'Kolkata', '2025-08-03', null], // no orders
  [32, 'Ayan', 'Mukherjee', 'ayan.m@example.com', '+91 98300 11032', 'Kolkata', '2025-08-22', 25],
  [33, 'Shreya', 'Saha', 'shreya.saha@example.com', '+91 98300 11033', null, '2025-09-10', null],
  [34, 'Dhruv', 'Malhotra', 'dhruv.m@example.com', '+91 98111 11034', 'Delhi', '2025-09-28', 30],
  [35, 'Ritika', 'Sen', 'ritika.sen@example.com', '+91 98300 11035', 'Kolkata', '2025-10-12', 19],
  [36, 'Arnab', 'Goswami', null, null, 'Kolkata', '2025-11-04', null], // no orders
  [37, 'Lakshmi', 'Narayanan', 'lakshmi.n@example.com', '+91 99000 11037', 'Bengaluru', '2025-12-15', 28],
  [38, 'Bikram', 'Singh', 'bikram.singh@example.com', '+91 98111 11038', 'Delhi', '2026-02-01', null], // no orders
  [39, 'Esha', 'Kar', 'esha.kar@example.com', '+91 98300 11039', 'Kolkata', '2026-04-20', 35], // no orders
  [40, 'Parth', 'Shah', 'parth.shah@example.com', '+91 98200 11040', 'Mumbai', '2026-06-05', null], // no orders
];
const customersWithoutOrders = new Set([7, 15, 22, 31, 36, 38, 39, 40]); // (a couple of rare buyers may end up with none too)
// how often each ordering customer buys (Pareto-ish)
const loyalty = { 2: 6, 5: 5, 8: 5, 1: 4, 12: 4, 4: 3, 10: 3, 19: 3, 21: 3, 25: 3 };

// =====================================================================
// Generated transactional data
// =====================================================================

const DATA_START = day('2025-01-01');
const DATA_END = day('2026-06-30');
// Order volume by month: Bengali festive season (Durga Puja / Diwali, Oct-Nov) is busiest,
// winter (nolen gur) and Poila Baisakh (April) are busy too.
const monthWeight = { 1: 1.3, 2: 1.0, 3: 0.9, 4: 1.4, 5: 0.9, 6: 0.8, 7: 0.7, 8: 0.8, 9: 1.2, 10: 2.4, 11: 1.9, 12: 1.3 };

const storeStaff = {};
for (const e of employees) if (e[6] !== null && e[6] !== 5) (storeStaff[e[6]] ??= []).push(e[0]);
const deliveryStaff = [18, 19];

const orderRows = [];
const itemRows = [];
const paymentRows = [];
const purchases = []; // [customer, product, date] for reviews
const ORDER_COUNT = 170;
const emptyOrders = new Set([37, 128]); // orders with no order_items
let itemId = 1;
let paymentId = 1;

// pick the order dates first so ids increase with time
const months = [];
for (let y = 2025, m = 1; y < 2026 || (y === 2026 && m <= 6); m === 12 ? ((m = 1), y++) : m++) months.push([y, m]);
const orderDates = [];
for (let i = 0; i < ORDER_COUNT; i++) {
  const [y, m] = weightedPick(months, ([, mm]) => monthWeight[mm]);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const d = new Date(Date.UTC(y, m - 1, randInt(1, daysInMonth), randInt(9, 21), randInt(0, 59), randInt(0, 59)));
  orderDates.push(d);
}
orderDates.sort((a, b) => a - b);

// Choose the customer of every order up front (anonymous walk-ins get null)...
const orderCustomer = orderDates.map((at) => {
  if (rand() < 0.09) return null;
  const eligible = customers.filter((c) => !customersWithoutOrders.has(c[0]) && day(c[6]) <= at);
  return weightedPick(eligible, (c) => loyalty[c[0]] ?? 1.5)[0];
});
// ...then make sure every customer who is meant to have orders has at least one,
// so exactly the customers listed in customersWithoutOrders have none.
for (const c of customers) {
  if (customersWithoutOrders.has(c[0]) || orderCustomer.includes(c[0])) continue;
  const countOf = (cid) => orderCustomer.filter((x) => x === cid).length;
  for (let i = ORDER_COUNT - 1; i >= 0; i--) {
    const cur = orderCustomer[i];
    if (cur !== null && orderDates[i] >= day(c[6]) && countOf(cur) > 2) {
      orderCustomer[i] = c[0];
      break;
    }
  }
}

for (let i = 0; i < ORDER_COUNT; i++) {
  const id = i + 1;
  const at = orderDates[i];
  const month = at.getUTCMonth() + 1;
  const ageDays = (DATA_END - at) / 86400000;

  // customer (or anonymous walk-in)
  const customerId = orderCustomer[i];
  const customer = customerId ? customers[customerId - 1] : null;

  // channel: online orders have no store; walk-ins are always in a store
  const online = customer && rand() < 0.28;
  let storeId = null;
  if (!online) {
    const city = customer?.[5];
    const openStores = stores.filter((s) => s[0] !== 5 && day(s[3]) <= at);
    if (city === 'Bengaluru' && openStores.some((s) => s[0] === 4)) storeId = 4;
    else if (city === 'Howrah' && rand() < 0.7) storeId = 3;
    else storeId = weightedPick(openStores.filter((s) => s[0] !== 4), (s) => (s[0] === 1 ? 3 : 2))[0];
  }
  const employeeId = online ? (rand() < 0.75 ? pick(deliveryStaff) : null) : pick(storeStaff[storeId]);

  // status
  let status;
  const r = rand();
  if (online) {
    if (ageDays < 45) status = pick(['pending', 'shipped', 'shipped', 'paid']);
    else status = r < 0.07 ? 'cancelled' : r < 0.1 ? 'pending' : 'delivered';
  } else {
    status = r < 0.04 ? 'cancelled' : 'paid';
  }
  if (emptyOrders.has(id)) status = id === 37 ? 'cancelled' : 'pending';

  const festive = month === 10 || month === 11;
  const discount = festive && rand() < 0.35 ? pick([5, 10]) : rand() < 0.06 ? 15 : 0;

  orderRows.push([id, customerId, storeId, employeeId, fmtTs(at), status, discount]);

  // items
  let subtotal = 0;
  if (!emptyOrders.has(id)) {
    const available = products.filter((p) => {
      if (neverOrdered.has(p[0])) return false;
      if (day(p[7]) > at) return false;
      if (!p[6] && at >= day('2025-09-01')) return false; // discontinued products stopped selling
      const season = seasonalMonths[p[0]];
      return !season || season.includes(month);
    });
    const nItems = weightedPick([1, 2, 3, 4, 5], (n) => [3, 4, 3, 2, 1][n - 1]);
    const chosen = new Set();
    while (chosen.size < nItems) chosen.add(weightedPick(available, (p) => popularity[p[0]] ?? 2));
    for (const pid of [...chosen].map((p) => p[0]).sort((a, b) => a - b)) {
      const p = products[pid - 1];
      const qty = { piece: randInt(2, 12), kg: randInt(1, 2), box: randInt(1, 3), pack: randInt(1, 4), cup: randInt(1, 4) }[p[3]];
      // prices went up ~5% on 2026-01-01; older orders paid the old price
      const unitPrice = at < day('2026-01-01') ? Math.round(p[4] * 0.95) : p[4];
      subtotal += qty * unitPrice;
      itemRows.push([itemId++, id, pid, qty, fmtMoney(unitPrice)]);
      if (customerId) purchases.push([customerId, pid, at]);
    }
  }

  // payments
  const total = money(subtotal * (1 - discount / 100));
  if (total > 0 && !['pending', 'cancelled'].includes(status)) {
    const payAt = new Date(at.getTime() + (online ? randInt(1, 30) * 60000 : randInt(0, 3) * 60000));
    const method = online ? weightedPick(['upi', 'card', 'wallet'], (m) => ({ upi: 6, card: 3, wallet: 2 })[m]) : weightedPick(['cash', 'upi', 'card'], (m) => ({ cash: 4, upi: 5, card: 2 })[m]);
    if (total > 300 && rand() < 0.12) {
      // split payment, e.g. part wallet balance + rest by UPI
      const first = money(Math.round(total * (0.3 + rand() * 0.4)));
      paymentRows.push([paymentId++, id, online ? 'wallet' : 'cash', fmtMoney(first), fmtTs(payAt)]);
      paymentRows.push([paymentId++, id, 'upi', fmtMoney(total - first), fmtTs(new Date(payAt.getTime() + 120000))]);
    } else {
      paymentRows.push([paymentId++, id, method, fmtMoney(total), fmtTs(payAt)]);
    }
  }
}

// reviews: customers review things they bought, mostly happily
const reviewComments = {
  5: ['Absolutely heavenly!', 'Best in the city.', 'Just like my grandmother used to make.', 'Fresh and perfectly sweet.', 'Ordering again for Puja.'],
  4: ['Very good, slightly too sweet for me.', 'Tasty and fresh.', 'Good quality, a bit pricey.', 'Loved it.'],
  3: ['Okay, nothing special.', 'Decent but was not very fresh.', 'Average.'],
  2: ['Too sugary.', 'Packaging was damaged.'],
  1: ['Stale when it arrived.', 'Not worth the price.'],
};
const reviewRows = [];
const reviewed = new Set();
let reviewId = 1;
for (const [cid, pid, at] of purchases) {
  if (rand() > 0.17) continue;
  const key = `${cid}-${pid}`;
  if (reviewed.has(key)) continue;
  reviewed.add(key);
  const rating = weightedPick([5, 4, 3, 2, 1], (r) => ({ 5: 9, 4: 7, 3: 3, 2: 1.2, 1: 0.8 })[r]);
  const comment = rand() < 0.25 ? null : pick(reviewComments[rating]);
  const created = new Date(Math.min(at.getTime() + randInt(1, 6) * 86400000 + randInt(0, 600) * 60000, DATA_END.getTime()));
  reviewRows.push([reviewId++, pid, cid, rating, comment, fmtTs(created)]);
}
reviewRows.sort((a, b) => (a[5] < b[5] ? -1 : 1));
reviewRows.forEach((r, i) => (r[0] = i + 1));
// one anonymous review (its customer account was deleted -> customer_id set to NULL)
reviewRows.push([reviewRows.length + 1, 11, null, 2, 'Expected more cashews.', '2026-03-03 18:20:00']);

// =====================================================================
// Write files
// =====================================================================

const header = `-- GENERATED by scripts/generate-seed.mjs - edit that script, not this file.\n`;
let sql = header + `-- Hand-crafted + generated sample data. Generated: deterministic (seeded PRNG).\n\n`;
sql += insert('departments', ['id', 'name', 'budget'], departments) + '\n';
sql += insert('stores', ['id', 'name', 'city', 'opened_on'], stores) + '\n';
sql += insert(
  'employees',
  ['id', 'first_name', 'last_name', 'email', 'title', 'department_id', 'manager_id', 'store_id', 'salary', 'hire_date'],
  employees.map(([id, f, l, title, dept, mgr, store, sal, hired]) => [
    id, f, l, `${f.toLowerCase()}.${l.toLowerCase()}@mishtimore.example`, title, dept, mgr, store, fmtMoney(sal), hired,
  ]),
) + '\n';
sql += insert('salary_grades', ['grade', 'min_salary', 'max_salary'], salaryGrades.map(([g, a, b]) => [g, fmtMoney(a), fmtMoney(b)])) + '\n';
sql += insert('categories', ['id', 'name', 'parent_id'], categories) + '\n';
sql += insert(
  'products',
  ['id', 'name', 'category_id', 'unit', 'price', 'cost', 'is_active', 'launched_on'],
  products.map(([id, n, c, u, price, cost, active, launched]) => [id, n, c, u, fmtMoney(price), cost === null ? null : fmtMoney(cost), active, launched]),
) + '\n';
sql += insert('suppliers', ['id', 'name', 'city', 'phone'], suppliers) + '\n';
sql += insert('product_suppliers', ['product_id', 'supplier_id', 'unit_cost'], productSuppliers.map(([p, s, c]) => [p, s, fmtMoney(c)])) + '\n';
sql += insert('customers', ['id', 'first_name', 'last_name', 'email', 'phone', 'city', 'signup_date', 'referred_by'], customers) + '\n';
sql += insert('orders', ['id', 'customer_id', 'store_id', 'employee_id', 'ordered_at', 'status', 'discount'], orderRows.map((o) => { o[6] = fmtMoney(o[6]); return o; })) + '\n';
sql += insert('order_items', ['id', 'order_id', 'product_id', 'quantity', 'unit_price'], itemRows) + '\n';
sql += insert('payments', ['id', 'order_id', 'method', 'amount', 'paid_at'], paymentRows) + '\n';
sql += insert('reviews', ['id', 'product_id', 'customer_id', 'rating', 'comment', 'created_at'], reviewRows) + '\n';
writeFileSync(join(root, 'db/seed/02_data.sql'), sql);

const productCount = products.length;
const customerCount = customers.length;
const identityTables = ['departments', 'stores', 'employees', 'categories', 'products', 'suppliers', 'customers', 'orders', 'order_items', 'payments', 'reviews'];
const setvals = identityTables
  .map((t) => `SELECT setval(pg_get_serial_sequence('${t}', 'id'), (SELECT max(id) FROM ${t}));`)
  .join('\n');
const big = `${header}
-- 200,000 website events, generated inside Postgres with generate_series.
-- Pure arithmetic (no random()) so the data is identical every time.
INSERT INTO web_events (customer_id, product_id, event_type, device, occurred_at)
SELECT
  CASE WHEN g % 5 = 0 THEN NULL ELSE ((g::bigint * 7919) % ${customerCount}) + 1 END,
  CASE WHEN g % 11 = 0 THEN NULL ELSE ((g::bigint * 104729) % ${productCount - 4}) + 1 END,
  (ARRAY['page_view','page_view','page_view','page_view','search','add_to_cart','add_to_cart','checkout'])[((g * 31) % 8) + 1],
  (ARRAY['mobile','mobile','mobile','desktop','tablet'])[((g * 17) % 5) + 1],
  timestamp '2025-01-01' + (((g::bigint * 2654435761) % (546 * 86400)) * interval '1 second')
FROM generate_series(1, 200000) AS g;

-- Identity columns: move each sequence past the ids we inserted explicitly,
-- so your own INSERTs get fresh ids instead of "duplicate key" errors.
${setvals}
`;
writeFileSync(join(root, 'db/seed/03_web_events.sql'), big);

console.log(
  `Wrote seed: ${orderRows.length} orders, ${itemRows.length} order_items, ${paymentRows.length} payments, ${reviewRows.length} reviews, 200000 web_events`,
);
