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
  summarizeTaskInstances,
  taskInstanceActionSchema,
  taskInstanceSummarySchema,
  type ActionType,
  type EventRecord,
  type FlowSchemaV1,
  type FlowStep,
  type FormSchemaV1,
  type FormSubmission,
  type ProjectSnapshotV1,
  type TaskInstanceAction,
  type TaskInstanceSnapshotV1,
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
  saveTaskInstance(taskInstance: TaskInstanceSnapshotV1): TaskInstanceSnapshotV1;
  getTaskInstance(taskInstanceId: string): TaskInstanceSnapshotV1 | null;
  listTaskInstances(filter?: { projectId?: string; status?: string }): TaskInstanceSnapshotV1[];
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
      taskInstanceIds: [],
      taskSummary: taskInstanceSummarySchema.parse({}),
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

  listTaskInstances(projectId?: string): TaskInstanceSnapshotV1[] {
    return this.options.repository.listTaskInstances(projectId ? { projectId } : undefined);
  }

  getTaskInstance(taskInstanceId: string): TaskInstanceSnapshotV1 {
    return this.mustTaskInstance(taskInstanceId);
  }

  createTaskInstance(input: {
    projectId: string;
    templateKey?: string | null;
    flowKey?: string | null;
    title: string;
    description?: string | null;
    phase?: string | null;
    milestoneKey?: string | null;
    priority?: string | null;
    assignees?: string[];
    fields?: Record<string, unknown>;
  }): TaskInstanceSnapshotV1 {
    const project = this.mustProject(input.projectId);
    const created = this.createTaskInstanceRecord(project, input);
    this.emit("task_instance.created", project.id, null, {
      taskInstanceId: created.id,
      title: created.title,
      phase: created.phase
    });
    this.refreshProjectTaskSummary(project.id);
    return this.mustTaskInstance(created.id);
  }

  batchCreateTaskInstances(input: {
    projectId: string;
    items: Array<{
      templateKey?: string | null;
      flowKey?: string | null;
      title: string;
      description?: string | null;
      phase?: string | null;
      milestoneKey?: string | null;
      priority?: string | null;
      assignees?: string[];
      fields?: Record<string, unknown>;
    }>;
  }): TaskInstanceSnapshotV1[] {
    const project = this.mustProject(input.projectId);
    const created = input.items.map((item) => this.createTaskInstanceRecord(project, item));
    this.refreshProjectTaskSummary(project.id);
    created.forEach((task) => this.emit("task_instance.created", project.id, null, {
      taskInstanceId: task.id,
      title: task.title,
      phase: task.phase
    }));
    return created.map((task) => this.mustTaskInstance(task.id));
  }

  submitTaskInstance(input: {
    id: string;
    action: TaskInstanceAction;
    actorId: string;
    data?: Record<string, unknown>;
  }): TaskInstanceSnapshotV1 {
    const action = taskInstanceActionSchema.parse(input.action);
    const task = this.mustTaskInstance(input.id);
    const payload = input.data ?? {};
    const mergedFields = { ...task.fields, ...payload };
    this.validateTaskInstanceAction(task, action, mergedFields);
    const nextStatus = this.resolveTaskInstanceNextStatus(task.status, action);
    const next: TaskInstanceSnapshotV1 = {
      ...task,
      status: nextStatus,
      fields: mergedFields,
      assignees: this.resolveTaskInstanceAssignees(task, payload),
      actionLog: [
        ...task.actionLog,
        {
          at: nowIso(),
          action,
          actorId: input.actorId,
          payload
        }
      ],
      updatedAt: nowIso(),
      completedAt: nextStatus === "completed" ? nowIso() : task.completedAt
    };
    this.options.repository.saveTaskInstance(next);
    this.refreshProjectTaskSummary(task.projectId);
    this.emit("task_instance.submitted", task.projectId, null, {
      taskInstanceId: task.id,
      action,
      status: nextStatus,
      actorId: input.actorId
    });
    return this.mustTaskInstance(task.id);
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

    let transition = null;
    if (action !== "terminate" && action !== "withdraw") {
      transition = this.pickTransition(flow.definition, step.id, action, fields, project.id);
      if (!transition) {
        throw new BpairError("NO_TRANSITION", `No transition from ${step.id} for action ${action}`);
      }
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

    return this.advanceProjectToStep(project.id, transition!.to);
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
    const taskInstances = this.options.repository.listTaskInstances({ projectId });
    const pending = tasks.filter((task) => task.status === "pending");
    return {
      projectId,
      status: project.status,
      currentStepIds: project.currentStepIds,
      taskSummary: project.taskSummary,
      pendingTasks: pending.map((task) => ({
        id: task.id,
        stepId: task.stepId,
        stepName: task.stepName,
        assignees: task.assignees
      })),
      taskInstances: taskInstances.map((task) => ({
        id: task.id,
        title: task.title,
        phase: task.phase,
        status: task.status,
        assignees: task.assignees,
        critical: Boolean(task.fields.isCritical)
      })),
      currentSteps: project.currentStepIds.map((stepId) => this.getStep(flow.definition, stepId)),
      recentEvents: this.options.repository.listEvents({ projectId, limit: 10 })
    };
  }

  auditTail(limit = 20, projectId?: string): EventRecord[] {
    return this.options.repository.listEvents({ projectId, limit });
  }

  private createTaskInstanceRecord(project: ProjectSnapshotV1, input: {
    templateKey?: string | null;
    flowKey?: string | null;
    title: string;
    description?: string | null;
    phase?: string | null;
    milestoneKey?: string | null;
    priority?: string | null;
    assignees?: string[];
    fields?: Record<string, unknown>;
  }): TaskInstanceSnapshotV1 {
    const now = nowIso();
    const task: TaskInstanceSnapshotV1 = {
      id: makeId("ti"),
      projectId: project.id,
      templateKey: input.templateKey ?? null,
      flowKey: input.flowKey ?? null,
      title: input.title,
      description: input.description ?? null,
      phase: input.phase ?? null,
      milestoneKey: input.milestoneKey ?? null,
      priority: input.priority ?? null,
      assignees: input.assignees?.length
        ? input.assignees
        : this.resolveAssigneesFromFields(input.fields ?? {}, ["system"]),
      status: "pending",
      fields: { ...(input.fields ?? {}) },
      actionLog: [],
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };
    this.options.repository.saveTaskInstance(task);
    return task;
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
      const next = flow.definition.transitions.find((transition) =>
        transition.from === step.id && evaluateCondition(transition.condition, this.buildConditionContext(project.id, project.data.fields))
      );
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
    const nextProject = this.saveProjectState({
      ...project,
      status: "processing",
      currentStepIds: [step.id],
      currentTaskIds: [task.id]
    });
    this.seedTaskInstancesForStep(nextProject, step);
    return this.mustProject(project.id);
  }

  private seedTaskInstancesForStep(project: ProjectSnapshotV1, step: FlowStep): void {
    if (!step.taskOrchestration) {
      return;
    }
    const existingTaskInstances = this.options.repository.listTaskInstances({ projectId: project.id });
    for (const template of step.taskOrchestration.createOnEnter) {
      const phase = template.phase ?? step.id;
      if (template.key && existingTaskInstances.some((task) => task.templateKey === template.key && task.phase === phase)) {
        continue;
      }
      const assignees = template.assigneeRule
        ? this.resolveAssignees({ ...step, assigneeRule: template.assigneeRule }, project.data.fields)
        : ["system"];
      const created = this.createTaskInstanceRecord(project, {
        templateKey: template.key ?? null,
        title: template.title,
        description: template.description ?? null,
        phase,
        milestoneKey: template.milestoneKey ?? null,
        priority: template.priority ?? null,
        assignees,
        fields: {
          ...template.fields,
          isCritical: template.critical
        }
      });
      existingTaskInstances.push(created);
    }

    for (const seed of step.taskOrchestration.seedFromFields) {
      const source = project.data.fields[seed.field];
      if (!Array.isArray(source)) {
        continue;
      }
      for (const item of source) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          continue;
        }
        const row = item as Record<string, unknown>;
        const title = row[seed.titleField];
        if (typeof title !== "string" || !title.trim()) {
          continue;
        }
        const templateKey = seed.templateKeyField ? this.asNullableString(row[seed.templateKeyField]) : null;
        const phase = seed.phaseField ? this.asNullableString(row[seed.phaseField]) : step.id;
        if (templateKey && existingTaskInstances.some((task) => task.templateKey === templateKey && task.phase === phase)) {
          continue;
        }
        const assigneeValue = seed.assigneeField ? row[seed.assigneeField] : undefined;
        const assignees = this.normalizeAssignees(assigneeValue, seed.defaultAssignees);
        const created = this.createTaskInstanceRecord(project, {
          templateKey,
          title,
          description: seed.descriptionField ? this.asNullableString(row[seed.descriptionField]) : null,
          phase,
          milestoneKey: seed.milestoneField ? this.asNullableString(row[seed.milestoneField]) : null,
          priority: seed.priorityField ? this.asNullableString(row[seed.priorityField]) : null,
          assignees,
          fields: {
            ...seed.defaultFields,
            ...row,
            isCritical: seed.criticalField ? Boolean(row[seed.criticalField]) : Boolean(seed.defaultFields.isCritical)
          }
        });
        existingTaskInstances.push(created);
      }
    }

    this.refreshProjectTaskSummary(project.id);
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
    const transition = this.pickTransition(flow.definition, currentSubflowStepId, "complete", parent.data.fields, parent.id);
    if (!transition) {
      return;
    }
    this.advanceProjectToStep(parent.id, transition.to);
  }

  private resolveAssignees(step: Pick<FlowStep, "assigneeRule">, fields: Record<string, unknown>): string[] {
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

  private pickTransition(flow: FlowSchemaV1, stepId: string, action: ActionType, fields: Record<string, unknown>, projectId?: string) {
    const context = this.buildConditionContext(projectId, fields);
    return flow.transitions.find((transition) =>
      transition.from === stepId && transition.action === action && evaluateCondition(transition.condition, context)
    );
  }

  private buildConditionContext(projectId: string | undefined, fields: Record<string, unknown>) {
    return {
      fields,
      taskInstances: projectId ? this.options.repository.listTaskInstances({ projectId }) : []
    };
  }

  private resolveTaskInstanceNextStatus(current: TaskInstanceSnapshotV1["status"], action: TaskInstanceAction): TaskInstanceSnapshotV1["status"] {
    if (["completed", "cancelled"].includes(current)) {
      throw new BpairError("TASK_INSTANCE_CLOSED", `Task instance is already ${current}`);
    }
    if (action === "cancel") {
      return "cancelled";
    }
    if (action === "block") {
      return "blocked";
    }
    if (action === "unblock") {
      if (current !== "blocked") {
        throw new BpairError("TASK_INSTANCE_NOT_BLOCKED", "Only blocked task instances can be unblocked");
      }
      return "in_progress";
    }
    if (action === "submit_review") {
      if (!["in_progress", "pending"].includes(current)) {
        throw new BpairError("TASK_INSTANCE_INVALID_ACTION", `Cannot submit review from ${current}`);
      }
      return "waiting_review";
    }
    if (action === "approve" || action === "complete") {
      return "completed";
    }
    if (action === "reject") {
      if (current !== "waiting_review") {
        throw new BpairError("TASK_INSTANCE_INVALID_ACTION", "Only waiting_review task instances can be rejected");
      }
      return "in_progress";
    }
    return "in_progress";
  }

  private validateTaskInstanceAction(task: TaskInstanceSnapshotV1, action: TaskInstanceAction, mergedFields: Record<string, unknown>): void {
    const currentStage = this.asNullableString(task.fields.currentStage);
    const nextStage = this.asNullableString(mergedFields.currentStage) ?? currentStage;
    if (!currentStage && !nextStage) {
      return;
    }
    if (action === "submit_review") {
      if (currentStage !== "develop") {
        throw new BpairError("TASK_INSTANCE_STAGE_INVALID", "Only develop-stage task instances can submit review");
      }
      if (nextStage !== "test") {
        throw new BpairError("TASK_INSTANCE_STAGE_INVALID", "submit_review must move currentStage to test");
      }
    }
    if (action === "reject" && nextStage !== "develop") {
      throw new BpairError("TASK_INSTANCE_STAGE_INVALID", "reject must move currentStage back to develop");
    }
    if (action === "complete" && task.status === "waiting_review" && nextStage !== "test") {
        throw new BpairError("TASK_INSTANCE_STAGE_INVALID", "complete must keep currentStage at test");
    }
  }

  private normalizeAssignees(value: unknown, fallback: string[]): string[] {
    if (typeof value === "string" && value.trim()) {
      return [value];
    }
    if (Array.isArray(value)) {
      const assignees = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
      if (assignees.length > 0) {
        return assignees;
      }
    }
    return fallback.length > 0 ? fallback : ["system"];
  }

  private asNullableString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null;
  }

  private resolveTaskInstanceAssignees(task: TaskInstanceSnapshotV1, payload: Record<string, unknown>): string[] {
    return this.resolveAssigneesFromFields({ ...task.fields, ...payload }, task.assignees);
  }

  private resolveAssigneesFromFields(fields: Record<string, unknown>, fallback: string[]): string[] {
    if (fields.currentOwner !== undefined) {
      return this.normalizeAssignees(fields.currentOwner, fallback);
    }
    if (fields.currentStage === "design") {
      return this.normalizeAssignees(fields.designOwner, fallback);
    }
    if (fields.currentStage === "develop") {
      return this.normalizeAssignees(fields.developerOwner, fallback);
    }
    if (fields.currentStage === "test") {
      return this.normalizeAssignees(fields.testerOwner, fallback);
    }
    return fallback;
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

  private mustTaskInstance(taskInstanceId: string): TaskInstanceSnapshotV1 {
    const record = this.options.repository.getTaskInstance(taskInstanceId);
    if (!record) {
      throw new BpairError("TASK_INSTANCE_NOT_FOUND", `Task instance ${taskInstanceId} not found`);
    }
    return record;
  }

  private refreshProjectTaskSummary(projectId: string): ProjectSnapshotV1 {
    const project = this.mustProject(projectId);
    const taskInstances = this.options.repository.listTaskInstances({ projectId });
    return this.saveProjectState({
      ...project,
      taskInstanceIds: taskInstances.map((task) => task.id),
      taskSummary: summarizeTaskInstances(taskInstances)
    });
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
