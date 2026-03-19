interface Env {
  ALLOWED_ORIGINS?: string;
  LISTMONK_API_TOKEN?: string;
  LISTMONK_API_USER?: string;
  LISTMONK_LIST_ID?: string;
  LISTMONK_URL?: string;
}

interface SubscribeRequestBody {
  email?: unknown;
  page_url?: unknown;
  source?: unknown;
}

interface ListmonkPayload {
  message?: unknown;
  data?: {
    results?: Array<{
      id: number;
      email?: string;
      name?: string;
      status?: string;
      attribs?: Record<string, unknown> | null;
      lists?: Array<{ id: number }>;
    }>;
  };
}

const DEFAULT_LISTMONK_URL = 'https://lists.a.srg.id.au';

function corsHeaders(request: Request, env: Env) {
  const origin = request.headers.get('Origin');
  const configured = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  let allowedOrigin = '*';
  if (configured.length > 0) {
    allowedOrigin = configured[0];
    if (origin && configured.includes(origin)) {
      allowedOrigin = origin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

function jsonResponse(request: Request, env: Env, status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request, env),
    },
  });
}

function normalizeBaseUrl(url?: string) {
  const value = url || DEFAULT_LISTMONK_URL;
  return value.replace(/\/+$/, '');
}

function messageFromPayload(payload: ListmonkPayload | null, fallback: string) {
  if (typeof payload?.message === 'string' && payload.message.trim() !== '') {
    return payload.message.trim();
  }

  return fallback;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function readOptionalString(body: SubscribeRequestBody, key: keyof SubscribeRequestBody) {
  return String(body[key] || '').trim();
}

function normalizePageUrl(value: string) {
  const pageUrl = value.trim();
  if (!pageUrl) return '';

  try {
    return new URL(pageUrl).toString();
  } catch {
    return '';
  }
}

function buildSubscribeAttribs({
  source,
  pageUrl,
}: {
  pageUrl: string;
  source: string;
}) {
  const attribs: Record<string, string> = {};
  if (source) attribs.source = source;
  if (pageUrl) attribs.page_url = pageUrl;
  return attribs;
}

function mergeAttribs(existing: unknown, updates: Record<string, string>) {
  const next = {
    ...(existing && typeof existing === 'object' ? existing : {}),
    ...(updates && typeof updates === 'object' ? updates : {}),
  };

  return Object.keys(next).length > 0 ? next : null;
}

async function parseRequestBody(request: Request): Promise<SubscribeRequestBody> {
  const contentType = (request.headers.get('Content-Type') || '').toLowerCase();

  if (contentType.includes('application/json')) {
    return (await request.json()) as SubscribeRequestBody;
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const form = await request.formData();
    return {
      email: form.get('email'),
      page_url: form.get('page_url'),
      source: form.get('source'),
    };
  }

  return {};
}

async function listmonkRequest(
  env: Env,
  method: string,
  path: string,
  body?: Record<string, unknown> | null,
  query?: Record<string, string | number | undefined | null>
) {
  const baseUrl = normalizeBaseUrl(env.LISTMONK_URL);
  const username = env.LISTMONK_API_USER || 'web';
  const token = env.LISTMONK_API_TOKEN;

  if (!token) {
    return {
      ok: false,
      payload: { message: "sorry, something's broken." },
      status: 500,
    };
  }

  const url = new URL(`${baseUrl}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${btoa(`${username}:${token}`)}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload: ListmonkPayload | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as ListmonkPayload;
    } catch {
      payload = { message: text };
    }
  }

  return {
    ok: response.ok,
    payload,
    status: response.status,
  };
}

async function ensureSubscriberInList(
  env: Env,
  email: string,
  listId: number,
  attribUpdates: Record<string, string>
) {
  const search = await listmonkRequest(env, 'GET', '/api/subscribers', null, { search: email });
  if (!search.ok) {
    return {
      message: messageFromPayload(search.payload, "sorry, something's broken."),
      ok: false,
    };
  }

  const results = search.payload?.data?.results || [];
  const lowerEmail = email.toLowerCase();
  const subscriber = results.find((entry) => (entry.email || '').toLowerCase() === lowerEmail);

  if (!subscriber) {
    return { alreadySubscribed: true, ok: true };
  }

  const listIds = (subscriber.lists || []).map((list) => list.id);
  const hasAttribUpdates = Object.keys(attribUpdates).length > 0;
  const nextAttribs = mergeAttribs(subscriber.attribs, attribUpdates);
  const hasList = listIds.includes(listId);

  if (hasList && !hasAttribUpdates) {
    return { alreadySubscribed: true, ok: true };
  }

  const update = await listmonkRequest(env, 'PUT', `/api/subscribers/${subscriber.id}`, {
    attribs: nextAttribs || {},
    email: subscriber.email || email,
    lists: hasList ? listIds : [...new Set([...listIds, listId])],
    name: subscriber.name || '',
    preconfirm_subscriptions: true,
    status: subscriber.status || 'enabled',
  });

  if (!update.ok) {
    return {
      message: messageFromPayload(update.payload, "sorry, something's broken."),
      ok: false,
    };
  }

  return { alreadySubscribed: hasList, ok: true };
}

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) =>
  new Response(null, {
    status: 204,
    headers: corsHeaders(request, env),
  });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: SubscribeRequestBody = {};
  try {
    body = await parseRequestBody(request);
  } catch {
    return jsonResponse(request, env, 400, {
      message: 'Invalid request body.',
      ok: false,
    });
  }

  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  if (!email || !isValidEmail(email)) {
    return jsonResponse(request, env, 400, {
      message: 'Please enter a valid email address.',
      ok: false,
    });
  }

  const parsedListId = Number(env.LISTMONK_LIST_ID || '3');
  if (!Number.isInteger(parsedListId) || parsedListId <= 0) {
    return jsonResponse(request, env, 500, {
      message: "sorry, something's broken.",
      ok: false,
    });
  }

  const source = readOptionalString(body, 'source');
  const pageUrl = normalizePageUrl(readOptionalString(body, 'page_url'));
  const subscribeAttribs = buildSubscribeAttribs({ pageUrl, source });
  const createPayload = {
    ...(Object.keys(subscribeAttribs).length > 0 ? { attribs: subscribeAttribs } : {}),
    email,
    lists: [parsedListId],
    name: '',
    preconfirm_subscriptions: true,
    status: 'enabled',
  };

  const create = await listmonkRequest(env, 'POST', '/api/subscribers', createPayload);

  if (create.ok) {
    return jsonResponse(request, env, 200, {
      already_subscribed: false,
      message: 'Subscribed successfully.',
      ok: true,
    });
  }

  const createMessage = messageFromPayload(create.payload, 'Subscription failed.');
  const isDuplicate = create.status === 409 || /already exists/i.test(createMessage);

  if (isDuplicate) {
    const ensured = await ensureSubscriberInList(env, email, parsedListId, subscribeAttribs);
    if (!ensured.ok) {
      return jsonResponse(request, env, 502, {
        message: ensured.message || 'Could not complete subscription.',
        ok: false,
      });
    }

    return jsonResponse(request, env, 200, {
      already_subscribed: !!ensured.alreadySubscribed,
      message: ensured.alreadySubscribed ? 'You are already subscribed.' : 'Subscription updated.',
      ok: true,
    });
  }

  if (create.status >= 400 && create.status < 500) {
    return jsonResponse(request, env, 400, {
      message: createMessage,
      ok: false,
    });
  }

  return jsonResponse(request, env, 502, {
    message: 'Subscription service is temporarily unavailable.',
    ok: false,
  });
};
