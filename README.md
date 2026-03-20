# BPMax-Air

BPMax-Air is an AI-first headless BPM engine for teams that want workflow runtime, form templates, and automation-friendly transport layers without coupling the core model to a visual designer.

It is designed around a small set of stable JSON contracts so the same workflow objects can be used by:

- CLI automation
- HTTP integrations
- SDK consumers
- Codex-style skills and agent workflows

## Highlights

- AI-friendly flow DSL in JSON/YAML
- JSON-based form template model with revisioning
- Headless runtime with project, task, audit, and event concepts
- SQLite-first persistence with room for future Postgres support
- Stable JSON CLI output for agents and scripts
- HTTP API and TypeScript SDK on top of the same core engine
- Codex skill assets and blueprint generator for semi-automated scaffolding

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

See [docs/cli.md](/Users/yanghanwen/Development/Cicada/bpmax-air/docs/cli.md) for more.

## Skill Integration

Codex-oriented skill assets live under [docs/skills/codex-bpair](/Users/yanghanwen/Development/Cicada/bpmax-air/docs/skills/codex-bpair). The skill is installed locally via symlink so edits in this repository update the live skill immediately.

See:

- [docs/skill-integration.md](/Users/yanghanwen/Development/Cicada/bpmax-air/docs/skill-integration.md)
- [docs/skills/codex-bpair/SKILL.md](/Users/yanghanwen/Development/Cicada/bpmax-air/docs/skills/codex-bpair/SKILL.md)

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

MIT. See [LICENSE](/Users/yanghanwen/Development/Cicada/bpmax-air/LICENSE).
