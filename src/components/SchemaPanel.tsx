import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronRight, ChevronsDownUp, ChevronsUpDown, Database, Eye, KeyRound, Link2, PanelRightClose, Play, RefreshCw, Search, Table2, X } from 'lucide-react';
import { usePlayground } from '../state';
import type { SchemaTable } from '../api';
import { PanelHeader, IconButton } from './PanelHeader';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Always-visible database schema: tables, columns, keys and relationships.
// It refreshes automatically after statements that may change the schema.
export function SchemaPanel({ onHide }: { onHide?: () => void }) {
  const { schema, schemaError, refreshSchema, focusTable, setFocusTable } = usePlayground();
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({ customers: true, orders: true });
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (!focusTable) return;
    setOpen((o) => ({ ...o, [focusTable]: true }));
    setFlash(focusTable);
    setTimeout(() => refs.current[focusTable]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
    const t = setTimeout(() => setFlash(null), 1300);
    setFocusTable(null);
    return () => clearTimeout(t);
  }, [focusTable, setFocusTable]);

  const f = filter.trim().toLowerCase();
  const tables = (schema?.tables ?? []).filter((t) => !f || t.name.includes(f) || t.columns.some((c) => c.name.includes(f)));
  const refresh = async () => {
    setSpinning(true);
    await refreshSchema();
    setTimeout(() => setSpinning(false), 300);
  };

  return (
    <>
      <PanelHeader
        icon={<Database />}
        title="Schema"
        extra={
          schema && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10.5px] font-medium tabular-nums">
              {schema.tables.length} tables
            </Badge>
          )
        }
        actions={
          <>
            <IconButton label="Expand all" icon={<ChevronsUpDown />} onClick={() => setOpen(Object.fromEntries((schema?.tables ?? []).map((t) => [t.name, true])))} />
            <IconButton label="Collapse all" icon={<ChevronsDownUp />} onClick={() => setOpen({})} />
            <IconButton label="Refresh" icon={<RefreshCw className={cn(spinning && 'animate-spin')} />} onClick={refresh} />
            {onHide && <IconButton label="Hide schema" icon={<PanelRightClose />} onClick={onHide} side="left" />}
          </>
        }
      />
      <div className="relative flex-none p-2.5">
        <Search className="pointer-events-none absolute top-1/2 left-5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter tables or columns…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 bg-card pr-7 pl-8 text-[13px] shadow-none"
        />
        {filter && (
          <button onClick={() => setFilter('')} className="absolute top-1/2 right-4.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear filter">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-1.5 pb-3" data-testid="schema">
          {schemaError && <div className="m-2 rounded-lg border border-destructive/25 bg-danger-soft p-3 text-[12.5px] text-destructive">{schemaError}</div>}
          {!schema && !schemaError && <div className="p-6 text-center text-[13px] text-muted-foreground">Loading schema…</div>}
          {schema && schema.tables.length === 0 && (
            <div className="m-2 rounded-lg border border-dashed p-4 text-center text-[12.5px] text-muted-foreground">No tables in the database. Did you drop them all? Reset DB brings them back.</div>
          )}
          {schema && tables.length === 0 && f && <div className="p-4 text-center text-[12.5px] text-muted-foreground">Nothing matches “{filter}”.</div>}
          {tables.map((t) => (
            <TableEntry
              key={t.name}
              t={t}
              open={!!open[t.name] || !!f}
              flash={flash === t.name}
              setRef={(el) => (refs.current[t.name] = el)}
              setOpen={(o) => setOpen((s) => ({ ...s, [t.name]: o }))}
              highlight={f}
            />
          ))}
          {schema && schema.relationships.length > 0 && !f && (
            <div className="mx-1.5 mt-4 rounded-lg border bg-card p-3">
              <div className="mb-2 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Relationships</div>
              <div className="space-y-1 font-mono text-[11px] text-muted-foreground">
                {schema.relationships.map((r, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="text-foreground/80">{r.from}</span>.{r.columns.join(',')} <span className="text-primary">→</span> <span className="text-foreground/80">{r.to}</span>.
                    {r.refColumns.join(',')}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="flex flex-none flex-wrap gap-x-3 gap-y-1 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <KeyRound className="size-3 text-pk" /> primary key
        </span>
        <span className="flex items-center gap-1">
          <Link2 className="size-3 text-primary" /> foreign key
        </span>
        <span>
          <b className="font-semibold">NN</b> not null
        </span>
        <span>
          <b className="font-semibold">UQ</b> unique
        </span>
      </div>
    </>
  );
}

function TableEntry({
  t,
  open,
  setOpen,
  flash,
  setRef,
  highlight,
}: {
  t: SchemaTable;
  open: boolean;
  setOpen: (o: boolean) => void;
  flash: boolean;
  setRef: (el: HTMLDivElement | null) => void;
  highlight: string;
}) {
  const { loadSql, setFocusTable } = usePlayground();
  const extras = t.checks.length + t.foreignKeys.length + t.uniques.length;
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <div className={cn('rounded-lg', flash && 'flash', open && 'mb-1 bg-card shadow-[var(--shadow-card)] ring-1 ring-border')} ref={setRef} data-table={t.name}>
        <CollapsibleTrigger asChild>
          <button
            className={cn('group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent', open && 'hover:bg-accent/60')}
            title={t.comment ?? undefined}
          >
            <ChevronRight className={cn('size-3.5 flex-none text-muted-foreground transition-transform duration-200', open && 'rotate-90')} />
            {t.kind === 'table' ? <Table2 className="size-3.5 flex-none text-muted-foreground" /> : <Eye className="size-3.5 flex-none text-warning" />}
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] font-medium">{t.name}</span>
            {t.kind !== 'table' && <span className="text-[10px] font-semibold text-warning uppercase">{t.kind}</span>}
            {t.rowCount !== null && <span className="text-[11px] text-muted-foreground tabular-nums">{t.rowCount.toLocaleString()}</span>}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-2.5 pt-0.5 pb-2.5">
            {t.comment && <p className="mb-2 ml-6 text-[11.5px] leading-snug text-muted-foreground">{t.comment}</p>}
            <div className="space-y-px">
              {t.columns.map((c) => (
                <div
                  key={c.name}
                  className="group/col flex items-center gap-1.5 rounded px-1 py-[3px] font-mono text-[12px] hover:bg-muted/60"
                  title={[c.comment, c.default ? `default: ${c.default}` : null].filter(Boolean).join('\n') || undefined}
                >
                  <span className="flex w-4 flex-none justify-center">
                    {c.isPrimaryKey ? <KeyRound className="size-3 text-pk" /> : c.references ? <Link2 className="size-3 text-primary" /> : null}
                  </span>
                  <span className={cn('text-foreground', highlight && c.name.includes(highlight) && 'rounded-sm bg-warning-soft px-0.5')}>{c.name}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{c.type}</span>
                  {!c.nullable && !c.isPrimaryKey && <span className="text-[9.5px] font-semibold text-muted-foreground/80">NN</span>}
                  {c.isUnique && <span className="text-[9.5px] font-semibold text-muted-foreground/80">UQ</span>}
                  {c.references && (
                    <button
                      className="ml-auto flex flex-none items-center gap-0.5 rounded px-1 text-[11px] whitespace-nowrap text-primary hover:bg-brand-soft"
                      onClick={() => setFocusTable(c.references!.table)}
                      title="Jump to the referenced table"
                    >
                      {c.references.table}.{c.references.column}
                      <ArrowUpRight className="size-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {(extras > 0 || t.indexes.length > 0 || t.viewDefinition) && (
              <details className="group/d mt-2 ml-6">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground">
                  <ChevronRight className="size-3 transition-transform group-open/d:rotate-90" />
                  {extras} constraint{extras === 1 ? '' : 's'}, {t.indexes.length} index{t.indexes.length === 1 ? '' : 'es'}
                </summary>
                <div className="mt-1.5 space-y-1 rounded-md border bg-code p-2 font-mono text-[10.5px] leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
                  {t.foreignKeys.map((fk) => (
                    <div key={fk.name}>
                      <span className="text-foreground/80">{fk.name}</span>: {fk.def}
                    </div>
                  ))}
                  {t.checks.map((c) => (
                    <div key={c.name}>
                      <span className="text-foreground/80">{c.name}</span>: {c.def}
                    </div>
                  ))}
                  {t.indexes.map((i) => (
                    <div key={i.name}>{i.def.replace(' ON public.', ' ON ')}</div>
                  ))}
                  {t.viewDefinition && <div>{t.viewDefinition}</div>}
                </div>
              </details>
            )}
            <Button variant="outline" size="xs" className="mt-2.5 ml-6" onClick={() => loadSql(`SELECT *\nFROM ${t.name}\nLIMIT 100;`, { run: true })}>
              <Play className="fill-current" /> SELECT * <span className="text-muted-foreground">(100 rows)</span>
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
