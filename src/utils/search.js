export const tokenize = (str) =>
  String(str || "")
    .toLowerCase()
    .replace(/[^a-zа-я0-9\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);

export function cosineScore(query, fields) {
  const q = tokenize(query);
  if (!q.length) return 0;
  const d = tokenize(fields.join(" "));
  if (!d.length) return 0;
  const qf = new Map(), df = new Map();
  q.forEach((t) => qf.set(t, (qf.get(t) || 0) + 1));
  d.forEach((t) => df.set(t, (df.get(t) || 0) + 1));
  const vocab = new Set([...qf.keys(), ...df.keys()]);
  let dot = 0, qn = 0, dn = 0;
  for (const t of vocab) {
    const a = qf.get(t) || 0, b = df.get(t) || 0;
    dot += a * b; qn += a * a; dn += b * b;
  }
  return qn && dn ? dot / (Math.sqrt(qn) * Math.sqrt(dn)) : 0;
}
