export function demonstrationLabel(value) {
  return typeof value === 'string' ? value.replace(/^Synthetic\s+/iu, '').trim() : value;
}
