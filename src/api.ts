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

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  status: () => call<Status>('GET', '/api/status'),
  schema: () => call<Schema>('GET', '/api/schema'),
  query: (sql: string, session: string) => call<QueryResponse>('POST', '/api/query', { sql, session }),
  cancel: (session: string) => call<{ cancelled: boolean }>('POST', '/api/cancel', { session }),
  reset: () => call<{ ok: boolean; durationMs: number }>('POST', '/api/reset'),
  check: (body: { sql: string; solution: string; ordered?: boolean; verify?: string }) => call<CheckResponse>('POST', '/api/check', body),
};
