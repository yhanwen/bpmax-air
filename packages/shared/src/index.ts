import { randomUUID } from "node:crypto";
import { z } from "zod";

export const stepTypeSchema = z.enum(["start", "step", "gateway", "subflow", "end", "fail"]);
export const actionTypeSchema = z.enum(["approve", "reject", "complete", "route", "auto", "cancel", "terminate", "withdraw"]);
export const taskInstanceStatusSchema = z.enum(["pending", "in_progress", "waiting_review", "completed", "cancelled", "blocked"]);
export const taskInstanceActionSchema = z.enum(["start", "progress", "submit_review", "approve", "reject", "complete", "block", "unblock", "cancel"]);
export const fieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "currency",
  "date",
  "datetime",
  "select",
  "multiSelect",
  "user",
  "userList",
  "boolean",
  "attachment",
  "table",
  "computed"
]);

export const assigneeRuleSchema = z.object({
  type: z.enum(["user", "role", "group", "field", "static"]).default("static"),
  value: z.union([z.string(), z.array(z.string())])
});

export const taskInstanceConditionFilterSchema = z.object({
  phase: z.string().optional(),
  milestoneKey: z.string().optional(),
  templateKey: z.string().optional(),
  assignee: z.string().optional(),
  critical: z.boolean().optional(),
  statuses: z.array(taskInstanceStatusSchema).optional()
}).default({});

export const conditionSchema = z.object({
  source: z.enum(["field", "task_instance"]).default("field"),
  field: z.string(),
  metric: z.enum([
    "value",
    "count",
    "completed_count",
    "open_count",
    "blocked_count",
    "all_completed",
    "all_critical_completed",
    "any_blocked"
  ]).default("value"),
  op: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "in", "exists"]).default("eq"),
  value: z.any().optional(),
  filters: taskInstanceConditionFilterSchema.optional()
});

export const fieldSchema = z.object({
  key: z.string(),
  type: fieldTypeSchema,
  label: z.string(),
  required: z.boolean().default(false),
  defaultValue: z.any().optional(),
  description: z.string().optional(),
  options: z.array(z.object({
    label: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()])
  })).optional()
});

export const formSchemaV1Schema = z.object({
  kind: z.literal("form-template"),
  version: z.literal("v1"),
  key: z.string(),
  name: z.string(),
  schema: z.object({
    fields: z.array(fieldSchema).min(1)
  }),
  layout: z.object({
    groups: z.array(z.object({
      key: z.string(),
      title: z.string(),
      fields: z.array(z.string())
    })).default([])
  }).default({ groups: [] }),
  behavior: z.object({
    computed: z.array(z.object({
      field: z.string(),
      expr: z.string()
    })).default([]),
    draftable: z.boolean().default(true)
  }).default({ computed: [], draftable: true }),
  metadata: z.record(z.string(), z.any()).default({})
});

export const taskInstanceTemplateSchema = z.object({
  key: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  phase: z.string().optional(),
  milestoneKey: z.string().optional(),
  priority: z.string().optional(),
  critical: z.boolean().default(false),
  assigneeRule: assigneeRuleSchema.optional(),
  fields: z.record(z.string(), z.any()).default({})
});

export const taskInstanceSeedSchema = z.object({
  field: z.string(),
  templateKeyField: z.string().optional(),
  titleField: z.string().default("title"),
  descriptionField: z.string().optional(),
  phaseField: z.string().optional(),
  milestoneField: z.string().optional(),
  assigneeField: z.string().optional(),
  priorityField: z.string().optional(),
  criticalField: z.string().optional(),
  defaultAssignees: z.array(z.string()).default([]),
  defaultFields: z.record(z.string(), z.any()).default({})
});

export const taskOrchestrationSchema = z.object({
  createOnEnter: z.array(taskInstanceTemplateSchema).default([]),
  seedFromFields: z.array(taskInstanceSeedSchema).default([])
}).default({ createOnEnter: [], seedFromFields: [] });

export const flowStepSchema = z.object({
  id: z.string(),
  type: stepTypeSchema,
  name: z.string(),
  description: z.string().optional(),
  taskForm: z.string().optional(),
  assigneeRule: assigneeRuleSchema.optional(),
  actions: z.array(actionTypeSchema).default(["complete"]),
  subflow: z.object({
    flowKey: z.string()
  }).optional(),
  taskOrchestration: taskOrchestrationSchema.optional()
});

export const transitionSchema = z.object({
  from: z.string(),
  action: actionTypeSchema,
  to: z.string(),
  condition: conditionSchema.optional()
});

export const flowSchemaV1Schema = z.object({
  kind: z.literal("flow-template"),
  version: z.literal("v1"),
  key: z.string(),
  name: z.string(),
  createForm: z.string().optional(),
  entry: z.string().optional(),
  steps: z.array(flowStepSchema).min(1),
  transitions: z.array(transitionSchema).default([]),
  policies: z.object({
    slaHours: z.number().int().positive().optional()
  }).default({}),
  triggers: z.array(z.object({
    event: z.string(),
    handler: z.string()
  })).default([]),
  metadata: z.record(z.string(), z.any()).default({})
});

