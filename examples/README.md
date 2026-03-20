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
