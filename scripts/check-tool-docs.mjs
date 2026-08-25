import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readCurrentToolNames(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const lines = source.split(/\r?\n/);
  const values = new Map();
  let inNames = false;
  for (const line of lines) {
    if (line.includes('TOOL_NAMES =')) inNames = true;
    if (inNames) {
      const match = line.match(/^\s*([A-Z0-9_]+): '([^']+)'/);
      if (match) values.set(match[1], match[2]);
      if (line === '};') inNames = false;
    }
  }

  const schemaStart = lines.findIndex((line) => line.startsWith('export const TOOL_SCHEMAS'));
  const names = new Set();
  for (const line of lines.slice(schemaStart)) {
    if (line.trimStart().startsWith('//')) continue;
    const constant = line.match(/name: TOOL_NAMES\.BROWSER\.([A-Z0-9_]+)/);
    if (constant && values.has(constant[1])) names.add(values.get(constant[1]));
    const literal = line.match(/name: '([^']+)'/);
    if (literal) names.add(literal[1]);
  }
  return names;
}

function readHeadings(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  return new Set(
    text
      .split(/\r?\n/)
      .map((line) => line.match(/^### `([^`]+)`/))
      .filter(Boolean)
      .map((match) => match[1]),
  );
}

const current = readCurrentToolNames('packages/shared/src/tools.ts');
const currentEnglish = readCurrentToolNames('packages/shared/src/tools-en.ts');
const failures = [];
const languageDrift = [
  ...[...current].filter((name) => !currentEnglish.has(name)),
  ...[...currentEnglish].filter((name) => !current.has(name)),
];
if (languageDrift.length) {
  failures.push(`shared tool schema differs between languages: ${languageDrift.join(', ')}`);
}
const docs = ['docs/TOOLS.md', 'docs/TOOLS_zh.md'];
for (const file of docs) {
  const documented = readHeadings(file);
  const missing = [...current].filter((name) => !documented.has(name));
  if (missing.length) failures.push(`${file}: missing ${missing.join(', ')}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Tool documentation is complete for ${current.size} schemas.`);
}
