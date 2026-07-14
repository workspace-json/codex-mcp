---
name: release-candidate-review
description: Audit a frozen release candidate and its judge-facing evidence before HAC-124 or final judge-journey review. Use only after an exact commit and packed artifact are frozen to review installation, teardown, metadata, claims, and launch completeness.
---

# Release Candidate Review

Review the exact frozen commit and tarball. Do not repair files during the review;
return reproducible findings for an issue-scoped follow-up.

## Entry gate

Require the release commit, tarball path and hash, package version, claim matrix,
evidence packet, public URLs, and supported-platform wording. If the commit or
artifact is not frozen, return `INCOMPLETE` and stop.

## Review workflow

1. Confirm a clean checkout at the stated commit and verify the tarball hash.
2. Inspect tarball contents and package/version/changelog consistency.
3. Install the tarball in a clean temporary project without rebuilding source.
4. Start the MCP server and inspect tool registration and bounded responses.
5. Install plugin/hook integration, reproduce the supported denial path, and
   confirm the reviewer remains read-only and advisory.
6. Uninstall and enumerate residual files. Confirm unrelated configuration and
   user-owned `workspace.json` remain unchanged.
7. Follow the README quickstart exactly on each claimed supported platform or mark
   untested platforms as unavailable.
8. Cross-check repository, npm, site, video, Devpost, and other supplied links;
   compare their claims with the canonical matrix and evidence packet.
9. Check evidence packet completeness, known limitations, alt text/captions, and
   the under-three-minute judge path.
10. Run the full publish gate and the read-only GPT-5.6 adversarial reviewer.

## Required output

Return:

- Frozen commit, artifact hash, and environment
- Checklist with command, exit code, observed result, and evidence location
- Tarball/install/startup/plugin/hook/uninstall findings
- Metadata, link, claim, video/site/Devpost consistency findings
- Untested platforms and unavailable evidence
- Residual files and known limitations
- Reviewer session and advisory verdict
- Overall `PASS`, `BLOCK`, or `INCOMPLETE`

`PASS` means no blocking issue was found in the reviewed scope; it is not a safety
certification. Do not proceed to HAC-124 with a failed command, missing required
artifact, unsupported claim, unresolved BLOCK, or unexplained residual file.
