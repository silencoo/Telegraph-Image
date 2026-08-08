const escapeTomlString = (value) => JSON.stringify(String(value));

const ARRAY_TABLE_RE = /^\s*\[\[\s*([^\]]+?)\s*\]\]\s*(?:#.*)?$/;
const TOML_STRING_RE = /^\s*([A-Za-z0-9_-]+)\s*=\s*(["'])(.*?)\2\s*(?:#.*)?$/;

function arrayTableBlocks(source) {
  const lines = source.split(/\r?\n/);
  const blocks = [];
  let current = null;

  lines.forEach((line, index) => {
    const match = line.match(ARRAY_TABLE_RE);
    if (!match) return;
    if (current) current.end = index;
    current = { name: match[1].trim(), start: index, end: lines.length };
    blocks.push(current);
  });

  return { lines, blocks };
}

function blockValue(lines, block, key) {
  for (let index = block.start + 1; index < block.end; index += 1) {
    const match = lines[index].match(TOML_STRING_RE);
    if (match?.[1] === key) return match[3];
  }
  return undefined;
}

export function upsertProductionKvBinding(source, binding, namespaceId) {
  const normalized = source.endsWith('\n') ? source : `${source}\n`;
  const { lines, blocks } = arrayTableBlocks(normalized);
  const target = blocks.find(
    (block) =>
      block.name === 'env.production.kv_namespaces' &&
      blockValue(lines, block, 'binding') === binding,
  );

  if (target) {
    for (let index = target.start + 1; index < target.end; index += 1) {
      if (/^\s*id\s*=/.test(lines[index])) {
        lines[index] = `id = ${escapeTomlString(namespaceId)}`;
        return `${lines.join('\n').replace(/\n+$/, '')}\n`;
      }
    }
    lines.splice(target.end, 0, `id = ${escapeTomlString(namespaceId)}`);
    return `${lines.join('\n').replace(/\n+$/, '')}\n`;
  }

  return `${normalized.trimEnd()}\n\n[[env.production.kv_namespaces]]\nbinding = ${escapeTomlString(binding)}\nid = ${escapeTomlString(namespaceId)}\n`;
}

export function upsertPagesBuildOutputDir(source, outputDirectory) {
  const lines = source.split(/\r?\n/);
  const firstTable = lines.findIndex((line) => /^\s*\[/.test(line));
  const rootEnd = firstTable === -1 ? lines.length : firstTable;
  const existing = lines.findIndex(
    (line, index) => index < rootEnd && /^\s*pages_build_output_dir\s*=/.test(line),
  );
  const assignment = `pages_build_output_dir = ${escapeTomlString(outputDirectory)}`;

  if (existing !== -1) lines[existing] = assignment;
  else lines.splice(rootEnd, 0, assignment, '');
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

export function parseNamespaceList(output) {
  const withoutAnsi = output.replace(/\u001b\[[0-9;]*m/g, '');
  const start = withoutAnsi.indexOf('[');
  const end = withoutAnsi.lastIndexOf(']');
  if (start === -1 || end < start) {
    throw new Error('Wrangler did not return a KV namespace list.');
  }
  const parsed = JSON.parse(withoutAnsi.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('Invalid KV namespace list.');
  return parsed;
}

export function parseSecretNames(output) {
  return new Set(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*-\s+([A-Za-z_][A-Za-z0-9_]*):/)?.[1])
      .filter(Boolean),
  );
}

export function parseProjectList(output) {
  const withoutAnsi = output.replace(/\u001b\[[0-9;]*m/g, '');
  const start = withoutAnsi.indexOf('[');
  const end = withoutAnsi.lastIndexOf(']');
  if (start === -1 || end < start) throw new Error('Wrangler did not return a Pages project list.');
  const parsed = JSON.parse(withoutAnsi.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('Invalid Pages project list.');
  return parsed;
}

export function findProjectDomain(projects, projectName) {
  const project = projects.find(
    (item) => item['Project Name'] === projectName || item.name === projectName,
  );
  const domains = project?.['Project Domains'] ?? project?.domains;
  if (Array.isArray(domains)) return domains[0];
  return typeof domains === 'string' ? domains.split(',')[0].trim() : undefined;
}

export function parseDeploymentUrl(output) {
  return output.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.pages\.dev/i)?.[0];
}
