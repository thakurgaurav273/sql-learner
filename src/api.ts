// Thin client for the playground's JSON API (server/index.mjs).

export type Cell = string | null;
export type Field = { name: string; type: string };

export type StatementResult = {
  index: number;
  sql: string;
  offset: number;
  command: string;
  rowCount: number | null;
  fields: Field[];
  rows: Cell[][];
  truncated: boolean;
  durationMs: number;
};

export type SqlError = {
  message: string;
  code?: string;
  codeName?: string;
  severity?: string;
  detail?: string;
  hint?: string;
  where?: string;
  table?: string;
  column?: string;
  constraint?: string;
  tip?: string;
  position?: number;
  statementIndex?: number;
  statementCount?: number;
  sql?: string;
};

export type TxStatus = 'idle' | 'in-transaction' | 'failed-transaction';

export type QueryResponse = { results: StatementResult[]; error: SqlError | null; txStatus?: TxStatus };

export type SchemaColumn = {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  isPrimaryKey: boolean;
  isUnique: boolean;
  references: { table: string; column: string } | null;
  comment: string | null;
};
export type SchemaTable = {
  name: string;
  kind: string;
  comment: string | null;
  rowCount: number | null;
  viewDefinition?: string;
  primaryKey: string[];
  columns: SchemaColumn[];
  foreignKeys: { name: string; columns: string[]; refTable: string; refColumns: string[]; def: string }[];
  checks: { name: string; def: string }[];
  uniques: { name: string; columns: string[] }[];
  indexes: { name: string; def: string; primary: boolean; unique: boolean }[];
};
export type Schema = {
  tables: SchemaTable[];
  relationships: { from: string; columns: string[]; to: string; refColumns: string[] }[];
};

export type Status = {
  ok: boolean;
  serverVersion: string;
  database: string;
  practiceDatabase: string;
  host: string;
  port: number;
  user: string;
  sessions: Record<string, TxStatus>;
};

export type ResultTableData = { fields: Field[]; rows: Cell[][]; total: number };
export type CheckResponse = {
  pass: boolean;
  reason?: string;
  note?: string;
  error?: SqlError;
  missing?: Cell[][];
  extra?: Cell[][];
  missingCount?: number;
  extraCount?: number;
  expected?: ResultTableData;
  actual?: ResultTableData;
};

export type DatabaseInfo = {
  name: string;
  kind: 'practice' | 'user' | 'other';
  origin: 'empty' | 'sample' | null;
  createdAt: string | null;
  owner: string;
  sizeBytes: number;
};
export type DatabasesResponse = { active: string; practice: string; databases: DatabaseInfo[] };

export type TerminalResponse = {
  results: (StatementResult & { title?: string })[];
  messages: string[];
  notices: string[];
  error: SqlError | null;
  database: string;
  user: string;
  txStatus: TxStatus;
};

export type SavedQuery = {
  id: string;
  title: string;
  notes: string;
  sql: string;
  lessonId: string | null;
  database?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type SavedQueryInput = { title?: string; notes?: string; sql?: string; lessonId?: string | null; database?: string | null };

async function call<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the playground server. Is `npm run dev` still running?');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  // e.g. an older server without this endpoint answers with the HTML page
  if (data === null) throw new Error('The server sent an unexpected response. Restart `npm run dev` and try again.');
  return data as T;
}

export const api = {
  status: () => call<Status>('GET', '/api/status'),
  schema: () => call<Schema>('GET', '/api/schema'),
  query: (sql: string, session: string) => call<QueryResponse>('POST', '/api/query', { sql, session }),
  cancel: (session: string) => call<{ cancelled: boolean }>('POST', '/api/cancel', { session }),
  reset: (database?: string) => call<{ ok: boolean; database: string; durationMs: number }>('POST', '/api/reset', { database }),
  check: (body: { sql: string; solution: string; ordered?: boolean; verify?: string }) => call<CheckResponse>('POST', '/api/check', body),
  databases: {
    list: () => call<DatabasesResponse>('GET', '/api/databases'),
    create: (body: { name: string; origin: 'empty' | 'sample'; use?: boolean }) => call<DatabasesResponse>('POST', '/api/databases', body),
    use: (name: string) => call<DatabasesResponse>('POST', '/api/databases/use', { name }),
    remove: (name: string) => call<DatabasesResponse>('DELETE', `/api/databases/${encodeURIComponent(name)}`),
  },
  terminal: {
    info: () =>
      call<{ database: string; user: string; host: string; port: number; databases: { name: string; internal: boolean }[] }>('GET', '/api/terminal'),
    run: (input: string) => call<TerminalResponse>('POST', '/api/terminal', { input }),
    cancel: () => call<{ cancelled: boolean }>('POST', '/api/terminal/cancel'),
  },
  saved: {
    list: () => call<{ queries: SavedQuery[]; file: string }>('GET', '/api/saved'),
    create: (body: SavedQueryInput & { sql: string }) => call<SavedQuery>('POST', '/api/saved', body),
    update: (id: string, body: SavedQueryInput) => call<SavedQuery>('PUT', `/api/saved/${encodeURIComponent(id)}`, body),
    remove: (id: string) => call<{ ok: true }>('DELETE', `/api/saved/${encodeURIComponent(id)}`),
  },
};
