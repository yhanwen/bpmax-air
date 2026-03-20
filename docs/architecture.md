# Architecture

## Design Goals

- Keep runtime logic independent from CLI, HTTP, and skill transports
- Make flow and form configuration easy to generate and patch with AI
- Keep public output contracts stable and machine-readable
- Support local-first development with SQLite

## Layering

### 1. Shared

`packages/shared`

- public zod schemas
- stable result envelope
- shared ids, errors, and helpers

### 2. Core

`packages/core`

- flow and form validation
- runtime state transitions
- project and task lifecycle
- audit and event emission

### 3. Storage

`packages/storage-sqlite`

- repository implementation
- persistence schema
- object serialization

### 4. Transports

- `packages/cli`
- `packages/server`
- `packages/sdk`

These packages do not define workflow rules. They only translate between the outside world and the core engine.

## Generation Path

Natural-language or compact workflow descriptions should be normalized into a blueprint, then compiled into final flow and form JSON:

1. user intent
2. `blueprint.yaml`
3. generated `forms/*.json`
4. generated `flows/*.json`
5. `bpair` commands or HTTP calls

This two-step model is easier to patch and review than free-form direct generation.
