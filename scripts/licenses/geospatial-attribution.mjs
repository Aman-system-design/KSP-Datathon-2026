import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const governedRoots = [
  '@deck.gl/aggregation-layers',
  '@deck.gl/core',
  '@deck.gl/geo-layers',
  '@deck.gl/layers',
  '@deck.gl/mapbox',
  'h3-js',
  'maplibre-gl',
  'pmtiles',
  'supercluster',
];
const licenseFilePattern = /^(?:licen[cs]e|notice)(?:[._-].*)?$/i;
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const lockfilePath = resolve(repositoryRoot, 'package-lock.json');
const outputPath = resolve(repositoryRoot, 'web/public/third-party-licenses.txt');
const fallbackDirectory = resolve(repositoryRoot, 'legal/geospatial-license-fallbacks');
const fallbackManifestPath = resolve(fallbackDirectory, 'manifest.json');

function installedDirectory(lockPath) {
  return resolve(repositoryRoot, ...lockPath.split('/'));
}

async function isInstalled(lockPath) {
  try {
    await readFile(resolve(installedDirectory(lockPath), 'package.json'), 'utf8');
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function resolveDependency(packages, parentPath, name, installed) {
  const candidates = [`${parentPath}/node_modules/${name}`];
  let ancestor = parentPath;
  while (ancestor.includes('/node_modules/')) {
    ancestor = ancestor.slice(0, ancestor.lastIndexOf('/node_modules/'));
    candidates.push(`${ancestor}/node_modules/${name}`);
  }
  candidates.push(`node_modules/${name}`);

  for (const candidate of new Set(candidates)) {
    const entry = packages[candidate];
    if (entry && entry.dev !== true && entry.link !== true && await installed(candidate)) return candidate;
  }
  return undefined;
}

export async function productionClosure(packages, roots = governedRoots, installed = isInstalled) {
  const queue = roots.map(name => `node_modules/${name}`);
  const visited = new Set();

  while (queue.length > 0) {
    const lockPath = queue.shift();
    if (visited.has(lockPath)) continue;
    const entry = packages[lockPath];
    if (!entry || entry.dev === true || entry.link === true || !await installed(lockPath)) {
      throw new Error(`Governed production package is missing: ${lockPath}`);
    }
    visited.add(lockPath);

    const dependencyNames = new Set(Object.keys(entry.dependencies ?? {}));
    const requiredPeerNames = Object.keys(entry.peerDependencies ?? {})
      .filter(name => entry.peerDependenciesMeta?.[name]?.optional !== true);
    const names = [...new Set([...dependencyNames, ...requiredPeerNames])].sort();
    for (const name of names) {
      const dependencyPath = await resolveDependency(packages, lockPath, name, installed);
      if (dependencyPath) queue.push(dependencyPath);
      else if (dependencyNames.has(name)) throw new Error(`Required production dependency is missing: ${lockPath} -> ${name}`);
    }
  }

  return [...visited];
}

export async function readPackageLicenseFiles(directory, packageKey, fallback) {
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter(file => file.isFile() && licenseFilePattern.test(file.name))
    .map(file => file.name)
    .sort((left, right) => left.localeCompare(right));
  if (files.length > 0) {
    return {
      files: await Promise.all(files.map(async file => ({ file, text: await readFile(resolve(directory, file), 'utf8') }))),
      usedFallback: false,
    };
  }
  if (!fallback) throw new Error(`Missing LICENSE/NOTICE text for ${packageKey}`);
  if (!/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[0-9a-f]{40}\//.test(fallback.source)) {
    throw new Error(`Fallback source is not pinned to a commit for ${packageKey}`);
  }
  if (!/^[0-9a-f]{64}$/.test(fallback.sha256)) throw new Error(`Invalid fallback SHA-256 for ${packageKey}`);

  const fallbackPath = resolve(fallbackDirectory, fallback.file);
  if (dirname(fallbackPath) !== fallbackDirectory) throw new Error(`Invalid fallback path for ${packageKey}`);
  const text = (await readFile(fallbackPath, 'utf8')).replace(/\r\n/g, '\n');
  const sha256 = createHash('sha256').update(text).digest('hex');
  if (sha256 !== fallback.sha256) throw new Error(`Fallback SHA-256 mismatch for ${packageKey}`);
  return {
    files: [{ file: `${fallback.file} (audited fallback from ${fallback.source})`, text }],
    usedFallback: true,
  };
}

async function packageNotice(packages, lockPath, fallbacks, usedFallbacks) {
  const entry = packages[lockPath];
  if (!entry.version || !entry.resolved || !entry.integrity) {
    throw new Error(`Incomplete registry metadata for ${lockPath}`);
  }
  if (!entry.resolved.startsWith('https://registry.npmjs.org/')) {
    throw new Error(`Non-registry third-party source for ${lockPath}: ${entry.resolved}`);
  }

  const directory = installedDirectory(lockPath);
  const manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
  if (manifest.private === true || !manifest.name) {
    throw new Error(`Private or unnamed package cannot enter attribution: ${lockPath}`);
  }
  const packageKey = `${manifest.name}@${entry.version}`;
  const fallback = fallbacks[packageKey];
  const licenseFiles = await readPackageLicenseFiles(directory, packageKey, fallback);
  if (licenseFiles.usedFallback) usedFallbacks.add(packageKey);

  const texts = [];
  for (const file of licenseFiles.files) {
    const text = file.text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trimEnd();
    if (!text) throw new Error(`Empty ${file.file} for ${packageKey}`);
    texts.push(`----- BEGIN ${file.file} -----\n${text}\n----- END ${file.file} -----`);
  }

  return {
    key: `${manifest.name}@${entry.version}|${entry.resolved}`,
    text: [
      `Package: ${manifest.name}`,
      `Version: ${entry.version}`,
      `Source: ${entry.resolved}`,
      `License metadata: ${entry.license ?? manifest.license ?? 'unspecified'}`,
      '',
      ...texts,
    ].join('\n'),
  };
}

export async function generateGeospatialAttribution() {
  const lockfile = JSON.parse(await readFile(lockfilePath, 'utf8'));
  const fallbacks = JSON.parse(await readFile(fallbackManifestPath, 'utf8'));
  const usedFallbacks = new Set();
  const lockPaths = await productionClosure(lockfile.packages);
  const results = await Promise.allSettled(lockPaths.map(
    lockPath => packageNotice(lockfile.packages, lockPath, fallbacks, usedFallbacks),
  ));
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length > 0) throw new AggregateError(failures.map(result => result.reason), 'Attribution generation failed');
  const notices = results.map(result => result.value);
  const unusedFallbacks = Object.keys(fallbacks).filter(key => !usedFallbacks.has(key));
  if (unusedFallbacks.length > 0) throw new Error(`Unused license fallbacks: ${unusedFallbacks.join(', ')}`);
  const unique = new Map(notices.map(notice => [notice.key, notice.text]));
  const sections = [...unique.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, text]) => text);
  return [
    'Slate Geospatial Third-Party License Notices',
    '',
    'Generated from package-lock.json and installed production package LICENSE/NOTICE files.',
    'Closure includes governed roots, required dependencies, and installed non-optional peers; optional dependencies and peerOptional packages are re-evaluated when activated.',
    'Regenerate with: node scripts/licenses/geospatial-attribution.mjs',
    '',
    sections.join('\n\n================================================================================\n\n'),
    '',
  ].join('\n');
}

async function runCli() {
  const unexpected = process.argv.slice(2).filter(argument => argument !== '--check');
  if (unexpected.length > 0) throw new Error(`Unknown argument: ${unexpected[0]}`);
  const generated = await generateGeospatialAttribution();

  if (process.argv.includes('--check')) {
    let committed;
    try {
      committed = await readFile(outputPath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error(`Attribution artifact is missing: ${outputPath}`);
      throw error;
    }
    if (committed !== generated) throw new Error('Geospatial attribution artifact is stale; regenerate it');
    console.log('PASS: geospatial attribution artifact is current');
    return;
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, generated, 'utf8');
  console.log(`PASS: wrote geospatial attribution artifact to ${outputPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
