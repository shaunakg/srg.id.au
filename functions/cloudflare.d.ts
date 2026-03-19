interface PagesFunctionContext<Env = Record<string, unknown>> {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  data: Record<string, unknown>;
  waitUntil(promise: Promise<unknown>): void;
  next(): Promise<Response>;
}

type PagesFunction<Env = Record<string, unknown>> = (
  context: PagesFunctionContext<Env>
) => Response | Promise<Response>;
