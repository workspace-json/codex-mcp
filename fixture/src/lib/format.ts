import { publish } from "../runtime/registry.ts";

publish("retry:display", (cents: number) => `$${(cents / 100).toFixed(2)}`);
