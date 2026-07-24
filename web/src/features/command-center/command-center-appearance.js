export const COMMAND_CENTER_APPEARANCE_KEY = 'ksp-command-center-appearance';
export const commandCenterAppearances = Object.freeze(['light', 'dark', 'system']);
export function readCommandCenterAppearance(storage = globalThis.localStorage) { const value = storage?.getItem(COMMAND_CENTER_APPEARANCE_KEY); return commandCenterAppearances.includes(value) ? value : 'light'; }
export function resolveCommandCenterAppearance(value, media = globalThis.matchMedia?.('(prefers-color-scheme: dark)')) { return value === 'system' ? (media?.matches ? 'dark' : 'light') : value; }
