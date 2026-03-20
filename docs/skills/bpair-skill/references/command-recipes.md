# Command Recipes

## Create a project delivery flow

1. Write a blueprint file.
2. Compile the blueprint.
3. Create forms.
4. Create flow.
5. Publish flow.

```bash
pnpm gen:blueprint --input ./docs/skills/bpair-skill/references/blueprint-template.yaml --out-dir ./tmp/generated
```

```bash
npx -y @bpair/cli form create --input ./tmp/generated/forms/project-intake-form.json --json
npx -y @bpair/cli form create --input ./tmp/generated/forms/kickoff-form.json --json
npx -y @bpair/cli flow create --input ./tmp/generated/flows/project-delivery.json --json
npx -y @bpair/cli flow publish --key project-delivery --json
```

## Launch a project

```bash
npx -y @bpair/cli project create --flow project-delivery --name "A客户交付" --data ./examples/submissions/project-intake.json --json
```

## Save draft on a task

```bash
npx -y @bpair/cli task draft-save --task t_xxx --data ./examples/submissions/kickoff-approve.json --json
```

## Approve a task and move forward

```bash
npx -y @bpair/cli task submit --task t_xxx --action approve --data ./examples/submissions/kickoff-approve.json --json
```

## Inspect runtime state

```bash
npx -y @bpair/cli runtime explain --project p_xxx --json
npx -y @bpair/cli audit tail --project p_xxx --json
```

## Minimal patch workflow

Read current state first:

```bash
npx -y @bpair/cli flow get --key project-delivery --json
```

Then patch:

```bash
npx -y @bpair/cli flow update --key project-delivery --patch /abs/path/patch.json --json
```
