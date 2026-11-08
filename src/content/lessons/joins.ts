import type { JoinVizConfig, Lesson } from '../types.ts';

// Mini versions of real tables used by the join visualizer.
const miniCustomers = {
  name: 'customers',
  alias: 'c',
  columns: ['id', 'name'],
  rows: [
    [1, 'Asha'],
    [2, 'Bikram'],
    [3, 'Chitra'],
    [4, 'Dev'],
  ],
  key: 'id',
};
const miniOrders = {
  name: 'orders',
  alias: 'o',
  columns: ['id', 'customer_id', 'amount'],
  rows: [
    [101, 1, 250],
    [102, 3, 560],
    [103, 1, 120],
    [104, null, 90],
    [105, 2, 300],
  ],
  key: 'customer_id',
  labelColumn: 'id',
  labelPrefix: 'order ',
};
const customersOrders = (initial: JoinVizConfig['initial'], types: JoinVizConfig['types']): JoinVizConfig => ({
  left: miniCustomers,
  right: miniOrders,
  types,
  initial,
});

const miniEmployees = [
  [1, 'Meera', null],
  [2, 'Arjun', 1],
  [3, 'Kavya', 1],
  [4, 'Rohan', 2],
  [5, 'Sneha', 2],
];
const selfJoinViz: JoinVizConfig = {
  left: { name: 'employees', alias: 'e', columns: ['id', 'name', 'manager_id'], rows: miniEmployees, key: 'manager_id' },
  right: { name: 'employees', alias: 'm', columns: ['id', 'name', 'manager_id'], rows: miniEmployees, key: 'id' },
  selfJoin: true,
  types: ['inner', 'left', 'right'],
  initial: 'left',
};

const crossViz: JoinVizConfig = {
  left: { name: 'stores', alias: 's', columns: ['id', 'name'], rows: [[1, 'Park Street'], [2, 'Salt Lake']] },
  right: { name: 'products', alias: 'p', columns: ['id', 'name'], rows: [[1, 'Rasgulla'], [6, 'Sandesh'], [28, 'Mishti Doi']] },
  types: ['cross'],
  initial: 'cross',
};

