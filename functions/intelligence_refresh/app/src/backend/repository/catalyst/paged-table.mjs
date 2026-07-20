import { sanitizeCatalystSdkError } from './sdk-errors.mjs';

function validateBound(value, { name, maximum }) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new RangeError(`${name} must be an integer between 1 and ${maximum}.`);
  }
}

function pageToken(page) {
  const snake = page.next_token ?? null;
  const camel = page.nextToken ?? null;
  if (snake !== null && camel !== null && snake !== camel) throw new TypeError('Catalyst page contains conflicting tokens.');
  const token = snake ?? camel;
  if (token !== null && (typeof token !== 'string' || token.length === 0)) throw new TypeError('Catalyst page token is invalid.');
  if (page.more_records === false) return null;
  if (page.more_records === true && token === null) throw new TypeError('Catalyst page is missing its continuation token.');
  return token;
}

export async function readPagedRows({ table, maxRows = 200, maxPages = 50, nextToken = null }) {
  if (!table || typeof table.getPagedRows !== 'function') throw new TypeError('Catalyst table pagination is required.');
  validateBound(maxRows, { name: 'maxRows', maximum: 200 });
  validateBound(maxPages, { name: 'maxPages', maximum: 100 });
  if (nextToken !== null && (typeof nextToken !== 'string' || nextToken.length === 0)) throw new TypeError('nextToken must be an opaque string.');

  const seenTokens = new Set(nextToken === null ? [] : [nextToken]);
  const rows = [];
  let token = nextToken;
  let pageCount = 0;

  while (pageCount < maxPages) {
    const options = token === null ? { maxRows } : { maxRows, nextToken: token };
    let page;
    try {
      page = await table.getPagedRows(options);
    } catch (error) {
      throw sanitizeCatalystSdkError(error, { operation: 'GET_PAGED_ROWS' });
    }
    if (!page || !Array.isArray(page.data)) throw new TypeError('Catalyst page rows are invalid.');
    rows.push(...page.data.map(row => structuredClone(row)));
    pageCount += 1;
    token = pageToken(page);
    if (token === null) break;
    if (seenTokens.has(token)) throw new Error('Catalyst page token loop detected.');
    seenTokens.add(token);
  }

  return { rows, nextToken: token, pageCount };
}
