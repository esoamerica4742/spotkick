interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Result<T = unknown> {
  success: boolean;
  results?: T[];
  meta: { changes?: number };
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface DurableObjectNamespace {
  getByName(name: string): DurableObjectStub;
  get(id: DurableObjectId): DurableObjectStub;
  idFromName(name: string): DurableObjectId;
}

interface DurableObjectStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface DurableObjectId {}

interface CloudflareEnv {
  DB: D1Database;
  MATCH: DurableObjectNamespace;
  MATCHMAKER: DurableObjectNamespace;
  ASSETS?: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
  WORKER_SELF_REFERENCE?: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
  SENDAR_API_KEY?: string;
  SENDAR_SENDER_ID?: string;
}
