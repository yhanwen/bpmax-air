# Contributing

## Development

Requirements:

- Node.js 22+
- pnpm 10+

Install dependencies:

```bash
pnpm install
```

Run checks:

```bash
pnpm build
pnpm test
```

Useful local commands:

```bash
pnpm dev:cli -- --help
pnpm dev:server
pnpm gen:blueprint --sample
```

## Project layout

- `packages/shared`: public schemas and result envelope
- `packages/core`: engine and domain rules
- `packages/storage-sqlite`: SQLite persistence
- `packages/server`: HTTP transport
- `packages/cli`: CLI transport
- `packages/sdk`: TypeScript client
- `docs`: project and skill documentation
- `examples`: sample forms, flows, submissions, and blueprints
- `tools`: repository tooling and generators

## Contribution rules

- Keep changes small and focused.
- Preserve the stable JSON contract for CLI and HTTP outputs.
- Add or update tests when runtime behavior changes.
- Prefer explicit schema evolution over ad hoc shape changes.
- Document new commands or public interfaces in `README.md` and `docs/`.
