# BPMax-Air

[![CI](https://github.com/yhanwen/bpmax-air/actions/workflows/ci.yml/badge.svg)](https://github.com/yhanwen/bpmax-air/actions/workflows/ci.yml)
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
- SQLite-first persistence with room for future Postgres support
- Stable JSON CLI output for agents and scripts
- HTTP API and TypeScript SDK on top of the same core engine
- Generic skill assets and blueprint generator for semi-automated scaffolding

## Quick Start

Requirements:

- Node.js 22+
- pnpm 10+

Install and verify:

```bash
pnpm install
pnpm check
```

Create forms, flow, and a project:

```bash
pnpm dev:cli -- --db ./demo.db form create --input ./examples/forms/project-intake.json --json
pnpm dev:cli -- --db ./demo.db form create --input ./examples/forms/kickoff.json --json
pnpm dev:cli -- --db ./demo.db flow create --input ./examples/flows/project-delivery.json --json
pnpm dev:cli -- --db ./demo.db flow publish --key project-delivery --json
pnpm dev:cli -- --db ./demo.db project create --flow project-delivery --name "A客户交付" --data ./examples/submissions/project-intake.json --json
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
- `Event`: runtime event trail
- `Artifact`: external references such as subflow links

## CLI Example

```bash
bpair form create --input ./form.json --json
bpair flow create --input ./flow.json --json
bpair project create --flow project-delivery --name "Project A" --data ./create.json --json
bpair task submit --task t_123 --action approve --data ./submit.json --json
bpair runtime explain --project p_123 --json
```

See [docs/cli.md](./docs/cli.md) for more.

## Skill Integration

Agent-oriented skill assets live under [docs/skills/bpair-skill](./docs/skills/bpair-skill). The primary local skill is installed via symlink so edits in this repository update the live skill immediately.

See:

- [docs/skill-integration.md](./docs/skill-integration.md)
- [docs/skills/bpair-skill/SKILL.md](./docs/skills/bpair-skill/SKILL.md)

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

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yhanwen/bpmax-air&type=Date)](https://www.star-history.com/#yhanwen/bpmax-air&Date)

## License

MIT. See [LICENSE](./LICENSE).
