import { DatabaseSync } from "node:sqlite";
import { eventSchema, projectSnapshotV1Schema, taskSnapshotV1Schema, type EventRecord, type FlowSchemaV1, type FormSchemaV1, type ProjectSnapshotV1, type TaskSnapshotV1 } from "@bpair/shared";
import { type ArtifactRecord, type Repository, type TemplateRecord } from "@bpair/core";

type JsonRow<T> = {
  key?: string;
  revision?: number;
  status?: string;
  definition?: string;
  data?: string;
  created_at?: string;
  updated_at?: string;
};

export interface SqliteRepositoryOptions {
  databasePath?: string;
}

export class SqliteBpairRepository implements Repository {
  private readonly db: DatabaseSync;

  constructor(options: SqliteRepositoryOptions = {}) {
    this.db = new DatabaseSync(options.databasePath ?? "bpair.db");
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.initialize();
  }

  saveFormTemplate(record: TemplateRecord<FormSchemaV1>): TemplateRecord<FormSchemaV1> {
    this.db.prepare(`
      INSERT INTO form_templates (key, revision, status, definition, created_at, updated_at)
      VALUES (@key, @revision, @status, @definition, @createdAt, @updatedAt)
      ON CONFLICT(key, revision) DO UPDATE SET
        status = excluded.status,
        definition = excluded.definition,
        updated_at = excluded.updated_at
    `).run({
      ...record,
      definition: JSON.stringify(record.definition)
    });
    return record;
  }

  getFormTemplate(key: string, revision?: number): TemplateRecord<FormSchemaV1> | null {
    const row = revision
      ? this.db.prepare(`SELECT * FROM form_templates WHERE key = ? AND revision = ?`).get(key, revision)
      : this.db.prepare(`SELECT * FROM form_templates WHERE key = ? ORDER BY revision DESC LIMIT 1`).get(key);
    return this.parseTemplateRow<FormSchemaV1>(row);
  }

  listFormTemplates(): TemplateRecord<FormSchemaV1>[] {
    const rows = this.db.prepare(`
      SELECT ft.*
      FROM form_templates ft
      INNER JOIN (
        SELECT key, MAX(revision) AS revision
        FROM form_templates
        GROUP BY key
      ) latest ON latest.key = ft.key AND latest.revision = ft.revision
      ORDER BY ft.key
    `).all();
    return (rows as unknown[]).map((row: unknown) => this.parseTemplateRow<FormSchemaV1>(row)).filter(Boolean) as TemplateRecord<FormSchemaV1>[];
  }

  saveFlowTemplate(record: TemplateRecord<FlowSchemaV1>): TemplateRecord<FlowSchemaV1> {
    this.db.prepare(`
      INSERT INTO flow_templates (key, revision, status, definition, created_at, updated_at)
      VALUES (@key, @revision, @status, @definition, @createdAt, @updatedAt)
      ON CONFLICT(key, revision) DO UPDATE SET
        status = excluded.status,
        definition = excluded.definition,
        updated_at = excluded.updated_at
    `).run({
      ...record,
      definition: JSON.stringify(record.definition)
    });
    return record;
  }

  getFlowTemplate(key: string, revision?: number): TemplateRecord<FlowSchemaV1> | null {
    const row = revision
      ? this.db.prepare(`SELECT * FROM flow_templates WHERE key = ? AND revision = ?`).get(key, revision)
      : this.db.prepare(`SELECT * FROM flow_templates WHERE key = ? ORDER BY revision DESC LIMIT 1`).get(key);
    return this.parseTemplateRow<FlowSchemaV1>(row);
  }

  listFlowTemplates(): TemplateRecord<FlowSchemaV1>[] {
    const rows = this.db.prepare(`
      SELECT ft.*
      FROM flow_templates ft
      INNER JOIN (
        SELECT key, MAX(revision) AS revision
        FROM flow_templates
        GROUP BY key
      ) latest ON latest.key = ft.key AND latest.revision = ft.revision
      ORDER BY ft.key
    `).all();
    return (rows as unknown[]).map((row: unknown) => this.parseTemplateRow<FlowSchemaV1>(row)).filter(Boolean) as TemplateRecord<FlowSchemaV1>[];
  }

  saveProject(project: ProjectSnapshotV1): ProjectSnapshotV1 {
    this.db.prepare(`
      INSERT INTO projects (id, name, flow_key, flow_revision, status, current_step_ids, current_task_ids, parent_project_id, data, created_at, updated_at)
      VALUES (@id, @name, @flowKey, @flowRevision, @status, @currentStepIds, @currentTaskIds, @parentProjectId, @data, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        status = excluded.status,
        current_step_ids = excluded.current_step_ids,
        current_task_ids = excluded.current_task_ids,
        parent_project_id = excluded.parent_project_id,
        data = excluded.data,
        updated_at = excluded.updated_at
    `).run({
      ...project,
      flowKey: project.flowKey,
      flowRevision: project.flowRevision,
      currentStepIds: JSON.stringify(project.currentStepIds),
      currentTaskIds: JSON.stringify(project.currentTaskIds),
      parentProjectId: project.parentProjectId,
      data: JSON.stringify(project.data)
    });
    return project;
  }

