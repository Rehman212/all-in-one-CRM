function splitCsvLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      q = !q;
      continue;
    }
    if (ch === "," && !q) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function looksEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function parseAudienceCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const emailIdx = header.findIndex((h) => h === "email" || h === "e-mail" || h === "email address" || h.includes("email"));
  const nameIdx = header.findIndex((h) => h === "name" || h === "full name" || h === "fullname" || h === "contact name");
  const firstIdx = header.findIndex((h) => h === "first name" || h === "firstname" || h === "first");
  const lastIdx = header.findIndex((h) => h === "last name" || h === "lastname" || h === "last");
  const hasHeader = emailIdx >= 0 || header.some((h) => h.includes("name"));

  const rows: { email: string; name: string }[] = [];
  const start = hasHeader ? 1 : 0;
  for (const line of lines.slice(start)) {
    const cols = splitCsvLine(line);
    let email = "";
    let name = "";
    if (hasHeader && emailIdx >= 0) {
      email = cols[emailIdx] || "";
      if (nameIdx >= 0) name = cols[nameIdx] || "";
      else name = [cols[firstIdx] || "", cols[lastIdx] || ""].join(" ").trim();
    } else {
      const a = cols[0] || "";
      const b = cols[1] || "";
      if (looksEmail(a)) {
        email = a;
        name = b;
      } else if (looksEmail(b)) {
        email = b;
        name = a;
      }
    }
    email = email.toLowerCase();
    if (looksEmail(email)) rows.push({ email, name });
  }
  return rows;
}
