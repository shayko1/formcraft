// Shared CSV builder. UTF-8 BOM prefix so Excel opens Hebrew/RTL correctly.

function escapeCell(value: unknown): string {
  const s = value == null ? "" : Array.isArray(value) ? value.join("; ") : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Build a CSV string from row objects keyed by column id.
 * @param headers ordered [{ id, label }] — label becomes the header cell.
 * @param rows    array of records keyed by the header ids.
 */
export function buildCsv(
  headers: { id: string; label: string }[],
  rows: Record<string, unknown>[],
): string {
  const headerLine = headers.map((h) => escapeCell(h.label)).join(",");
  const lines = rows.map((row) => headers.map((h) => escapeCell(row[h.id])).join(","));
  return "﻿" + [headerLine, ...lines].join("\r\n");
}
