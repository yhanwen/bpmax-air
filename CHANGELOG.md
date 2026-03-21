# Changelog

All notable changes to this project will be documented in this file.

## 0.3.0

- Added software project management blueprint, forms, seeded task examples, and staged task-instance submissions
- Added staged task-instance assignee handoff based on task fields and stricter stage transition validation
- Fixed rollback task seeding to deduplicate within the current phase instead of across the whole project
- Fixed staged task completion so direct-complete work items still finish correctly when they never enter review
- Added release workflow support for publishing `@bpair/cli` to npm during tagged releases

## 0.2.0

- Added project-scoped parallel `task-instance` runtime model
- Added task orchestration on flow steps, including template seeding and table-driven batch task creation
- Added aggregate transition conditions for task-instance completion and blocking state
- Added `task-instance` CLI commands for create, batch-create, list, get, and submit
- Updated runtime explain output, docs, and `bpair-skill` guidance for the two-layer project workflow model

## 0.1.0

- Initial public MVP release
- Added AI-first flow and form DSL
- Added SQLite-backed runtime engine
- Added `bpair` CLI, HTTP server, and SDK
- Added Codex-oriented skill assets and blueprint generator
