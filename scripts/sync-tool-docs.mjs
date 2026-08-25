import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readTools(file) {
  const lines = fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/);
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

  const start = lines.findIndex((line) => line.includes('TOOL_SCHEMAS'));
  const tools = [];
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trimStart().startsWith('//')) continue;
    const constant = line.match(/^\s*name: TOOL_NAMES\.BROWSER\.([A-Z0-9_]+)/);
    const literal = line.match(/^\s*name: '([^']+)'/);
    const name = constant ? values.get(constant[1]) : literal?.[1];
    if (!name) continue;

    let description = '';
    for (let j = i + 1; j < lines.length && !/^  \{/.test(lines[j]); j += 1) {
      const sameLine = lines[j].match(/description:\s*'([^']*)'/);
      if (sameLine) {
        description = sameLine[1];
        break;
      }
      if (lines[j].trim() === 'description:' && lines[j + 1]) {
        const nextLine = lines[j + 1].match(/'([^']*)'/);
        if (nextLine) {
          description = nextLine[1];
          break;
        }
      }
    }
    tools.push({ name, description: description || 'See the shared MCP schema for parameters.' });
  }
  return tools;
}

function sync(file, source) {
  const absolute = path.join(root, file);
  let text = fs.readFileSync(absolute, 'utf8');
  const documented = new Set(
    [...text.matchAll(/^### `([^`]+)`/gm)].map((match) => match[1]),
  );
  const missing = readTools(source).filter((tool) => !documented.has(tool.name));
  if (!missing.length) return 0;

  const isChinese = file.includes('_zh');
  const heading = isChinese ? '## 🔄 Schema Catalog 补充' : '## 🔄 Schema Catalog Additions';
  const generatedNote = isChinese
    ? '该部分由共享工具 schema 自动生成。'
    : 'This section is generated from the shared tool schema.';
  const canonicalNote = isChinese
    ? '规范 inputSchema 维护在 shared package 中，并由 pnpm check:tool-docs 校验。'
    : 'The canonical input schema is maintained in the shared package and is checked by pnpm check:tool-docs.';
  const blocks = missing.map(
    (tool) =>
      `### \`${tool.name}\`\n\n${tool.description}\n\n> ${canonicalNote}`,
  );
  const section = `\n\n${heading}\n\n> ${generatedNote}\n\n${blocks.join('\n\n')}`;
  const responseHeading = text.match(/^## 📋 Response Format/m)?.[0];
  text = responseHeading ? text.replace(responseHeading, `${section}\n\n${responseHeading}`) : `${text.trimEnd()}${section}\n`;
  fs.writeFileSync(absolute, text);
  return missing.length;
}

const added =
  sync('docs/TOOLS.md', 'packages/shared/src/tools-en.ts') +
  sync('docs/TOOLS_zh.md', 'packages/shared/src/tools.ts');
console.log(`Added ${added} tool documentation entries.`);