export const formSubmissionSchema = z.object({
  formTemplateKey: z.string(),
  revision: z.number().int().positive().optional(),
  data: z.record(z.string(), z.any())
});

export const actionLogSchema = z.object({
  at: z.string(),
  action: actionTypeSchema,
  actorId: z.string(),
  payload: z.record(z.string(), z.any()).default({})
});

export const taskInstanceActionLogSchema = z.object({
  at: z.string(),
  action: taskInstanceActionSchema,
  actorId: z.string(),
  payload: z.record(z.string(), z.any()).default({})
});

export const taskSnapshotV1Schema = z.object({
  id: z.string(),
  projectId: z.string(),
  stepId: z.string(),
  stepName: z.string(),
  status: z.enum(["pending", "completed", "cancelled"]),
  assignees: z.array(z.string()),
  draftSubmission: formSubmissionSchema.nullable(),
  actionLog: z.array(actionLogSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable()
});

export const taskInstanceSnapshotV1Schema = z.object({
  id: z.string(),
  projectId: z.string(),
  templateKey: z.string().nullable(),
  flowKey: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  phase: z.string().nullable(),
  milestoneKey: z.string().nullable(),
  priority: z.string().nullable(),
  assignees: z.array(z.string()),
  status: taskInstanceStatusSchema,
  fields: z.record(z.string(), z.any()),
  actionLog: z.array(taskInstanceActionLogSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable()
});

export const taskInstanceSummarySchema = z.object({
  total: z.number().int().nonnegative().default(0),
  pending: z.number().int().nonnegative().default(0),
  inProgress: z.number().int().nonnegative().default(0),
  waitingReview: z.number().int().nonnegative().default(0),
  completed: z.number().int().nonnegative().default(0),
  cancelled: z.number().int().nonnegative().default(0),
  blocked: z.number().int().nonnegative().default(0),
  criticalOpen: z.number().int().nonnegative().default(0),
  criticalCompleted: z.number().int().nonnegative().default(0)
});

export const projectSnapshotV1Schema = z.object({
  id: z.string(),
  name: z.string(),
  flowKey: z.string(),
  flowRevision: z.number().int().positive(),
  status: z.enum(["processing", "completed", "failed", "cancelled", "waiting_subflow"]),
  currentStepIds: z.array(z.string()),
  currentTaskIds: z.array(z.string()),
  taskInstanceIds: z.array(z.string()).default([]),
  taskSummary: taskInstanceSummarySchema.default({}),
  parentProjectId: z.string().nullable(),
  data: z.object({
    createSubmission: formSubmissionSchema.nullable(),
    taskSubmissions: z.record(z.string(), formSubmissionSchema),
    fields: z.record(z.string(), z.any())
  }),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const eventSchema = z.object({
  id: z.string(),
  type: z.string(),
  projectId: z.string().nullable(),
  taskId: z.string().nullable(),
  payload: z.record(z.string(), z.any()),
  createdAt: z.string()
});

export const cliResultV1Schema = z.object({
  ok: z.boolean(),
  data: z.any().nullable(),
  meta: z.object({
    requestId: z.string(),
    revision: z.number().nullable().optional()
  }),
  errors: z.array(z.object({
    code: z.string(),
    message: z.string()
  }))
});

export type FormSchemaV1 = z.infer<typeof formSchemaV1Schema>;
export type FlowSchemaV1 = z.infer<typeof flowSchemaV1Schema>;
export type FormSubmission = z.infer<typeof formSubmissionSchema>;
export type ProjectSnapshotV1 = z.infer<typeof projectSnapshotV1Schema>;
export type TaskSnapshotV1 = z.infer<typeof taskSnapshotV1Schema>;
export type TaskInstanceSnapshotV1 = z.infer<typeof taskInstanceSnapshotV1Schema>;
export type TaskInstanceSummary = z.infer<typeof taskInstanceSummarySchema>;
export type EventRecord = z.infer<typeof eventSchema>;
export type CliResultV1<T = unknown> = z.infer<typeof cliResultV1Schema> & { data: T | null };
export type FlowStep = z.infer<typeof flowStepSchema>;
export type Transition = z.infer<typeof transitionSchema>;
export type ActionType = z.infer<typeof actionTypeSchema>;
export type TaskInstanceAction = z.infer<typeof taskInstanceActionSchema>;
export type TaskInstanceStatus = z.infer<typeof taskInstanceStatusSchema>;
export type Condition = z.infer<typeof conditionSchema>;

export interface RuntimeConditionContext {
  fields: Record<string, unknown>;
  taskInstances?: TaskInstanceSnapshotV1[];
}

export class BpairError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "BpairError";
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function ok<T>(data: T, meta: { revision?: number | null } = {}): CliResultV1<T> {
  return {
    ok: true,
    data,
    meta: {
      requestId: makeId("req"),
      revision: meta.revision ?? null
    },
    errors: []
  };
}

export function fail(code: string, message: string): CliResultV1<null> {
  return {
    ok: false,
    data: null,
    meta: {
      requestId: makeId("req"),
      revision: null
    },
    errors: [{ code, message }]
  };
}

export function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === null || patch === undefined || typeof patch !== "object" || Array.isArray(patch)) {
    return patch as T;
  }
  if (typeof base !== "object" || base === null || Array.isArray(base)) {
    return patch as T;
  }
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const current = result[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object" && !Array.isArray(current)) {
      result[key] = deepMerge(current, value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

export function applyDefaultsToSubmission(form: FormSchemaV1, submission: Record<string, unknown>): Record<string, unknown> {
  const data = { ...submission };
  for (const field of form.schema.fields) {
    if (data[field.key] === undefined && field.defaultValue !== undefined) {
      data[field.key] = field.defaultValue;
    }
  }
  return data;
}

function getFieldValue(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, source);
}

function filterTaskInstances(taskInstances: TaskInstanceSnapshotV1[], filters?: z.infer<typeof taskInstanceConditionFilterSchema>): TaskInstanceSnapshotV1[] {
  if (!filters) {
    return taskInstances;
  }
  return taskInstances.filter((task) => {
    if (filters.phase && task.phase !== filters.phase) {
      return false;
    }
    if (filters.milestoneKey && task.milestoneKey !== filters.milestoneKey) {
      return false;
    }
    if (filters.templateKey && task.templateKey !== filters.templateKey) {
      return false;
    }
    if (filters.assignee && !task.assignees.includes(filters.assignee)) {
      return false;
    }
    if (filters.critical !== undefined && Boolean(task.fields.isCritical) !== filters.critical) {
      return false;
    }
    if (filters.statuses && !filters.statuses.includes(task.status)) {
      return false;
    }
    return true;
  });
}

function evaluateOperator(current: unknown, condition: Condition): boolean {
  switch (condition.op) {
    case "eq":
      return current === condition.value;
    case "ne":
      return current !== condition.value;
    case "gt":
      return typeof current === "number" && typeof condition.value === "number" && current > condition.value;
    case "gte":
      return typeof current === "number" && typeof condition.value === "number" && current >= condition.value;
    case "lt":
      return typeof current === "number" && typeof condition.value === "number" && current < condition.value;
    case "lte":
      return typeof current === "number" && typeof condition.value === "number" && current <= condition.value;
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(current);
    case "exists":
      return current !== undefined && current !== null && current !== "";
  }
}

function evaluateTaskInstanceMetric(condition: Condition, context: RuntimeConditionContext): unknown {
  const scoped = filterTaskInstances(context.taskInstances ?? [], condition.filters);
  switch (condition.metric) {
    case "count":
      return scoped.length;
    case "completed_count":
      return scoped.filter((task) => task.status === "completed").length;
    case "open_count":
      return scoped.filter((task) => !["completed", "cancelled"].includes(task.status)).length;
    case "blocked_count":
      return scoped.filter((task) => task.status === "blocked").length;
    case "all_completed":
      return scoped.length > 0 && scoped.every((task) => task.status === "completed");
    case "all_critical_completed": {
      const critical = scoped.filter((task) => Boolean(task.fields.isCritical));
      return critical.length > 0 && critical.every((task) => task.status === "completed");
    }
    case "any_blocked":
      return scoped.some((task) => task.status === "blocked");
    case "value":
    default:
      return undefined;
  }
}

export function summarizeTaskInstances(taskInstances: TaskInstanceSnapshotV1[]): TaskInstanceSummary {
  return taskInstanceSummarySchema.parse(taskInstances.reduce<TaskInstanceSummary>((summary, task) => {
    summary.total += 1;
    if (task.status === "pending") {
      summary.pending += 1;
    } else if (task.status === "in_progress") {
      summary.inProgress += 1;
    } else if (task.status === "waiting_review") {
      summary.waitingReview += 1;
    } else if (task.status === "completed") {
      summary.completed += 1;
    } else if (task.status === "cancelled") {
      summary.cancelled += 1;
    } else if (task.status === "blocked") {
      summary.blocked += 1;
    }
    if (Boolean(task.fields.isCritical) && !["completed", "cancelled"].includes(task.status)) {
      summary.criticalOpen += 1;
    }
    if (Boolean(task.fields.isCritical) && task.status === "completed") {
      summary.criticalCompleted += 1;
    }
    return summary;
  }, {
    total: 0,
    pending: 0,
    inProgress: 0,
    waitingReview: 0,
    completed: 0,
    cancelled: 0,
    blocked: 0,
    criticalOpen: 0,
    criticalCompleted: 0
  }));
}

export function evaluateCondition(condition: Condition | undefined, contextOrFields: RuntimeConditionContext | Record<string, unknown>): boolean {
  if (!condition) {
    return true;
  }
  const context = "fields" in contextOrFields
    ? contextOrFields as RuntimeConditionContext
    : { fields: contextOrFields as Record<string, unknown> };
  const current = condition.source === "task_instance"
    ? evaluateTaskInstanceMetric(condition, context)
    : getFieldValue(context.fields, condition.field);
  return evaluateOperator(current, condition);
}
