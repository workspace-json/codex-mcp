# The `workspace.json` shape it reads

This server reads a tolerant superset of the [workspace.json standard](https://workspacejson.dev). The fields consumed:

| Field | Used for |
| --- | --- |
| `manual.fragileFiles` | fragility signal (accepts `string[]` or `{ path, reason, score, evidence }[]`) |
| `manual.coChangePatterns` | co-change groups (accepts `{ files: [] }[]`, `string[][]`, or adjacency map) |
| `generated.fileIndex` | whether a queried path is indexed |
| `generated.frameworkManifest` | framework context |

> **Provenance note:** the normalizer in `src/services/workspace.ts` is the single place that touches raw file shape. Field names above track the standard's `v0.x` line; if the canonical schema in `@workspacejson/spec` differs, adjust the normalizer only. The rest of the server depends on the normalized model in `src/types.ts`, never the raw file.
