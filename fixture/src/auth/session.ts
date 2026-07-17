import { publish } from "../runtime/registry.ts";

publish("retry:identity", () => "member");
