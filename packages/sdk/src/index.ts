import { type CliResultV1 } from "@bpair/shared";

export interface BpairClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
}

export class BpairClient {
  constructor(private readonly options: BpairClientOptions) {}

  listForms() {
    return this.request("/v1/forms");
  }

  createFlow(definition: unknown) {
    return this.request("/v1/flows", {
      method: "POST",
      body: JSON.stringify(definition)
    });
  }

  updateForm(key: string, patch: unknown) {
    return this.request(`/v1/forms/${key}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
  }

  createProject(payload: unknown) {
    return this.request("/v1/projects", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  submitTask(taskId: string, payload: unknown) {
    return this.request(`/v1/tasks/${taskId}/submit`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  getProject(projectId: string) {
    return this.request(`/v1/projects/${projectId}`);
  }

  explainProject(projectId: string) {
    return this.request(`/v1/projects/${projectId}/explain`);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<CliResultV1<T>> {
    const response = await fetch(new URL(path, this.options.baseUrl), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...this.options.headers,
        ...init?.headers
      }
    });
    return response.json() as Promise<CliResultV1<T>>;
  }
}
