/**
 * Tiny CSV helpers for client-side downloads.
 * No deps — escapes per RFC 4180.
 */

const escapeCell = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  const s = typeof val === "string" ? val : String(val);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export function toCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns?: { key: keyof T; label?: string }[],
): string {
  if (!rows.length && !columns?.length) return "";
  const cols =
    columns ??
    (Object.keys(rows[0] ?? {}) as (keyof T)[]).map((k) => ({ key: k }));
  const header = cols.map((c) => escapeCell(c.label ?? String(c.key))).join(",");
  const body = rows
    .map((row) => cols.map((c) => escapeCell(row[c.key])).join(","))
    .join("\r\n");
  return body ? `${header}\r\n${body}` : header;
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
