# Codex BPMax-Air Examples

## Example 1

User prompt:

```text
帮我创建一个采购审批流程：申请、主管审批、财务付款。申请和付款环节都要表单。最后直接给我可执行的 bpair 命令。
```

Expected skill behavior:

- generate 1 flow JSON
- generate 2 form JSON files
- return `bpair form create`
- return `bpair flow create`
- return `bpair flow publish`

## Example 2

User prompt:

```text
把 project-delivery 的 kickoff 通过后，先加一个法务审批，再进入 delivery，尽量用 patch。
```

Expected skill behavior:

- read current flow
- generate a patch file
- call `bpair flow update --key project-delivery --patch ... --json`

## Example 3

User prompt:

```text
查看项目 p_17a9ad44b175 的当前状态，并解释为什么它还没结束。
```

Expected skill behavior:

- call `bpair project get`
- call `bpair runtime explain`
- optionally call `bpair audit tail`
- return raw JSON plus a short explanation
