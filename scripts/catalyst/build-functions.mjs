import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TARGETS = Object.freeze({
  api: Object.freeze({
    runtime: 'node24',
    roots: Object.freeze([
      'src/backend/catalyst/api-bootstrap.mjs',
      'src/backend/catalyst/runtime-config.mjs',
    ]),
  }),
  refresh: Object.freeze({
    runtime: 'node18',
    roots: Object.freeze([
      'src/backend/refresh/refresh-service.mjs',
      'src/ingestion/to-intelligence-input.mjs',
      'src/ingestion/validate-source-seed.mjs',
      'src/synthetic/source-seed.mjs',
    ]),
  }),
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function relativeImports(source) {
  const values = new Set();
  for (const pattern of [/\bfrom\s+['"](\.[^'"]+)['"]/gu, /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/gu]) {
    for (const match of source.matchAll(pattern)) values.add(match[1]);
  }
  return [...values];
}

function collectReachable(repositoryRoot, roots) {
  const queue = [...roots];
  const files = new Set();
  while (queue.length > 0) {
    const relativeFile = queue.shift().replaceAll('\\', '/');
    if (files.has(relativeFile)) continue;
    const absoluteFile = path.join(repositoryRoot, relativeFile);
    if (!existsSync(absoluteFile)) throw new Error(`Runtime source is missing: ${relativeFile}`);
    files.add(relativeFile);
    if (!/\.(?:c?js|mjs)$/iu.test(relativeFile)) continue;
    const source = readFileSync(absoluteFile, 'utf8');
    for (const specifier of relativeImports(source)) {
      const resolved = path.resolve(path.dirname(absoluteFile), specifier);
      if (relativeFile === 'src/synthetic/source-seed.mjs' && resolved.includes(`${path.sep}fixtures${path.sep}`)) continue;
      const insideRepository = path.relative(repositoryRoot, resolved);
      if (insideRepository.startsWith('..') || path.isAbsolute(insideRepository)) throw new Error(`Import escapes repository: ${relativeFile} -> ${specifier}`);
      queue.push(insideRepository);
    }
  }
  return [...files].sort();
}

function walkFiles(root, current = root) {
  return readdirSync(current, { withFileTypes: true })
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
    .flatMap(entry => entry.isDirectory()
      ? walkFiles(root, path.join(current, entry.name))
      : [path.relative(root, path.join(current, entry.name)).replaceAll('\\', '/')]);
}

function materializeFile({ repositoryRoot, appRoot, sourcePath, destinationPath = sourcePath, transform }) {
  const source = readFileSync(path.join(repositoryRoot, sourcePath));
  const output = transform ? Buffer.from(transform(source.toString('utf8')), 'utf8') : source;
  const destination = path.join(appRoot, destinationPath);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, output);
}

function writeManifest({ appRoot, target, runtime }) {
  const files = walkFiles(appRoot).sort().map((relativePath) => {
    const bytes = readFileSync(path.join(appRoot, relativePath));
    return { path: relativePath, sha256: sha256(bytes), bytes: bytes.byteLength };
  });
  const manifest = { schemaVersion: '1.0.0', target, runtime, files };
  writeFileSync(path.join(appRoot, 'bundle-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

export function buildFunctionBundle({ target, repositoryRoot, functionRoot }) {
  const definition = TARGETS[target];
  if (!definition) throw new Error(`Unsupported Catalyst bundle target: ${target}`);
  const appRoot = path.join(functionRoot, 'app');
  rmSync(appRoot, { recursive: true, force: true });
  mkdirSync(appRoot, { recursive: true });

  const reachable = collectReachable(repositoryRoot, definition.roots);
  for (const sourcePath of reachable) {
    materializeFile({
      repositoryRoot,
      appRoot,
      sourcePath,
      transform: sourcePath === 'src/synthetic/source-seed.mjs'
        ? source => source.replace('../../fixtures/intelligence/demo-input.json', '../../data/synthetic-demo-input.json')
        : undefined,
    });
  }
  materializeFile({ repositoryRoot, appRoot, sourcePath: 'config/access-policy.json' });

  if (target === 'refresh') {
    materializeFile({
      repositoryRoot,
      appRoot,
      sourcePath: 'fixtures/intelligence/demo-input.json',
      destinationPath: 'data/synthetic-demo-input.json',
    });
    const vendorFiles = collectReachable(repositoryRoot, ['packages/intelligence-core/src/pipeline.mjs']);
    for (const sourcePath of vendorFiles) {
      materializeFile({
        repositoryRoot,
        appRoot,
        sourcePath,
        destinationPath: sourcePath.replace('packages/intelligence-core/', 'vendor/intelligence-core/'),
      });
    }
    materializeFile({
      repositoryRoot,
      appRoot,
      sourcePath: 'packages/intelligence-core/index.mjs',
      destinationPath: 'vendor/intelligence-core/index.mjs',
      transform: () => "export { runIntelligencePipeline } from './src/pipeline.mjs';\n",
    });
    materializeFile({
      repositoryRoot,
      appRoot,
      sourcePath: 'packages/intelligence-core/package.json',
      destinationPath: 'vendor/intelligence-core/package.json',
    });
  }

  return writeManifest({ appRoot, target, runtime: definition.runtime });
}

function runCli() {
  const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
  const outputs = [
    buildFunctionBundle({ target: 'api', repositoryRoot, functionRoot: path.join(repositoryRoot, 'functions', 'crime_intelligence_api') }),
    buildFunctionBundle({ target: 'refresh', repositoryRoot, functionRoot: path.join(repositoryRoot, 'functions', 'intelligence_refresh') }),
  ];
  process.stdout.write(`${JSON.stringify(outputs.map(({ target, runtime, files }) => ({ target, runtime, fileCount: files.length })), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runCli();
