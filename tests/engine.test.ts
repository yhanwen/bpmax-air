import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BpairEngine } from "@bpair/core";
import { BpairError } from "@bpair/shared";
import { SqliteBpairRepository } from "@bpair/storage-sqlite";
import kickoffForm from "../examples/forms/kickoff.json";
import intakeForm from "../examples/forms/project-intake.json";
import flow from "../examples/flows/project-delivery.json";

const workdirs: string[] = [];

function createEngine() {
  const dir = mkdtempSync(join(tmpdir(), "bpair-"));
  workdirs.push(dir);
  return new BpairEngine({
    repository: new SqliteBpairRepository({
      databasePath: join(dir, "test.db")
    })
  });
}

afterEach(() => {
  while (workdirs.length > 0) {
    rmSync(workdirs.pop()!, { recursive: true, force: true });
  }
});

describe("BpairEngine", () => {
  it("creates templates and advances a project to completion", () => {
    const engine = createEngine();
    engine.createForm(intakeForm);
    engine.createForm(kickoffForm);
    engine.createFlow(flow);
    engine.publishFlow("project-delivery");

    const project = engine.createProject({
      name: "测试项目",
      flowKey: "project-delivery",
      createSubmission: {
        data: {
          projectName: "测试项目",
          owner: "u_001"
        }
      }
    });

    expect(project.status).toBe("processing");
    expect(project.currentStepIds).toEqual(["kickoff"]);

    const kickoffTask = engine.listTasks(project.id)[0];
    const afterApprove = engine.submitTask({
      taskId: kickoffTask.id,
      action: "approve",
      actorId: "u_pm",
      submission: {
        data: {
          scopeConfirmed: true,
          riskLevel: "low"
        }
      }
    });

    expect(afterApprove.currentStepIds).toEqual(["delivery"]);

    const deliveryTask = engine.listTasks(project.id).find((task) => task.status === "pending");
    expect(deliveryTask?.assignees).toEqual(["u_001"]);

    const completed = engine.submitTask({
      taskId: deliveryTask!.id,
      action: "complete",
      actorId: "u_001"
    });

    expect(completed.status).toBe("completed");
    expect(engine.auditTail(10, project.id).length).toBeGreaterThan(0);
  });

  it("supports draft save without moving state", () => {
    const engine = createEngine();
    engine.createForm(intakeForm);
    engine.createForm(kickoffForm);
    engine.createFlow(flow);

    const project = engine.createProject({
      name: "草稿测试",
      flowKey: "project-delivery",
      createSubmission: {
        data: {
          projectName: "草稿测试",
          owner: "u_002"
        }
      }
    });

    const task = engine.listTasks(project.id)[0];
    engine.saveTaskDraft(task.id, {
      data: {
        scopeConfirmed: true,
        riskLevel: "high"
      }
    });

    const current = engine.getProject(project.id);
    expect(current.currentStepIds).toEqual(["kickoff"]);
    expect(engine.getTask(task.id).draftSubmission?.data.riskLevel).toBe("high");
  });

  it("supports parallel task instances and stage-gate conditions", () => {
    const engine = createEngine();
    engine.createForm({
      kind: "form-template",
      version: "v1",
      key: "software-project-intake",
      name: "软件项目立项",
      schema: {
        fields: [
          { key: "projectName", type: "text", label: "项目名称", required: true },
          { key: "pm", type: "user", label: "项目经理", required: true },
          { key: "executionTasks", type: "table", label: "执行任务清单", required: true }
        ]
      },
      layout: { groups: [] },
      behavior: { computed: [], draftable: true },
      metadata: {}
    });
    engine.createForm({
      kind: "form-template",
      version: "v1",
      key: "stage-review-form",
      name: "阶段评审",
      schema: {
        fields: [
          { key: "reviewResult", type: "select", label: "评审结果", required: true, options: [{ label: "通过", value: "approved" }] }
        ]
      },
      layout: { groups: [] },
      behavior: { computed: [], draftable: true },
      metadata: {}
    });
    engine.createFlow({
      kind: "flow-template",
      version: "v1",
      key: "software-project-flow",
      name: "软件项目主流程",
      createForm: "software-project-intake",
      entry: "execution",
      steps: [
        {
          id: "execution",
          type: "step",
          name: "执行阶段评审",
          taskForm: "stage-review-form",
          assigneeRule: { type: "field", value: "pm" },
          actions: ["approve"],
          taskOrchestration: {
            seedFromFields: [
              {
                field: "executionTasks",
                titleField: "title",
                phaseField: "phase",
                assigneeField: "assignee",
                criticalField: "isCritical",
                defaultFields: {}
              }
            ]
          }
        },
        {
          id: "delivery",
          type: "step",
          name: "交付阶段",
          assigneeRule: { type: "field", value: "pm" },
          actions: ["complete"]
        },
        {
          id: "done",
          type: "end",
          name: "完成"
        }
      ],
      transitions: [
        {
          from: "execution",
          action: "approve",
          to: "delivery",
          condition: {
            source: "task_instance",
            field: "taskSummary",
            metric: "all_critical_completed",
            op: "eq",
            value: true,
            filters: {
              phase: "execution"
            }
          }
        },
        {
          from: "delivery",
          action: "complete",
          to: "done"
        }
      ],
      policies: {},
      triggers: [],
      metadata: {}
    });
    engine.publishFlow("software-project-flow");

    const project = engine.createProject({
      name: "并行任务项目",
      flowKey: "software-project-flow",
      createSubmission: {
        data: {
          projectName: "并行任务项目",
          pm: "u_pm",
          executionTasks: [
            { title: "开发接口", phase: "execution", assignee: "u_dev", isCritical: true },
            { title: "编写测试", phase: "execution", assignee: "u_qa", isCritical: false }
          ]
        }
      }
    });

    expect(project.currentStepIds).toEqual(["execution"]);
    expect(project.taskSummary.total).toBe(2);
    expect(project.taskSummary.criticalOpen).toBe(1);

    const taskInstances = engine.listTaskInstances(project.id);
    expect(taskInstances).toHaveLength(2);
    expect(taskInstances.map((task) => task.assignees[0]).sort()).toEqual(["u_dev", "u_qa"]);

    const stageGateTask = engine.listTasks(project.id)[0];
    expect(() => engine.submitTask({
      taskId: stageGateTask.id,
      action: "approve",
      actorId: "u_pm",
      submission: { data: { reviewResult: "approved" } }
    })).toThrowError(BpairError);

    const criticalTask = taskInstances.find((task) => Boolean(task.fields.isCritical));
    const normalTask = taskInstances.find((task) => !Boolean(task.fields.isCritical));
    engine.submitTaskInstance({ id: criticalTask!.id, action: "start", actorId: "u_dev" });
    engine.submitTaskInstance({ id: criticalTask!.id, action: "complete", actorId: "u_dev", data: { result: "done" } });
    engine.submitTaskInstance({ id: normalTask!.id, action: "block", actorId: "u_qa", data: { reason: "waiting api" } });

    const afterBlocked = engine.getProject(project.id);
    expect(afterBlocked.taskSummary.blocked).toBe(1);
    expect(afterBlocked.taskSummary.criticalCompleted).toBe(1);

    const releasedNormalTask = engine.submitTaskInstance({ id: normalTask!.id, action: "unblock", actorId: "u_qa" });
    expect(releasedNormalTask.status).toBe("in_progress");

    const afterApprove = engine.submitTask({
      taskId: stageGateTask.id,
      action: "approve",
      actorId: "u_pm",
      submission: { data: { reviewResult: "approved" } }
    });

    expect(afterApprove.currentStepIds).toEqual(["delivery"]);
    expect(afterApprove.taskSummary.total).toBe(2);
  });
});
