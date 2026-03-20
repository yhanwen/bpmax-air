import { randomUUID } from "node:crypto";
import { z } from "zod";

export const stepTypeSchema = z.enum(["start", "step", "gateway", "subflow", "end", "fail"]);
export const actionTypeSchema = z.enum(["approve", "reject", "complete", "route", "auto", "cancel", "terminate", "withdraw"]);
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

export const conditionSchema = z.object({
  field: z.string(),
  op: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "in", "exists"]).default("eq"),
  value: z.any().optional()
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
  }).optional()
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

export const projectSnapshotV1Schema = z.object({
  id: z.string(),
  name: z.string(),
  flowKey: z.string(),
  flowRevision: z.number().int().positive(),
  status: z.enum(["processing", "completed", "failed", "cancelled", "waiting_subflow"]),
  currentStepIds: z.array(z.string()),
  currentTaskIds: z.array(z.string()),
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
export type EventRecord = z.infer<typeof eventSchema>;
export type CliResultV1<T = unknown> = z.infer<typeof cliResultV1Schema> & { data: T | null };
export type FlowStep = z.infer<typeof flowStepSchema>;
export type Transition = z.infer<typeof transitionSchema>;
export type ActionType = z.infer<typeof actionTypeSchema>;
export type Condition = z.infer<typeof conditionSchema>;

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

export function evaluateCondition(condition: Condition | undefined, fields: Record<string, unknown>): boolean {
  if (!condition) {
    return true;
  }
  const current = fields[condition.field];
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
