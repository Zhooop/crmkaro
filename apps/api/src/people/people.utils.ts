export function normaliseEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

export function normalisePhone(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  return `${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(field); field = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(field); if (row.some((cell) => cell.length)) rows.push(row); row = []; field = "";
    } else field += character;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field); if (row.some((cell) => cell.length)) rows.push(row);
  return rows;
}

export function csvCell(value: unknown) {
  let output = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(output)) output = `'${output}`;
  return `"${output.replaceAll('"', '""')}"`;
}
