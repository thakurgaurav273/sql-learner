import type { Lesson } from '../types.ts';

export const basics: Lesson[] = [
  {
    id: 'welcome',
    section: 'Basics',
    title: 'Welcome & the practice database',
    summary: 'How this playground works, and a tour of the sample data you will query in every lesson.',
    blocks: [
      `
## How to use this playground

- **Left:** lessons. Each has an explanation, runnable examples and practice exercises.
- **Middle:** the SQL editor. Press **Run** (or **Cmd/Ctrl + Enter**) to execute everything in it, or select part of the text to run only that part. Several statements separated by \`;\` run one after another, like in \`psql\`; if one fails, the rest are skipped and the error is explained below the editor.
- **Right:** the live **schema** of the database - tables, columns, primary keys (🔑) and foreign keys (↗). It refreshes after you create, alter or drop things.
- **Reset DB** (top right) puts the database back exactly as it started. So experiment freely: delete rows, drop tables, break things - one click undoes it all.

Every SQL code block in a lesson has **Load into editor** and **▶ Run** buttons. Try this one:

~~~sql
SELECT * FROM stores;
~~~

> The database is a real **PostgreSQL** server running in Docker on your machine (see the chip at the top). Nothing here touches any other database.

## The story: "Mishti & More"

You are the new data person at **Mishti & More**, a small chain of Bengali sweet shops. The database records:

| Table | What it holds |
|---|---|
| \`stores\` | 5 shops (the newest one has no orders yet) |
| \`departments\`, \`employees\` | staff, their department, store and **manager** (\`manager_id\` points back at \`employees\`) |
| \`salary_grades\` | salary bands - no foreign key, you join them with \`BETWEEN\` |
| \`categories\`, \`products\` | what we sell; categories form a **tree** via \`parent_id\` |
| \`suppliers\`, \`product_suppliers\` | a **many-to-many** link between products and suppliers |
| \`customers\` | registered customers; \`referred_by\` points back at \`customers\` |
| \`orders\`, \`order_items\` | order headers and their lines (product, quantity, price paid) |
| \`payments\` | how orders were paid - some orders have none, some were split into two payments |
| \`reviews\` | 1-5 star product reviews |
| \`web_events\` | 200,000 website events, for the performance lessons |

### How the tables connect

An arrow means "has a foreign key pointing to":

~~~text
departments ◄── employees ──► stores ◄── orders ──► customers ◄─┐
                 │   ▲                    │  │  │       │        │ referred_by
                 └───┘ manager_id         │  │  │       └────────┘
                                          │  │  └──► employees
            order_items ──────────────────┘  │
                 │                 payments ─┘
                 ▼
categories ◄── products ◄── product_suppliers ──► suppliers
   ▲    │          ▲
   └────┘          ├── reviews ──► customers
  parent_id        └── web_events ──► customers
~~~

### Built-in gaps (on purpose!)

Real data is messy, and joins are all about what happens when rows **don't** match. So the data includes:

- customers who have **never ordered**, and anonymous **walk-in orders** with \`customer_id = NULL\`
- **online orders** with \`store_id = NULL\`, and a store with **no orders**
- products **never ordered**, a product with **no category**, and **empty categories**
- a department with **no employees**, and an employee with **no department**
- orders with **no order items**, orders with **no payment** and orders with **two payments**
- \`NULL\` emails, phones, cities, product costs and review comments

You will meet each of these in the join lessons.
`,
    ],
    examples: [
      { title: 'Peek at the customers', sql: `SELECT *\nFROM customers\nLIMIT 10;` },
      { title: 'Peek at recent orders', sql: `SELECT *\nFROM orders\nORDER BY ordered_at DESC\nLIMIT 10;` },
      {
        title: 'How many rows does each table have?',
        sql: `SELECT 'customers' AS table_name, count(*) FROM customers
UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'order_items', count(*) FROM order_items
UNION ALL SELECT 'products', count(*) FROM products
UNION ALL SELECT 'payments', count(*) FROM payments
UNION ALL SELECT 'web_events', count(*) FROM web_events;`,
        note: 'Don\'t worry about `UNION ALL` yet - it just stacks results on top of each other. You will learn it later.',
      },
    ],
    exercises: [
      {
        id: 'welcome-1',
        title: 'Your first query',
        prompt: 'Return **every column** of **every row** in the `stores` table.',
        hint: '`SELECT * FROM table_name;` - the `*` means "all columns".',
        solution: 'SELECT * FROM stores;',
      },
      {
        id: 'welcome-2',
        title: 'Pick columns',
        prompt: 'List the `name` and `price` of every product (two columns, in that order).',
        hint: 'List the columns you want after `SELECT`, separated by commas.',
        solution: 'SELECT name, price FROM products;',
      },
    ],
  },

  {
    id: 'select-basics',
    section: 'Basics',
    title: 'SELECT, WHERE & ORDER BY',
    summary: 'Filter rows, compute new columns, sort and limit - and the order in which SQL actually evaluates a query.',
    blocks: [
      `
## Anatomy of a query

~~~text
SELECT   columns / expressions        -- 5. what to output
FROM     table                        -- 1. where the rows come from (joins happen here)
WHERE    condition                    -- 2. keep only rows where this is TRUE
GROUP BY ...                          -- 3. (later lesson)
HAVING   ...                          -- 4. (later lesson)
ORDER BY ...                          -- 6. sort the output
LIMIT    n OFFSET m                   -- 7. keep only part of it
~~~

You **write** \`SELECT\` first, but the database **evaluates** \`FROM\` first and \`SELECT\` near the end. That is why you cannot use a column alias defined in \`SELECT\` inside \`WHERE\` - it does not exist yet - but you *can* use it in \`ORDER BY\`.

## Filtering with WHERE

~~~sql
SELECT name, price, unit
FROM products
WHERE price < 50 AND unit = 'piece';
~~~

Useful operators:

| Operator | Example |
|---|---|
| \`=  <>  <  <=  >  >=\` | \`price >= 100\` |
| \`AND\`, \`OR\`, \`NOT\` | \`city = 'Kolkata' OR city = 'Howrah'\` |
| \`IN (list)\` | \`city IN ('Kolkata', 'Howrah')\` |
| \`BETWEEN a AND b\` (inclusive) | \`price BETWEEN 40 AND 60\` |
| \`LIKE\` / \`ILIKE\` (case-insensitive) | \`name ILIKE '%sandesh%'\` (\`%\` = any text, \`_\` = one character) |
| \`IS NULL\` / \`IS NOT NULL\` | \`email IS NULL\` (next lesson!) |

> **Precedence trap:** \`AND\` binds tighter than \`OR\`. \`WHERE a OR b AND c\` means \`a OR (b AND c)\`. When mixing them, always use parentheses.

Text values use **single quotes** (\`'Kolkata'\`). Double quotes are for identifiers such as column names (\`"Order Total"\`).

## Expressions, aliases and CASE

You can compute new columns and name them with \`AS\`:

~~~sql
SELECT name,
       price,
       cost,
       price - cost                         AS margin,
       round((price - cost) / price * 100)  AS margin_pct,
       CASE WHEN price >= 500 THEN 'premium'
            WHEN price >= 50  THEN 'regular'
            ELSE 'budget' END               AS band
FROM products
ORDER BY margin_pct DESC;
~~~

## Sorting, DISTINCT and LIMIT

- \`ORDER BY col\` sorts ascending; add \`DESC\` for descending. Sort by several columns: \`ORDER BY city, last_name\`.
- Without \`ORDER BY\`, row order is **not guaranteed** - never rely on it.
- \`SELECT DISTINCT\` removes duplicate output rows.
- \`LIMIT 10\` keeps the first 10 rows (after sorting); \`OFFSET 10\` skips 10 first (pagination).

## Dates and text

~~~sql
SELECT id,
       ordered_at,
       ordered_at::date                     AS order_day,
       extract(year FROM ordered_at)        AS yr,
       date_trunc('month', ordered_at)      AS month,
       to_char(ordered_at, 'Dy DD Mon YYYY') AS pretty
FROM orders
WHERE ordered_at >= '2026-01-01'
ORDER BY ordered_at
LIMIT 10;
~~~

\`||\` concatenates text: \`first_name || ' ' || last_name\`. \`::type\` casts a value (\`'2026-01-01'::date\`).
`,
    ],
    examples: [
      { title: 'Customers from Kolkata or Howrah', sql: `SELECT first_name, last_name, city\nFROM customers\nWHERE city IN ('Kolkata', 'Howrah')\nORDER BY city, last_name;` },
      { title: 'Cheap single pieces', sql: `SELECT name, price\nFROM products\nWHERE unit = 'piece' AND price BETWEEN 20 AND 40\nORDER BY price DESC, name;` },
      { title: 'Pattern matching with ILIKE', sql: `SELECT name FROM products WHERE name ILIKE '%doi%';` },
      { title: 'Distinct order statuses', sql: `SELECT DISTINCT status\nFROM orders\nORDER BY status;` },
      { title: 'Page 2 of products, 5 per page', sql: `SELECT id, name, price\nFROM products\nORDER BY id\nLIMIT 5 OFFSET 5;` },
      {
        title: 'The precedence trap',
        sql: `-- Meant: active products in category 2 or 3 that cost under 40.
-- Without parentheses this means: (category 2) OR (category 3 AND active AND price < 40)
SELECT name, category_id, price, is_active
FROM products
WHERE category_id = 2 OR category_id = 3 AND is_active AND price < 40;

-- Correct:
SELECT name, category_id, price, is_active
FROM products
WHERE (category_id = 2 OR category_id = 3) AND is_active AND price < 40;`,
        note: 'Run both and compare: the first one wrongly includes expensive and inactive category-2 products.',
      },
    ],
    exercises: [
      {
        id: 'select-1',
        title: 'Kolkata sign-ups in 2025',
        prompt: 'List `first_name`, `last_name` and `signup_date` of customers from **Kolkata** who signed up in **2025**, oldest sign-up first.',
        hint: 'Use a date range: `signup_date >= \'2025-01-01\' AND signup_date < \'2026-01-01\'`, then `ORDER BY signup_date`.',
        solution: `SELECT first_name, last_name, signup_date
FROM customers
WHERE city = 'Kolkata'
  AND signup_date >= '2025-01-01' AND signup_date < '2026-01-01'
ORDER BY signup_date;`,
        ordered: true,
      },
      {
        id: 'select-2',
        title: 'Top 5 most expensive products',
        prompt: 'Return `name` and `price` of the **5 most expensive** products, most expensive first.',
        solution: `SELECT name, price
FROM products
ORDER BY price DESC
LIMIT 5;`,
        ordered: true,
      },
      {
        id: 'select-3',
        title: 'Where do customers live?',
        prompt: 'List each **distinct** customer `city` once, alphabetically. Leave out customers whose city is unknown (NULL).',
        hint: '`SELECT DISTINCT city ... WHERE city IS NOT NULL ORDER BY city`',
        solution: `SELECT DISTINCT city
FROM customers
WHERE city IS NOT NULL
ORDER BY city;`,
        ordered: true,
      },
      {
        id: 'select-4',
        title: 'All the sandesh',
        prompt: 'Find the `name` of every product whose name contains **"sandesh"** in any letter case.',
        hint: '`ILIKE` is the case-insensitive version of `LIKE`; `%` matches any text.',
        solution: `SELECT name FROM products WHERE name ILIKE '%sandesh%';`,
      },
      {
        id: 'select-5',
        title: 'Price bands',
        prompt:
          'For every product return `name`, `price` and a column `band` that is `\'budget\'` when the price is under 50, `\'regular\'` from 50 up to (but not including) 500, and `\'premium\'` for 500 and above.',
        hint: '`CASE WHEN ... THEN ... WHEN ... THEN ... ELSE ... END AS band` - conditions are tested top to bottom.',
        solution: `SELECT name, price,
       CASE WHEN price < 50 THEN 'budget'
            WHEN price < 500 THEN 'regular'
            ELSE 'premium' END AS band
FROM products;`,
      },
    ],
  },

  {
    id: 'nulls',
    section: 'Basics',
    title: 'NULL & three-valued logic',
    summary: 'NULL means "unknown". It behaves differently from every other value - and it is the key to understanding outer joins.',
    blocks: [
      `
## NULL is not a value, it is "unknown"

\`NULL\` marks a missing or unknown value: a customer who never gave an email, a product whose cost we don't know, a walk-in order with no customer.

Any comparison with NULL gives **NULL** (unknown), not TRUE or FALSE:

| Expression | Result |
|---|---|
| \`NULL = NULL\` | NULL |
| \`NULL <> 5\` | NULL |
| \`NULL + 10\` | NULL |
| \`NULL AND FALSE\` | FALSE |
| \`NULL OR TRUE\` | TRUE |
| \`NULL IS NULL\` | TRUE |

SQL uses **three-valued logic**: TRUE, FALSE and UNKNOWN. A \`WHERE\` clause keeps a row only when the condition is **TRUE** - UNKNOWN rows are dropped just like FALSE ones.

~~~sql
-- Looks reasonable, returns nothing: email = NULL is never TRUE
SELECT first_name, email FROM customers WHERE email = NULL;
~~~

~~~sql
-- The right way
SELECT first_name, email FROM customers WHERE email IS NULL;
~~~

## Surprises to remember

1. \`WHERE city <> 'Kolkata'\` does **not** return customers whose city is NULL. Ask for them explicitly: \`WHERE city <> 'Kolkata' OR city IS NULL\`, or use \`city IS DISTINCT FROM 'Kolkata'\` which treats NULL as a normal comparable value.
2. Aggregates skip NULLs: \`count(*)\` counts rows, \`count(email)\` counts non-NULL emails, \`avg(cost)\` averages only the known costs.
3. When sorting, NULLs come **last** in ascending order and **first** in descending order. Override with \`NULLS FIRST\` / \`NULLS LAST\`.
4. \`NOT IN (subquery)\` returns nothing if the subquery contains a NULL (more in the Subqueries lesson).
5. In joins, \`NULL = NULL\` is not TRUE, so **rows with a NULL join key never match** anything.

## Handling NULLs

- \`COALESCE(a, b, c)\` returns the first non-NULL argument: \`COALESCE(email, phone, 'no contact')\`.
- \`NULLIF(a, b)\` returns NULL if \`a = b\` - handy to avoid division by zero: \`total / NULLIF(count, 0)\`.

~~~sql
SELECT first_name,
       email,
       phone,
       COALESCE(email, phone, '(no contact info)') AS best_contact
FROM customers
ORDER BY id;
~~~
`,
    ],
    examples: [
      { title: 'count(*) vs count(column)', sql: `SELECT count(*)        AS customers,\n       count(email)    AS with_email,\n       count(phone)    AS with_phone,\n       count(city)     AS with_city\nFROM customers;` },
      { title: '<> silently drops NULLs', sql: `SELECT count(*) FROM customers WHERE city <> 'Kolkata';\nSELECT count(*) FROM customers WHERE city IS DISTINCT FROM 'Kolkata';` },
      { title: 'NULL arithmetic', sql: `SELECT name, price, cost, price - cost AS margin\nFROM products\nWHERE cost IS NULL OR id < 4;` },
      { title: 'Where do NULLs sort?', sql: `SELECT name, cost FROM products ORDER BY cost DESC LIMIT 6;   -- NULLs first!\nSELECT name, cost FROM products ORDER BY cost DESC NULLS LAST LIMIT 6;` },
      { title: 'The three-valued truth table', sql: `SELECT a, b, a AND b AS "a AND b", a OR b AS "a OR b", NOT a AS "NOT a"\nFROM (VALUES (true), (false), (NULL::boolean)) AS x(a)\nCROSS JOIN (VALUES (true), (false), (NULL::boolean)) AS y(b);` },
    ],
    exercises: [
      {
        id: 'nulls-1',
        title: 'Missing emails',
        prompt: 'List `first_name` and `last_name` of customers who have **no email**.',
        solution: `SELECT first_name, last_name FROM customers WHERE email IS NULL;`,
      },
      {
        id: 'nulls-2',
        title: 'Best way to reach each customer',
        prompt: 'For **every** customer return `first_name`, `last_name` and `contact`: their email, or if that is missing their phone, or if both are missing the text `no contact info`.',
        hint: '`COALESCE(email, phone, \'no contact info\') AS contact`',
        solution: `SELECT first_name, last_name, COALESCE(email, phone, 'no contact info') AS contact FROM customers;`,
      },
      {
        id: 'nulls-3',
        title: 'Not from Kolkata',
        prompt: 'Return `first_name` and `city` of every customer who is **not known to live in Kolkata** - that includes customers whose city is unknown.',
        hint: '`city <> \'Kolkata\'` alone drops the NULL cities. Add `OR city IS NULL`, or use `IS DISTINCT FROM`.',
        solution: `SELECT first_name, city FROM customers WHERE city IS DISTINCT FROM 'Kolkata';`,
      },
      {
        id: 'nulls-4',
        title: 'Margins, unknown last',
        prompt:
          'Return `name` and `margin` (`price - cost`) for every product, highest margin first. Products with an unknown margin must come **last**; break ties by `name`.',
        hint: 'In descending order Postgres puts NULLs first by default. Use `ORDER BY margin DESC NULLS LAST, name`.',
        solution: `SELECT name, price - cost AS margin
FROM products
ORDER BY margin DESC NULLS LAST, name;`,
        ordered: true,
      },
    ],
  },
];
