import {
  actionTypeSchema,
  applyDefaultsToSubmission,
  BpairError,
  deepMerge,
  evaluateCondition,
  flowSchemaV1Schema,
  formSchemaV1Schema,
  formSubmissionSchema,
  makeId,
  nowIso,
  type ActionType,
  type EventRecord,
  type FlowSchemaV1,
  type FlowStep,
  type FormSchemaV1,
  type FormSubmission,
  type ProjectSnapshotV1,
  type TaskSnapshotV1
} from "@bpair/shared";

export type TemplateStatus = "draft" | "published";

export interface TemplateRecord<T> {
  key: string;
  revision: number;
  status: TemplateStatus;
  definition: T;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactRecord {
  id: string;
  projectId: string;
  type: string;
  ref: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Repository {
  saveFormTemplate(record: TemplateRecord<FormSchemaV1>): TemplateRecord<FormSchemaV1>;
  getFormTemplate(key: string, revision?: number): TemplateRecord<FormSchemaV1> | null;
  listFormTemplates(): TemplateRecord<FormSchemaV1>[];
  saveFlowTemplate(record: TemplateRecord<FlowSchemaV1>): TemplateRecord<FlowSchemaV1>;
  getFlowTemplate(key: string, revision?: number): TemplateRecord<FlowSchemaV1> | null;
  listFlowTemplates(): TemplateRecord<FlowSchemaV1>[];
  saveProject(project: ProjectSnapshotV1): ProjectSnapshotV1;
  getProject(projectId: string): ProjectSnapshotV1 | null;
  listProjects(): ProjectSnapshotV1[];
  saveTask(task: TaskSnapshotV1): TaskSnapshotV1;
  getTask(taskId: string): TaskSnapshotV1 | null;
  listTasks(filter?: { projectId?: string; status?: string }): TaskSnapshotV1[];
  appendEvent(event: EventRecord): EventRecord;
  listEvents(filter?: { projectId?: string; taskId?: string; limit?: number }): EventRecord[];
  saveArtifact(artifact: ArtifactRecord): ArtifactRecord;
  listArtifacts(projectId: string): ArtifactRecord[];
}

export interface BpairEngineOptions {
  repository: Repository;
}

export class BpairEngine {
  constructor(private readonly options: BpairEngineOptions) {}

  createForm(definition: unknown): TemplateRecord<FormSchemaV1> {
    const parsed = formSchemaV1Schema.parse(definition);
    const latest = this.options.repository.getFormTemplate(parsed.key);
    const now = nowIso();
    return this.options.repository.saveFormTemplate({
      key: parsed.key,
      revision: (latest?.revision ?? 0) + 1,
      status: "draft",
      definition: parsed,
      createdAt: now,
      updatedAt: now
    });
  }

  updateForm(key: string, patch: unknown): TemplateRecord<FormSchemaV1> {
    const current = this.mustForm(key);
    const next = formSchemaV1Schema.parse(deepMerge(current.definition, patch));
    const now = nowIso();
    return this.options.repository.saveFormTemplate({
      key,
      revision: current.revision + 1,
      status: current.status,
      definition: next,
      createdAt: current.createdAt,
      updatedAt: now
    });
  }

  getForm(key: string, revision?: number): TemplateRecord<FormSchemaV1> {
    return this.mustForm(key, revision);
  }

  listForms(): TemplateRecord<FormSchemaV1>[] {
    return this.options.repository.listFormTemplates();
  }

  diffForm(key: string, fromRevision: number, toRevision: number): Record<string, unknown> {
    const from = this.mustForm(key, fromRevision);
    const to = this.mustForm(key, toRevision);
    return {
      key,
      fromRevision,
      toRevision,
      from: from.definition,
      to: to.definition
    };
  }

  createFlow(definition: unknown): TemplateRecord<FlowSchemaV1> {
    const parsed = flowSchemaV1Schema.parse(definition);
    this.validateFlowDefinition(parsed);
    const latest = this.options.repository.getFlowTemplate(parsed.key);
    const now = nowIso();
    return this.options.repository.saveFlowTemplate({
      key: parsed.key,
      revision: (latest?.revision ?? 0) + 1,
      status: "draft",
      definition: parsed,
      createdAt: now,
      updatedAt: now
    });
  }

  updateFlow(key: string, patch: unknown): TemplateRecord<FlowSchemaV1> {
    const current = this.mustFlow(key);
    const next = flowSchemaV1Schema.parse(deepMerge(current.definition, patch));
    this.validateFlowDefinition(next);
    const now = nowIso();
    return this.options.repository.saveFlowTemplate({
      key,
      revision: current.revision + 1,
      status: current.status,
      definition: next,
      createdAt: current.createdAt,
      updatedAt: now
    });
  }

  getFlow(key: string, revision?: number): TemplateRecord<FlowSchemaV1> {
    return this.mustFlow(key, revision);
  }

  listFlows(): TemplateRecord<FlowSchemaV1>[] {
    return this.options.repository.listFlowTemplates();
  }

  publishFlow(key: string, revision?: number): TemplateRecord<FlowSchemaV1> {
    const current = this.mustFlow(key, revision);
    return this.options.repository.saveFlowTemplate({
      ...current,
      status: "published",
      updatedAt: nowIso()
    });
  }

  validateFlow(input: unknown): { valid: boolean; errors: string[] } {
    try {
      const parsed = flowSchemaV1Schema.parse(input);
      this.validateFlowDefinition(parsed);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof Error) {
        return { valid: false, errors: [error.message] };
      }
      return { valid: false, errors: ["Unknown flow validation error"] };
    }
  }

  simulateFlow(key: string, actions: Array<{ stepId: string; action: ActionType }>): Record<string, unknown> {
    const flow = this.mustFlow(key);
    let currentStep = this.getEntryStep(flow.definition);
    const path = [currentStep.id];
    for (const item of actions) {
      if (currentStep.id !== item.stepId) {
        throw new BpairError("SIMULATION_STEP_MISMATCH", `Expected step ${currentStep.id}, got ${item.stepId}`);
      }
      const transition = this.pickTransition(flow.definition, currentStep.id, item.action, {});
      if (!transition) {
        throw new BpairError("SIMULATION_NO_TRANSITION", `No transition from ${currentStep.id} on ${item.action}`);
      }
      currentStep = this.getStep(flow.definition, transition.to);
      path.push(currentStep.id);
    }
    return {
      flowKey: key,
      path,
      finalStep: currentStep
    };
  }

  createProject(input: {
    name: string;
    flowKey: string;
    createSubmission?: unknown;
    parentProjectId?: string | null;
  }): ProjectSnapshotV1 {
    const flow = this.getPublishedOrLatestFlow(input.flowKey);
    let createSubmission: FormSubmission | null = null;
    let mergedFields: Record<string, unknown> = {};
    if (flow.definition.createForm) {
      const form = this.mustForm(flow.definition.createForm);
      const parsedSubmission = formSubmissionSchema.parse({
        formTemplateKey: form.key,
        revision: form.revision,
        data: applyDefaultsToSubmission(form.definition, (input.createSubmission as { data?: Record<string, unknown> } | undefined)?.data ?? {})
      });
      this.validateSubmission(form.definition, parsedSubmission.data);
      createSubmission = parsedSubmission;
      mergedFields = { ...parsedSubmission.data };
    }
    const now = nowIso();
    const project: ProjectSnapshotV1 = {
      id: makeId("p"),
      name: input.name,
      flowKey: flow.key,
      flowRevision: flow.revision,
      status: "processing",
      currentStepIds: [],
      currentTaskIds: [],
      parentProjectId: input.parentProjectId ?? null,
      data: {
        createSubmission,
        taskSubmissions: {},
        fields: mergedFields
      },
      createdAt: now,
      updatedAt: now
    };
    this.options.repository.saveProject(project);
    this.emit("project.created", project.id, null, {
      flowKey: project.flowKey,
      flowRevision: project.flowRevision
    });
    return this.advanceProjectToStep(project.id, this.getEntryStep(flow.definition).id);
  }

  listProjects(): ProjectSnapshotV1[] {
    return this.options.repository.listProjects();
  }

  getProject(projectId: string): ProjectSnapshotV1 {
    return this.mustProject(projectId);
  }

  getProjectData(projectId: string): ProjectSnapshotV1["data"] {
    return this.mustProject(projectId).data;
  }

  listTasks(projectId?: string): TaskSnapshotV1[] {
    return this.options.repository.listTasks(projectId ? { projectId } : undefined);
  }

  getTask(taskId: string): TaskSnapshotV1 {
    return this.mustTask(taskId);
  }

  saveTaskDraft(taskId: string, submission: unknown): TaskSnapshotV1 {
    const task = this.mustTask(taskId);
    if (task.status !== "pending") {
      throw new BpairError("TASK_NOT_PENDING", "Only pending tasks can save draft");
    }
    const project = this.mustProject(task.projectId);
    const flow = this.mustFlow(project.flowKey, project.flowRevision);
    const step = this.getStep(flow.definition, task.stepId);
    const parsed = this.parseTaskSubmission(step, submission);
    const next: TaskSnapshotV1 = {
      ...task,
      draftSubmission: parsed,
      updatedAt: nowIso()
    };
    this.options.repository.saveTask(next);
    this.emit("task.draft_saved", project.id, task.id, {
      stepId: task.stepId,
      formTemplateKey: parsed?.formTemplateKey ?? null
    });
    return next;
  }

  submitTask(input: {
    taskId: string;
    action: ActionType;
    actorId: string;
    submission?: unknown;
  }): ProjectSnapshotV1 {
    const action = actionTypeSchema.parse(input.action);
    const task = this.mustTask(input.taskId);
    if (task.status !== "pending") {
      throw new BpairError("TASK_NOT_PENDING", "Task is already completed");
    }
    const project = this.mustProject(task.projectId);
    const flow = this.mustFlow(project.flowKey, project.flowRevision);
    const step = this.getStep(flow.definition, task.stepId);
    if (!step.actions.includes(action)) {
      throw new BpairError("ACTION_NOT_ALLOWED", `Action ${action} is not allowed on step ${step.id}`);
    }

    const parsed = this.parseTaskSubmission(step, input.submission ?? task.draftSubmission);
    const fields = { ...project.data.fields };
    if (parsed) {
      const form = this.mustForm(parsed.formTemplateKey, parsed.revision);
      this.validateSubmission(form.definition, parsed.data);
      Object.assign(fields, parsed.data);
    }

    const updatedProject: ProjectSnapshotV1 = {
      ...project,
      data: {
        ...project.data,
        fields,
        taskSubmissions: parsed
          ? { ...project.data.taskSubmissions, [task.stepId]: parsed }
          : project.data.taskSubmissions
      },
      currentTaskIds: project.currentTaskIds.filter((id) => id !== task.id),
      updatedAt: nowIso()
    };
    this.options.repository.saveProject(updatedProject);

    const completedTask: TaskSnapshotV1 = {
      ...task,
      status: action === "terminate" ? "cancelled" : "completed",
      draftSubmission: parsed,
      actionLog: [
        ...task.actionLog,
        {
          at: nowIso(),
          action,
          actorId: input.actorId,
          payload: parsed ? parsed.data : {}
        }
      ],
      updatedAt: nowIso(),
      completedAt: nowIso()
    };
    this.options.repository.saveTask(completedTask);
    this.emit("task.submitted", project.id, task.id, {
      stepId: task.stepId,
      action,
      actorId: input.actorId
    });

    if (action === "terminate") {
      return this.saveProjectState({
        ...updatedProject,
        status: "cancelled",
        currentStepIds: []
      });
    }

    if (action === "withdraw") {
      return this.advanceProjectToStep(project.id, this.getEntryStep(flow.definition).id);
    }

    const transition = this.pickTransition(flow.definition, step.id, action, fields);
    if (!transition) {
      throw new BpairError("NO_TRANSITION", `No transition from ${step.id} for action ${action}`);
    }
    return this.advanceProjectToStep(project.id, transition.to);
  }

  reassignTask(taskId: string, assignees: string[]): TaskSnapshotV1 {
    const task = this.mustTask(taskId);
    const next: TaskSnapshotV1 = {
      ...task,
      assignees,
      updatedAt: nowIso()
    };
    this.options.repository.saveTask(next);
    this.emit("task.reassigned", task.projectId, task.id, { assignees });
    return next;
  }

  explainRuntime(projectId: string): Record<string, unknown> {
    const project = this.mustProject(projectId);
    const flow = this.mustFlow(project.flowKey, project.flowRevision);
    const tasks = this.options.repository.listTasks({ projectId });
    const pending = tasks.filter((task) => task.status === "pending");
    return {
      projectId,
      status: project.status,
      currentStepIds: project.currentStepIds,
      pendingTasks: pending.map((task) => ({
        id: task.id,
        stepId: task.stepId,
        stepName: task.stepName,
        assignees: task.assignees
      })),
      currentSteps: project.currentStepIds.map((stepId) => this.getStep(flow.definition, stepId)),
      recentEvents: this.options.repository.listEvents({ projectId, limit: 10 })
    };
  }

  auditTail(limit = 20, projectId?: string): EventRecord[] {
    return this.options.repository.listEvents({ projectId, limit });
  }

  private parseTaskSubmission(step: FlowStep, submission: unknown): FormSubmission | null {
    if (!step.taskForm) {
      return null;
    }
    if (!submission) {
      throw new BpairError("MISSING_SUBMISSION", `Step ${step.id} requires a submission`);
    }
    const form = this.mustForm(step.taskForm);
    const parsed = formSubmissionSchema.parse({
      formTemplateKey: form.key,
      revision: form.revision,
      data: applyDefaultsToSubmission(form.definition, (submission as { data?: Record<string, unknown> }).data ?? {})
    });
    return parsed;
  }

  private validateSubmission(form: FormSchemaV1, data: Record<string, unknown>): void {
    for (const field of form.schema.fields) {
      if (field.required && (data[field.key] === undefined || data[field.key] === null || data[field.key] === "")) {
        throw new BpairError("FIELD_REQUIRED", `Field ${field.key} is required`);
      }
    }
  }

  private validateFlowDefinition(flow: FlowSchemaV1): void {
    const ids = new Set(flow.steps.map((step) => step.id));
    if (ids.size !== flow.steps.length) {
      throw new BpairError("DUPLICATE_STEP", "Flow contains duplicate step ids");
    }
    const entryId = flow.entry ?? flow.steps.find((step) => step.type === "step" || step.type === "subflow" || step.type === "gateway")?.id;
    if (!entryId || !ids.has(entryId)) {
      throw new BpairError("INVALID_ENTRY", "Flow entry step is missing");
    }
    for (const transition of flow.transitions) {
      if (!ids.has(transition.from) || !ids.has(transition.to)) {
        throw new BpairError("INVALID_TRANSITION", `Transition ${transition.from} -> ${transition.to} references unknown steps`);
      }
    }
  }

  private advanceProjectToStep(projectId: string, stepId: string): ProjectSnapshotV1 {
    const project = this.mustProject(projectId);
    const flow = this.mustFlow(project.flowKey, project.flowRevision);
    const step = this.getStep(flow.definition, stepId);

    if (step.type === "end") {
      const completed = this.saveProjectState({
        ...project,
        status: "completed",
        currentStepIds: [],
        currentTaskIds: []
      });
      this.emit("project.completed", completed.id, null, {});
      this.resumeParentIfNeeded(completed);
      return completed;
    }

    if (step.type === "fail") {
      return this.saveProjectState({
        ...project,
        status: "failed",
        currentStepIds: [step.id],
        currentTaskIds: []
      });
    }

    if (step.type === "gateway") {
      const next = flow.definition.transitions.find((transition) => transition.from === step.id && evaluateCondition(transition.condition, project.data.fields));
      if (!next) {
        throw new BpairError("GATEWAY_NO_MATCH", `Gateway ${step.id} has no matching transition`);
      }
      return this.advanceProjectToStep(projectId, next.to);
    }

    if (step.type === "subflow") {
      if (!step.subflow?.flowKey) {
        throw new BpairError("SUBFLOW_MISSING_KEY", `Subflow step ${step.id} is missing flowKey`);
      }
      const waiting = this.saveProjectState({
        ...project,
        status: "waiting_subflow",
        currentStepIds: [step.id],
        currentTaskIds: []
      });
      const child = this.createProject({
        name: `${project.name} / ${step.name}`,
        flowKey: step.subflow.flowKey,
        parentProjectId: project.id
      });
      this.options.repository.saveArtifact({
        id: makeId("a"),
        projectId: project.id,
        type: "subflow",
        ref: child.id,
        payload: { parentStepId: step.id },
        createdAt: nowIso()
      });
      this.emit("project.subflow_created", project.id, null, {
        childProjectId: child.id,
        parentStepId: step.id
      });
      return waiting;
    }

    const assignees = this.resolveAssignees(step, project.data.fields);
    const task: TaskSnapshotV1 = {
      id: makeId("t"),
      projectId: project.id,
      stepId: step.id,
      stepName: step.name,
      status: "pending",
      assignees,
      draftSubmission: null,
      actionLog: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null
    };
    this.options.repository.saveTask(task);
    this.emit("task.started", project.id, task.id, { stepId: step.id });
    return this.saveProjectState({
      ...project,
      status: "processing",
      currentStepIds: [step.id],
      currentTaskIds: [task.id]
    });
  }

  private resumeParentIfNeeded(project: ProjectSnapshotV1): void {
    if (!project.parentProjectId) {
      return;
    }
    const parent = this.mustProject(project.parentProjectId);
    const flow = this.mustFlow(parent.flowKey, parent.flowRevision);
    const currentSubflowStepId = parent.currentStepIds[0];
    if (!currentSubflowStepId) {
      return;
    }
    const transition = this.pickTransition(flow.definition, currentSubflowStepId, "complete", parent.data.fields);
    if (!transition) {
      return;
    }
    this.advanceProjectToStep(parent.id, transition.to);
  }

  private resolveAssignees(step: FlowStep, fields: Record<string, unknown>): string[] {
    const rule = step.assigneeRule;
    if (!rule) {
      return ["system"];
    }
    if (rule.type === "field") {
      const fieldValue = fields[String(rule.value)];
      if (typeof fieldValue === "string") {
        return [fieldValue];
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.filter((item): item is string => typeof item === "string");
      }
    }
    if (typeof rule.value === "string") {
      return [rule.value];
    }
    return rule.value;
  }

  private pickTransition(flow: FlowSchemaV1, stepId: string, action: ActionType, fields: Record<string, unknown>) {
    return flow.transitions.find((transition) => transition.from === stepId && transition.action === action && evaluateCondition(transition.condition, fields));
  }

  private getEntryStep(flow: FlowSchemaV1): FlowStep {
    const entryId = flow.entry ?? flow.steps.find((step) => step.type === "step" || step.type === "gateway" || step.type === "subflow")?.id;
    if (!entryId) {
      throw new BpairError("INVALID_ENTRY", "Flow has no executable entry");
    }
    return this.getStep(flow, entryId);
  }

  private getStep(flow: FlowSchemaV1, stepId: string): FlowStep {
    const step = flow.steps.find((item) => item.id === stepId);
    if (!step) {
      throw new BpairError("STEP_NOT_FOUND", `Step ${stepId} not found`);
    }
    return step;
  }

  private getPublishedOrLatestFlow(key: string): TemplateRecord<FlowSchemaV1> {
    const flows = this.options.repository.listFlowTemplates().filter((item) => item.key === key);
    const published = flows.filter((item) => item.status === "published").sort((a, b) => b.revision - a.revision)[0];
    return published ?? this.mustFlow(key);
  }

  private mustForm(key: string, revision?: number): TemplateRecord<FormSchemaV1> {
    const record = this.options.repository.getFormTemplate(key, revision);
    if (!record) {
      throw new BpairError("FORM_NOT_FOUND", `Form ${key}${revision ? `@${revision}` : ""} not found`);
    }
    return record;
  }

  private mustFlow(key: string, revision?: number): TemplateRecord<FlowSchemaV1> {
    const record = this.options.repository.getFlowTemplate(key, revision);
    if (!record) {
      throw new BpairError("FLOW_NOT_FOUND", `Flow ${key}${revision ? `@${revision}` : ""} not found`);
    }
    return record;
  }

  private mustProject(projectId: string): ProjectSnapshotV1 {
    const record = this.options.repository.getProject(projectId);
    if (!record) {
      throw new BpairError("PROJECT_NOT_FOUND", `Project ${projectId} not found`);
    }
    return record;
  }

  private mustTask(taskId: string): TaskSnapshotV1 {
    const record = this.options.repository.getTask(taskId);
    if (!record) {
      throw new BpairError("TASK_NOT_FOUND", `Task ${taskId} not found`);
    }
    return record;
  }

  private saveProjectState(project: ProjectSnapshotV1): ProjectSnapshotV1 {
    const next: ProjectSnapshotV1 = {
      ...project,
      updatedAt: nowIso()
    };
    this.options.repository.saveProject(next);
    return next;
  }

  private emit(type: string, projectId: string | null, taskId: string | null, payload: Record<string, unknown>): void {
    this.options.repository.appendEvent({
      id: makeId("evt"),
      type,
      projectId,
      taskId,
      payload,
      createdAt: nowIso()
    });
  }
}
