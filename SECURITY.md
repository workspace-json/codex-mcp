# Security Policy

## Supported versions

Only the latest published version of `@workspacejson/codex-mcp` receives security updates.

## Reporting a vulnerability

Please report security issues privately to the maintainers at the contact address on <https://workspacejson.dev>. Do not open public issues for vulnerabilities.

## Scope

This package runs locally over stdio and does not transmit repository contents over the network. Vulnerabilities of interest include: unsafe handling of workspace.json contents, path traversal, and anything that could allow the hook to block or allow edits outside the intended policy.

## Disclosure

We will acknowledge receipt within 5 business days and aim to release a fix or advisory within 30 days.
