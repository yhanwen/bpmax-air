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
bpair form create --input ./tmp/generated/forms/project-intake-form.json --json
bpair form create --input ./tmp/generated/forms/kickoff-form.json --json
bpair flow create --input ./tmp/generated/flows/project-delivery.json --json
bpair flow publish --key project-delivery --json
```

## Launch a project

```bash
bpair project create --flow project-delivery --name "A客户交付" --data ./examples/submissions/project-intake.json --json
```

## Save draft on a task

```bash
bpair task draft-save --task t_xxx --data ./examples/submissions/kickoff-approve.json --json
```

## Approve a task and move forward

```bash
bpair task submit --task t_xxx --action approve --data ./examples/submissions/kickoff-approve.json --json
```

## Inspect runtime state

```bash
bpair runtime explain --project p_xxx --json
bpair audit tail --project p_xxx --json
```

## Minimal patch workflow

Read current state first:

```bash
bpair flow get --key project-delivery --json
```

Then patch:

```bash
bpair flow update --key project-delivery --patch /abs/path/patch.json --json
```
