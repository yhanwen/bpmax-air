# Examples

This directory contains reference assets for local development, tests, and skill workflows.

- `forms/`: reusable form templates
- `flows/`: reusable flow templates
- `submissions/`: create and task submission payloads
- `ai/`: blueprint examples and agent-oriented prompt assets

Typical flow:

1. generate or edit a blueprint
2. compile it with `pnpm gen:blueprint`
3. create forms and flows with `bpair`
4. create a project instance
5. save drafts or submit tasks

Added software project management reference assets:

- `ai/software-project-management.blueprint.yaml`: full lifecycle software project blueprint
- `flows/software-project-management.json`: generated main flow with stage gates and task orchestration
- `forms/*-form.json`: project intake, requirement baseline, solution review, release readiness, and acceptance forms
- `submissions/software-project-intake.json`: sample project creation payload with seeded development tasks
- `submissions/task-instance-*.json`: sample payloads for design -> develop -> test task progression
