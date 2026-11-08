// Tiny SQL syntax highlighter for read-only code blocks in lessons.

const KEYWORDS = new Set(
  `select from where and or not null is in as on join inner left right full outer cross natural using group by having order asc desc
  limit offset distinct union all intersect except with recursive insert into values update set delete returning create table drop alter
  add column constraint primary key foreign references unique check default index if exists cascade restrict begin commit rollback
  savepoint release transaction isolation level read write committed repeatable serializable only case when then else end like ilike
  between exists any some over partition rows range unbounded preceding following current row filter lateral explain analyze
  buffers costs verbose true false nulls first last view materialized truncate conflict do nothing grant revoke lock share mode
  for nowait skip locked cast interval date timestamp integer int text numeric boolean serial bigint smallint varchar char
  generated always identity analyse vacuum similar to show reset window within array escape lateral merge matched`
    .split(/\s+/)
    .filter(Boolean),
);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function highlightSql(sql: string): string {
  const re = /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^']|'')*'?)|("(?:[^"]|"")*"?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)(\s*\()?|([\s\S])/g;
  let out = '';
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const [, cmt, str, quoted, num, word, paren, other] = m;
    if (cmt) out += `<span class="tok-cmt">${esc(cmt)}</span>`;
    else if (str) out += `<span class="tok-str">${esc(str)}</span>`;
    else if (quoted) out += esc(quoted);
    else if (num) out += `<span class="tok-num">${num}</span>`;
    else if (word) {
      if (KEYWORDS.has(word.toLowerCase())) out += `<span class="tok-kw">${esc(word)}</span>`;
      else if (paren) out += `<span class="tok-fn">${esc(word)}</span>`;
      else out += esc(word);
      if (paren) out += esc(paren);
    } else out += esc(other ?? '');
  }
  return out;
}

export function escapeHtml(s: string) {
  return esc(s);
}
