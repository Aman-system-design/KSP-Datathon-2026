import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REQUIRED_FILES = Object.freeze([
  'docs/superpowers/specs/2026-07-22-geospatial-studio-design.md',
  'docs/superpowers/plans/2026-07-22-geospatial-studio-core.md',
  'docs/runbooks/catalyst-publication-pointer-migration.md',
  'packages/geospatial-core/src/index.mjs',
  'src/backend/geospatial/dataset-catalog.mjs',
  'src/backend/geospatial/layer-service.mjs',
  'src/backend/geospatial/map-view-service.mjs',
  'src/backend/refresh/run-groups.mjs',
  'tests/geospatial/contracts.test.mjs',
  'tests/geospatial/compile-layer.test.mjs',
  'tests/backend/geospatial-layer-service.test.mjs',
  'tests/backend/geospatial-refresh-integration.test.mjs',
  'tests/backend/map-view-service.test.mjs',
  'tests/catalyst/geospatial-repository.test.mjs',
  'tests/architecture/web-bundle-budget.test.mjs',
  'web/src/app/router.test.jsx',
  'web/src/features/geospatial/MapCanvas.test.jsx',
  'web/src/features/geospatial/GeospatialStudio.test.jsx',
  'web/src/features/geospatial/useGeospatialWorkspace.test.jsx',
  'web/src/features/geospatial/EmbeddedMapView.test.jsx',
]);

function invariant(condition, message) {
  if (!condition) throw new Error(`Geospatial verification failed: ${message}`);
}

function rootPath(root) {
  if (root instanceof URL) return fileURLToPath(root);
  return path.resolve(root ?? path.resolve(import.meta.dirname, '..', '..'));
}

async function readJson(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

async function filesBelow(root, relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const relative = path.posix.join(relativeDirectory.replaceAll('\\', '/'), entry.name);
    return entry.isDirectory() ? filesBelow(root, relative) : [relative];
  }));
  return nested.flat();
}

function dependencyNames(manifest) {
  return new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ].map(name => name.toLowerCase()));
}

function assertNoLeafletDependency(manifest, label) {
  const names = dependencyNames(manifest);
  invariant(!names.has('leaflet') && !names.has('react-leaflet'), `${label} still declares Leaflet`);
}

function isIdentifierCharacter(value) {
  return value !== undefined && /[\p{ID_Continue}$]/u.test(value);
}

function skipQuoted(source, start) {
  const quote = source[start];
  let value = '';
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === '\\') {
      value += source[index + 1] ?? '';
      index += 1;
    } else if (source[index] === quote) {
      return { end: index + 1, value };
    } else {
      value += source[index];
    }
  }
  return { end: source.length, value: null };
}

function skipSpaceAndComments(source, start) {
  let index = start;
  while (index < source.length) {
    if (/\s/u.test(source[index])) index += 1;
    else if (source.startsWith('//', index)) {
      index = source.indexOf('\n', index + 2);
      if (index === -1) return source.length;
    } else if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
    } else break;
  }
  return index;
}

function startsKeyword(source, index, keyword) {
  return source.startsWith(keyword, index)
    && !isIdentifierCharacter(source[index - 1])
    && !isIdentifierCharacter(source[index + keyword.length]);
}

function sourceAfterFrom(source, start) {
  for (let index = start; index < source.length;) {
    index = skipSpaceAndComments(source, index);
    if (source[index] === ';') return { end: index + 1 };
    if (source[index] === "'" || source[index] === '"' || source[index] === '`') {
      index = skipQuoted(source, index).end;
      continue;
    }
    if (startsKeyword(source, index, 'from')) {
      const literalStart = skipSpaceAndComments(source, index + 4);
      if (source[literalStart] === "'" || source[literalStart] === '"') return skipQuoted(source, literalStart);
      return { end: literalStart };
    }
    index += 1;
  }
  return { end: source.length };
}

