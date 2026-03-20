# Skill Distribution

BPMax-Air ships a universal skill package for SKILL.md-compatible clients.

## Recommended path

Use the release zip from the GitHub Releases page and install it with `cc-switch` where supported.

- Releases: `https://github.com/yhanwen/bpmax-air/releases`
- Skill asset name: `bpair-skill-v<version>.zip`

This path is the cleanest option when you are not developing inside the repository.

Typical flow:

1. download the latest `bpair-skill-v<version>.zip`
2. import it with `cc-switch`, or unzip it into the target client's `skills` directory

## Supported clients

- Codex
- Claude Code
- OpenClaw
- OpenCode

The release zip contains a single top-level directory:

```text
bpair-skill/
```

Inside it:

- `SKILL.md`
- `references/`
- `scripts/`
- `evals/`
- `skill-package.json`

## Repository packaging

Build the release zip locally:

```bash
pnpm package:skill
```

Output:

```text
.artifacts/releases/bpair-skill-v<version>.zip
```

## Local installer

When working from the repository, the installer script can link or copy the skill into a target client directory:

```bash
./docs/skills/bpair-skill/scripts/install.sh --platform codex
./docs/skills/bpair-skill/scripts/install.sh --platform claude-code
./docs/skills/bpair-skill/scripts/install.sh --platform openclaw
./docs/skills/bpair-skill/scripts/install.sh --platform opencode
```

Override the destination when needed:

```bash
./docs/skills/bpair-skill/scripts/install.sh --target-dir /abs/path/to/skills --copy
```

## Release automation

The repository includes a `Release` GitHub Actions workflow that:

1. validates the repository
2. packages the npm CLI tarball
3. packages the skill zip
4. uploads both assets to a GitHub Release

Trigger it by pushing a tag like `v0.1.0` or by running the workflow manually.
