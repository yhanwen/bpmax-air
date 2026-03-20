import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BpairEngine } from "@bpair/core";
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
});
