import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BpairEngine } from "@bpair/core";
import { BpairError } from "@bpair/shared";
import { SqliteBpairRepository } from "@bpair/storage-sqlite";
import kickoffForm from "../examples/forms/kickoff.json";
import intakeForm from "../examples/forms/project-intake.json";
import acceptanceForm from "../examples/forms/acceptance-form.json";
import projectIntakeForm from "../examples/forms/project-intake-form.json";
import releaseReadinessForm from "../examples/forms/release-readiness-form.json";
import requirementBaselineForm from "../examples/forms/requirement-baseline-form.json";
import solutionReviewForm from "../examples/forms/solution-review-form.json";
import flow from "../examples/flows/project-delivery.json";
import softwareProjectFlow from "../examples/flows/software-project-management.json";
import acceptanceApprove from "../examples/submissions/acceptance-approve.json";
import releaseReadinessApprove from "../examples/submissions/release-readiness-approve.json";
import requirementBaselineApprove from "../examples/submissions/requirement-baseline-approve.json";
import softwareProjectIntake from "../examples/submissions/software-project-intake.json";
import solutionReviewApprove from "../examples/submissions/solution-review-approve.json";
import taskInstanceDesignComplete from "../examples/submissions/task-instance-design-complete.json";
import taskInstanceSubmitTest from "../examples/submissions/task-instance-submit-test.json";
import taskInstanceTestComplete from "../examples/submissions/task-instance-test-complete.json";
import taskInstanceTestReject from "../examples/submissions/task-instance-test-reject.json";

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

  it("supports software project development tasks with staged assignee handoff", () => {
    const engine = createEngine();
    [
      projectIntakeForm,
      requirementBaselineForm,
      solutionReviewForm,
      releaseReadinessForm,
      acceptanceForm
    ].forEach((formDefinition) => engine.createForm(formDefinition));
    engine.createFlow(softwareProjectFlow);
    engine.publishFlow("software-project-management");

    const project = engine.createProject({
      name: "软件项目流程验证",
      flowKey: "software-project-management",
      createSubmission: softwareProjectIntake
    });

    expect(project.currentStepIds).toEqual(["project_intake"]);
    let currentTask = engine.listTasks(project.id)[0];
    expect(currentTask.assignees).toEqual(["u_pm"]);

    let snapshot = engine.submitTask({
      taskId: currentTask.id,
      action: "approve",
      actorId: "u_pm"
    });
    expect(snapshot.currentStepIds).toEqual(["requirement_review"]);

    currentTask = engine.listTasks(project.id).find((task) => task.status === "pending")!;
    snapshot = engine.submitTask({
      taskId: currentTask.id,
      action: "approve",
      actorId: "u_po",
      submission: requirementBaselineApprove
    });
    expect(snapshot.currentStepIds).toEqual(["solution_design"]);

    currentTask = engine.listTasks(project.id).find((task) => task.status === "pending")!;
    snapshot = engine.submitTask({
      taskId: currentTask.id,
      action: "approve",
      actorId: "u_tl",
      submission: solutionReviewApprove
    });
    expect(snapshot.currentStepIds).toEqual(["development_execution"]);

    const developmentGateTask = engine.listTasks(project.id).find((task) => task.status === "pending")!;
    const developmentInstances = engine.listTaskInstances(project.id).filter((task) => task.phase === "development_execution");
    expect(developmentInstances).toHaveLength(3);

    const criticalTask = developmentInstances.find((task) => task.templateKey === "feature-auth-center");
    if (!criticalTask) {
      throw new Error("Missing seeded critical development task");
    }
    expect(criticalTask.fields.currentStage).toBe("design");
    expect(criticalTask.assignees).toEqual(["u_architect"]);

    expect(() => engine.submitTask({
      taskId: developmentGateTask.id,
      action: "complete",
      actorId: "u_devlead"
    })).toThrowError(BpairError);

    engine.submitTaskInstance({
      id: criticalTask.id,
      action: "start",
      actorId: "u_architect"
    });
    let stagedTask = engine.submitTaskInstance({
      id: criticalTask.id,
      action: "progress",
      actorId: "u_architect",
      data: taskInstanceDesignComplete
    });
    expect(stagedTask.status).toBe("in_progress");
    expect(stagedTask.fields.currentStage).toBe("develop");
    expect(stagedTask.assignees).toEqual(["u_backend_1"]);

    stagedTask = engine.submitTaskInstance({
      id: criticalTask.id,
      action: "submit_review",
      actorId: "u_backend_1",
      data: taskInstanceSubmitTest
    });
    expect(stagedTask.status).toBe("waiting_review");
    expect(stagedTask.fields.currentStage).toBe("test");
    expect(stagedTask.assignees).toEqual(["u_qa_1"]);

    stagedTask = engine.submitTaskInstance({
      id: criticalTask.id,
      action: "reject",
      actorId: "u_qa_1",
      data: taskInstanceTestReject
    });
    expect(stagedTask.status).toBe("in_progress");
    expect(stagedTask.fields.currentStage).toBe("develop");
    expect(stagedTask.assignees).toEqual(["u_backend_1"]);

    engine.submitTaskInstance({
      id: criticalTask.id,
      action: "submit_review",
      actorId: "u_backend_1",
      data: taskInstanceSubmitTest
    });
    stagedTask = engine.submitTaskInstance({
      id: criticalTask.id,
      action: "complete",
      actorId: "u_qa_1",
      data: taskInstanceTestComplete
    });
    expect(stagedTask.status).toBe("completed");
    expect(stagedTask.assignees).toEqual(["u_qa_1"]);

    snapshot = engine.submitTask({
      taskId: developmentGateTask.id,
      action: "complete",
      actorId: "u_devlead"
    });
    expect(snapshot.currentStepIds).toEqual(["testing_validation"]);

    const testingInstances = engine.listTaskInstances(project.id).filter((task) => task.phase === "testing_validation");
    expect(testingInstances).toHaveLength(3);

    const testCriticalKeys = ["test-integration", "test-bug-burn-down"];
    for (const taskInstance of testingInstances.filter((task) => task.templateKey && testCriticalKeys.includes(task.templateKey))) {
      engine.submitTaskInstance({
        id: taskInstance.id,
        action: "complete",
        actorId: "u_qalead",
        data: { result: "done" }
      });
    }

    currentTask = engine.listTasks(project.id).find((task) => task.status === "pending")!;
    snapshot = engine.submitTask({
      taskId: currentTask.id,
      action: "approve",
      actorId: "u_qalead"
    });
    expect(snapshot.currentStepIds).toEqual(["release_preparation"]);

    currentTask = engine.listTasks(project.id).find((task) => task.status === "pending")!;
    snapshot = engine.submitTask({
      taskId: currentTask.id,
      action: "approve",
      actorId: "u_pm",
      submission: releaseReadinessApprove
    });
    expect(snapshot.currentStepIds).toEqual(["go_live_acceptance"]);

    currentTask = engine.listTasks(project.id).find((task) => task.status === "pending")!;
    snapshot = engine.submitTask({
      taskId: currentTask.id,
      action: "approve",
      actorId: "u_biz",
      submission: acceptanceApprove
    });
    expect(snapshot.status).toBe("completed");
  });

  it("does not duplicate seeded development tasks after rollback and reports blocked critical work", () => {
    const engine = createEngine();
    [
      projectIntakeForm,
      requirementBaselineForm,
      solutionReviewForm,
      releaseReadinessForm,
      acceptanceForm
    ].forEach((formDefinition) => engine.createForm(formDefinition));
    engine.createFlow(softwareProjectFlow);
    engine.publishFlow("software-project-management");

    const project = engine.createProject({
      name: "回退与阻塞验证",
      flowKey: "software-project-management",
      createSubmission: softwareProjectIntake
    });

    let currentTask = engine.listTasks(project.id)[0];
    engine.submitTask({ taskId: currentTask.id, action: "approve", actorId: "u_pm" });
    currentTask = engine.listTasks(project.id).find((task) => task.status === "pending")!;
    engine.submitTask({
      taskId: currentTask.id,
      action: "approve",
      actorId: "u_po",
      submission: requirementBaselineApprove
    });
    currentTask = engine.listTasks(project.id).find((task) => task.status === "pending")!;
    engine.submitTask({
      taskId: currentTask.id,
      action: "approve",
      actorId: "u_tl",
      submission: solutionReviewApprove
    });

    const criticalTask = engine.listTaskInstances(project.id).find((task) => task.templateKey === "feature-auth-center")!;
    engine.submitTaskInstance({
      id: criticalTask.id,
      action: "block",
      actorId: "u_architect",
      data: { blockerReason: "等待外部依赖" }
    });

    const runtime = engine.explainRuntime(project.id);
    expect(runtime.taskSummary).toMatchObject({ blocked: 1 });
    expect((runtime.taskSummary as { criticalOpen: number }).criticalOpen).toBeGreaterThanOrEqual(1);

    const developmentGateTask = engine.listTasks(project.id).find((task) => task.status === "pending")!;
    expect(() => engine.submitTask({
      taskId: developmentGateTask.id,
      action: "complete",
      actorId: "u_devlead"
    })).toThrowError(BpairError);

    engine.submitTaskInstance({
      id: criticalTask.id,
      action: "unblock",
      actorId: "u_architect",
      data: taskInstanceDesignComplete
    });
    engine.submitTaskInstance({
      id: criticalTask.id,
      action: "submit_review",
      actorId: "u_backend_1",
      data: taskInstanceSubmitTest
    });
    engine.submitTaskInstance({
      id: criticalTask.id,
      action: "complete",
      actorId: "u_qa_1",
      data: taskInstanceTestComplete
    });

    let snapshot = engine.submitTask({
      taskId: developmentGateTask.id,
      action: "complete",
      actorId: "u_devlead"
    });
    expect(snapshot.currentStepIds).toEqual(["testing_validation"]);

    const beforeRollback = engine.listTaskInstances(project.id).filter((task) => task.phase === "development_execution").length;
    currentTask = engine.listTasks(project.id).find((task) => task.status === "pending")!;
    snapshot = engine.submitTask({
      taskId: currentTask.id,
      action: "reject",
      actorId: "u_qalead"
    });
    expect(snapshot.currentStepIds).toEqual(["development_execution"]);

    const afterRollback = engine.listTaskInstances(project.id).filter((task) => task.phase === "development_execution").length;
    expect(afterRollback).toBe(beforeRollback);
  });

  it("allows direct completion for staged task instances that never enter review", () => {
    const engine = createEngine();
    [
      projectIntakeForm,
      requirementBaselineForm,
      solutionReviewForm,
      releaseReadinessForm,
      acceptanceForm
    ].forEach((formDefinition) => engine.createForm(formDefinition));
    engine.createFlow(softwareProjectFlow);
    engine.publishFlow("software-project-management");

    const project = engine.createProject({
      name: "普通分阶段任务完成验证",
      flowKey: "software-project-management",
      createSubmission: softwareProjectIntake
    });

    let currentTask = engine.listTasks(project.id)[0];
    engine.submitTask({ taskId: currentTask.id, action: "approve", actorId: "u_pm" });
    currentTask = engine.listTasks(project.id).find((task) => task.status === "pending")!;
    engine.submitTask({
      taskId: currentTask.id,
      action: "approve",
      actorId: "u_po",
      submission: requirementBaselineApprove
    });
    currentTask = engine.listTasks(project.id).find((task) => task.status === "pending")!;
    engine.submitTask({
      taskId: currentTask.id,
      action: "approve",
      actorId: "u_tl",
      submission: solutionReviewApprove
    });

    const setupTask = engine.listTaskInstances(project.id).find((task) => task.templateKey === "dev-env-setup");
    if (!setupTask) {
      throw new Error("Missing development setup task");
    }

    const completed = engine.submitTaskInstance({
      id: setupTask.id,
      action: "complete",
      actorId: "u_devlead",
      data: { checklistCompleted: true }
    });

    expect(completed.status).toBe("completed");
    expect(completed.fields.currentStage).toBe("develop");
  });

  it("deduplicates seeded task instances within a phase instead of across the whole project", () => {
    const engine = createEngine();
    engine.createForm(intakeForm);
    engine.createFlow({
      kind: "flow-template",
      version: "v1",
      key: "phase-scoped-dedupe",
      name: "阶段内去重",
      createForm: "project-intake-form",
      entry: "design",
      steps: [
        {
          id: "design",
          type: "step",
          name: "设计阶段",
          assigneeRule: { type: "field", value: "owner" },
          actions: ["approve"],
          taskOrchestration: {
            createOnEnter: [
              {
                key: "shared-task",
                title: "共享任务",
                phase: "design",
                assigneeRule: { type: "field", value: "owner" },
                fields: {}
              }
            ],
            seedFromFields: []
          }
        },
        {
          id: "release",
          type: "step",
          name: "发布阶段",
          assigneeRule: { type: "field", value: "owner" },
          actions: ["complete"],
          taskOrchestration: {
            createOnEnter: [
              {
                key: "shared-task",
                title: "共享任务",
                phase: "release",
                assigneeRule: { type: "field", value: "owner" },
                fields: {}
              }
            ],
            seedFromFields: []
          }
        },
        {
          id: "done",
          type: "end",
          name: "完成"
        }
      ],
      transitions: [
        {
          from: "design",
          action: "approve",
          to: "release"
        },
        {
          from: "release",
          action: "complete",
          to: "done"
        }
      ],
      policies: {},
      triggers: [],
      metadata: {}
    });
    engine.publishFlow("phase-scoped-dedupe");

    const project = engine.createProject({
      name: "阶段内去重验证",
      flowKey: "phase-scoped-dedupe",
      createSubmission: {
        data: {
          projectName: "阶段内去重验证",
          owner: "u_001"
        }
      }
    });

    expect(engine.listTaskInstances(project.id)).toHaveLength(1);

    const designTask = engine.listTasks(project.id)[0];
    engine.submitTask({
      taskId: designTask.id,
      action: "approve",
      actorId: "u_001"
    });

    const taskInstances = engine.listTaskInstances(project.id);
    expect(taskInstances).toHaveLength(2);
    expect(taskInstances.map((task) => task.phase).sort()).toEqual(["design", "release"]);
  });
});