function javascriptModuleSpecifiers(source) {
  const values = [];
  for (let index = 0; index < source.length;) {
    if (source.startsWith('//', index) || source.startsWith('/*', index)) {
      index = skipSpaceAndComments(source, index);
      continue;
    }
    if (source[index] === "'" || source[index] === '"' || source[index] === '`') {
      index = skipQuoted(source, index).end;
      continue;
    }
    if (startsKeyword(source, index, 'import')) {
      let cursor = skipSpaceAndComments(source, index + 6);
      if (source[cursor] === '.') { index = cursor + 1; continue; }
      if (source[cursor] === '(') cursor = skipSpaceAndComments(source, cursor + 1);
      if (source[cursor] === "'" || source[cursor] === '"' || source[cursor] === '`') {
        const literal = skipQuoted(source, cursor);
        if (literal.value !== null && !literal.value.includes('${')) values.push(literal.value);
        index = literal.end;
        continue;
      }
      const literal = sourceAfterFrom(source, cursor);
      if (literal.value !== undefined && literal.value !== null) values.push(literal.value);
      index = literal.end;
      continue;
    }
    if (startsKeyword(source, index, 'export')) {
      const cursor = skipSpaceAndComments(source, index + 6);
      if (source[cursor] !== '*' && source[cursor] !== '{') { index = cursor; continue; }
      const literal = sourceAfterFrom(source, cursor);
      if (literal.value !== undefined && literal.value !== null) values.push(literal.value);
      index = literal.end;
      continue;
    }
    if (startsKeyword(source, index, 'require')) {
      let cursor = skipSpaceAndComments(source, index + 7);
      if (source[cursor] === '(') cursor = skipSpaceAndComments(source, cursor + 1);
      else { index += 7; continue; }
      if (source[cursor] === "'" || source[cursor] === '"') {
        const literal = skipQuoted(source, cursor);
        cursor = skipSpaceAndComments(source, literal.end);
        if (literal.value !== null && source[cursor] === ')') values.push(literal.value);
        index = literal.end;
        continue;
      }
    }
    index += 1;
  }
  return values;
}

