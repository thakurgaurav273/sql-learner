import type { Lesson } from '../types.ts';

export const aggregation: Lesson[] = [
  {
    id: 'group-by',
    section: 'Aggregation & beyond',
    title: 'GROUP BY & HAVING',
    summary: 'Collapse rows into groups and compute counts, sums and averages - and filter the groups.',
    blocks: [
      `
## Aggregate functions

Aggregates turn many rows into one value: \`count\`, \`sum\`, \`avg\`, \`min\`, \`max\`, \`string_agg\`, \`array_agg\`, \`bool_and\`...

~~~sql
SELECT count(*)            AS products,
       count(cost)         AS with_known_cost,
       count(DISTINCT unit) AS different_units,
       min(price), max(price),
       round(avg(price), 2) AS avg_price
FROM products;
~~~

## GROUP BY: one output row per group

\`GROUP BY city\` splits the rows into buckets that share the same city and runs the aggregates **per bucket**:

~~~sql
SELECT city, count(*) AS customers
FROM customers
GROUP BY city
ORDER BY customers DESC;
~~~

Notice the row where \`city\` is NULL: all NULLs form **one** group.

> **The golden rule:** every column in \`SELECT\` must either appear in \`GROUP BY\` or be inside an aggregate. Otherwise Postgres can't know which of the group's many values to show and raises *column must appear in the GROUP BY clause or be used in an aggregate function*. (Exception: if you group by a table's primary key, you may select any other column of that table.)

## WHERE vs HAVING

Recall the evaluation order: \`FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY\`.

- \`WHERE\` filters **rows** before grouping (it can't see aggregates).
- \`HAVING\` filters **groups** after aggregation.

~~~sql
-- customers with more than 5 non-cancelled orders
SELECT c.first_name, c.last_name, count(*) AS orders
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.status <> 'cancelled'          -- row filter
GROUP BY c.id, c.first_name, c.last_name
HAVING count(*) > 5                    -- group filter
ORDER BY orders DESC;
~~~

## Joins + GROUP BY

Most reports join first, then group. With a LEFT JOIN, count a column from the right table so empty groups show 0 (see the LEFT JOIN lesson):

~~~sql
SELECT cat.name AS category, count(p.id) AS products, round(avg(p.price), 2) AS avg_price
FROM categories cat
LEFT JOIN products p ON p.category_id = cat.id
GROUP BY cat.id, cat.name
ORDER BY products DESC, category;
~~~

## Handy extras

- **Group by an expression:** \`GROUP BY date_trunc('month', ordered_at)\`.
- **FILTER** counts several subsets in one pass: \`count(*) FILTER (WHERE status = 'cancelled')\`.
- **string_agg** glues values together: \`string_agg(name, ', ' ORDER BY name)\`.
- **ROLLUP** adds subtotal and grand-total rows: \`GROUP BY ROLLUP (city, status)\`.
`,
    ],
    examples: [
      {
        title: 'Monthly revenue (excluding cancelled orders)',
        sql: `SELECT date_trunc('month', o.ordered_at)::date AS month,\n       count(DISTINCT o.id)                AS orders,\n       sum(oi.quantity * oi.unit_price)    AS revenue\nFROM orders o\nJOIN order_items oi ON oi.order_id = o.id\nWHERE o.status <> 'cancelled'\nGROUP BY 1\nORDER BY 1;`,
        note: '`GROUP BY 1` means "group by the first SELECT column". Handy, but naming the expression is clearer in big queries.',
      },
      { title: 'FILTER: several counts in one pass', sql: `SELECT store_id,\n       count(*)                                      AS all_orders,\n       count(*) FILTER (WHERE status = 'cancelled')  AS cancelled,\n       count(*) FILTER (WHERE discount > 0)          AS discounted\nFROM orders\nGROUP BY store_id\nORDER BY store_id NULLS LAST;` },
      { title: 'string_agg: list products per category', sql: `SELECT cat.name, string_agg(p.name, ', ' ORDER BY p.name) AS products\nFROM categories cat\nJOIN products p ON p.category_id = cat.id\nGROUP BY cat.name\nORDER BY cat.name;` },
      { title: 'ROLLUP: subtotals per city and status', sql: `SELECT COALESCE(c.city, '(unknown)') AS city, o.status, count(*) AS orders\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nGROUP BY ROLLUP (c.city, o.status)\nORDER BY c.city NULLS LAST, o.status NULLS LAST;`, note: 'Rows with a NULL status are subtotals for the city; the last row is the grand total.' },
      { title: 'The grouping error', sql: `-- fails: which last_name should Postgres show for each city?\nSELECT city, last_name, count(*)\nFROM customers\nGROUP BY city;` },
    ],
    exercises: [
      {
        id: 'group-1',
        title: 'Customers per city',
        prompt: 'Return `city` and `customers` (how many customers live there), one row per city - including one row for customers whose city is unknown.',
        solution: `SELECT city, count(*) AS customers FROM customers GROUP BY city;`,
      },
      {
        id: 'group-2',
        title: 'Orders per store, zeros included',
        prompt: 'Return `name` (store name) and `orders` (number of orders) for **every** store - a store without orders shows 0.',
        hint: 'LEFT JOIN orders and use `count(o.id)`, not `count(*)`.',
        solution: `SELECT s.name, count(o.id) AS orders
FROM stores s
LEFT JOIN orders o ON o.store_id = s.id
GROUP BY s.id, s.name;`,
      },
      {
        id: 'group-3',
        title: 'Best-selling products',
        prompt:
          'For every product that was sold in a **non-cancelled** order, return `name`, `units` (total quantity) and `revenue` (sum of quantity × unit_price). Highest revenue first; break ties by name.',
        solution: `SELECT p.name, sum(oi.quantity) AS units, sum(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
WHERE o.status <> 'cancelled'
GROUP BY p.id, p.name
ORDER BY revenue DESC, p.name;`,
        ordered: true,
      },
      {
        id: 'group-4',
        title: 'Regulars (HAVING)',
        prompt: 'Return `first_name`, `last_name` and `orders` (their number of orders, any status) for customers with **more than 5** orders.',
        solution: `SELECT c.first_name, c.last_name, count(*) AS orders
FROM customers c
JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.first_name, c.last_name
HAVING count(*) > 5;`,
      },
      {
        id: 'group-5',
        title: 'Orders per month in 2025',
        prompt: 'Return `month` (a date: the first day of the month) and `orders` (count) for every month of **2025** that has orders, in calendar order.',
        hint: '`date_trunc(\'month\', ordered_at)::date`',
        solution: `SELECT date_trunc('month', ordered_at)::date AS month, count(*) AS orders
FROM orders
WHERE ordered_at >= '2025-01-01' AND ordered_at < '2026-01-01'
GROUP BY 1
ORDER BY 1;`,
        ordered: true,
      },
      {
        id: 'group-6',
        title: 'Well-reviewed products',
        prompt:
          'For products with **at least 3 reviews**, return `name`, `reviews` (count) and `avg_rating` (average rating rounded to 2 decimals).',
        solution: `SELECT p.name, count(*) AS reviews, round(avg(r.rating), 2) AS avg_rating
FROM reviews r
JOIN products p ON p.id = r.product_id
GROUP BY p.id, p.name
HAVING count(*) >= 3;`,
      },
    ],
  },

  {
    id: 'subqueries',
    section: 'Aggregation & beyond',
    title: 'Subqueries',
    summary: 'Queries inside queries: scalar values, IN / EXISTS, correlated subqueries, derived tables and LATERAL.',
    blocks: [
      `
## Scalar subqueries: a single value

A subquery in parentheses that returns **one row, one column** can be used anywhere a value can:

~~~sql
SELECT name, price, round(price - (SELECT avg(price) FROM products), 2) AS vs_average
FROM products
WHERE price > (SELECT avg(price) FROM products)
ORDER BY price DESC;
~~~

If it returns more than one row you get *more than one row returned by a subquery used as an expression*.

## IN and EXISTS: does a related row exist?

~~~sql
-- customers who reviewed something
SELECT first_name, last_name FROM customers
WHERE id IN (SELECT customer_id FROM reviews);

-- the same with EXISTS (a "semi-join")
SELECT first_name, last_name FROM customers c
WHERE EXISTS (SELECT 1 FROM reviews r WHERE r.customer_id = c.id);
~~~

\`EXISTS\` only checks whether *at least one* row exists - unlike a JOIN it never duplicates the outer row, so you don't need DISTINCT.

## ⚠️ The NOT IN trap

"Customers who never ordered":

~~~sql
SELECT count(*) FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders);
~~~

**Zero!** \`orders.customer_id\` contains NULLs (walk-ins). \`id NOT IN (1, 2, NULL)\` means \`id <> 1 AND id <> 2 AND id <> NULL\`, and \`id <> NULL\` is unknown, so the whole condition is never TRUE. Use \`NOT EXISTS\` (NULL-safe) or filter the NULLs out:

~~~sql
SELECT id, first_name FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
~~~

## Correlated subqueries

A subquery that refers to the outer query's row (\`c.id\` above) is **correlated**: conceptually it runs once per outer row.

~~~sql
SELECT c.first_name,
       (SELECT count(*) FROM orders o WHERE o.customer_id = c.id)      AS orders,
       (SELECT max(o.ordered_at) FROM orders o WHERE o.customer_id = c.id) AS last_order
FROM customers c
ORDER BY orders DESC;
~~~

## Derived tables: a subquery in FROM

A subquery in \`FROM\` acts like a temporary table (it needs an alias). Great for "aggregate, then join" - the fix for the fan-out trap:

~~~sql
SELECT c.first_name, t.orders, t.spent
FROM customers c
JOIN (
  SELECT o.customer_id, count(DISTINCT o.id) AS orders, sum(oi.quantity * oi.unit_price) AS spent
  FROM orders o JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status <> 'cancelled'
  GROUP BY o.customer_id
) t ON t.customer_id = c.id
ORDER BY t.spent DESC
LIMIT 5;
~~~

## LATERAL: a subquery per row

A \`LATERAL\` subquery in FROM may reference earlier tables - like a correlated subquery that returns **several rows and columns**. Classic use: *top N per group*.

~~~sql
-- each customer's 2 most recent orders
SELECT c.first_name, recent.id AS order_id, recent.ordered_at
FROM customers c
CROSS JOIN LATERAL (
  SELECT o.id, o.ordered_at FROM orders o
  WHERE o.customer_id = c.id
  ORDER BY o.ordered_at DESC
  LIMIT 2
) AS recent
ORDER BY c.first_name, recent.ordered_at DESC;
~~~

Use \`LEFT JOIN LATERAL (...) ON true\` to keep customers with no orders.
`,
    ],
    examples: [
      { title: 'ANY / ALL', sql: `-- products more expensive than every product in 'Syrup Sweets'\nSELECT name, price FROM products\nWHERE price > ALL (SELECT price FROM products WHERE category_id = 2)\nORDER BY price;` },
      { title: 'NOT IN, fixed', sql: `SELECT id, first_name FROM customers\nWHERE id NOT IN (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL);` },
      { title: 'Subquery in HAVING', sql: `-- stores with more orders than the average store\nSELECT store_id, count(*) AS orders\nFROM orders\nWHERE store_id IS NOT NULL\nGROUP BY store_id\nHAVING count(*) > (SELECT count(*)::numeric / count(DISTINCT store_id) FROM orders WHERE store_id IS NOT NULL);` },
    ],
    exercises: [
      {
        id: 'sub-1',
        title: 'Above-average prices',
        prompt: 'Return `name` and `price` of products priced **above the average** product price.',
        solution: `SELECT name, price FROM products WHERE price > (SELECT avg(price) FROM products);`,
      },
      {
        id: 'sub-2',
        title: 'Never ordered, with NOT EXISTS',
        prompt: 'Return `id`, `first_name` and `last_name` of customers who never placed an order. Use `NOT EXISTS`.',
        solution: `SELECT c.id, c.first_name, c.last_name
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);`,
      },
      {
        id: 'sub-3',
        title: 'Fix the NOT IN trap',
        prompt: 'Return the `id` of customers who never ordered - this time using `NOT IN` correctly.',
        hint: 'Exclude NULLs inside the subquery.',
        solution: `SELECT id FROM customers WHERE id NOT IN (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL);`,
      },
      {
        id: 'sub-4',
        title: 'Last order per customer',
        prompt: 'For **every** customer return `first_name`, `last_name` and `last_order` (the latest `ordered_at` of their orders; NULL if none). Use a correlated subquery.',
        solution: `SELECT c.first_name, c.last_name,
       (SELECT max(o.ordered_at) FROM orders o WHERE o.customer_id = c.id) AS last_order
FROM customers c;`,
      },
      {
        id: 'sub-5',
        title: 'Priciest product in each category',
        prompt: 'Return `category`, `product` and `price` for the most expensive product of each category (uncategorised products are ignored).',
        hint: 'Compare each product\'s price with `(SELECT max(price) FROM products p2 WHERE p2.category_id = p.category_id)`.',
        solution: `SELECT c.name AS category, p.name AS product, p.price
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.price = (SELECT max(p2.price) FROM products p2 WHERE p2.category_id = p.category_id);`,
      },
    ],
  },

  {
    id: 'ctes',
    section: 'Aggregation & beyond',
    title: 'CTEs (WITH) & recursive queries',
    summary: 'Name your subqueries to build queries step by step, and walk trees of any depth with WITH RECURSIVE.',
    blocks: [
      `
## WITH: named subqueries

A **Common Table Expression** gives a subquery a name you can refer to below, like a variable. Complex queries become a readable pipeline:

~~~sql
WITH order_totals AS (
  SELECT order_id, sum(quantity * unit_price) AS items_total
  FROM order_items
  GROUP BY order_id
),
customer_spend AS (
  SELECT o.customer_id, count(*) AS orders, sum(t.items_total) AS spent
  FROM orders o
  JOIN order_totals t ON t.order_id = o.id
  WHERE o.status <> 'cancelled' AND o.customer_id IS NOT NULL
  GROUP BY o.customer_id
)
SELECT c.first_name, c.last_name, s.orders, s.spent
FROM customer_spend s
JOIN customers c ON c.id = s.customer_id
ORDER BY s.spent DESC
LIMIT 10;
~~~

Each CTE can use the ones defined before it. A CTE can also be referenced several times in the main query.

## WITH RECURSIVE: hierarchies of any depth

A recursive CTE has two parts joined by \`UNION ALL\`:

1. the **anchor**: the starting rows (e.g. the CEO);
2. the **recursive part**: joins the table to *the CTE itself* to find the next level.

Postgres runs the anchor, then repeats the recursive part on the rows found in the previous round, until a round finds nothing.

~~~sql
WITH RECURSIVE org AS (
  SELECT id, first_name, title, manager_id, 1 AS level, first_name::text AS path
  FROM employees
  WHERE manager_id IS NULL                     -- anchor: the top of the tree
  UNION ALL
  SELECT e.id, e.first_name, e.title, e.manager_id, org.level + 1, org.path || ' > ' || e.first_name
  FROM employees e
  JOIN org ON e.manager_id = org.id            -- recursive step: the next level down
)
SELECT repeat('    ', level - 1) || first_name AS org_chart, title, level, path
FROM org
ORDER BY path;
~~~

The recursive step is just a **self join** applied over and over. The same pattern walks the category tree (\`categories.parent_id\`) or a chain of referrals.

> Guard against cycles (A manages B manages A) with a depth limit such as \`WHERE level < 20\`, or Postgres 14+'s \`CYCLE id SET is_cycle USING path\` clause.

## Generating series with recursion

~~~sql
WITH RECURSIVE days AS (
  SELECT date '2026-06-01' AS day
  UNION ALL
  SELECT day + 1 FROM days WHERE day < date '2026-06-07'
)
SELECT day, to_char(day, 'Day') AS weekday FROM days;
~~~

(\`generate_series\` does this more simply, but it shows the mechanics.)
`,
    ],
    examples: [
      {
        title: 'Category tree with full paths',
        sql: `WITH RECURSIVE tree AS (\n  SELECT id, name, parent_id, name::text AS path, 0 AS depth\n  FROM categories WHERE parent_id IS NULL\n  UNION ALL\n  SELECT c.id, c.name, c.parent_id, tree.path || ' / ' || c.name, tree.depth + 1\n  FROM categories c JOIN tree ON c.parent_id = tree.id\n)\nSELECT path, depth FROM tree ORDER BY path;`,
      },
      {
        title: 'Referral chains',
        sql: `WITH RECURSIVE chain AS (\n  SELECT id, first_name, referred_by, first_name::text AS chain, 0 AS hops\n  FROM customers WHERE referred_by IS NULL\n  UNION ALL\n  SELECT c.id, c.first_name, c.referred_by, chain.chain || ' → ' || c.first_name, chain.hops + 1\n  FROM customers c JOIN chain ON c.referred_by = chain.id\n)\nSELECT chain, hops FROM chain WHERE hops > 0 ORDER BY hops DESC, chain;`,
      },
      {
        title: 'A CTE used twice',
        sql: `WITH monthly AS (\n  SELECT date_trunc('month', ordered_at)::date AS month, count(*) AS orders\n  FROM orders GROUP BY 1\n)\nSELECT month, orders,\n       round(100.0 * orders / (SELECT sum(orders) FROM monthly), 1) AS pct_of_all\nFROM monthly\nORDER BY month;`,
      },
    ],
    exercises: [
      {
        id: 'cte-1',
        title: 'Big orders',
        prompt:
          'Using a CTE that computes each order\'s items total (`sum(quantity * unit_price)`, ignore discounts), return `order_id` and `total` for orders whose total is **above 2000**.',
        solution: `WITH totals AS (
  SELECT order_id, sum(quantity * unit_price) AS total
  FROM order_items
  GROUP BY order_id
)
SELECT order_id, total FROM totals WHERE total > 2000;`,
      },
      {
        id: 'cte-2',
        title: 'Org chart levels',
        prompt: 'Return `first_name` and `level` for every employee, where the CEO is level 1, their direct reports level 2, and so on.',
        solution: `WITH RECURSIVE org AS (
  SELECT id, first_name, 1 AS level FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.first_name, org.level + 1
  FROM employees e JOIN org ON e.manager_id = org.id
)
SELECT first_name, level FROM org;`,
      },
      {
        id: 'cte-3',
        title: 'Up the chain of command',
        prompt:
          'Starting from employee **Joy** (id 13), return `first_name` and `depth` for Joy (depth 0), Joy\'s manager (depth 1), their manager (depth 2)... up to the CEO, ordered by depth.',
        hint: 'Anchor: `WHERE id = 13`. Recursive step: join employees ON `e.id = chain.manager_id` (walking upwards).',
        solution: `WITH RECURSIVE chain AS (
  SELECT id, first_name, manager_id, 0 AS depth FROM employees WHERE id = 13
  UNION ALL
  SELECT e.id, e.first_name, e.manager_id, chain.depth + 1
  FROM employees e JOIN chain ON e.id = chain.manager_id
)
SELECT first_name, depth FROM chain ORDER BY depth;`,
        ordered: true,
      },
      {
        id: 'cte-4',
        title: 'Everything under "Sweets"',
        prompt: 'Return the `name` of every product in the **Sweets** category or any of its sub-categories (at any depth).',
        hint: 'First collect the category ids recursively (anchor: `WHERE name = \'Sweets\'`), then join products to that list.',
        solution: `WITH RECURSIVE tree AS (
  SELECT id FROM categories WHERE name = 'Sweets'
  UNION ALL
  SELECT c.id FROM categories c JOIN tree ON c.parent_id = tree.id
)
SELECT p.name FROM products p JOIN tree ON p.category_id = tree.id;`,
      },
    ],
  },

  {
    id: 'window-functions',
    section: 'Aggregation & beyond',
    title: 'Window functions',
    summary: 'Rankings, running totals, previous/next rows and top-N per group - aggregates that keep every row.',
    blocks: [
      `
## Aggregates without collapsing rows

\`GROUP BY\` squashes each group into one row. A **window function** computes over a set of related rows ("the window") but **keeps every row**. The \`OVER (...)\` clause defines the window:

~~~sql
SELECT name, category_id, price,
       avg(price) OVER ()                         AS avg_all,         -- whole result
       avg(price) OVER (PARTITION BY category_id) AS avg_in_category  -- per category
FROM products
ORDER BY category_id, price;
~~~

- \`PARTITION BY\` splits rows into independent groups (like GROUP BY, but nothing collapses).
- \`ORDER BY\` inside \`OVER\` orders rows within each partition - needed for rankings and running totals.

Window functions run **after** WHERE/GROUP BY/HAVING, just before ORDER BY. So you can't filter on them directly in WHERE - wrap the query in a subquery or CTE first.

## Ranking

~~~sql
SELECT name, price,
       row_number() OVER (ORDER BY price DESC) AS row_number,  -- 1,2,3,4 (ties broken arbitrarily)
       rank()       OVER (ORDER BY price DESC) AS rank,        -- 1,2,2,4 (gaps after ties)
       dense_rank() OVER (ORDER BY price DESC) AS dense_rank   -- 1,2,2,3 (no gaps)
FROM products
WHERE category_id = 2;
~~~

## Running totals and frames

With an \`ORDER BY\`, aggregate windows are *cumulative*: by default the frame runs from the first row up to the current row.

~~~sql
WITH monthly AS (
  SELECT date_trunc('month', o.ordered_at)::date AS month, sum(oi.quantity * oi.unit_price) AS revenue
  FROM orders o JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status <> 'cancelled'
  GROUP BY 1
)
SELECT month, revenue,
       sum(revenue) OVER (ORDER BY month)                                         AS running_total,
       round(avg(revenue) OVER (ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS moving_avg_3m
FROM monthly
ORDER BY month;
~~~

## Looking at neighbouring rows: LAG / LEAD

~~~sql
SELECT id, ordered_at,
       lag(ordered_at) OVER (ORDER BY ordered_at)              AS previous_order,
       ordered_at - lag(ordered_at) OVER (ORDER BY ordered_at) AS gap
FROM orders
WHERE customer_id = 2
ORDER BY ordered_at;
~~~

## Top-N per group

Number the rows inside each partition, then keep the first N in an outer query:

~~~sql
WITH ranked AS (
  SELECT p.name, p.category_id, p.price,
         row_number() OVER (PARTITION BY p.category_id ORDER BY p.price DESC) AS rn
  FROM products p
)
SELECT * FROM ranked WHERE rn <= 2 ORDER BY category_id, rn;
~~~

Other useful ones: \`ntile(4)\` (quartiles), \`first_value\` / \`last_value\`, \`percent_rank()\`, \`count(*) OVER (...)\`.
`,
    ],
    examples: [
      { title: 'Share of each order line in its order', sql: `SELECT order_id, product_id, quantity * unit_price AS line_total,\n       round(100.0 * quantity * unit_price / sum(quantity * unit_price) OVER (PARTITION BY order_id), 1) AS pct_of_order\nFROM order_items\nWHERE order_id BETWEEN 10 AND 14\nORDER BY order_id, line_total DESC;` },
      { title: 'Salary rank inside each department', sql: `SELECT d.name AS department, e.first_name, e.salary,\n       rank() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS rank_in_dept,\n       e.salary - avg(e.salary) OVER (PARTITION BY e.department_id) AS vs_dept_avg\nFROM employees e\nLEFT JOIN departments d ON d.id = e.department_id\nORDER BY department, rank_in_dept;` },
      { title: 'Named WINDOW clause', sql: `SELECT id, customer_id, ordered_at,\n       row_number() OVER w AS nth_order,\n       count(*)     OVER (PARTITION BY customer_id) AS total_orders\nFROM orders\nWHERE customer_id IN (2, 5)\nWINDOW w AS (PARTITION BY customer_id ORDER BY ordered_at)\nORDER BY customer_id, ordered_at;` },
      { title: 'Customers in quartiles by spend', sql: `WITH spend AS (\n  SELECT o.customer_id, sum(oi.quantity * oi.unit_price) AS spent\n  FROM orders o JOIN order_items oi ON oi.order_id = o.id\n  WHERE o.customer_id IS NOT NULL\n  GROUP BY o.customer_id\n)\nSELECT customer_id, spent, ntile(4) OVER (ORDER BY spent DESC) AS quartile\nFROM spend ORDER BY spent DESC;` },
    ],
    exercises: [
      {
        id: 'win-1',
        title: 'Price rank within category',
        prompt:
          'For every product that has a category return `category_id`, `name`, `price` and `price_rank`: its rank by price within its category (most expensive = 1, equal prices share a rank, gaps after ties).',
        solution: `SELECT category_id, name, price,
       rank() OVER (PARTITION BY category_id ORDER BY price DESC) AS price_rank
FROM products
WHERE category_id IS NOT NULL;`,
      },
      {
        id: 'win-2',
        title: 'Running revenue total in 2025',
        prompt:
          'For each month of **2025** return `month` (date), `revenue` (sum of quantity × unit_price over non-cancelled orders) and `running_total` (revenue from January up to that month), in calendar order.',
        solution: `WITH monthly AS (
  SELECT date_trunc('month', o.ordered_at)::date AS month, sum(oi.quantity * oi.unit_price) AS revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status <> 'cancelled' AND o.ordered_at >= '2025-01-01' AND o.ordered_at < '2026-01-01'
  GROUP BY 1
)
SELECT month, revenue, sum(revenue) OVER (ORDER BY month) AS running_total
FROM monthly
ORDER BY month;`,
        ordered: true,
      },
      {
        id: 'win-3',
        title: 'Each customer\'s first order',
        prompt: 'For every customer who has orders, return `customer_id`, `order_id` and `ordered_at` of their **first** (earliest) order.',
        hint: '`row_number() OVER (PARTITION BY customer_id ORDER BY ordered_at)` in a CTE, then keep `rn = 1`.',
        solution: `WITH ranked AS (
  SELECT customer_id, id AS order_id, ordered_at,
         row_number() OVER (PARTITION BY customer_id ORDER BY ordered_at) AS rn
  FROM orders
  WHERE customer_id IS NOT NULL
)
SELECT customer_id, order_id, ordered_at FROM ranked WHERE rn = 1;`,
      },
      {
        id: 'win-4',
        title: 'Previous order',
        prompt:
          'For the orders of customer **2**, return `id`, `ordered_at` and `previous_order` (the `ordered_at` of that customer\'s previous order; NULL for the first), in date order.',
        solution: `SELECT id, ordered_at, lag(ordered_at) OVER (ORDER BY ordered_at) AS previous_order
FROM orders
WHERE customer_id = 2
ORDER BY ordered_at;`,
        ordered: true,
      },
    ],
  },

  {
    id: 'set-operations',
    section: 'Aggregation & beyond',
    title: 'UNION, INTERSECT & EXCEPT',
    summary: 'Combine the results of two queries vertically: stack them, intersect them or subtract one from the other.',
    blocks: [
      `
## Joins combine columns, set operations combine rows

A join puts tables **side by side**. A set operation stacks two query results **on top of each other**. Both queries must return the same number of columns with compatible types; the column names come from the first query.

| Operator | Result |
|---|---|
| \`UNION\` | rows in either query, **duplicates removed** |
| \`UNION ALL\` | rows in either query, duplicates kept (faster - no de-duplication) |
| \`INTERSECT\` | rows in both queries |
| \`EXCEPT\` | rows in the first query but not the second |

~~~sql
SELECT first_name, 'customer' AS kind FROM customers
UNION ALL
SELECT first_name, 'employee' FROM employees
ORDER BY first_name;
~~~

An \`ORDER BY\` at the end sorts the combined result.

> Unlike \`=\` in a join, set operations treat two NULLs as equal (they are "not distinct"). \`EXCEPT\` is a handy NULL-safe alternative to anti-joins when you only compare a few columns.
`,
    ],
    examples: [
      { title: 'Names used by both customers and employees', sql: `SELECT first_name FROM customers\nINTERSECT\nSELECT first_name FROM employees;` },
      { title: 'Cities with customers but no store', sql: `SELECT city FROM customers WHERE city IS NOT NULL\nEXCEPT\nSELECT city FROM stores;` },
      { title: 'One timeline from two tables', sql: `SELECT ordered_at AS at, 'order #' || id AS event FROM orders WHERE customer_id = 5\nUNION ALL\nSELECT created_at, 'review: ' || rating || ' stars' FROM reviews WHERE customer_id = 5\nORDER BY at;` },
    ],
    exercises: [
      {
        id: 'set-1',
        title: 'All first names',
        prompt: 'Return a single column `first_name` with every first name used by a customer **or** an employee, each name once.',
        solution: `SELECT first_name FROM customers UNION SELECT first_name FROM employees;`,
      },
      {
        id: 'set-2',
        title: 'Cities with customers and stores',
        prompt: 'Return the `city` values that have **both** at least one customer and at least one store.',
        solution: `SELECT city FROM customers INTERSECT SELECT city FROM stores;`,
      },
      {
        id: 'set-3',
        title: 'Viewed but never ordered',
        prompt: 'Return the `product_id` of products that appear in `web_events` but have **never been ordered**. Ignore events without a product.',
        solution: `SELECT product_id FROM web_events WHERE product_id IS NOT NULL
EXCEPT
SELECT product_id FROM order_items;`,
      },
    ],
  },
];
