import { read } from "../runtime/registry.ts";

export function retrySummary(cents: number): string {
  const identity = read<() => string>("retry:identity");
  const display = read<(value: number) => string>("retry:display");
  return `${identity()} retry: ${display(cents)}`;
}
