# BPMax-Air

[![CI](https://github.com/yhanwen/bpmax-air/actions/workflows/ci.yml/badge.svg)](https://github.com/yhanwen/bpmax-air/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/yhanwen/bpmax-air)](https://github.com/yhanwen/bpmax-air/releases/latest)
[![npm](https://img.shields.io/npm/v/%40bpair%2Fcli)](https://www.npmjs.com/package/@bpair/cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](./package.json)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](./package.json)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GitHub stars](https://img.shields.io/github/stars/yhanwen/bpmax-air?style=social)](https://github.com/yhanwen/bpmax-air/stargazers)

BPMax-Air is an AI-first headless BPM engine for teams that want workflow runtime, form templates, and automation-friendly transport layers without coupling the core model to a visual designer.

It is designed around a small set of stable JSON contracts so the same workflow objects can be used by:

- CLI automation
- HTTP integrations
- SDK consumers
- generic skills and agent workflows

## Highlights

- AI-friendly flow DSL in JSON/YAML
- JSON-based form template model with revisioning
- Headless runtime with project, task, audit, and event concepts
- Project-level parallel `task-instance` model for software delivery and stage-gate workflows
- SQLite-first persistence with room for future Postgres support
- Stable JSON CLI output for agents and scripts
- HTTP API and TypeScript SDK on top of the same core engine
- Generic skill assets and blueprint generator for semi-automated scaffolding

## Quick Start

Requirements:

- Node.js 22+
- pnpm 10+ for repository development

Repository setup and verification:

```bash
pnpm install
pnpm check
```

Published CLI quick start:

```bash
npx -y @bpair/cli --db ./demo.db flow list --json
```

Local development entrypoint:

```bash
pnpm dev:cli -- --db ./demo.db flow list --json
```

## NPX Distribution

The CLI is published to npm for clone-free usage:

```bash
npx -y @bpair/cli --db ./demo.db flow list --json
```

To verify the standalone package locally from the repository, generate a tarball:

```bash
pnpm pack:cli
```

Offline CLI tarball assets are also attached to each GitHub Release.

Create forms, flow, and a project:

```bash
npx -y @bpair/cli --db ./demo.db form create --input ./examples/forms/project-intake.json --json
npx -y @bpair/cli --db ./demo.db form create --input ./examples/forms/kickoff.json --json
npx -y @bpair/cli --db ./demo.db flow create --input ./examples/flows/project-delivery.json --json
npx -y @bpair/cli --db ./demo.db flow publish --key project-delivery --json
npx -y @bpair/cli --db ./demo.db project create --flow project-delivery --name "A客户交付" --data ./examples/submissions/project-intake.json --json
```

Run the HTTP server:

```bash
BPAIR_DB=./demo.db pnpm dev:server
```

Generate flow/form JSON from a blueprint:

```bash
pnpm gen:blueprint --input ./examples/ai/project-delivery.blueprint.yaml --out-dir ./tmp/generated-blueprint
```

## Repository Structure

- `packages/shared`: public schemas, errors, and JSON result envelope
- `packages/core`: engine, state machine, template validation, runtime logic
- `packages/storage-sqlite`: SQLite-backed repository implementation
- `packages/storage-postgres`: placeholder package for future Postgres repository
- `packages/cli`: `bpair` CLI
- `packages/server`: Express-based HTTP API
- `packages/sdk`: TypeScript client
- `docs`: CLI, skill, and architecture documentation
- `examples`: forms, flows, submissions, AI blueprints, and prompts
- `tools`: local generators and repository tooling
- `tests`: runtime and end-to-end style tests

## Core Concepts

- `FormTemplate`: schema, layout, behavior, revision
- `FlowTemplate`: steps, transitions, policies, triggers, revision
- `Project`: runtime instance of a flow
- `Task`: step-specific work item with draft and submit lifecycle
- `TaskInstance`: project-scoped parallel task object with its own status, assignees, and audit trail
- `Event`: runtime event trail
- `Artifact`: external references such as subflow links

## CLI Example

```bash
npx -y @bpair/cli form create --input ./form.json --json
npx -y @bpair/cli flow create --input ./flow.json --json
npx -y @bpair/cli project create --flow project-delivery --name "Project A" --data ./create.json --json
npx -y @bpair/cli task submit --task t_123 --action approve --data ./submit.json --json
npx -y @bpair/cli task-instance list --project p_123 --json
npx -y @bpair/cli task-instance submit --id ti_123 --action complete --data ./task-instance-submit.json --json
npx -y @bpair/cli runtime explain --project p_123 --json
```

See [docs/cli.md](./docs/cli.md) for more.

## Parallel Task Model

BPMax-Air now supports a two-layer runtime model:

- main flow steps still control phase entry, review, and release
- project-level `task-instance` records carry day-to-day execution work in parallel
- flow step `taskOrchestration` can create task templates on step entry or seed tasks from table fields
- transition conditions can read task-instance aggregate state such as `all_critical_completed` or `any_blocked`

This is intended for project-delivery style workflows where one project must hold many concurrent tasks without forcing every task into a subflow.

## Skill Integration

Agent-oriented skill assets live under [docs/skills/bpair-skill](./docs/skills/bpair-skill). The skill can be distributed in two ways:

- repository mode via the local installer script
- release mode via the packaged zip asset for `cc-switch` or manual import

Fastest distribution path:

1. Open the latest [GitHub Release](https://github.com/yhanwen/bpmax-air/releases/latest)
2. Download `bpair-skill-v<version>.zip`
3. Import that zip with `cc-switch` where supported, or unzip/import it into the target client's `skills` directory

See:

- [docs/skill-integration.md](./docs/skill-integration.md)
- [docs/skill-distribution.md](./docs/skill-distribution.md)
- [docs/skills/bpair-skill/SKILL.md](./docs/skills/bpair-skill/SKILL.md)

Package the release zip locally:

```bash
pnpm package:skill
```

Install from the repository for different clients:

```bash
./docs/skills/bpair-skill/scripts/install.sh --platform codex
./docs/skills/bpair-skill/scripts/install.sh --platform claude-code
./docs/skills/bpair-skill/scripts/install.sh --platform openclaw
./docs/skills/bpair-skill/scripts/install.sh --platform opencode
```

## Development

Common commands:

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm check
pnpm gen:blueprint --sample
```

## Status

This is an early but working open-source MVP. The runtime, CLI, HTTP API, blueprint generation, and skill scaffolding are implemented. Postgres storage, more advanced permissions, and richer BPM compatibility are still future work.

## License

MIT. See [LICENSE](./LICENSE).
