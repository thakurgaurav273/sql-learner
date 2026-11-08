// Shapes of the lesson content in src/content/lessons/*.ts

export type JoinType = 'concept' | 'inner' | 'left' | 'right' | 'full' | 'cross' | 'anti';

export type VizValue = string | number | null;

export type VizTable = {
  name: string; // table name, e.g. "customers"
  alias: string; // alias used in the SQL, e.g. "c"
  columns: string[];
  rows: VizValue[][];
  key?: string; // join column (omit for CROSS JOIN)
  labelColumn?: string; // column used to name a row in explanations (default: first text column)
  labelPrefix?: string; // e.g. "order " -> "order 104"
};

export type JoinVizConfig = {
  left: VizTable;
  right: VizTable; // for a self join, the same rows with a different alias/key
  selfJoin?: boolean;
  types: JoinType[]; // join types offered as buttons
  initial: JoinType;
  caption?: string;
};

export type Example = {
  title: string;
  sql: string;
  note?: string; // markdown
};

export type Exercise = {
  id: string; // stable id (progress is stored under it)
  title: string;
  prompt: string; // markdown
  hint?: string; // markdown
  solution: string; // reference SQL; the checker runs it on a pristine copy of the data
  ordered?: boolean; // row order matters (the task asks for an ORDER BY)
  verify?: string; // for INSERT/UPDATE/DDL tasks: query whose result is compared after running the answer
  starter?: string; // SQL placed in the editor under the task comment
};

export type Block = string | { viz: JoinVizConfig };

export type Lesson = {
  id: string;
  section: string;
  title: string;
  summary: string;
  blocks: Block[]; // strings are markdown (```sql fences become runnable)
  examples: Example[];
  exercises: Exercise[];
};
