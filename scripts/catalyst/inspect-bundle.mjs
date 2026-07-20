import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_FORBIDDEN = Object.freeze([
  /(?:^|\/)(?:fixtures|tests|docs|artifacts|\.git)(?:\/|$)/i,
  /hidden[-_]?truth/i,
  /(?:^|\/)(?:\.env|credentials?[^/]*|tokens?[^/]*|secrets?[^/]*)(?:$|\/)/i,
]);

function walk(root, current = root) {
  if (!existsSync(current)) return [];
  return readdirSync(current, { withFileTypes: true })
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
    .flatMap(entry => entry.isDirectory()
      ? walk(root, path.join(current, entry.name))
      : [path.relative(root, path.join(current, entry.name)).replaceAll('\\', '/')]);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function moduleSpecifiers(source) {
  const values = new Set();
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/gu,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
    /\bimport\s+['"]([^'"]+)['"]/gu,
    /new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/gu,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/gu,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) values.add(match[1]);
  }
  return [...values];
}

function resolvesRelative(appRoot, importingFile, specifier) {
  const candidate = path.resolve(path.dirname(path.join(appRoot, importingFile)), specifier);
  const options = [candidate, `${candidate}.mjs`, `${candidate}.js`, `${candidate}.cjs`, `${candidate}.json`, path.join(candidate, 'index.mjs')];
  return options.some(existsSync) && candidate.startsWith(path.resolve(appRoot) + path.sep);
}

export function inspectBundle({ functionRoot, forbiddenPatterns = DEFAULT_FORBIDDEN }) {
  const appRoot = path.join(functionRoot, 'app');
  const manifestPath = path.join(appRoot, 'bundle-manifest.json');
  if (!existsSync(manifestPath)) {
    return { valid: false, manifestErrors: ['bundle-manifest.json is missing'], forbiddenFiles: [], unresolvedImports: [] };
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const diskFiles = walk(appRoot).filter(file => file !== 'bundle-manifest.json');
  const declaredFiles = (manifest.files ?? []).map(file => file.path);
  const manifestErrors = [];
  if (JSON.stringify(declaredFiles) !== JSON.stringify([...declaredFiles].sort())) manifestErrors.push('manifest files are not sorted');
  if (JSON.stringify(diskFiles) !== JSON.stringify(declaredFiles)) manifestErrors.push('manifest inventory differs from files on disk');
  for (const declared of manifest.files ?? []) {
    const absolute = path.join(appRoot, declared.path);
    if (!existsSync(absolute)) continue;
    const bytes = readFileSync(absolute);
    if (bytes.byteLength !== declared.bytes || sha256(bytes) !== declared.sha256) manifestErrors.push(`${declared.path}: digest mismatch`);
  }

  const forbiddenFiles = diskFiles.filter(file => forbiddenPatterns.some(pattern => pattern.test(file)));
  const unresolvedImports = [];
  for (const file of diskFiles.filter(file => /\.(?:c?js|mjs)$/iu.test(file))) {
    const source = readFileSync(path.join(appRoot, file), 'utf8');
    for (const specifier of moduleSpecifiers(source)) {
      if (specifier.startsWith('node:')) continue;
      if (specifier.startsWith('.')) {
        if (!resolvesRelative(appRoot, file, specifier)) unresolvedImports.push(`${file} -> ${specifier}`);
      } else {
        unresolvedImports.push(`${file} -> ${specifier}`);
      }
    }
  }

  return {
    valid: manifestErrors.length === 0 && forbiddenFiles.length === 0 && unresolvedImports.length === 0,
    target: manifest.target,
    runtime: manifest.runtime,
    fileCount: diskFiles.length,
    manifestErrors,
    forbiddenFiles,
    unresolvedImports,
  };
}

function runCli() {
  const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
  const targets = [
    ['api', 'crime_intelligence_api'],
    ['refresh', 'intelligence_refresh'],
  ];
  const results = targets.map(([target, directory]) => inspectBundle({
    functionRoot: path.join(repositoryRoot, 'functions', directory),
  }));
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  if (results.some(result => !result.valid)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runCli();
