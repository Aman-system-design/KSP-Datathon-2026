const stopWords = new Set(['synthetic', 'test', 'record', 'the', 'a', 'an', 'and', 'or', 'was', 'is', 'after']);

export const tokenize = text => text.toLocaleLowerCase('en-IN').match(/[a-z0-9]+/g)?.filter(token => token.length > 2 && !stopWords.has(token)) ?? [];

export function textSimilarity(left, right) {
  const documents = [tokenize(left), tokenize(right)];
  const vocabulary = [...new Set(documents.flat())];
  const vectors = documents.map(tokens => vocabulary.map(term => {
    const tf = tokens.filter(token => token === term).length / Math.max(1, tokens.length);
    const documentFrequency = documents.filter(document => document.includes(term)).length;
    return tf * (Math.log((documents.length + 1) / (documentFrequency + 1)) + 1);
  }));
  const dot = vectors[0].reduce((sum, value, index) => sum + value * vectors[1][index], 0);
  const norm = vector => Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0));
  return dot / Math.max(Number.EPSILON, norm(vectors[0]) * norm(vectors[1]));
}