export const joins: Lesson[] = [
  {
    id: 'inner-join',
    section: 'Joins',
    title: 'How joins work: INNER JOIN',
    summary: 'Why data is split across tables, the mental model behind every join, and the INNER JOIN.',
    blocks: [
      `
## Why joins exist

A well-designed database stores each fact **once**. An order does not repeat the customer's name and city - it stores \`customer_id\`, a **foreign key** that points to the customer's **primary key** (\`customers.id\`). To see orders *with* customer names, you put the two tables back together: that is a **join**.

## The mental model: all pairs, then filter

Conceptually, \`A JOIN B ON condition\` does two things:

1. Pair **every** row of A with **every** row of B (the *Cartesian product*).
2. Keep only the pairs for which the \`ON\` condition is **TRUE**.

Below, four customers and five orders make 4 × 5 = 20 possible pairs. The condition \`c.id = o.customer_id\` keeps 4 of them. Switch between **Concept** and **INNER** - the kept rows are identical. Then press **Step through** to watch it row by row, and hover any row to see where it comes from.
`,
      { viz: customersOrders('concept', ['concept', 'inner', 'left', 'right', 'full', 'cross']) },
      `
Things to notice:

- **Asha appears twice**: she has two orders. A join repeats a row once for every match - joins can **multiply** rows.
- **Dev disappears**: no order has \`customer_id = 4\`.
- **Order 104 disappears**: its \`customer_id\` is NULL (a walk-in), and \`NULL = anything\` is never TRUE.

(The database does not really build all 20 pairs - see the *Join algorithms* lesson - but the result is always the same as this mental model.)

## Syntax

~~~sql
SELECT o.id AS order_id, o.ordered_at, c.first_name, c.last_name
FROM orders AS o
INNER JOIN customers AS c ON c.id = o.customer_id
ORDER BY o.ordered_at
LIMIT 20;
~~~

- \`INNER JOIN\` and plain \`JOIN\` mean the same thing.
- **Aliases** (\`o\`, \`c\`) keep queries short. Once you alias a table, use the alias.
- **Qualify** columns that exist in both tables (\`id\` is in both!). Postgres raises *column reference "id" is ambiguous* otherwise.
- If the columns have the same name in both tables you can write \`JOIN t USING (col)\`; the shared column then appears once.

> The \`ON\` condition is usually *foreign key = primary key*, but it can be **any** boolean expression: several conditions with AND, ranges, inequalities... (see *Joining many tables*).

## The old comma syntax

You will see this in older code - it is an inner join written as a cross join plus a WHERE filter, exactly the mental model above:

~~~sql
SELECT o.id, c.first_name
FROM orders o, customers c
WHERE c.id = o.customer_id
LIMIT 5;
~~~

Prefer explicit \`JOIN ... ON\`: it keeps join conditions separate from filters, and forgetting the WHERE line silently produces a huge cross join.
`,
    ],
    examples: [
      {
        title: 'Order lines with product names',
        sql: `SELECT oi.order_id, p.name AS product, oi.quantity, oi.unit_price,\n       oi.quantity * oi.unit_price AS line_total\nFROM order_items oi\nJOIN products p ON p.id = oi.product_id\nORDER BY oi.order_id\nLIMIT 25;`,
      },
      {
        title: 'Employees with their department',
        sql: `SELECT e.first_name, e.last_name, e.title, d.name AS department\nFROM employees e\nJOIN departments d ON d.id = e.department_id\nORDER BY d.name, e.first_name;`,
        note: 'Count the rows: 21, not 22. Rhea has no department (`department_id` is NULL), so the inner join drops her. The LEFT JOIN lesson shows how to keep her.',
      },
      {
        title: 'Joins multiply rows',
        sql: `SELECT count(*) AS orders FROM orders;\nSELECT count(*) AS orders_joined_to_items\nFROM orders o JOIN order_items oi ON oi.order_id = o.id;`,
        note: 'One order with three lines becomes three rows after joining to `order_items`. Always ask: "after this join, what does one row represent?"',
      },
      {
        title: 'Ambiguous column error',
        sql: `-- Both tables have an "id" column, so Postgres can't tell which one you mean:\nSELECT id, first_name\nFROM orders o\nJOIN customers c ON c.id = o.customer_id;`,
        note: 'Run it to see the error, then fix it by writing `o.id` or `c.id`.',
      },
      { title: 'JOIN ... USING', sql: `-- product_suppliers and order_items both have a product_id column\nSELECT product_id, ps.supplier_id, oi.order_id\nFROM product_suppliers ps\nJOIN order_items oi USING (product_id)\nLIMIT 10;` },
    ],
    exercises: [
      {
        id: 'inner-1',
        title: 'Orders with customer names',
        prompt: 'For every order that has a customer, return the order `id`, `ordered_at`, and the customer\'s `first_name` and `last_name` (4 columns, in that order).',
        hint: '`FROM orders o JOIN customers c ON c.id = o.customer_id`',
        solution: `SELECT o.id, o.ordered_at, c.first_name, c.last_name
FROM orders o
JOIN customers c ON c.id = o.customer_id;`,
      },
      {
        id: 'inner-2',
        title: 'Products with their category',
        prompt: 'Return two columns, `product` (the product name) and `category` (the category name), for every product that has a category.',
        solution: `SELECT p.name AS product, c.name AS category
FROM products p
JOIN categories c ON c.id = p.category_id;`,
      },
      {
        id: 'inner-3',
        title: 'What was in order 42?',
        prompt: 'For order **42**, list each line: the product `name`, `quantity`, `unit_price` and `line_total` (quantity × unit_price).',
        solution: `SELECT p.name, oi.quantity, oi.unit_price, oi.quantity * oi.unit_price AS line_total
FROM order_items oi
JOIN products p ON p.id = oi.product_id
WHERE oi.order_id = 42;`,
      },
      {
        id: 'inner-4',
        title: 'Store staff',
        prompt:
          'List employees who work in a store: their `first_name`, `title` and the store name as `store`. Sort by store name, then by first name.',
        solution: `SELECT e.first_name, e.title, s.name AS store
FROM employees e
JOIN stores s ON s.id = e.store_id
ORDER BY s.name, e.first_name;`,
        ordered: true,
      },
    ],
  },

  {
    id: 'left-join',
    section: 'Joins',
    title: 'LEFT JOIN',
    summary: 'Keep every row of the left table, matched or not - and the classic ON-vs-WHERE trap.',
    blocks: [
      `
## Keep everything on the left

\`A LEFT JOIN B ON ...\` returns every row an INNER JOIN would, **plus** every row of A that found no match, with **NULL in all of B's columns**. (\`LEFT OUTER JOIN\` is the same thing.)

The "left" table is simply the one written **before** the \`LEFT JOIN\` keyword.
`,
      { viz: customersOrders('left', ['inner', 'left', 'anti', 'full']) },
      `
## Finding rows with no match (anti-join)

Because unmatched rows get NULLs, you can filter for them. "Which customers have never ordered?":

~~~sql
SELECT c.id, c.first_name, c.last_name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;
~~~

Test a column that **can't be NULL in a real match** - the right table's primary key is the safest choice. (\`NOT EXISTS\` does the same job; see *Subqueries*.)

## Counting with LEFT JOIN

\`count(*)\` counts rows, and an unmatched customer still produces one row (full of NULLs). Count a column from the right table instead - \`count(o.id)\` ignores NULLs, so customers without orders get **0**:

~~~sql
SELECT c.first_name, c.last_name, count(o.id) AS orders, count(*) AS wrong_count
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.first_name, c.last_name
ORDER BY orders, c.first_name;
~~~

## ⚠️ The ON vs WHERE trap

Goal: *every* customer, together with their orders from **2026** (if any).

~~~sql
-- WRONG: the WHERE runs after the join. For customers without 2026 orders,
-- o.ordered_at is NULL, "NULL >= '2026-01-01'" is not TRUE, so they are removed.
-- The LEFT JOIN has silently become an INNER JOIN.
SELECT c.first_name, o.id AS order_id, o.ordered_at
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.ordered_at >= '2026-01-01';
~~~

~~~sql
-- RIGHT: put conditions on the right-hand table in the ON clause.
-- They decide which rows *match*; unmatched customers are still kept.
SELECT c.first_name, o.id AS order_id, o.ordered_at
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.ordered_at >= '2026-01-01';
~~~

Rule of thumb: in a LEFT JOIN, conditions on the **right** table go in \`ON\`; conditions on the **left** table go in \`WHERE\`.
`,
    ],
    examples: [
      {
        title: 'Every employee, with or without a department',
        sql: `SELECT e.first_name, e.title, d.name AS department\nFROM employees e\nLEFT JOIN departments d ON d.id = e.department_id\nORDER BY d.name NULLS FIRST, e.first_name;`,
      },
      {
        title: 'Orders and their payments (unpaid orders show NULL)',
        sql: `SELECT o.id, o.status, p.method, p.amount\nFROM orders o\nLEFT JOIN payments p ON p.order_id = o.id\nWHERE o.status IN ('pending', 'cancelled')\nORDER BY o.id;`,
      },
      {
        title: 'Stores and their number of orders',
        sql: `SELECT s.name, count(o.id) AS orders\nFROM stores s\nLEFT JOIN orders o ON o.store_id = s.id\nGROUP BY s.id, s.name\nORDER BY orders DESC;`,
        note: 'New Town shows 0. With an INNER JOIN it would vanish from the report.',
      },
      {
        title: 'Orders without any order lines',
        sql: `SELECT o.id, o.status, o.ordered_at\nFROM orders o\nLEFT JOIN order_items oi ON oi.order_id = o.id\nWHERE oi.id IS NULL;`,
      },
    ],
    exercises: [
      {
        id: 'left-1',
        title: 'All customers and their orders',
        prompt: 'Return `first_name`, `last_name` and `order_id` (the order\'s id) for **every** customer. Customers who never ordered must appear once with `order_id` NULL.',
        solution: `SELECT c.first_name, c.last_name, o.id AS order_id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;`,
      },
      {
        id: 'left-2',
        title: 'Customers who never ordered',
        prompt: 'Return `id`, `first_name` and `last_name` of customers with **no orders at all**, using a LEFT JOIN.',
        hint: 'LEFT JOIN orders, then keep rows where the order side is NULL: `WHERE o.id IS NULL`.',
        solution: `SELECT c.id, c.first_name, c.last_name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;`,
      },
      {
        id: 'left-3',
        title: 'Products nobody ordered',
        prompt: 'Return the `name` of every product that appears in **no** order line.',
        solution: `SELECT p.name
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
WHERE oi.id IS NULL;`,
      },
      {
        id: 'left-4',
        title: 'Every store with its June 2026 orders',
        prompt:
          'Return `store` (store name) and `order_id` for orders placed in **June 2026**. **Every store must appear** - a store with no June 2026 orders appears once with `order_id` NULL.',
        hint: 'This is the ON-vs-WHERE trap. The date condition belongs in the `ON` clause: `ON o.store_id = s.id AND o.ordered_at >= \'2026-06-01\' AND o.ordered_at < \'2026-07-01\'`.',
        solution: `SELECT s.name AS store, o.id AS order_id
FROM stores s
LEFT JOIN orders o
  ON o.store_id = s.id
 AND o.ordered_at >= '2026-06-01' AND o.ordered_at < '2026-07-01';`,
      },
    ],
  },

  {
    id: 'right-join',
    section: 'Joins',
    title: 'RIGHT JOIN',
    summary: 'The mirror image of LEFT JOIN - and why most people rewrite it as one.',
    blocks: [
      `
## Keep everything on the right

\`A RIGHT JOIN B\` keeps every row of **B** (the table after the keyword), filling A's columns with NULL where there is no match. It is exactly \`B LEFT JOIN A\` with the column order swapped.
`,
      { viz: customersOrders('right', ['left', 'right', 'inner']) },
      `
Here every **order** is kept, including walk-in order 104, which has no customer. Dev, who has no orders, is dropped.

## When would I use it?

Rarely. Queries read more naturally when the "main" table comes first and everything else is LEFT JOINed onto it. These two queries return the same rows:

~~~sql
SELECT c.name AS category, p.name AS product
FROM products p
RIGHT JOIN categories c ON c.id = p.category_id
ORDER BY category, product;
~~~

~~~sql
SELECT c.name AS category, p.name AS product
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
ORDER BY category, product;
~~~

RIGHT JOIN is still worth understanding: you will meet it in other people's SQL, and Postgres itself uses "Hash Right Join" in query plans (see *Join algorithms*).
`,
    ],
    examples: [
      {
        title: 'Every order, with the customer if known',
        sql: `SELECT o.id AS order_id, o.ordered_at, c.first_name\nFROM customers c\nRIGHT JOIN orders o ON o.customer_id = c.id\nORDER BY c.first_name NULLS FIRST\nLIMIT 30;`,
        note: 'Walk-in orders come first with `first_name` NULL.',
      },
      {
        title: 'Same thing as a LEFT JOIN',
        sql: `SELECT o.id AS order_id, o.ordered_at, c.first_name\nFROM orders o\nLEFT JOIN customers c ON c.id = o.customer_id\nORDER BY c.first_name NULLS FIRST\nLIMIT 30;`,
      },
    ],
    exercises: [
      {
        id: 'right-1',
        title: 'Every category and its products',
        prompt: 'Using a **RIGHT JOIN** (with `products` written first), return `category` and `product` names. Empty categories must appear with `product` NULL.',
        solution: `SELECT c.name AS category, p.name AS product
FROM products p
RIGHT JOIN categories c ON c.id = p.category_id;`,
      },
      {
        id: 'right-2',
        title: 'Every department and its people',
        prompt: 'Return `department` (department name) and `first_name` of its employees. Every department must appear, even one without employees. (Employees without a department do not need to appear.)',
        solution: `SELECT d.name AS department, e.first_name
FROM employees e
RIGHT JOIN departments d ON d.id = e.department_id;`,
      },
    ],
  },

  {
    id: 'full-join',
    section: 'Joins',
    title: 'FULL OUTER JOIN',
    summary: 'Keep unmatched rows from both sides - perfect for reconciling two lists.',
    blocks: [
      `
## Keep everything from both sides

\`A FULL JOIN B\` = all matching pairs **+** unmatched rows of A (NULLs for B) **+** unmatched rows of B (NULLs for A). It is the union of a LEFT and a RIGHT join.
`,
      { viz: customersOrders('full', ['inner', 'left', 'right', 'full']) },
      `
## Reconciliation

FULL JOIN shines when you compare two lists and want to see *everything that doesn't line up*. Keep only the rows where one side is missing:

~~~sql
SELECT e.first_name, e.last_name, d.name AS department
FROM employees e
FULL JOIN departments d ON d.id = e.department_id
WHERE e.id IS NULL OR d.id IS NULL;
~~~

This shows the employee without a department **and** the department without employees in one result.

## Merging keys with COALESCE

When the two sides describe the same thing, \`COALESCE\` picks whichever side exists. Example: compare 2025 vs 2026 sales per product - a product might only sell in one of the years:

~~~sql
WITH y25 AS (
  SELECT oi.product_id, sum(oi.quantity) AS qty
  FROM order_items oi JOIN orders o ON o.id = oi.order_id
  WHERE o.ordered_at < '2026-01-01'
  GROUP BY oi.product_id
), y26 AS (
  SELECT oi.product_id, sum(oi.quantity) AS qty
  FROM order_items oi JOIN orders o ON o.id = oi.order_id
  WHERE o.ordered_at >= '2026-01-01'
  GROUP BY oi.product_id
)
SELECT COALESCE(y25.product_id, y26.product_id) AS product_id,
       y25.qty AS qty_2025,
       y26.qty AS qty_2026
FROM y25
FULL JOIN y26 ON y26.product_id = y25.product_id
ORDER BY product_id;
~~~

(\`WITH\` defines named subqueries - covered in the CTE lesson. \`GROUP BY\` is next in line.)

> FULL JOIN only supports conditions Postgres can execute as a hash or merge join - in practice, equality conditions (\`a.x = b.y\`). That covers almost every real use.
`,
    ],
    examples: [
      {
        title: 'All employees and all departments',
        sql: `SELECT e.first_name, d.name AS department\nFROM employees e\nFULL JOIN departments d ON d.id = e.department_id\nORDER BY d.name NULLS FIRST, e.first_name NULLS FIRST;`,
      },
      {
        title: 'Which stores and cities have customers?',
        sql: `SELECT s.name AS store, s.city AS store_city, cc.city AS customer_city, cc.customers\nFROM stores s\nFULL JOIN (SELECT city, count(*) AS customers FROM customers WHERE city IS NOT NULL GROUP BY city) cc\n  ON cc.city = s.city\nORDER BY COALESCE(s.city, cc.city);`,
        note: 'Delhi and Mumbai have customers but no store; every store city shows up too.',
      },
    ],
    exercises: [
      {
        id: 'full-1',
        title: 'Employees and departments, the full picture',
        prompt: 'Return `first_name` (employee) and `department` (department name). Include employees with no department **and** departments with no employees.',
        solution: `SELECT e.first_name, d.name AS department
FROM employees e
FULL JOIN departments d ON d.id = e.department_id;`,
      },
      {
        id: 'full-2',
        title: 'Only the mismatches',
        prompt: 'Same two columns as before, but return **only** the rows where one side is missing.',
        hint: 'Add `WHERE e.id IS NULL OR d.id IS NULL`.',
        solution: `SELECT e.first_name, d.name AS department
FROM employees e
FULL JOIN departments d ON d.id = e.department_id
WHERE e.id IS NULL OR d.id IS NULL;`,
      },
      {
        id: 'full-3',
        title: 'Supplier coverage',
        prompt:
          'Return `product` and `supplier` names for every product-supplier link, **plus** products that have no supplier (`supplier` NULL) **plus** suppliers that supply nothing (`product` NULL).',
        hint:
          'Products connect to suppliers through `product_suppliers`. Try `products LEFT JOIN product_suppliers ... FULL JOIN suppliers ...`. Why would an INNER JOIN between product_suppliers and suppliers lose the idle supplier?',
        solution: `SELECT p.name AS product, s.name AS supplier
FROM products p
LEFT JOIN product_suppliers ps ON ps.product_id = p.id
FULL JOIN suppliers s ON s.id = ps.supplier_id;`,
      },
    ],
  },

  {
    id: 'cross-join',
    section: 'Joins',
    title: 'CROSS JOIN',
    summary: 'Every row with every row: generating combinations, and why it is dangerous on big tables.',
    blocks: [
      `
## The Cartesian product

\`A CROSS JOIN B\` has no condition. Every row of A is paired with every row of B, so the result has \`rows(A) × rows(B)\` rows.
`,
      { viz: crossViz },
      `
## When is that useful?

Whenever you need **all combinations**: every store × every month, every product × every size, a grid to fill in.

~~~sql
SELECT s.name AS store, m::date AS month
FROM stores s
CROSS JOIN generate_series(date '2026-01-01', date '2026-06-01', interval '1 month') AS m
ORDER BY store, month;
~~~

A classic report pattern: CROSS JOIN to build the complete grid, then LEFT JOIN the real data onto it, so missing combinations show up as **0** instead of being absent:

~~~sql
SELECT s.name AS store, m::date AS month, count(o.id) AS orders
FROM stores s
CROSS JOIN generate_series(date '2026-01-01', date '2026-06-01', interval '1 month') AS m
LEFT JOIN orders o
  ON o.store_id = s.id
 AND date_trunc('month', o.ordered_at) = m
GROUP BY s.name, m
ORDER BY store, month;
~~~

## ⚠️ Size explodes

\`web_events CROSS JOIN web_events\` would be 200,000 × 200,000 = **40 billion** rows. Postgres would try! (Here a 30-second timeout and a 1,000-row display limit protect you.) An accidental cross join usually comes from a **missing join condition**:

~~~sql
-- forgot the WHERE / ON: 170 orders x 40 customers = 6,800 rows of nonsense
SELECT count(*) FROM orders, customers;
~~~
`,
    ],
    examples: [
      { title: 'All store × product combinations', sql: `SELECT s.name AS store, p.name AS product\nFROM stores s\nCROSS JOIN products p\nWHERE p.category_id = 2\nORDER BY store, product;` },
      { title: 'Count the combinations', sql: `SELECT (SELECT count(*) FROM stores)   AS stores,\n       (SELECT count(*) FROM products) AS products,\n       count(*)                        AS combinations\nFROM stores CROSS JOIN products;` },
      {
        title: 'Cross join with VALUES',
        sql: `SELECT p.name, s.size, p.price * s.factor AS price\nFROM products p\nCROSS JOIN (VALUES ('small', 0.5), ('regular', 1.0), ('family', 2.5)) AS s(size, factor)\nWHERE p.name = 'Mishti Doi';`,
      },
    ],
    exercises: [
      {
        id: 'cross-1',
        title: 'Store × payment method',
        prompt:
          'Return every combination of store `name` and payment `method`, where the methods are the four values `upi`, `card`, `cash` and `wallet` (build them with `VALUES`). Name the columns `name` and `method`.',
        hint: '`CROSS JOIN (VALUES (\'upi\'), (\'card\'), (\'cash\'), (\'wallet\')) AS m(method)`',
        solution: `SELECT s.name, m.method
FROM stores s
CROSS JOIN (VALUES ('upi'), ('card'), ('cash'), ('wallet')) AS m(method);`,
      },
      {
        id: 'cross-2',
        title: 'A store × month grid for 2025',
        prompt:
          'Return one row per store and per month of **2025**: columns `name` (store name) and `month` (a `date`: the first day of the month, e.g. 2025-01-01).',
        hint: '`generate_series(date \'2025-01-01\', date \'2025-12-01\', interval \'1 month\')` returns timestamps; cast with `::date`.',
        solution: `SELECT s.name, m::date AS month
FROM stores s
CROSS JOIN generate_series(date '2025-01-01', date '2025-12-01', interval '1 month') AS m;`,
      },
    ],
  },

  {
    id: 'self-join',
    section: 'Joins',
    title: 'SELF JOIN',
    summary: 'Joining a table to itself: managers, referrals and pairs of rows.',
    blocks: [
      `
## One table, two roles

A self join is an ordinary join where both sides are **the same table**, given two different aliases so you can tell the roles apart. \`employees.manager_id\` points at another row of \`employees\`:

- alias \`e\` = the employee
- alias \`m\` = the manager
- condition: \`e.manager_id = m.id\`
`,
      { viz: selfJoinViz },
      `
- **INNER**: Meera disappears - her \`manager_id\` is NULL (she is the boss).
- **LEFT**: everyone is kept; Meera's manager columns are NULL.
- **RIGHT**: every employee *as a manager* is kept; Kavya, Rohan and Sneha manage nobody, so the employee side is NULL.

~~~sql
SELECT e.first_name AS employee, e.title, m.first_name AS manager, m.title AS manager_title
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id
ORDER BY m.first_name NULLS FIRST, e.first_name;
~~~

## Pairs of rows

To compare rows *within* a table - e.g. customers living in the same city - join the table to itself on the shared value and use \`a.id < b.id\`. That removes both the pair of a row with itself and the mirrored duplicates (A-B and B-A):

~~~sql
SELECT a.first_name AS customer_1, b.first_name AS customer_2, a.city
FROM customers a
JOIN customers b ON b.city = a.city AND a.id < b.id
WHERE a.city = 'Howrah';
~~~

Try changing \`a.id < b.id\` to \`a.id <> b.id\` and count the rows.

## Deeper hierarchies

A single self join climbs **one** level (employee → manager). Climb two levels by joining a third copy (\`LEFT JOIN employees mm ON mm.id = m.manager_id\`). For hierarchies of *any* depth you need a **recursive CTE** - see the CTE lesson.
`,
    ],
    examples: [
      {
        title: 'Employee → manager → manager\'s manager',
        sql: `SELECT e.first_name AS employee, m.first_name AS manager, mm.first_name AS grand_manager\nFROM employees e\nLEFT JOIN employees m  ON m.id  = e.manager_id\nLEFT JOIN employees mm ON mm.id = m.manager_id\nORDER BY e.id;`,
      },
      {
        title: 'How many direct reports does each person have?',
        sql: `SELECT m.first_name, m.title, count(e.id) AS direct_reports\nFROM employees m\nLEFT JOIN employees e ON e.manager_id = m.id\nGROUP BY m.id, m.first_name, m.title\nORDER BY direct_reports DESC;`,
      },
      {
        title: 'Customer referrals',
        sql: `SELECT c.first_name || ' ' || c.last_name AS customer,\n       r.first_name || ' ' || r.last_name AS referred_by\nFROM customers c\nJOIN customers r ON r.id = c.referred_by\nORDER BY referred_by;`,
      },
    ],
    exercises: [
      {
        id: 'self-1',
        title: 'Who is my manager?',
        prompt: 'Return `employee` (first name) and `manager` (the manager\'s first name) for **every** employee. The CEO has no manager and must appear with `manager` NULL.',
        solution: `SELECT e.first_name AS employee, m.first_name AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id;`,
      },
      {
        id: 'self-2',
        title: 'Who referred whom',
        prompt:
          'For customers who were referred by another customer, return `customer` and `referred_by`, each as the full name (`first_name || \' \' || last_name`).',
        solution: `SELECT c.first_name || ' ' || c.last_name AS customer,
       r.first_name || ' ' || r.last_name AS referred_by
FROM customers c
JOIN customers r ON r.id = c.referred_by;`,
      },
      {
        id: 'self-3',
        title: 'Colleagues in the same store',
        prompt:
          'Return every **pair** of employees who work in the same store: `employee_1`, `employee_2` (first names) and `store_id`. List each pair only once, and never pair someone with themselves (the employee with the lower id goes in `employee_1`).',
        hint: '`JOIN employees b ON b.store_id = a.store_id AND a.id < b.id`',
        solution: `SELECT a.first_name AS employee_1, b.first_name AS employee_2, a.store_id
FROM employees a
JOIN employees b ON b.store_id = a.store_id AND a.id < b.id;`,
      },
      {
        id: 'self-4',
        title: 'Managed across departments',
        prompt:
          'Return `employee` and `manager` first names for employees whose manager is in a **different department** than they are. Treat a missing department as different from any department.',
        hint: '`e.department_id <> m.department_id` is NULL when either side is NULL. `IS DISTINCT FROM` treats NULL as a comparable value.',
        solution: `SELECT e.first_name AS employee, m.first_name AS manager
FROM employees e
JOIN employees m ON m.id = e.manager_id
WHERE e.department_id IS DISTINCT FROM m.department_id;`,
      },
    ],
  },

  {
    id: 'multi-join',
    section: 'Joins',
    title: 'Joining many tables',
    summary: 'Join chains, many-to-many tables, non-equi joins, and the two traps that bite everyone: LEFT chains and fan-out.',
    blocks: [
      `
## Join chains

Joins are evaluated left to right, each one adding columns to the growing result. Follow the foreign keys:

~~~sql
SELECT o.id AS order_id, c.first_name, p.name AS product, cat.name AS category, oi.quantity
FROM orders o
JOIN customers   c   ON c.id   = o.customer_id
JOIN order_items oi  ON oi.order_id = o.id
JOIN products    p   ON p.id   = oi.product_id
JOIN categories  cat ON cat.id = p.category_id
WHERE o.ordered_at >= '2026-06-01'
ORDER BY o.id;
~~~

## Many-to-many through a junction table

A product can have many suppliers and a supplier many products. The link lives in \`product_suppliers\`, so you join **through** it:

~~~sql
SELECT p.name AS product, s.name AS supplier, ps.unit_cost
FROM products p
JOIN product_suppliers ps ON ps.product_id = p.id
JOIN suppliers s          ON s.id = ps.supplier_id
ORDER BY p.name;
~~~

## Non-equi joins

The ON condition doesn't have to be \`=\`. \`salary_grades\` has no foreign key - each employee belongs to the band their salary falls into:

~~~sql
SELECT e.first_name, e.salary, g.grade
FROM employees e
JOIN salary_grades g ON e.salary BETWEEN g.min_salary AND g.max_salary
ORDER BY e.salary DESC;
~~~

## ⚠️ Trap 1: an INNER JOIN after a LEFT JOIN

Goal: every customer, with the products they bought (NULL if they bought nothing).

~~~sql
-- WRONG: customers without orders have o.id = NULL after the LEFT JOIN.
-- The next INNER JOIN needs oi.order_id = NULL, which never matches,
-- so those customers are thrown away again.
SELECT c.first_name, p.name AS product
FROM customers c
LEFT JOIN orders o       ON o.customer_id = c.id
JOIN order_items oi      ON oi.order_id = o.id
JOIN products p          ON p.id = oi.product_id
ORDER BY c.first_name;
~~~

Once a table is LEFT JOINed, keep using LEFT JOIN for the tables that hang off it (or group the inner joins in parentheses: \`LEFT JOIN (order_items oi JOIN products p ON ...) ON ...\`).

## ⚠️ Trap 2: fan-out (double counting)

Each order has several **items** and possibly several **payments**. Join both to the order and every item row is paired with every payment row - an order with 3 items and 2 payments becomes 6 rows, and every SUM is wrong:

~~~sql
SELECT o.id,
       sum(oi.quantity * oi.unit_price) AS items_total,   -- doubled!
       sum(p.amount)                    AS paid           -- tripled!
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN payments p     ON p.order_id  = o.id
WHERE o.id IN (SELECT order_id FROM payments GROUP BY order_id HAVING count(*) > 1)
GROUP BY o.id
ORDER BY o.id;
~~~

**Fix:** aggregate each child table *before* joining, so each side has one row per order:

~~~sql
SELECT o.id, i.items_total, p.paid
FROM orders o
JOIN (SELECT order_id, sum(quantity * unit_price) AS items_total FROM order_items GROUP BY order_id) i ON i.order_id = o.id
JOIN (SELECT order_id, sum(amount) AS paid FROM payments GROUP BY order_id) p ON p.order_id = o.id
WHERE o.id IN (SELECT order_id FROM payments GROUP BY order_id HAVING count(*) > 1)
ORDER BY o.id;
~~~
`,
    ],
    examples: [
      {
        title: 'Which supplier provides each product sold in an order?',
        sql: `SELECT oi.order_id, p.name AS product, s.name AS supplier\nFROM order_items oi\nJOIN products p ON p.id = oi.product_id\nLEFT JOIN product_suppliers ps ON ps.product_id = p.id\nLEFT JOIN suppliers s ON s.id = ps.supplier_id\nWHERE oi.order_id = 7;`,
      },
      {
        title: 'Joining on two conditions',
        sql: `-- employees who handled orders in their own store\nSELECT o.id, e.first_name, o.store_id, e.store_id AS employee_store\nFROM orders o\nJOIN employees e ON e.id = o.employee_id AND e.store_id = o.store_id\nLIMIT 15;`,
      },
      {
        title: 'Parenthesised join to protect a LEFT JOIN',
        sql: `SELECT c.first_name, p.name AS product\nFROM customers c\nLEFT JOIN (orders o\n           JOIN order_items oi ON oi.order_id = o.id\n           JOIN products p     ON p.id = oi.product_id)\n       ON o.customer_id = c.id\nORDER BY product NULLS FIRST, c.first_name\nLIMIT 20;`,
      },
    ],
    exercises: [
      {
        id: 'multi-1',
        title: 'October 2025 order lines',
        prompt:
          'For orders placed in **October 2025** that have a customer, return `order_id`, the customer\'s `first_name`, `product` (product name), `category` (category name) and `quantity`.',
        solution: `SELECT o.id AS order_id, c.first_name, p.name AS product, cat.name AS category, oi.quantity
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
JOIN categories cat ON cat.id = p.category_id
WHERE o.ordered_at >= '2025-10-01' AND o.ordered_at < '2025-11-01';`,
      },
      {
        id: 'multi-2',
        title: 'Salary grades',
        prompt: 'Return `first_name`, `salary` and `grade` for every employee, using the band in `salary_grades` their salary falls into.',
        solution: `SELECT e.first_name, e.salary, g.grade
FROM employees e
JOIN salary_grades g ON e.salary BETWEEN g.min_salary AND g.max_salary;`,
      },
      {
        id: 'multi-3',
        title: 'Who bought Kaju Katli?',
        prompt: 'Return the distinct `first_name` and `last_name` of customers who have bought **Kaju Katli** at least once.',
        hint: 'customers → orders → order_items → products, filter on the product name, and `SELECT DISTINCT`.',
        solution: `SELECT DISTINCT c.first_name, c.last_name
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
WHERE p.name = 'Kaju Katli';`,
      },
      {
        id: 'multi-4',
        title: 'Every customer and what they bought',
        prompt:
          'Return `first_name`, `last_name` and `product` (product name) for every product line of every customer\'s orders. Customers with no orders must still appear (with `product` NULL) - and so must orders that have no lines.',
        hint: 'Trap 1! Every join after the first LEFT JOIN must also be a LEFT JOIN.',
        solution: `SELECT c.first_name, c.last_name, p.name AS product
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN products p ON p.id = oi.product_id;`,
      },
      {
        id: 'multi-5',
        title: 'Products with their suppliers',
        prompt: 'Return `product` and `supplier` names for every product that has at least one supplier, with the supplier\'s `unit_cost`.',
        solution: `SELECT p.name AS product, s.name AS supplier, ps.unit_cost
FROM products p
JOIN product_suppliers ps ON ps.product_id = p.id
JOIN suppliers s ON s.id = ps.supplier_id;`,
      },
    ],
  },
];
