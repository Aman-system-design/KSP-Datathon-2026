import { createHash } from 'node:crypto';
import { lstat, mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REQUIRED_FILES = Object.freeze([
  'docs/superpowers/specs/2026-07-22-geospatial-studio-design.md',
  'docs/superpowers/plans/2026-07-22-geospatial-studio-core.md',
  'docs/runbooks/catalyst-publication-pointer-migration.md',
  'docs/runbooks/circleci-verification-security-boundary.md',
  'schema/catalyst/migrations/2026-07-22-publication-pointer.after.json',
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
  'tests/compat/node18-refresh-runtime.test.mjs',
  'tests/architecture/node-runtime-isolation.test.mjs',
  'scripts/ci/run-node18-compat.mjs',
  'tools/node18-runtime/package.json',
  'tools/node18-runtime/package-lock.json',
  'web/src/app/router.test.jsx',
  'web/src/features/geospatial/GeospatialPage.jsx',
  'web/src/features/geospatial/MapCanvas.test.jsx',
  'web/src/features/geospatial/GeospatialStudio.test.jsx',
  'web/src/features/geospatial/useGeospatialWorkspace.test.jsx',
  'web/src/features/geospatial/EmbeddedMapView.test.jsx',
]);

const PUBLICATION_AFTER_DIGEST = 'cc55386a1f3c42f25c48f9e89722934eee6d413dccbfc415c80ff0a206e0e52b';
const PUBLICATION_MIGRATION_DIGEST = 'f2e98e55765ac3616b2d4ca651b9da415301d38a7949df3748459ddec6ec509a';

function invariant(condition, message) {
  if (!condition) throw new Error(`Geospatial verification failed: ${message}`);
}

function rootPath(root) {
  if (root instanceof URL) return fileURLToPath(root);
  return path.resolve(root ?? path.resolve(import.meta.dirname, '..', '..'));
}

async function readJson(root, relativePath) {
  return JSON.parse(await readRepositoryFile(root, relativePath));
}

function contained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function checkedRepositoryEntry(root, relativePath, expectedType) {
  const repository = await realpath(root);
  const absolute = path.resolve(root, relativePath);
  invariant(contained(path.resolve(root), absolute), `${relativePath} escapes repository`);
  const stats = await lstat(absolute);
  invariant(!stats.isSymbolicLink(), `${relativePath} must not be a symbolic link`);
  invariant(expectedType === 'directory' ? stats.isDirectory() : stats.isFile(),
    `${relativePath} must be a ${expectedType === 'directory' ? 'directory' : 'regular file'}`);
  const resolved = await realpath(absolute);
  invariant(contained(repository, resolved), `${relativePath} resolves outside repository`);
  return resolved;
}

export async function assertRegularContainedFile(root, relativePath) {
  return checkedRepositoryEntry(rootPath(root), relativePath, 'file');
}

async function readRepositoryFile(root, relativePath) {
  return readFile(await assertRegularContainedFile(root, relativePath), 'utf8');
}

async function filesBelow(root, relativeDirectory) {
  const directory = await checkedRepositoryEntry(root, relativeDirectory, 'directory');
  const entries = await readdir(directory);
  const nested = await Promise.all(entries.sort().map(async name => {
    const relative = path.posix.join(relativeDirectory.replaceAll('\\', '/'), name);
    const absolute = path.join(directory, name);
    const stats = await lstat(absolute);
    invariant(!stats.isSymbolicLink(), `${relative} must not be a symbolic link`);
    if (stats.isDirectory()) {
      invariant(!/\.(?:[cm]?[jt]sx?|css|html?)$/iu.test(name), `${relative} must be a regular file`);
      return filesBelow(root, relative);
    }
    invariant(stats.isFile(), `${relative} must be a regular file`);
    const resolved = await realpath(absolute);
    invariant(contained(await realpath(root), resolved), `${relative} resolves outside repository`);
    return [relative];
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

function previousSignificantCharacter(source, start) {
  let index = start - 1;
  while (index >= 0) {
    if (/\s/u.test(source[index])) { index -= 1; continue; }
    if (source[index] === '/' && source[index - 1] === '*') {
      const commentStart = source.lastIndexOf('/*', index - 2);
      if (commentStart !== -1) { index = commentStart - 1; continue; }
    }
    return source[index];
  }
  return undefined;
}

function scanTemplateLiteral(source, start) {
  const expressions = [];
  for (let index = start + 1; index < source.length;) {
    if (source[index] === '\\') { index += 2; continue; }
    if (source[index] === '`') return { end: index + 1, expressions };
    if (!source.startsWith('${', index)) { index += 1; continue; }
    const expressionStart = index + 2;
    let depth = 1;
    index = expressionStart;
    while (index < source.length && depth > 0) {
      if (source.startsWith('//', index) || source.startsWith('/*', index)) {
        index = skipSpaceAndComments(source, index);
      } else if (source[index] === "'" || source[index] === '"') {
        index = skipQuoted(source, index).end;
      } else if (source[index] === '`') {
        index = scanTemplateLiteral(source, index).end;
      } else {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') depth -= 1;
        index += 1;
      }
    }
    if (depth === 0) expressions.push(source.slice(expressionStart, index - 1));
  }
  return { end: source.length, expressions };
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
    if (source[index] === '`') {
      const template = scanTemplateLiteral(source, index);
      for (const expression of template.expressions) values.push(...javascriptModuleSpecifiers(expression));
      index = template.end;
      continue;
    }
    if (source[index] === "'" || source[index] === '"') {
      index = skipQuoted(source, index).end;
      continue;
    }
    if (startsKeyword(source, index, 'import') && previousSignificantCharacter(source, index) !== '.') {
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
    if (startsKeyword(source, index, 'require') && previousSignificantCharacter(source, index) !== '.') {
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

function literalAttributes(tag) {
  const values = [];
  let index = /^<[A-Za-z][\w-]*/u.exec(tag)?.[0].length ?? 1;
  while (index < tag.length) {
    while (/\s/u.test(tag[index])) index += 1;
    const nameStart = index;
    while (index < tag.length && !/[\s=/>]/u.test(tag[index])) index += 1;
    const name = tag.slice(nameStart, index).toLowerCase();
    while (/\s/u.test(tag[index])) index += 1;
    if (tag[index] !== '=') { index += 1; continue; }
    index += 1;
    while (/\s/u.test(tag[index])) index += 1;
    if (tag[index] === '{') {
      index += 1;
      while (/\s/u.test(tag[index])) index += 1;
    }
    if (!['"', "'", '`'].includes(tag[index])) {
      while (index < tag.length && !/[\s>]/u.test(tag[index])) index += 1;
      continue;
    }
    const literal = skipQuoted(tag, index);
    index = literal.end;
    if (literal.value !== null && !literal.value.includes('${') && ['src', 'href', 'style'].includes(name)) {
      values.push({ name, value: literal.value });
    }
  }
  return values;
}

function markupReferences(source, { javascript = false } = {}) {
  const values = [];
  for (let index = 0; index < source.length;) {
    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4);
      index = end === -1 ? source.length : end + 3;
      continue;
    }
    if (javascript && (source.startsWith('//', index) || source.startsWith('/*', index))) {
      index = skipSpaceAndComments(source, index);
      continue;
    }
    if (javascript && (source[index] === "'" || source[index] === '"' || source[index] === '`')) {
      index = source[index] === '`' ? scanTemplateLiteral(source, index).end : skipQuoted(source, index).end;
      continue;
    }
    if (source[index] !== '<' || !/[A-Za-z]/u.test(source[index + 1] ?? '')) { index += 1; continue; }
    let end = index + 1;
    let quote;
    while (end < source.length) {
      if (quote) {
        if (source[end] === '\\') end += 2;
        else if (source[end] === quote) { quote = undefined; end += 1; }
        else end += 1;
      } else if (source[end] === "'" || source[end] === '"') { quote = source[end]; end += 1; }
      else if (source[end] === '>') break;
      else end += 1;
    }
    if (end >= source.length) break;
    const tag = source.slice(index, end + 1);
    const tagName = /^<([A-Za-z][\w-]*)/u.exec(tag)?.[1]?.toLowerCase();
    for (const attribute of literalAttributes(tag)) {
      if ((tagName === 'script' && attribute.name === 'src')
        || (tagName === 'link' && attribute.name === 'href')) values.push(attribute.value);
      if (attribute.name === 'style') values.push(...cssReferences(attribute.value));
    }
    const closing = tagName === 'style' || tagName === 'script'
      ? source.toLowerCase().indexOf(`</${tagName}>`, end + 1)
      : -1;
    if (closing !== -1) {
      const body = source.slice(end + 1, closing);
      values.push(...(tagName === 'style' ? cssReferences(body) : javascriptModuleSpecifiers(body)));
      index = closing + tagName.length + 3;
    } else index = end + 1;
  }
  return values;
}

function isLeafletPackage(value) {
  const raw = value.trim().replace(/^~/u, '');
  const packageSegment = segment => /^(?:react-)?leaflet(?:@[^/]+)?$/u.test(segment)
    || /^(?:react-)?leaflet(?:\.min)?\.(?:js|css)$/u.test(segment);
  const matchesPath = pathname => {
    try {
      return decodeURIComponent(pathname).split('/').filter(Boolean)
        .some(segment => packageSegment(segment.toLowerCase()));
    } catch { return false; }
  };
  const normalized = raw.toLowerCase();
  if (/^(?:react-)?leaflet(?:\/|$)/u.test(normalized)
    || /(?:^|\/)node_modules\/(?:react-)?leaflet(?:\/|$)/u.test(normalized)) return true;
  if (!/^[a-z][a-z\d+.-]*:/u.test(normalized)) {
    const pathname = raw.split(/[?#]/u, 1)[0];
    if (matchesPath(pathname)) return true;
  }
  try {
    const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    return matchesPath(url.pathname);
  } catch {
    return false;
  }
}

export async function assertNoLeafletReferences(source, relativePath) {
  if (/\.css$/iu.test(relativePath)) {
    invariant(!cssReferences(source).some(isLeafletPackage), `${relativePath} references Leaflet`);
    return;
  }
  if (/\.html?$/iu.test(relativePath)) {
    invariant(!markupReferences(source).some(isLeafletPackage), `${relativePath} references Leaflet`);
    return;
  }
  const references = [...javascriptModuleSpecifiers(source), ...markupReferences(source, { javascript: true })];
  invariant(!references.some(isLeafletPackage), `${relativePath} imports Leaflet`);
}

export async function scanWebAssets(repositoryRoot) {
  const root = rootPath(repositoryRoot);
  const candidates = ['web/index.html'];
  for (const directory of ['web/src', 'web/public']) candidates.push(...await filesBelow(root, directory));
  for (const relativePath of candidates) {
    if (!/\.(?:[cm]?[jt]sx?|css|html?)$/iu.test(relativePath)) continue;
    await assertNoLeafletReferences(await readRepositoryFile(root, relativePath), relativePath);
  }
  return Object.freeze({ filesChecked: candidates.length });
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonicalValue(value[key])]),
  );
  return value;
}

function semanticDigest(value) {
  return createHash('sha256').update(JSON.stringify(canonicalValue(value))).digest('hex');
}

function assertColumnContract(table, expectedColumn) {
  const actual = table?.columns?.find(column => column.name === expectedColumn.name);
  invariant(actual, `${table?.name ?? 'schema'} is missing ${expectedColumn.name}`);
  for (const [key, expected] of Object.entries(expectedColumn)) {
    invariant(JSON.stringify(actual[key]) === JSON.stringify(expected),
      `${table.name}.${expectedColumn.name}.${key} does not match the migration after-state`);
  }
}

export function validatePublicationMigration({ schema, migration, migrationState, after }) {
  invariant(semanticDigest(migration) === PUBLICATION_MIGRATION_DIGEST, 'publication migration artifact was mutated');
  invariant(semanticDigest(after) === PUBLICATION_AFTER_DIGEST, 'publication migration after-state artifact was mutated');
  invariant(after.migrationId === migration.migrationId && migrationState.migrationId === migration.migrationId,
    'migration state or after-state does not match the migration artifact');
  invariant(after.fromTableCount === migration.fromTableCount && after.toTableCount === migration.toTableCount,
    'migration before/after table counts do not match');
  invariant(migration.fromTableCount + 1 === migration.toTableCount, 'migration must add exactly one table');
  invariant(after.newTable.name === migration.newTable, 'migration new table does not match its immutable after-state');
  const alteredColumnNames = after.alteredTables.flatMap(table => table.columns.map(column => column.name)).sort();
  invariant(JSON.stringify(alteredColumnNames) === JSON.stringify([...migration.nullableRunColumns].sort()),
    'migration altered columns do not match its immutable after-state');

  const tables = new Map(schema.tables?.map(table => [table.name, table]));
  invariant(migration.legacyRequiredTables.length === migration.fromTableCount, 'migration legacy table count is inconsistent');
  invariant(migration.legacyRequiredTables.every(table => tables.has(table)), 'current schema lost a migration baseline table');
  const currentNewTable = tables.get(after.newTable.name);
  invariant(currentNewTable, `current schema is missing ${after.newTable.name}`);
  for (const key of ['name', 'zone', 'businessId']) {
    invariant(currentNewTable[key] === after.newTable[key], `${after.newTable.name}.${key} does not match the migration after-state`);
  }
  for (const column of after.newTable.columns) assertColumnContract(currentNewTable, column);
  for (const expectedTable of after.alteredTables) {
    const currentTable = tables.get(expectedTable.name);
    invariant(currentTable, `current schema is missing ${expectedTable.name}`);
    for (const column of expectedTable.columns) assertColumnContract(currentTable, column);
  }
  invariant(['NOT_APPLIED', 'APPLIED', 'VERIFIED'].includes(migrationState.status), 'migration state status is unsupported');
  return Object.freeze({ schemaTableCount: tables.size });
}

export async function verifyGeospatial(repositoryRoot) {
  const root = rootPath(repositoryRoot);
  const [repository, web, schema, migration, migrationState, after] = await Promise.all([
    readJson(root, 'package.json'),
    readJson(root, 'web/package.json'),
    readJson(root, 'schema/catalyst/intelligence-schema.json'),
    readJson(root, 'schema/catalyst/migrations/2026-07-22-publication-pointer.json'),
    readJson(root, 'schema/catalyst/migrations/2026-07-22-publication-pointer.state.json'),
    readJson(root, 'schema/catalyst/migrations/2026-07-22-publication-pointer.after.json'),
  ]);

  assertNoLeafletDependency(repository, 'root package');
  assertNoLeafletDependency(web, 'web package');
  await scanWebAssets(root);

  await Promise.all(REQUIRED_FILES.map(relativePath => assertRegularContainedFile(root, relativePath)));
  invariant(REQUIRED_FILES.every(relativePath => !relativePath.startsWith('functions/')),
    'architecture checks must target canonical source, not generated Functions');

  const router = await readRepositoryFile(root, 'web/src/app/router.jsx');
  invariant(/<Route\s+path=['"]\/geospatial['"]\s+element=/u.test(router), '/geospatial route is not declared');
  const geospatialPage = await readRepositoryFile(root, 'web/src/features/geospatial/GeospatialPage.jsx');
  invariant(/lazy\(\(\)\s*=>\s*import\(['"]\.\/GeospatialStudio\.jsx['"]\)\)/u.test(geospatialPage),
    'Geospatial Studio must remain lazy-loaded');

  const canvas = await readRepositoryFile(root, 'web/src/features/geospatial/MapCanvas.jsx');
  invariant(/import\s*\{\s*Protocol\s*\}\s*from\s*['"]pmtiles['"]/u.test(canvas), 'PMTiles Protocol import is missing');
  invariant(/Symbol\.for\(['"]ksp\.geospatial\.pmtiles-protocol['"]\)/u.test(canvas), 'PMTiles singleton guard is missing');
  invariant(/addProtocol\(['"]pmtiles['"]\s*,/u.test(canvas), 'pmtiles:// protocol registration is missing');

  const migrationContract = validatePublicationMigration({ schema, migration, migrationState, after });
  const tables = new Set(schema.tables?.map(table => table.name));
  invariant(tables.has('CFG_MapView') && tables.has('CFG_MapViewVersion'), 'map-view schema is incomplete');

  invariant(repository.scripts?.['web:build']?.includes('npm run web:bundle:check'), 'web build does not enforce bundle budgets');
  const budgetModule = await import(pathToFileURL(await assertRegularContainedFile(root, 'scripts/ci/check-web-bundle.mjs')).href);
  invariant(budgetModule.BUDGETS?.mainGzip <= 100 * 1024, 'main bundle budget is too large');
  invariant(budgetModule.BUDGETS?.studioGzip <= 100 * 1024, 'Studio bundle budget is too large');
  invariant(budgetModule.BUDGETS?.chunkGzip <= 300 * 1024, 'chunk bundle budget is too large');

  const buildModule = await import(pathToFileURL(await assertRegularContainedFile(root, 'scripts/catalyst/build-functions.mjs')).href);
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
    schemaTableCount: migrationContract.schemaTableCount,
    requiredFilesChecked: REQUIRED_FILES.length,
    bundleBudgetWired: true,
    generatedFunctionPathsChecked: 0,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await verifyGeospatial();
  console.log('PASS: governed geospatial core is structurally complete.');
}
