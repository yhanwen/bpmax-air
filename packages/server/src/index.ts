import express from "express";
import { BpairEngine } from "@bpair/core";
import { BpairError, fail, ok, type ActionType } from "@bpair/shared";
import { SqliteBpairRepository } from "@bpair/storage-sqlite";

export interface ServerOptions {
  dbPath?: string;
  port?: number;
}

export function createServer(options: ServerOptions = {}): express.Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const engine = new BpairEngine({
    repository: new SqliteBpairRepository({ databasePath: options.dbPath })
  });

  const wrap = (handler: (req: express.Request) => unknown | Promise<unknown>) => async (req: express.Request, res: express.Response) => {
    try {
      const data = await handler(req);
      res.json(ok(data));
    } catch (error) {
      const payload = error instanceof BpairError
        ? fail(error.code, error.message)
        : fail("INTERNAL_ERROR", error instanceof Error ? error.message : "Unknown error");
      res.status(payload.ok ? 200 : 400).json(payload);
    }
  };

  app.get("/health", (_req, res) => {
    res.json(ok({ status: "ok" }));
  });

  app.get("/v1/forms", wrap(() => engine.listForms()));
  app.post("/v1/forms", wrap((req) => engine.createForm(req.body)));
  app.get("/v1/forms/:key", wrap((req) => engine.getForm(String(req.params.key), req.query.revision ? Number(req.query.revision) : undefined)));
  app.patch("/v1/forms/:key", wrap((req) => engine.updateForm(String(req.params.key), req.body)));
  app.get("/v1/forms/:key/diff", wrap((req) => engine.diffForm(String(req.params.key), Number(req.query.from), Number(req.query.to))));

  app.get("/v1/flows", wrap(() => engine.listFlows()));
  app.post("/v1/flows", wrap((req) => engine.createFlow(req.body)));
  app.get("/v1/flows/:key", wrap((req) => engine.getFlow(String(req.params.key), req.query.revision ? Number(req.query.revision) : undefined)));
  app.patch("/v1/flows/:key", wrap((req) => engine.updateFlow(String(req.params.key), req.body)));
  app.post("/v1/flows/:key/publish", wrap((req) => engine.publishFlow(String(req.params.key), req.body?.revision)));
  app.post("/v1/flows/validate", wrap((req) => engine.validateFlow(req.body)));
  app.post("/v1/flows/:key/simulate", wrap((req) => engine.simulateFlow(String(req.params.key), req.body.actions)));

  app.get("/v1/projects", wrap(() => engine.listProjects()));
  app.post("/v1/projects", wrap((req) => engine.createProject(req.body)));
  app.get("/v1/projects/:id", wrap((req) => engine.getProject(String(req.params.id))));
  app.get("/v1/projects/:id/data", wrap((req) => engine.getProjectData(String(req.params.id))));
  app.get("/v1/projects/:id/explain", wrap((req) => engine.explainRuntime(String(req.params.id))));

  app.get("/v1/tasks", wrap((req) => engine.listTasks(typeof req.query.projectId === "string" ? req.query.projectId : undefined)));
  app.get("/v1/tasks/:id", wrap((req) => engine.getTask(String(req.params.id))));
  app.post("/v1/tasks/:id/draft", wrap((req) => engine.saveTaskDraft(String(req.params.id), req.body)));
  app.post("/v1/tasks/:id/submit", wrap((req) => engine.submitTask({
    taskId: String(req.params.id),
    action: String(req.body.action) as ActionType,
    actorId: req.body.actorId ?? "system",
    submission: req.body.submission
  })));
  app.post("/v1/tasks/:id/reassign", wrap((req) => engine.reassignTask(String(req.params.id), req.body.assignees ?? [])));

  app.get("/v1/events", wrap((req) => engine.auditTail(Number(req.query.limit ?? 20), typeof req.query.projectId === "string" ? req.query.projectId : undefined)));
  app.get("/v1/audit", wrap((req) => engine.auditTail(Number(req.query.limit ?? 20), typeof req.query.projectId === "string" ? req.query.projectId : undefined)));

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  const dbPath = process.env.BPAIR_DB ?? "bpair.db";
  const app = createServer({ port, dbPath });
  app.listen(port, () => {
    process.stdout.write(`BPMax-Air server listening on http://localhost:${port}\n`);
  });
}