  getProject(projectId: string): ProjectSnapshotV1 | null {
    const row = this.db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return projectSnapshotV1Schema.parse({
      id: row.id,
      name: row.name,
      flowKey: row.flow_key,
      flowRevision: row.flow_revision,
      status: row.status,
      currentStepIds: JSON.parse(String(row.current_step_ids)),
      currentTaskIds: JSON.parse(String(row.current_task_ids)),
      parentProjectId: row.parent_project_id ?? null,
      data: JSON.parse(String(row.data)),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  listProjects(): ProjectSnapshotV1[] {
    const rows = this.db.prepare(`SELECT id FROM projects ORDER BY updated_at DESC`).all() as Array<{ id: string }>;
    return rows.map((row) => this.getProject(row.id)).filter(Boolean) as ProjectSnapshotV1[];
  }

  saveTask(task: TaskSnapshotV1): TaskSnapshotV1 {
    this.db.prepare(`
      INSERT INTO tasks (id, project_id, step_id, step_name, status, assignees, draft_submission, action_log, created_at, updated_at, completed_at)
      VALUES (@id, @projectId, @stepId, @stepName, @status, @assignees, @draftSubmission, @actionLog, @createdAt, @updatedAt, @completedAt)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        assignees = excluded.assignees,
        draft_submission = excluded.draft_submission,
        action_log = excluded.action_log,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at
    `).run({
      ...task,
      assignees: JSON.stringify(task.assignees),
      draftSubmission: JSON.stringify(task.draftSubmission),
      actionLog: JSON.stringify(task.actionLog),
      completedAt: task.completedAt
    });
    return task;
  }

  getTask(taskId: string): TaskSnapshotV1 | null {
    const row = this.db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(taskId) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return taskSnapshotV1Schema.parse({
      id: row.id,
      projectId: row.project_id,
      stepId: row.step_id,
      stepName: row.step_name,
      status: row.status,
      assignees: JSON.parse(String(row.assignees)),
      draftSubmission: JSON.parse(String(row.draft_submission)),
      actionLog: JSON.parse(String(row.action_log)),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at ?? null
    });
  }

  listTasks(filter?: { projectId?: string; status?: string }): TaskSnapshotV1[] {
    const clauses: string[] = [];
    const values: Array<string> = [];
    if (filter?.projectId) {
      clauses.push("project_id = ?");
      values.push(filter.projectId);
    }
    if (filter?.status) {
      clauses.push("status = ?");
      values.push(filter.status);
    }
    const sql = `SELECT id FROM tasks${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY updated_at DESC`;
    const rows = this.db.prepare(sql).all(...values) as Array<{ id: string }>;
    return rows.map((row) => this.getTask(row.id)).filter(Boolean) as TaskSnapshotV1[];
  }

  appendEvent(event: EventRecord): EventRecord {
    this.db.prepare(`
      INSERT INTO events (id, type, project_id, task_id, payload, created_at)
      VALUES (@id, @type, @projectId, @taskId, @payload, @createdAt)
    `).run({
      ...event,
      payload: JSON.stringify(event.payload)
    });
    return event;
  }

  listEvents(filter?: { projectId?: string; taskId?: string; limit?: number }): EventRecord[] {
    const clauses: string[] = [];
    const values: Array<string | number> = [];
    if (filter?.projectId) {
      clauses.push("project_id = ?");
      values.push(filter.projectId);
    }
    if (filter?.taskId) {
      clauses.push("task_id = ?");
      values.push(filter.taskId);
    }
    const sql = `SELECT * FROM events${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT ?`;
    values.push(filter?.limit ?? 20);
    const rows = this.db.prepare(sql).all(...values) as Array<Record<string, unknown>>;
    return rows.map((row) => eventSchema.parse({
      id: row.id,
      type: row.type,
      projectId: row.project_id ?? null,
      taskId: row.task_id ?? null,
      payload: JSON.parse(String(row.payload)),
      createdAt: row.created_at
    }));
  }

  saveArtifact(artifact: ArtifactRecord): ArtifactRecord {
    this.db.prepare(`
      INSERT INTO artifacts (id, project_id, type, ref, payload, created_at)
      VALUES (@id, @projectId, @type, @ref, @payload, @createdAt)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload
    `).run({
      ...artifact,
      payload: JSON.stringify(artifact.payload)
    });
    return artifact;
  }

  listArtifacts(projectId: string): ArtifactRecord[] {
    const rows = this.db.prepare(`SELECT * FROM artifacts WHERE project_id = ? ORDER BY created_at DESC`).all(projectId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      type: String(row.type),
      ref: String(row.ref),
      payload: JSON.parse(String(row.payload)),
      createdAt: String(row.created_at)
    }));
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS form_templates (
        key TEXT NOT NULL,
        revision INTEGER NOT NULL,
        status TEXT NOT NULL,
        definition TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (key, revision)
      );

      CREATE TABLE IF NOT EXISTS flow_templates (
        key TEXT NOT NULL,
        revision INTEGER NOT NULL,
        status TEXT NOT NULL,
        definition TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (key, revision)
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        flow_key TEXT NOT NULL,
        flow_revision INTEGER NOT NULL,
        status TEXT NOT NULL,
        current_step_ids TEXT NOT NULL,
        current_task_ids TEXT NOT NULL,
        parent_project_id TEXT,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        step_name TEXT NOT NULL,
        status TEXT NOT NULL,
        assignees TEXT NOT NULL,
        draft_submission TEXT NOT NULL,
        action_log TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        project_id TEXT,
        task_id TEXT,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL,
        ref TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  private parseTemplateRow<T>(row: unknown): TemplateRecord<T> | null {
    if (!row) {
      return null;
    }
    const source = row as JsonRow<T>;
    return {
      key: String(source.key),
      revision: Number(source.revision),
      status: String(source.status) as "draft" | "published",
      definition: JSON.parse(String(source.definition)) as T,
      createdAt: String(source.created_at),
      updatedAt: String(source.updated_at)
    };
  }
}
