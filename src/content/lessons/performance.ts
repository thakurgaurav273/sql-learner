import type { Lesson } from '../types.ts';

export const performance: Lesson[] = [
  {
    id: 'indexes-explain',
    section: 'Performance',
    title: 'Indexes & EXPLAIN',
    summary: 'Read query plans, see why a query is slow, and make it fast with the right index.',
    blocks: [
      `
## EXPLAIN: how will Postgres run this?

Put \`EXPLAIN\` in front of a query to see the **plan** the optimizer picked, without running it. \`EXPLAIN ANALYZE\` also **runs** it and reports actual times and row counts.

~~~sql
EXPLAIN ANALYZE
SELECT * FROM web_events WHERE customer_id = 7;
~~~

Reading the output (read plans from the most-indented line outwards):

- **Seq Scan on web_events** - Postgres read *all* 200,000 rows and threw most away (see *Rows Removed by Filter*).
- \`cost=A..B\` - estimated startup cost .. total cost, in arbitrary units. Only useful for comparing plans.
- \`rows=...\` - the planner's **estimate**; \`actual ... rows=...\` - what really happened. Big differences mean stale or missing statistics.
- \`Execution Time\` - the real time taken.

## Creating an index

An index is a separate, sorted structure (a **B-tree**) that maps column values to row locations - like the index at the back of a book. Instead of reading every page, Postgres looks the value up and jumps straight to the matching rows.

~~~sql
CREATE INDEX web_events_customer_idx ON web_events (customer_id);
~~~

Now run the same \`EXPLAIN ANALYZE\` again: the plan switches to a **Bitmap Index Scan** / **Index Scan** and the time drops dramatically.

~~~sql
EXPLAIN ANALYZE
SELECT * FROM web_events WHERE customer_id = 7;
~~~

## Composite indexes: column order matters

An index on \`(customer_id, occurred_at)\` is sorted by customer first, then by time *within* each customer - like a phone book sorted by last name, then first name. It helps:

- \`WHERE customer_id = 7\`
- \`WHERE customer_id = 7 AND occurred_at >= '2026-01-01'\`
- \`WHERE customer_id = 7 ORDER BY occurred_at DESC LIMIT 10\` (no sort needed!)

but **not** \`WHERE occurred_at >= '2026-01-01'\` alone - just as a phone book doesn't help you find everyone called "Rahul".

~~~sql
CREATE INDEX web_events_customer_time_idx ON web_events (customer_id, occurred_at);

EXPLAIN ANALYZE
SELECT * FROM web_events
WHERE customer_id = 7
ORDER BY occurred_at DESC
LIMIT 10;
~~~

## When an index is NOT used

1. **Low selectivity:** \`WHERE device = 'mobile'\` matches 60% of the rows - reading the whole table sequentially is cheaper than jumping around. The planner knows this from table statistics.
2. **A function on the column:** \`WHERE date(occurred_at) = '2026-01-15'\` can't use an index on \`occurred_at\`. Rewrite it as a range: \`occurred_at >= '2026-01-15' AND occurred_at < '2026-01-16'\` (or create an *expression index* on \`date(occurred_at)\`).
3. **Leading wildcard:** \`LIKE '%sandesh'\` can't use a normal B-tree index.
4. **Tiny tables:** for a few hundred rows, a seq scan is simply faster.

## Indexes are not free

Every index takes disk space and must be updated on every INSERT/UPDATE/DELETE. Index what you filter, join and sort on - not everything.

~~~sql
SELECT indexname, indexdef,
       pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE tablename = 'web_events';
~~~

Clean up with \`DROP INDEX web_events_customer_idx;\` - or just Reset DB.
`,
    ],
    examples: [
      { title: 'EXPLAIN without running', sql: `EXPLAIN\nSELECT * FROM web_events WHERE event_type = 'checkout' AND device = 'tablet';` },
      {
        title: 'Function on a column vs a range',
        sql: `CREATE INDEX IF NOT EXISTS web_events_time_idx ON web_events (occurred_at);\n\nEXPLAIN ANALYZE SELECT count(*) FROM web_events WHERE date(occurred_at) = '2026-01-15';\n\nEXPLAIN ANALYZE SELECT count(*) FROM web_events\nWHERE occurred_at >= '2026-01-15' AND occurred_at < '2026-01-16';`,
        note: 'Compare the two plans: the first scans the whole table, the second uses the index.',
      },
      { title: 'Partial index', sql: `-- index only the rare rows you actually query\nCREATE INDEX IF NOT EXISTS web_events_checkout_idx ON web_events (occurred_at) WHERE event_type = 'checkout';\n\nEXPLAIN ANALYZE\nSELECT count(*) FROM web_events\nWHERE event_type = 'checkout' AND occurred_at >= '2026-06-01';` },
      { title: 'Table statistics the planner uses', sql: `SELECT attname, n_distinct, most_common_vals, most_common_freqs\nFROM pg_stats\nWHERE tablename = 'web_events' AND attname IN ('device', 'event_type');` },
    ],
    exercises: [
      {
        id: 'idx-1',
        title: 'Mobile activity of one customer',
        prompt:
          'Count the `web_events` of customer **7** on **mobile**, as a single column `events`. Then run it with `EXPLAIN ANALYZE` before and after creating an index on `customer_id` and compare the plans.',
        solution: `SELECT count(*) AS events FROM web_events WHERE customer_id = 7 AND device = 'mobile';`,
      },
      {
        id: 'idx-2',
        title: 'Latest 5 events of a customer',
        prompt:
          'Return `id`, `event_type` and `occurred_at` of the **5 most recent** events of customer **12**, newest first. Which index makes this query avoid both the seq scan and the sort?',
        hint: 'An index on `(customer_id, occurred_at)` delivers the rows of one customer already sorted by time.',
        solution: `SELECT id, event_type, occurred_at FROM web_events WHERE customer_id = 12 ORDER BY occurred_at DESC LIMIT 5;`,
        ordered: true,
      },
    ],
  },

  {
    id: 'join-algorithms',
    section: 'Performance',
    title: 'How Postgres executes joins',
    summary: 'Nested loop, hash join and merge join: the three algorithms behind every JOIN, and how to see which one was chosen.',
    blocks: [
      `
## The mental model vs. reality

In the first join lesson we described a join as "all pairs, then filter". For 200,000 events × 40 customers that would be 8 million pairs - far too slow. The planner instead picks one of three **join algorithms**. All three produce exactly the same result; they differ in speed depending on table sizes, indexes and sort order.

### 1. Nested Loop

~~~text
for each row r in outer:
    for each row s in inner matching r:      -- ideally an index lookup
        emit (r, s)
~~~

Great when the **outer side is small** and the inner side has an **index** on the join column. Without an index on the inner side it becomes the slow "all pairs" approach. It is the only algorithm that can run **any** condition (\`<\`, \`BETWEEN\`, ...), so non-equi joins always use it.

### 2. Hash Join

~~~text
build:  put every row of the smaller input into a hash table keyed on the join column
probe:  for each row of the bigger input, look up its key in the hash table
~~~

The workhorse for joining **large, unsorted** inputs on **equality** (\`=\`). Each side is read once. Needs memory for the hash table (\`work_mem\`).

### 3. Merge Join

~~~text
sort both inputs on the join key (or read them already sorted from an index)
walk through both lists side by side, like a zipper, emitting matches
~~~

Shines when both inputs are **already sorted** (e.g. via indexes) or the result must be sorted anyway. Also works for FULL OUTER JOIN.

## Seeing the choice

~~~sql
EXPLAIN ANALYZE
SELECT c.city, count(*)
FROM web_events w
JOIN customers c ON c.id = w.customer_id
GROUP BY c.city;
~~~

Typically a **Hash Join**: the 40 customers become a small hash table, and the 200,000 events probe it.

~~~sql
EXPLAIN ANALYZE
SELECT c.first_name, w.event_type, w.occurred_at
FROM customers c
JOIN web_events w ON w.customer_id = c.id
WHERE c.id = 7;
~~~

Without an index on \`web_events.customer_id\` this needs a scan of the whole events table. Create the index and run it again - you should now see a **Nested Loop** with an index lookup on the inner side (or a bitmap scan):

~~~sql
CREATE INDEX IF NOT EXISTS web_events_customer_idx ON web_events (customer_id);
~~~

## Forcing other algorithms (for learning only)

You can switch algorithms off for your session to compare plans. Never do this in production code!

~~~sql
SET enable_hashjoin = off;
EXPLAIN ANALYZE
SELECT c.city, count(*) FROM web_events w JOIN customers c ON c.id = w.customer_id GROUP BY c.city;
RESET enable_hashjoin;
~~~

Try also \`SET enable_mergejoin = off;\` and \`SET enable_nestloop = off;\` (and \`RESET ALL;\` afterwards).

## Outer joins, semi-joins and anti-joins in plans

- A LEFT JOIN often appears as **Hash Right Join**: Postgres builds the hash table on the *left* (preserved) table and scans the right one - the same result, just a cheaper arrangement.
- \`EXISTS\` / \`IN (subquery)\` become **Semi Join** nodes; \`NOT EXISTS\` becomes an **Anti Join**:

~~~sql
EXPLAIN
SELECT c.id FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
~~~

## Join order

With many tables, the planner also decides the **order** in which to join them (it can reorder inner joins freely - the result is the same). It relies on statistics gathered by \`ANALYZE\`; when estimates are badly off, plans go wrong. Run \`ANALYZE table_name;\` after big data changes.
`,
    ],
    examples: [
      { title: 'A merge join', sql: `SET enable_hashjoin = off;\nEXPLAIN ANALYZE\nSELECT o.id, oi.product_id\nFROM orders o JOIN order_items oi ON oi.order_id = o.id;\nRESET enable_hashjoin;` },
      { title: 'A non-equi join is always a nested loop', sql: `EXPLAIN ANALYZE\nSELECT e.first_name, g.grade\nFROM employees e\nJOIN salary_grades g ON e.salary BETWEEN g.min_salary AND g.max_salary;` },
      { title: 'LEFT JOIN as Hash Right Join', sql: `EXPLAIN\nSELECT c.first_name, count(w.id)\nFROM customers c\nLEFT JOIN web_events w ON w.customer_id = c.id\nGROUP BY c.id, c.first_name;` },
    ],
    exercises: [
      {
        id: 'alg-1',
        title: 'Events by city',
        prompt:
          'Return `city` and `events` (number of web events by logged-in customers from that city), one row per customer city - including a row for customers with an unknown city. Then look at its plan with `EXPLAIN ANALYZE`: which join algorithm did Postgres pick?',
        solution: `SELECT c.city, count(*) AS events
FROM web_events w
JOIN customers c ON c.id = w.customer_id
GROUP BY c.city;`,
      },
    ],
  },
];
