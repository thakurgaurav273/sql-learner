<div align="center">

# SQL Playground

**Learn SQL by running it, on a real PostgreSQL database that one click always restores.**

20 hands-on lessons · 68 auto-checked exercises · a visual join explainer · one-click database reset

![PostgreSQL 18](https://img.shields.io/badge/PostgreSQL-18-336791?logo=postgresql&logoColor=white)
![Node.js 20.19+](https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/runs%20in-Docker-2496ED?logo=docker&logoColor=white)
![Runs locally](https://img.shields.io/badge/100%25-local%20%26%20offline-6b7280)

[Quick start](#quick-start) · [Tour](#a-quick-tour-of-the-screen) · [First 10 minutes](#your-first-10-minutes) · [Lessons](#what-youll-learn) · [Practice data](#the-practice-database) · [Troubleshooting](#troubleshooting) · [FAQ](#faq)

</div>

![SQL Playground: a lesson, the query editor with results, and the database schema side by side](docs/screenshots/overview.png)

---

## Who is this for?

You learn SQL fastest by **typing queries and seeing what comes back**. SQL Playground gives you everything for that in one browser tab: explanations, a real database full of realistic data, an editor, and exercises that check your answers.

- **Complete beginners:** start at lesson 1. You don't need to know anything about databases. You only need to install two programs (below).
- **"I sort of know SQL" people:** joins, `NULL` and `GROUP BY` finally make sense when you can *see* them. Jump to the Joins section.
- **Developers and interview prep:** subqueries, CTEs, window functions, transactions, indexes and `EXPLAIN` on a 200,000-row table.

Everything runs **on your own computer**. No account, no sign-up, no cloud. Your queries never leave your machine.

---

## Quick start

### 1. Install two things (one time only)

| You need | Why | Check it is installed |
|---|---|---|
| **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** | Runs the PostgreSQL database in a container, so nothing is installed into your system | `docker --version` |
| **[Node.js](https://nodejs.org/)**: the current "LTS" download (any version from 20.19 or 22.12 upwards) | Runs the app | `node -v` |

> **Windows:** the Docker Desktop installer will ask to enable WSL 2. Say yes.
> **Linux:** install Docker Engine with the Compose plugin, and make sure your user can run `docker` without `sudo`.

### 2. Get the code

```bash
git clone https://github.com/thakurgaurav273/sql-learner.git
cd sql-learner
```

No Git? On the [GitHub page](https://github.com/thakurgaurav273/sql-learner) click **Code → Download ZIP**, unzip it, and open a terminal in that folder.

### 3. Start it

```bash
npm run dev
```

That one command does everything:

1. installs the app's npm packages (first run only),
2. starts Docker Desktop if it isn't running (macOS; on Windows and Linux, start Docker yourself first),
3. starts PostgreSQL 18 in a Docker container and waits until it is ready,
4. loads the practice database,
5. opens **http://localhost:4400** in your browser.

You should see something like this:

```text
[sql-playground] Starting PostgreSQL in Docker (localhost:54329)...
[sql-playground] Building the template database from db/seed/*.sql ...
[sql-playground] Template built in 0.9s
[sql-playground] Ready: http://localhost:4400   (database: 127.0.0.1:54329/learn)
[sql-playground] Press Ctrl+C to stop.
```

The **first start takes a minute or two**, because it downloads the npm packages and the PostgreSQL image. After that it starts in a few seconds.

### 4. Stop it

Press **Ctrl+C** in the terminal. This stops the app and the database container. Your data is kept for next time; use **Reset DB** in the app whenever you want the original data back.

---

## A quick tour of the screen

| Area | What it's for |
|---|---|
| **Lessons / Saved** (far left) | **Lessons:** 20 lessons in 5 sections; `2/5` shows how many exercises you've solved, ✓ means all of them. **Saved:** your own notebook of saved queries with notes. |
| **Lesson** (left) | The explanation, runnable code blocks (**Load into editor** or **▶ Run**), join pictures, example queries, and exercises at the bottom. |
| **Query editor** (middle) | Write SQL here. Autocomplete knows your tables and columns. **Cmd+Enter** (Mac) or **Ctrl+Enter** (Windows/Linux) runs it. |
| **Results** (under the editor) | One block per statement: the rows, each column's type, the row count and timing. `NULL` is shown in grey italics, so you can't mistake it for text. |
| **Schema** (right) | Every table with its columns, types, keys and row counts. Click `→ customers.id` to jump to the referenced table, or **▶ SELECT \*** to peek at its data. It updates when you create or drop things. |
| **Top bar** | Your progress, the **database switcher** (which database the editor uses; create new ones here), the **root terminal** button, light/dark, and **Reset DB**. |

Drag the borders between panels to resize them. **«** and **»** hide or show the lesson list and the schema.

---

## Your first 10 minutes

1. **Open lesson 1, "Welcome & the practice database".** It introduces the shop whose data you'll query.
2. **Click ▶ Run on any code block.** The query runs on the real database and the result appears on the right.
3. **Change the query and run it again** with Cmd/Ctrl+Enter. Break it on purpose (misspell a column) to see how errors are explained.
4. **Scroll down to the exercises.** Click **✎ Start in editor**, write your answer under the task, then click **✓ Check my answer**.
5. **Wrong answer? Read the feedback.** It shows exactly which rows you're missing or have too many of. Still stuck? Use **Hint**, then **Show solution**.
6. **Try to break the database:** `DELETE FROM customers;` or `DROP TABLE orders CASCADE;`. Then click **Reset DB**: everything is back in under a second.
7. **Save a query you like** with **Cmd+S** (Ctrl+S on Windows/Linux) and write a note about what it does. It goes into the **Saved** tab, your personal notebook.

Then work through the lessons in order, or jump straight to the topic you need.

---

## What you'll learn

| # | Lesson | What you'll learn | Exercises |
|---|---|---|:-:|
| | **Basics** | | |
| 1 | Welcome & the practice database | How the playground works and a tour of the sample data | 2 |
| 2 | SELECT, WHERE & ORDER BY | Filter, compute new columns, sort and limit, and the order in which SQL really evaluates a query | 5 |
| 3 | NULL & three-valued logic | Why `NULL = NULL` isn't true, `IS NULL`, `COALESCE`, and how NULL drives outer joins | 4 |
| | **Joins** | | |
| 4 | How joins work: INNER JOIN | Why data is split across tables, and the mental model behind every join | 4 |
| 5 | LEFT JOIN | Keep every row on the left, find rows with no match, and the ON-vs-WHERE trap | 4 |
| 6 | RIGHT JOIN | The mirror image of LEFT JOIN, and why people rewrite it as one | 2 |
| 7 | FULL OUTER JOIN | Keep unmatched rows from both sides, e.g. to reconcile two lists | 3 |
| 8 | CROSS JOIN | Every row with every row: generating combinations, and the danger on big tables | 2 |
| 9 | SELF JOIN | A table joined to itself: managers, referrals, pairs of rows | 4 |
| 10 | Joining many tables | Join chains, many-to-many tables, non-equi joins, and the fan-out trap | 5 |
| | **Aggregation & beyond** | | |
| 11 | GROUP BY & HAVING | Counts, sums and averages per group, and filtering the groups | 6 |
| 12 | Subqueries | Scalar subqueries, `IN` / `EXISTS`, correlated subqueries, derived tables, `LATERAL` | 5 |
| 13 | CTEs (WITH) & recursive queries | Build queries step by step, and walk trees with `WITH RECURSIVE` | 4 |
| 14 | Window functions | Rankings, running totals, previous/next rows, top-N per group | 4 |
| 15 | UNION, INTERSECT & EXCEPT | Stack, intersect and subtract query results | 3 |
| | **Changing data** | | |
| 16 | INSERT, UPDATE & DELETE | Add, change and remove rows, including joins in UPDATE/DELETE, `RETURNING` and upserts | 5 |
| 17 | Keys & constraints | Primary and foreign keys, `UNIQUE`, `NOT NULL`, `CHECK`, `DEFAULT` | 3 |
| 18 | Transactions & concurrency | `BEGIN` / `COMMIT` / `ROLLBACK`, savepoints, and what two sessions see of each other | walkthrough |
| | **Performance** | | |
| 19 | Indexes & EXPLAIN | Read query plans and make slow queries fast with the right index | 2 |
| 20 | How Postgres executes joins | Nested loop, hash join and merge join, and how to see which one was chosen | 1 |

**Suggested route:** go in order. If you already know `SELECT` and `WHERE`, start at lesson 3 (NULL); it's the key to understanding outer joins. Lessons 4–10 (joins) are the heart of the course.

---

## Features in pictures

### See joins happen

Every join lesson has a **join visualizer**: the left table, the right table with lines between matching rows, and the result, side by side. Switch between INNER, LEFT, RIGHT, FULL and anti-join and watch the result change. Hover any row to see where it came from, or click **Step through** to build the result one row at a time. **Run in Postgres** runs the very same mini tables as a real query.

![Join visualizer: customers and orders with lines between matching rows, and the LEFT JOIN result with a NULL-filled row for the customer without orders](docs/screenshots/join-visualizer.png)

### Exercises that tell you *what* is wrong

Answers are checked against the expected result, not against a fixed piece of SQL, so **any correct query passes**. When it isn't right, you see the rows that are missing or extra. Here, an `INNER JOIN` lost the 8 customers who never ordered:

![A wrong exercise answer: the checker lists the 8 rows missing from the result](docs/screenshots/exercise-wrong.png)

Change `JOIN` to `LEFT JOIN`, check again:

<img src="docs/screenshots/exercise-correct.png" alt="The same exercise, now marked correct" width="480">

Your answer is checked on a **separate, untouched copy** of the data inside a transaction that is rolled back, so even if you've changed your practice data, checking still works, and checking never changes anything.

### Error messages that teach

<img src="docs/screenshots/error-message.png" alt="An error explained: the message, the SQLSTATE code, a caret under the exact spot, and a plain-English tip" width="420" align="right">

When a query fails you get:

- PostgreSQL's own message and error code,
- the line with a **caret under the exact spot**, which is also marked in the editor,
- a **plain-English tip** for common mistakes (here: a column that is neither grouped nor aggregated).

If a script has several statements, they run one by one and stop at the first error, so you always know which one failed.

<br clear="right">

### Break anything, then Reset DB

Drop tables, delete every row, alter columns: it's all allowed, and that's how you learn what `DELETE` without `WHERE` really does. **Reset DB** restores the exact original data in well under a second. Your editor text and exercise progress are kept.

Below, a script has just dropped `order_items`, deleted the Kolkata customers and removed the `price` column. One click on **Reset database** puts every table, row and column back:

![The Reset DB confirmation dialog, over a script that dropped a table, deleted rows and removed a column](docs/screenshots/reset-db.png)

### Two sessions: watch transactions and locks

The editor has two independent database connections, **Session A** and **Session B**. The Transactions lesson walks you through what one session can see of the other's uncommitted work, and how one session waits for another's lock. A **TX** badge shows which session has an open transaction.

![Session A changed a price inside an open transaction (TX badge); Session B still sees the old price](docs/screenshots/transactions.png)

### Make queries fast with EXPLAIN and indexes

`web_events` has 200,000 rows and no indexes, so you can feel the difference. Query plans are formatted and highlighted. Below, the same query takes 13.5 ms with a full table scan and 1.6 ms once an index exists:

![EXPLAIN ANALYZE before and after creating an index: Seq Scan vs Bitmap Index Scan](docs/screenshots/explain.png)

### Always-visible schema

<img src="docs/screenshots/schema.png" alt="The schema panel with tables, columns, keys and row counts" width="260" align="right">

The schema panel is always there, so you never have to guess a column name:

- 🔑 primary keys and ↗ foreign keys (click to jump to the referenced table),
- types, `NN` (NOT NULL) and `UQ` (UNIQUE) markers,
- row counts, table descriptions, constraints and indexes,
- a filter box to find any table or column,
- **▶ SELECT \*** to see a table's data instantly.

It refreshes after you create, alter or drop something.

<br clear="right">

### Save your own queries, with notes

Wrote a query you want to keep, or finally understood something? Press **Cmd+S** (Ctrl+S on Windows/Linux) or click **Save query** above the editor. Give it a title and write notes about what it does or what you learned. Notes support Markdown, including ` ```sql ` blocks that get their own **Run** button.

- Everything you save is in the **Saved** tab next to Lessons, with search. Click one to read its notes; **Open in editor** loads it, **Run** runs it, **Edit notes** changes the title or notes.
- While a saved query is open in the editor, a chip above the editor shows its name. An amber dot means you changed it, and **Cmd/Ctrl+S** saves the change (with **Undo** in the confirmation). To start a fresh query instead, click **Clear** or load a lesson example.
- Saves can be linked to the lesson you were on, and **Export** downloads all of them as one `.sql` file with your notes as comments.
- They're stored in `data/saved-queries.json` in the project folder, **not** in the database, so **Reset DB never touches them**. That folder is in `.gitignore`, so your notes are never committed by accident.

### Your own databases

Once you're comfortable, start something of your own without losing your lessons and notes. Click the database name in the top bar:

- **New database…** creates a separate database on the same local PostgreSQL, either **empty** (design your own schema with `CREATE TABLE`) or as **a copy of the sample data** to change freely without touching the lessons' database.
- **Switch** between databases at any time. The editor, Session A/B, the schema panel and autocomplete all follow the active database. Exercises are always checked against the practice data, so they keep working wherever you are.
- **Reset DB** resets the *active* database to how it started: the practice data, an empty database, or a fresh sample copy. **Manage databases…** resets or deletes any of them.
- Saved queries remember which database they were written for, and offer to switch to it.

The app remembers the active database across restarts (in `data/settings.json`).

### Root terminal

For everything else there's a **root terminal**: a psql-style console docked at the bottom of the screen. Open it with **Ctrl+\`** or the terminal button in the top bar. It runs as the PostgreSQL **superuser** `postgres`, so it can see and change *every* database: `CREATE DATABASE`, `DROP DATABASE`, roles, privileges, anything.

```text
learn=# \l                         list all databases
learn=# CREATE DATABASE scratch;
learn=# \c scratch                 connect to it
scratch=# CREATE TABLE notes (id serial PRIMARY KEY, body text);
scratch=# \dt                      list tables      (\d notes describes one)
```

- psql habits work: `\l`, `\c`, `\d`, `\dt`, `\dv`, `\di`, `\dn`, `\df`, `\du`, `\conninfo` and `\?` for help.
- **Enter** runs a statement that ends with `;`; otherwise it continues on a new line, just like psql. **↑/↓** browse history, **Ctrl+C** cancels a running query, **Ctrl+L** clears the screen.
- The prompt shows the transaction state like psql: `learn=*#` while a transaction is open.
- Output is formatted the way psql prints it, with command tags (`INSERT 0 3`) and timings.
- Databases you create here show up in the database switcher too.
- **Protected:** the roles `postgres` and `learner` and the databases `postgres`, `learn_template` and `learn_check` keep the app running, so the terminal refuses to drop or alter them. Everything else is yours to break, and if the editor's database disappears, the app falls back to the practice database.

### Light and dark

The app follows your system's light or dark setting by default. Use the sun/moon button in the top bar to pick Light, Dark or System.

![The app in dark mode, showing a window-function lesson and query](docs/screenshots/dark-mode.png)

---

## The practice database

All lessons use the data of **"Mishti & More"**, a small chain of Indian sweet shops: stores, staff, products, customers, orders, payments, reviews and website activity from January 2025 to June 2026. It is small enough to understand and big enough to be interesting.

```mermaid
erDiagram
    departments |o--o{ employees : "has"
    stores |o--o{ employees : "employs"
    employees |o--o{ employees : "manages"
    customers |o--o{ customers : "referred"
    customers |o--o{ orders : "places"
    stores |o--o{ orders : "sells"
    employees |o--o{ orders : "handles"
    orders ||--o{ order_items : "contains"
    products ||--o{ order_items : "sold as"
    orders ||--o{ payments : "paid by"
    categories |o--o{ categories : "parent of"
    categories |o--o{ products : "groups"
    products ||--o{ product_suppliers : "bought from"
    suppliers ||--o{ product_suppliers : "supplies"
    products ||--o{ reviews : "gets"
    customers |o--o{ reviews : "writes"
    customers |o--o{ web_events : "triggers"
    products |o--o{ web_events : "viewed in"

    departments {
        int id PK
        text name
        numeric budget
    }
    stores {
        int id PK
        text name
        text city
        date opened_on
    }
    employees {
        int id PK
        text first_name
        text title
        int department_id FK
        int manager_id FK
        int store_id FK
        numeric salary
    }
    salary_grades {
        text grade PK
        numeric min_salary
        numeric max_salary
    }
    categories {
        int id PK
        text name
        int parent_id FK
    }
    products {
        int id PK
        text name
        int category_id FK
        numeric price
        numeric cost
    }
    suppliers {
        int id PK
        text name
        text city
    }
    product_suppliers {
        int product_id PK, FK
        int supplier_id PK, FK
        numeric unit_cost
    }
    customers {
        int id PK
        text first_name
        text email
        text city
        int referred_by FK
    }
    orders {
        int id PK
        int customer_id FK
        int store_id FK
        int employee_id FK
        timestamp ordered_at
        text status
        numeric discount
    }
    order_items {
        int id PK
        int order_id FK
        int product_id FK
        int quantity
        numeric unit_price
    }
    payments {
        int id PK
        int order_id FK
        text method
        numeric amount
    }
    reviews {
        int id PK
        int product_id FK
        int customer_id FK
        smallint rating
    }
    web_events {
        bigint id PK
        int customer_id FK
        int product_id FK
        text event_type
        text device
        timestamp occurred_at
    }
```

| Table | Rows | What's in it |
|---|--:|---|
| `customers` | 40 | Registered customers; `referred_by` points at another customer (self join) |
| `orders` | 170 | Order headers: who, where, when, status, discount |
| `order_items` | 418 | The lines of each order: product, quantity, price paid |
| `payments` | 168 | UPI, card, cash and wallet payments |
| `products` | 31 | Sweets, snacks and drinks, with price and (sometimes unknown) cost |
| `categories` | 12 | A category tree via `parent_id` (recursive CTEs) |
| `suppliers`, `product_suppliers` | 6, 28 | A many-to-many relationship |
| `employees` | 22 | Staff; `manager_id` points at another employee (org chart) |
| `departments`, `stores` | 6, 5 | Where the staff work and orders happen |
| `salary_grades` | 5 | Salary bands with no foreign key: join them with `BETWEEN` (a non-equi join) |
| `reviews` | 58 | 1–5 star product reviews |
| `web_events` | 200,000 | Website clicks for the performance lessons; deliberately has no indexes |

### Gaps on purpose

Real data is messy, and outer joins only make sense when some rows have no partner. So the data has gaps built in:

- **8 customers never placed an order**; some customers have no email or city.
- **20 walk-in orders have no customer** (`customer_id` is NULL) and **38 online orders have no store**.
- The **New Town** store opened in June 2026 and has **no orders yet**.
- **4 products were never ordered**, and one product (*Chef's Surprise Box*) has **no category**.
- The **Sugar-Free** and **Gift Hampers** categories are **empty**.
- The **Quality Lab** department has **no staff** and a NULL budget; one employee has **no department**.
- One supplier supplies **nothing**.
- **2 orders have no items**; **21 orders have no payment**, and **19 were paid in two parts**.
- One review is anonymous.

The data is generated deterministically, so everyone gets exactly the same rows and the exercise answers are stable.

---

## Keyboard shortcuts and handy tricks

| Do this | How |
|---|---|
| Run the whole editor | **Cmd+Enter** (Mac) or **Ctrl+Enter** (Windows/Linux); **Shift+Enter** also works |
| Run only part of the editor | Select the text, then press Cmd/Ctrl+Enter |
| Autocomplete a table or column | Just type, or press **Ctrl+Space** |
| Stop a long-running query | Click **Stop** (queries are also stopped automatically after 30 seconds) |
| Reuse an earlier query | **History ▾** above the editor |
| Save the query with notes | **Cmd+S** (Mac) or **Ctrl+S**: opens the Save dialog, or saves changes to the query that's open |
| Open or hide the root terminal | **Ctrl+\`** (in the terminal: Enter runs a statement ending in `;`, ↑/↓ history, Ctrl+C cancels, Ctrl+L clears) |
| Jump to the error | **Show in editor** in the error box |
| See a table's data | **▶ SELECT \*** in the schema panel |

The editor remembers what you typed, even after a reload. Results show at most 1,000 rows per statement; add a `LIMIT` or `WHERE` for big tables.

---

## Tips for learning

- **Predict first, then run.** Before you press Run, guess how many rows will come back. Being wrong is where the learning happens.
- **Type the examples instead of only clicking Run.** Then change one thing at a time.
- **When a join gives a surprising row count,** run the two tables on their own and count the matches per key. That's how you find fan-out.
- **Use `BEGIN; ... ROLLBACK;`** to try a risky `UPDATE` or `DELETE` and undo it, the way you would on a real system.
- **Don't fear Reset DB.** Exercises are checked on a separate, clean copy anyway.
- **Look at the schema panel** whenever you're unsure of a name. Real SQL work is half reading the schema.

---

## Troubleshooting

| Problem | What to do |
|---|---|
| `Docker is not installed` | Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and run `npm run dev` again. |
| `Docker is not running` (Windows/Linux) | Start Docker Desktop (or the Docker service), wait until it's ready, then run `npm run dev` again. |
| `Docker did not start within 2 minutes` (macOS) | Open Docker Desktop yourself, wait for "Engine running", then run `npm run dev` again. |
| `Port 4400 is already in use` | Another program is using that port. Use a different one: `PORT=4401 npm run dev` |
| `Could not start the database container` / port 54329 busy | Use a different database port: `PG_PORT=54330 npm run dev` |
| `npm install failed` or a strange syntax error at start-up | Your Node.js is too old. Check with `node -v`: you need 20.19+ or 22.12+. Install the current LTS from [nodejs.org](https://nodejs.org/). |
| The app shows **"Database unreachable"** | The database container stopped (e.g. Docker was quit). Stop the app with Ctrl+C and run `npm run dev` again. |
| A query runs forever | Click **Stop**. If it's waiting for a lock held by the other session, `COMMIT` or `ROLLBACK` in that session. |
| The data looks wrong or tables are missing | Click **Reset DB**. |
| You want a completely fresh start | `npm run db:destroy` (deletes the database container and its data), then `npm run dev`. |
| Your exercise progress is gone | Progress is stored in your browser. A different browser, a private window or clearing site data starts from zero. |
| `Could not read …/saved-queries.json` | The notebook file was edited by hand and is no longer valid JSON. Fix it (or move it away to start a fresh notebook); the app never overwrites a broken file. |

**On Windows (PowerShell)**, set options like this instead: `$env:PORT=4401; npm run dev`

---

## FAQ

**Is it safe? Can it affect other databases on my computer?**
No. The database runs in its own Docker container (`sql-playground-db`) on port 54329, reachable only from your own computer. The app never connects to anything else.

**Do I need to know Docker or PostgreSQL?**
No. `npm run dev` handles Docker for you, and the lessons start from zero.

**Do I need an internet connection?**
Only for the first start, to download the npm packages and the PostgreSQL image. After that it works offline.

**Will this help with MySQL, SQL Server or SQLite?**
Yes. `SELECT`, joins, `GROUP BY`, subqueries, CTEs and window functions work almost the same in every modern database. A few things shown here are PostgreSQL extras (for example `RETURNING`, `ON CONFLICT`, `FILTER`, `LATERAL`, `date_trunc`), and other databases have their own versions of them.

**Where is my data stored?**
All databases (the practice one and your own) live in a Docker volume named `sql-playground_pgdata`; it survives restarts, and `npm run db:destroy` deletes it. Your saved queries and notes are in `data/saved-queries.json` in the project folder, and the active database in `data/settings.json`: copy the `data` folder to back them up or move them to another computer. Exercise progress and editor contents are kept in your browser.

**Is the root terminal dangerous?**
It's a real superuser, but only for the local playground container, so the worst case is losing data inside it. The roles and databases the app needs are protected. If you break something anyway, `npm run db:destroy` followed by `npm run dev` gives you a completely fresh start (your saved notes in `data/` are kept).

**Can I use my own databases from other tools?**
Yes. Connect as `learner` / `learner` to any database you created from the database menu, for example `psql postgresql://learner:learner@localhost:54329/my_shop`.

**How do I reset my exercise progress?**
Clear the site data for `localhost:4400` in your browser (or open the app in a private window to start over).

**How do I uninstall it?**
Run `npm run db:destroy`, optionally `docker rmi postgres:18`, then delete the folder.

---

## Use other SQL tools too

While the app is running, any PostgreSQL client can connect to the same practice database. That's handy if you want to try a "real" tool such as DBeaver, TablePlus, pgAdmin, DataGrip or `psql`.

| Setting | Value |
|---|---|
| Host | `localhost` |
| Port | `54329` |
| Database | `learn` |
| User | `learner` |
| Password | `learner` |

```bash
psql postgresql://learner:learner@localhost:54329/learn
```

These are throwaway credentials for a local learning database. Never reuse them anywhere real.

---

## Commands and options

| Command | What it does |
|---|---|
| `npm run dev` | Start everything (same as `npm start`) |
| `npm run db:up` | Start only the database container |
| `npm run db:stop` | Stop the database container (data is kept) |
| `npm run db:destroy` | Delete the container **and** its data, for a completely fresh start |
| `npm run seed:generate` | Regenerate the sample data files in `db/seed/` |
| `npm run typecheck` | Type-check the TypeScript code |
| `node scripts/validate-content.mjs` | Run every lesson snippet and check every exercise solution (database must be running; needs Node 22.18+) |

| Option | Default | Example |
|---|---|---|
| `PORT` | `4400` | `PORT=4401 npm run dev`: run the app on another port |
| `PG_PORT` | `54329` | `PG_PORT=54330 npm run dev`: run the database on another port |
| `NO_OPEN` | not set | `NO_OPEN=1 npm run dev`: don't open the browser |
| `KEEP_DB` | not set | `KEEP_DB=1 npm run dev`: leave the database running after Ctrl+C |

---

## How it works

```mermaid
flowchart LR
    B["Browser<br/>React UI"] -- "HTTP API" --> S["Node.js server<br/>Express + Vite<br/>localhost:4400"]
    S -- "your SQL<br/>(user: learner)" --> L[("learn<br/>your practice DB")]
    S -- "exercise checks<br/>(rolled back)" --> C[("learn_check<br/>clean copy")]
    T[("learn_template<br/>original data")] -. "Reset DB<br/>clones it" .-> L
    T -. "cloned" .-> C
```

- **One container, several databases.** `learn` (practice), `learn_check` (exercise checks), `learn_template` (the original data) and any databases you create all live in a single PostgreSQL 18 container on `localhost:54329`. The editor works in the *active* one.
- **Your databases** are created by the server with the admin role but owned by `learner`, so you have full control inside them and nowhere else. The root terminal is the one place that runs as the superuser `postgres`.
- **One port for everything.** A small Express server serves the React app (through Vite) and a JSON API.
- **Your SQL runs as the user `learner`.** It owns the `learn` database, so it can create, change and drop anything in it. It is not a superuser, and it can't touch the template or other databases.
- **Reset DB is instant** because PostgreSQL can copy a whole database from a template: the server drops `learn` and recreates it from `learn_template`.
- **Exercise checking** runs your query and the reference solution on `learn_check`, inside a transaction that is always rolled back, and compares the results (row order only matters when the task asks for an `ORDER BY`).
- **Safety limits:** a statement times out after 30 seconds, and at most 1,000 rows are sent to the browser per statement.
- When the files in `db/seed/` change, the template is rebuilt automatically on the next start.

---

## Add your own lessons and exercises

Lessons are plain TypeScript objects in [`src/content/lessons/`](src/content/lessons), and the app reloads as you edit. A lesson looks like this:

```ts
{
  id: 'my-lesson',                 // used in the URL: http://localhost:4400/#my-lesson
  section: 'Joins',                // groups lessons in the left-hand list
  title: 'My lesson',
  summary: 'One sentence shown under the title.',
  blocks: [
    `
## A heading

Markdown text. A ~~~sql fence becomes a runnable block with Load / Run buttons:

~~~sql
SELECT * FROM stores;
~~~
`,
  ],
  examples: [{ title: 'Stores by city', sql: 'SELECT city, count(*) FROM stores GROUP BY city;' }],
  exercises: [
    {
      id: 'my-1',                  // progress is stored under this id: keep it stable
      title: 'Kolkata stores',
      prompt: 'Return the `name` of every store in **Kolkata**.',
      hint: 'Filter with `WHERE city = ...`.',
      solution: `SELECT name FROM stores WHERE city = 'Kolkata';`,
      // ordered: true,            // when row order matters (the task asks for ORDER BY)
      // verify: 'SELECT ...',     // for INSERT/UPDATE/DDL tasks: compared after running the answer
    },
  ],
}
```

- Use `~~~sql-A` or `~~~sql-B` for blocks that run in a specific session (see the Transactions lesson).
- Add a `{ viz: { ... } }` block for a join visualizer; the existing join lessons show the format, and [`src/content/types.ts`](src/content/types.ts) documents every field.
- Register a new lesson file in [`src/content/index.ts`](src/content/index.ts).
- With the app running, `node scripts/validate-content.mjs` runs all snippets and checks that every exercise solution passes.

---

## Project layout

```text
sql-learner/
├── docker-compose.yml        PostgreSQL 18 container (localhost:54329)
├── db/seed/                  schema + sample data that build the practice database
├── scripts/
│   ├── dev.mjs               `npm run dev`: Docker, database, server, browser
│   ├── generate-seed.mjs     regenerates the sample data (deterministic)
│   └── validate-content.mjs  runs every lesson snippet and exercise solution
├── server/                   Express API: queries, schema, Reset DB, exercise checks, databases,
│                             root terminal (terminal.mjs), saved queries (saved.mjs)
├── src/
│   ├── components/           editor, results, schema panel, join visualizer, exercises, notebook
│   │   └── ui/               shadcn/ui components
│   └── content/lessons/      all lessons and exercises
├── data/                     your saved queries + settings (created when needed, git-ignored)
└── docs/screenshots/         the images in this README
```

Built with PostgreSQL 18, Node.js, Express, React, Vite, Tailwind CSS, shadcn/ui and CodeMirror.