function cssReferences(source) {
  const values = [];
  for (let index = 0; index < source.length;) {
    if (source.startsWith('/*', index)) {
      index = skipSpaceAndComments(source, index);
      continue;
    }
    if (source[index] === "'" || source[index] === '"') {
      index = skipQuoted(source, index).end;
      continue;
    }
    const importAtRule = source.slice(index).match(/^@import(?![\w-])/iu);
    const urlFunction = !isIdentifierCharacter(source[index - 1]) && source[index - 1] !== '-'
      ? source.slice(index).match(/^url\s*\(/iu)
      : null;
    if (importAtRule || urlFunction) {
      let cursor = skipSpaceAndComments(source, index + (importAtRule ? importAtRule[0].length : urlFunction[0].length));
      if (importAtRule) {
        const nestedUrl = source.slice(cursor).match(/^url\s*\(/iu);
        if (nestedUrl) cursor = skipSpaceAndComments(source, cursor + nestedUrl[0].length);
      }
      if (source[cursor] === "'" || source[cursor] === '"') {
        const literal = skipQuoted(source, cursor);
        if (literal.value !== null) values.push(literal.value);
        index = literal.end;
        continue;
      }
      const end = source.indexOf(')', cursor);
      if (end !== -1) {
        values.push(source.slice(cursor, end).trim());
        index = end + 1;
        continue;
      }
    }
    index += 1;
  }
  return values;
}

function isLeafletPackage(value) {
  const normalized = value.trim().toLowerCase().replace(/^~/u, '');
  return /^(?:react-)?leaflet(?:\/|$)/u.test(normalized)
    || /(?:^|\/)node_modules\/(?:react-)?leaflet(?:\/|$)/u.test(normalized);
}

export async function assertNoLeafletReferences(source, relativePath) {
  if (/\.css$/iu.test(relativePath)) {
    invariant(!cssReferences(source).some(isLeafletPackage), `${relativePath} references Leaflet`);
    return;
  }
  invariant(!javascriptModuleSpecifiers(source).some(isLeafletPackage), `${relativePath} imports Leaflet`);
}

export async function verifyGeospatial(repositoryRoot) {
  const root = rootPath(repositoryRoot);
  const [repository, web, schema, migration, migrationState] = await Promise.all([
    readJson(root, 'package.json'),
    readJson(root, 'web/package.json'),
    readJson(root, 'schema/catalyst/intelligence-schema.json'),
    readJson(root, 'schema/catalyst/migrations/2026-07-22-publication-pointer.json'),
    readJson(root, 'schema/catalyst/migrations/2026-07-22-publication-pointer.state.json'),
  ]);

  assertNoLeafletDependency(repository, 'root package');
  assertNoLeafletDependency(web, 'web package');
  for (const relativePath of await filesBelow(root, 'web/src')) {
    if (!/\.(?:[cm]?[jt]sx?|css)$/u.test(relativePath)) continue;
    await assertNoLeafletReferences(await readFile(path.join(root, relativePath), 'utf8'), relativePath);
  }

  await Promise.all(REQUIRED_FILES.map(relativePath => access(path.join(root, relativePath))));
  invariant(REQUIRED_FILES.every(relativePath => !relativePath.startsWith('functions/')),
    'architecture checks must target canonical source, not generated Functions');

  const router = await readFile(path.join(root, 'web/src/app/router.jsx'), 'utf8');
  invariant(/<Route\s+path=['"]\/geospatial['"]\s+element=/u.test(router), '/geospatial route is not declared');
  invariant(/lazy\(\(\)\s*=>\s*import\(['"]\.\.\/features\/geospatial\/GeospatialStudio\.jsx['"]\)\)/u.test(router),
    'Geospatial Studio must remain lazy-loaded');

  const canvas = await readFile(path.join(root, 'web/src/features/geospatial/MapCanvas.jsx'), 'utf8');
  invariant(/import\s*\{\s*Protocol\s*\}\s*from\s*['"]pmtiles['"]/u.test(canvas), 'PMTiles Protocol import is missing');
  invariant(/Symbol\.for\(['"]ksp\.geospatial\.pmtiles-protocol['"]\)/u.test(canvas), 'PMTiles singleton guard is missing');
  invariant(/addProtocol\(['"]pmtiles['"]\s*,/u.test(canvas), 'pmtiles:// protocol registration is missing');

  const tables = new Set(schema.tables?.map(table => table.name));
  invariant(tables.size === migration.toTableCount, 'current schema table count does not match migration contract');
  invariant(tables.has('CFG_MapView') && tables.has('CFG_MapViewVersion'), 'map-view schema is incomplete');
  invariant(tables.has(migration.newTable), 'publication-state table is missing from current schema');
  invariant(migration.legacyRequiredTables.every(table => tables.has(table)), 'migration references a missing legacy table');
  invariant(migration.legacyRequiredTables.length === migration.fromTableCount, 'migration legacy table count is inconsistent');
  invariant(migration.fromTableCount + 1 === migration.toTableCount, 'migration must add exactly the publication table');
  invariant([...tables].every(table => table === migration.newTable || migration.legacyRequiredTables.includes(table)),
    'current schema contains a table outside the migration contract');
  invariant(migrationState.migrationId === migration.migrationId, 'migration state does not match the migration manifest');
  invariant(['NOT_APPLIED', 'APPLIED', 'VERIFIED'].includes(migrationState.status), 'migration state status is unsupported');

  invariant(repository.scripts?.['web:build']?.includes('npm run web:bundle:check'), 'web build does not enforce bundle budgets');
  const budgetModule = await import(pathToFileURL(path.join(root, 'scripts/ci/check-web-bundle.mjs')).href);
  invariant(budgetModule.BUDGETS?.mainGzip <= 100 * 1024, 'main bundle budget is too large');
  invariant(budgetModule.BUDGETS?.studioGzip <= 100 * 1024, 'Studio bundle budget is too large');
  invariant(budgetModule.BUDGETS?.chunkGzip <= 300 * 1024, 'chunk bundle budget is too large');

  const buildModule = await import(pathToFileURL(path.join(root, 'scripts/catalyst/build-functions.mjs')).href);
  const functionRoot = await mkdtemp(path.join(tmpdir(), 'ksp-geospatial-ci-'));
  try {
    const manifest = buildModule.buildFunctionBundle({ target: 'api', repositoryRoot: root, functionRoot });
    const bundledPaths = new Set(manifest.files.map(file => file.path));
    invariant(bundledPaths.has('src/backend/geospatial/layer-service.mjs'),
      'Catalyst API bundle does not reach canonical geospatial source');
    invariant(bundledPaths.has('vendor/geospatial-core/index.mjs'),
      'Catalyst API bundle does not vendor the canonical geospatial core');
  } finally {
    await rm(functionRoot, { recursive: true, force: true });
  }

  return Object.freeze({
    schemaTableCount: tables.size,
    requiredFilesChecked: REQUIRED_FILES.length,
    bundleBudgetWired: true,
    generatedFunctionPathsChecked: 0,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await verifyGeospatial();
  console.log('PASS: governed geospatial core is structurally complete.');
}
