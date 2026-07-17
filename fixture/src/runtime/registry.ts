type Entry = (...args: never[]) => unknown;

const entries = new Map<string, Entry>();

export function publish(key: string, entry: Entry): void {
  entries.set(key, entry);
}

export function read<T extends Entry>(key: string): T {
  const entry = entries.get(key);
  if (!entry) throw new Error(`Missing runtime entry: ${key}`);
  return entry as T;
}
