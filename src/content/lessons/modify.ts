import type { Lesson } from '../types.ts';

export const modify: Lesson[] = [
  {
    id: 'modifying-data',
    section: 'Changing data',
    title: 'INSERT, UPDATE & DELETE',
    summary: 'Add, change and remove rows - including updates and deletes driven by joins, RETURNING and upserts.',
    blocks: [
      `
> Go ahead and change things. **Reset DB** (top right) restores the original data whenever you want. Exercises are checked on a separate pristine copy, inside a transaction that is rolled back.

## INSERT

~~~sql
INSERT INTO customers (first_name, last_name, email, city, signup_date)
VALUES ('Mitali', 'Ghosh', 'mitali.ghosh@example.com', 'Kolkata', current_date)
RETURNING id, first_name, signup_date;
~~~

- List the columns explicitly. Columns you leave out get their **default** (\`id\` comes from its identity sequence) or NULL.
- Insert several rows with \`VALUES (...), (...), (...)\`.
- \`INSERT INTO t (cols) SELECT ...\` inserts the result of a query.
- \`RETURNING\` hands back the inserted rows - including generated ids - without a second query.

## UPDATE

~~~sql
UPDATE products
SET price = price * 1.05
WHERE category_id = 8
RETURNING name, price;
~~~

> ⚠️ An UPDATE or DELETE **without WHERE** changes every row. When in doubt, first run the same WHERE as a SELECT to see which rows you will touch - or wrap your experiment in \`BEGIN; ... ROLLBACK;\`.

### UPDATE with a join: UPDATE ... FROM

To update rows based on another table, add a \`FROM\` clause and put the join condition in \`WHERE\`:

~~~sql
-- 5% loyalty discount on pending orders of customers from Bengaluru
UPDATE orders o
SET discount = 5
FROM customers c
WHERE c.id = o.customer_id
  AND c.city = 'Bengaluru'
  AND o.status = 'pending'
RETURNING o.id, c.first_name, o.discount;
~~~

## DELETE

~~~sql
DELETE FROM reviews WHERE rating = 1 RETURNING *;
~~~

**DELETE ... USING** is the join version: \`DELETE FROM payments p USING orders o WHERE o.id = p.order_id AND o.status = 'cancelled';\`

Deleting a row that other rows reference is governed by the foreign key's \`ON DELETE\` rule (see *Constraints*): deleting an order **cascades** to its items and payments, while deleting a product that has been ordered is **refused**.

## Upsert: INSERT ... ON CONFLICT

"Insert this row - or if it already exists, update it":

~~~sql
INSERT INTO product_suppliers (product_id, supplier_id, unit_cost)
VALUES (1, 1, 6.50)
ON CONFLICT (product_id, supplier_id)
DO UPDATE SET unit_cost = EXCLUDED.unit_cost
RETURNING *;
~~~

\`EXCLUDED\` is the row you tried to insert. \`ON CONFLICT DO NOTHING\` silently skips duplicates instead.

## Clearing a table

\`TRUNCATE order_items;\` empties a table instantly (no per-row work, no WHERE). It refuses if other tables reference it unless you add \`CASCADE\` - which then empties those too!
`,
    ],
    examples: [
      {
        title: 'Try it safely inside a transaction',
        sql: `BEGIN;\nDELETE FROM order_items WHERE order_id = 1;\nSELECT count(*) AS items_left_for_order_1 FROM order_items WHERE order_id = 1;\nROLLBACK;\nSELECT count(*) AS items_after_rollback FROM order_items WHERE order_id = 1;`,
        note: 'Everything between BEGIN and ROLLBACK is undone. More in the Transactions lesson.',
      },
      { title: 'INSERT ... SELECT', sql: `CREATE TABLE vip_customers AS SELECT id, first_name, last_name FROM customers WHERE false;\n\nINSERT INTO vip_customers (id, first_name, last_name)\nSELECT c.id, c.first_name, c.last_name\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nGROUP BY c.id\nHAVING count(*) >= 8\nRETURNING *;` },
      { title: 'Deleting a product that was ordered (refused)', sql: `DELETE FROM products WHERE name = 'Rasgulla';` },
      { title: 'Deleting an order cascades', sql: `BEGIN;\nSELECT count(*) AS items_before FROM order_items WHERE order_id = 5;\nDELETE FROM orders WHERE id = 5;\nSELECT count(*) AS items_after FROM order_items WHERE order_id = 5;\nROLLBACK;` },
    ],
    exercises: [
      {
        id: 'mod-1',
        title: 'Add a customer',
        prompt:
          'Insert a new customer **Mitali Ghosh** from **Kolkata**, email `mitali.ghosh@example.com`, signed up today (`current_date`). Let the database generate the id.',
        solution: `INSERT INTO customers (first_name, last_name, email, city, signup_date)
VALUES ('Mitali', 'Ghosh', 'mitali.ghosh@example.com', 'Kolkata', current_date);`,
        verify: `SELECT first_name, last_name, email, city, signup_date FROM customers WHERE email = 'mitali.ghosh@example.com';`,
      },
      {
        id: 'mod-2',
        title: 'Dry sweets price rise',
        prompt: 'Increase the price of every product in the **Dry Sweets** category by **10%**. Look up the category by its name rather than hard-coding its id.',
        hint: '`UPDATE products SET price = price * 1.10 WHERE category_id = (SELECT id FROM categories WHERE name = \'Dry Sweets\')`',
        solution: `UPDATE products SET price = price * 1.10
WHERE category_id = (SELECT id FROM categories WHERE name = 'Dry Sweets');`,
        verify: `SELECT id, name, price FROM products ORDER BY id;`,
      },
      {
        id: 'mod-3',
        title: 'Bengaluru discount',
        prompt: 'Set `discount` to **5** on every order placed in **2026** by a customer who lives in **Bengaluru**. Use `UPDATE ... FROM`.',
        solution: `UPDATE orders o SET discount = 5
FROM customers c
WHERE c.id = o.customer_id AND c.city = 'Bengaluru' AND o.ordered_at >= '2026-01-01';`,
        verify: `SELECT id, discount FROM orders ORDER BY id;`,
      },
      {
        id: 'mod-4',
        title: 'Remove one-star reviews',
        prompt: 'Delete every review with a rating of **1**.',
        solution: `DELETE FROM reviews WHERE rating = 1;`,
        verify: `SELECT id FROM reviews ORDER BY id;`,
      },
      {
        id: 'mod-5',
        title: 'Upsert supplier costs',
        prompt:
          'In **one statement**, record that supplier 1 now charges **6.50** for product 1 (that link already exists) and that supplier 2 charges **18.00** for product 29 (a new link).',
        hint: '`INSERT ... VALUES (1, 1, 6.50), (29, 2, 18.00) ON CONFLICT (product_id, supplier_id) DO UPDATE SET unit_cost = EXCLUDED.unit_cost`',
        solution: `INSERT INTO product_suppliers (product_id, supplier_id, unit_cost)
VALUES (1, 1, 6.50), (29, 2, 18.00)
ON CONFLICT (product_id, supplier_id) DO UPDATE SET unit_cost = EXCLUDED.unit_cost;`,
        verify: `SELECT product_id, supplier_id, unit_cost FROM product_suppliers ORDER BY product_id, supplier_id;`,
      },
    ],
  },

  {
    id: 'constraints',
    section: 'Changing data',
    title: 'Keys & constraints',
    summary: 'Primary keys, foreign keys, UNIQUE, NOT NULL, CHECK and DEFAULT: rules the database enforces for you.',
    blocks: [
      `
## Why constraints?

Constraints are rules the database checks on **every** insert and update, so bad data can't get in no matter which app (or which tired developer) writes it. Open a table in the Schema panel and expand *constraints & indexes* to see them.

| Constraint | Guarantees | Example in this database |
|---|---|---|
| \`PRIMARY KEY\` | unique + not null; identifies a row | \`customers.id\`, \`product_suppliers (product_id, supplier_id)\` |
| \`FOREIGN KEY\` | the referenced row exists | \`orders.customer_id → customers.id\` |
| \`UNIQUE\` | no two rows share the value (NULLs allowed, and NULLs don't clash) | \`customers.email\` |
| \`NOT NULL\` | a value is required | \`products.price\` |
| \`CHECK\` | an expression must not be false | \`price > 0\`, \`rating BETWEEN 1 AND 5\` |
| \`DEFAULT\` | value used when the column is omitted | \`orders.status DEFAULT 'pending'\` |

## Break them on purpose

Run each statement and read the error - the Detail line names the exact value and constraint:

~~~sql
INSERT INTO customers (first_name, last_name, email, signup_date)
VALUES ('Copy', 'Cat', 'aarav.sharma@example.com', current_date);   -- duplicate email
~~~

~~~sql
INSERT INTO orders (customer_id, ordered_at) VALUES (999, now());  -- customer 999 doesn't exist
~~~

~~~sql
UPDATE products SET price = -10 WHERE id = 1;                       -- CHECK (price > 0)
~~~

~~~sql
INSERT INTO reviews (product_id, rating, created_at) VALUES (1, 6, now());   -- rating 1-5
~~~

## What happens on DELETE?

Each foreign key says what to do when the referenced row is deleted:

- \`ON DELETE CASCADE\` - delete the referencing rows too (\`order_items.order_id\`: deleting an order deletes its lines).
- \`ON DELETE SET NULL\` - keep the rows, clear the reference (\`orders.customer_id\`: deleting a customer keeps their orders as anonymous ones).
- default (\`NO ACTION\` / \`RESTRICT\`) - refuse the delete (\`order_items.product_id\`: you can't delete a product that has been sold).

~~~sql
BEGIN;
SELECT count(*) FILTER (WHERE customer_id IS NULL) AS anonymous_orders_before FROM orders;
DELETE FROM customers WHERE id = 1;     -- customer 1 has orders: they become anonymous
SELECT count(*) FILTER (WHERE customer_id IS NULL) AS anonymous_orders_after FROM orders;
ROLLBACK;
~~~

## Adding constraints later

\`ALTER TABLE\` adds constraints to existing tables - but only if **all existing rows** already satisfy them:

~~~sql
ALTER TABLE employees ADD CONSTRAINT salary_cap CHECK (salary <= 200000);
~~~

That fails because one salary is higher. Find the offenders first, fix them, then add the constraint.

## Creating a table

~~~sql
CREATE TABLE gift_cards (
  code        text PRIMARY KEY,
  customer_id integer REFERENCES customers (id) ON DELETE SET NULL,
  amount      numeric(10,2) NOT NULL CHECK (amount > 0),
  issued_at   timestamp NOT NULL DEFAULT now(),
  redeemed    boolean NOT NULL DEFAULT false
);
~~~

Note: Postgres does **not** create an index on a foreign key column automatically (only on primary keys and UNIQUE columns). You usually want one for joins - see *Indexes & EXPLAIN*.
`,
    ],
    examples: [
      {
        title: 'List every constraint in the database',
        sql: `SELECT conrelid::regclass AS table_name, conname AS constraint_name,\n       CASE contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY' WHEN 'u' THEN 'UNIQUE'\n                    WHEN 'c' THEN 'CHECK' WHEN 'n' THEN 'NOT NULL' END AS type,\n       pg_get_constraintdef(oid) AS definition\nFROM pg_constraint\nWHERE connamespace = 'public'::regnamespace\nORDER BY conrelid::regclass::text, type;`,
      },
      { title: 'Foreign keys via information_schema', sql: `SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table, rc.delete_rule\nFROM information_schema.table_constraints tc\nJOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name\nJOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name\nJOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name\nWHERE tc.constraint_type = 'FOREIGN KEY'\nORDER BY tc.table_name, kcu.column_name;` },
    ],
    exercises: [
      {
        id: 'con-1',
        title: 'Find the rule-breakers',
        prompt: 'Before adding `CHECK (salary BETWEEN 20000 AND 200000)` to `employees`, find the employees that would violate it: return their `first_name` and `salary`.',
        solution: `SELECT first_name, salary FROM employees WHERE NOT (salary BETWEEN 20000 AND 200000);`,
      },
      {
        id: 'con-2',
        title: 'Create a wishlist table',
        prompt: `Create a table \`wishlist_items\` with:
- \`customer_id\` integer, NOT NULL, foreign key to \`customers\`
- \`product_id\` integer, NOT NULL, foreign key to \`products\`
- \`added_at\` timestamp (without time zone), NOT NULL, default \`now()\`
- a **composite primary key** on (\`customer_id\`, \`product_id\`)`,
        hint: 'Table-level key: `PRIMARY KEY (customer_id, product_id)` after the column list. Column-level FK: `customer_id integer NOT NULL REFERENCES customers (id)`.',
        solution: `CREATE TABLE wishlist_items (
  customer_id integer NOT NULL REFERENCES customers (id),
  product_id  integer NOT NULL REFERENCES products (id),
  added_at    timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, product_id)
);`,
        verify: `SELECT format('column %s %s %s default:%s', column_name, data_type, CASE is_nullable WHEN 'NO' THEN 'NOT NULL' ELSE 'NULL' END, column_default IS NOT NULL) AS item
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'wishlist_items'
UNION ALL
SELECT format('%s (%s)%s',
         CASE con.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY' WHEN 'u' THEN 'UNIQUE' END,
         (SELECT string_agg(a.attname, ', ' ORDER BY a.attname) FROM pg_attribute a WHERE a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)),
         CASE WHEN con.contype = 'f' THEN ' -> ' || con.confrelid::regclass::text ELSE '' END)
FROM pg_constraint con
JOIN pg_class t ON t.oid = con.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname = 'wishlist_items' AND con.contype IN ('p', 'f', 'u');`,
      },
      {
        id: 'con-3',
        title: 'Emails must contain @',
        prompt:
          'Add a CHECK constraint named **`customers_email_has_at`** to `customers` that requires `email` to contain an `@` character. Customers without an email (NULL) must still be allowed.',
        hint: '`ALTER TABLE customers ADD CONSTRAINT customers_email_has_at CHECK (email LIKE \'%@%\')`. A CHECK only fails when the expression is FALSE - NULL passes. Test it afterwards with a bad INSERT!',
        solution: `ALTER TABLE customers ADD CONSTRAINT customers_email_has_at CHECK (email LIKE '%@%');`,
        verify: `SELECT conname, contype FROM pg_constraint WHERE conrelid = 'customers'::regclass AND conname = 'customers_email_has_at';`,
      },
    ],
  },

  {
    id: 'transactions',
    section: 'Changing data',
    title: 'Transactions & concurrency',
    summary: 'All-or-nothing changes with BEGIN / COMMIT / ROLLBACK, savepoints, and what two sessions see of each other.',
    blocks: [
      `
## All or nothing

A transaction groups statements so they succeed or fail **as a unit** (the A in ACID: *Atomicity*). Classic example: moving an employee to another store and making them its manager must not half-happen.

~~~sql
BEGIN;
UPDATE employees SET store_id = 5 WHERE id = 14;
UPDATE employees SET manager_id = 22 WHERE id = 14;
SELECT id, first_name, store_id, manager_id FROM employees WHERE id = 14;
ROLLBACK;   -- changed my mind: both updates are undone
~~~

- \`BEGIN\` starts a transaction; \`COMMIT\` makes its changes permanent and visible to others; \`ROLLBACK\` throws them away.
- Without BEGIN, Postgres runs in **autocommit** mode: every statement is its own little transaction.
- While a transaction is open, the editor shows a **TX** badge on the session and a yellow banner.

## Errors abort the transaction

If a statement fails inside a transaction, the whole transaction is marked as failed. Postgres then rejects everything with *current transaction is aborted, commands ignored until end of transaction block* until you \`ROLLBACK\`:

~~~sql
BEGIN;
UPDATE products SET price = price + 1 WHERE id = 1;
UPDATE products SET price = -5 WHERE id = 2;        -- violates CHECK (price > 0)
~~~

The session now shows **TX ✕**. Anything else is refused - even a harmless SELECT:

~~~sql
SELECT price FROM products WHERE id = 1;
~~~

Only ROLLBACK gets you out (the successful first UPDATE is undone too - all or nothing):

~~~sql
ROLLBACK;
~~~

## Savepoints: partial rollback

~~~sql
BEGIN;
INSERT INTO reviews (product_id, customer_id, rating, created_at) VALUES (1, 1, 5, now());
SAVEPOINT before_risky;
UPDATE products SET price = -5 WHERE id = 2;        -- fails
~~~

The playground stops a script at its first error (like \`psql -v ON_ERROR_STOP=1\`), so continue with a second step:

~~~sql
ROLLBACK TO SAVEPOINT before_risky;                 -- undo just the failed part
COMMIT;                                             -- the review is kept
SELECT id, product_id, rating FROM reviews ORDER BY id DESC LIMIT 1;
~~~

## Two sessions: isolation in action

The editor has two independent database connections, **Session A** and **Session B** (toggle above the editor). The blocks below run in a specific session - follow the steps in order and watch the results.

**1. Uncommitted changes are invisible to others.** Postgres's default isolation level, READ COMMITTED, never shows other sessions' uncommitted work ("no dirty reads").

~~~sql-A
BEGIN;
UPDATE products SET price = 99 WHERE id = 1;
SELECT name, price FROM products WHERE id = 1;   -- A sees 99
~~~

~~~sql-B
SELECT name, price FROM products WHERE id = 1;   -- B still sees the old price
~~~

**2. Writers block writers.** Now let B try to change the same row. B **waits**, because A holds a row lock until it commits or rolls back. (The Run button turns into Stop while it waits.)

~~~sql-B
UPDATE products SET price = price + 1 WHERE id = 1 RETURNING price;
~~~

**3. Release the lock.** Commit in A - B's update immediately continues, and it builds on A's committed value (99 + 1).

~~~sql-A
COMMIT;
~~~

Switch to Session B to see its result. Reset DB afterwards to restore the price (or update it back).

**4. Snapshots with REPEATABLE READ.** In READ COMMITTED each *statement* sees the latest committed data. In REPEATABLE READ the whole *transaction* sees one frozen snapshot:

~~~sql-A
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT count(*) FROM reviews;
~~~

~~~sql-B
INSERT INTO reviews (product_id, customer_id, rating, created_at) VALUES (2, 3, 4, now());
~~~

~~~sql-A
SELECT count(*) FROM reviews;   -- still the old count inside A's snapshot
COMMIT;
SELECT count(*) FROM reviews;   -- a new transaction sees B's row
~~~

**5. Deadlock.** A locks row 1 and B locks row 2; then each asks for the other's row. Neither can proceed, so Postgres detects the cycle (after about a second) and aborts one of them.

~~~sql-A
BEGIN;
UPDATE products SET price = price WHERE id = 1;
~~~

~~~sql-B
BEGIN;
UPDATE products SET price = price WHERE id = 2;
UPDATE products SET price = price WHERE id = 1;   -- waits for A
~~~

~~~sql-A
UPDATE products SET price = price WHERE id = 2;   -- deadlock! one session gets an error
ROLLBACK;
~~~

If a session still shows a **TX** badge afterwards, run \`ROLLBACK;\` in it.

## Locking rows you are about to change

\`SELECT ... FOR UPDATE\` locks the selected rows so nobody else can change them before you do - the standard way to do "read, decide, then update" safely (e.g. checking stock before selling).
`,
    ],
    examples: [
      { title: 'Which isolation level am I in?', sql: `SHOW transaction_isolation;` },
      { title: 'See open sessions and what they wait for', sql: `SELECT pid, application_name, state, wait_event_type, left(query, 60) AS query\nFROM pg_stat_activity\nWHERE datname = current_database();` },
    ],
    exercises: [],
  },
];
