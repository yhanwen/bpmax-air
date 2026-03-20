# Prompt Templates

## Create flow from natural language

```text
Use BPMax-Air to create a flow template.
Goal: <what the workflow should achieve>
Flow key: <flow-key>
Flow name: <flow-name>
Steps:
- <step 1>
- <step 2>
- <step 3>
Actions and transitions:
- <from> on <action> goes to <to>
Form requirements:
- create form: <fields>
- step form for <step>: <fields>
Return:
1. a normalized blueprint.yaml
2. the generated flow/form JSON files
3. the exact pnpm gen:blueprint and bpair commands
4. the raw command results
5. a short explanation
```

## Patch flow

```text
Use BPMax-Air to patch an existing flow.
Existing flow key: <flow-key>
Requested change: <change request>
Constraints:
- keep existing step ids when possible
- use a patch, not a full rewrite, unless patching is unsafe
Return:
1. the patch JSON
2. the exact bpair command
3. the raw command result
4. a short explanation of the new path
```

## Launch project and submit first task

```text
Use BPMax-Air to create a project and, if possible, advance the first task.
Flow key: <flow-key>
Project name: <project-name>
Create-form data:
<json or field list>
First task action:
- action: <approve|reject|complete>
- submission data: <json or field list>
Return:
1. the project create command result
2. the task submit command result
3. the final project snapshot
4. a short explanation of the current step
```

## Explain blockers

```text
Use BPMax-Air to explain why a project is blocked.
Project id: <project-id>
Read runtime and audit state first.
Return:
1. raw runtime explain result
2. raw audit tail result
3. a concise explanation of the blocker
4. the next action needed to move the workflow
```
