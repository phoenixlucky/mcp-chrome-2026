export function jsonPathValues(value: unknown, path: string): unknown[] {
  if (!path.startsWith('$')) return [];
  const walk = (current: unknown, parts: string[]): unknown[] => {
    if (!parts.length) return [current];
    const [part, ...rest] = parts;
    if (part === '*')
      return (Array.isArray(current) ? current : []).flatMap((item) => walk(item, rest));
    if (part.startsWith('..')) {
      const key = part.slice(2);
      const found: unknown[] = [];
      const visit = (node: unknown) => {
        if (!node || typeof node !== 'object') return;
        for (const [name, child] of Object.entries(node)) {
          if (name === key) found.push(child);
          visit(child);
        }
      };
      visit(current);
      return found.flatMap((item) => walk(item, rest));
    }
    return current && typeof current === 'object'
      ? walk((current as Record<string, unknown>)[part], rest)
      : [];
  };
  const tokens = path
    .replace(/^\$\.\./, '@recursive@.')
    .replace(/^\$\.?/, '')
    .replace(/\[\*\]/g, '.*')
    .replace(/\[([^\]]+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  const parts = tokens.flatMap((token, index) =>
    token === '@recursive@'
      ? [`..${tokens[index + 1]}`]
      : index && tokens[index - 1] === '@recursive@'
        ? []
        : [token],
  );
  return walk(value, parts);
}

export function extractJsonRecords(
  body: unknown,
  recordsPath: string,
  fields: Record<string, string>,
): Record<string, unknown>[] {
  return jsonPathValues(body, recordsPath).flatMap((item) => {
    const values = Array.isArray(item) ? item : [item];
    return values.map((record) =>
      Object.fromEntries(
        Object.entries(fields).map(([name, path]) => [
          name,
          jsonPathValues(record, path)[0] ?? null,
        ]),
      ),
    );
  });
}
