const TOKEN_KEY = "xdocs_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getApiBase(): string {
  return import.meta.env?.VITE_API_BASE ?? "http://127.0.0.1:8752";
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = `${getApiBase()}${path}`;
  const headers = new Headers(init.headers);

  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init.body && !(init.body instanceof FormData)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  const resp = await fetch(url, {
    ...init,
    headers,
  });

  if (resp.status === 204) {
    return undefined as T;
  }

  const text = await resp.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!resp.ok) {
    if (resp.status === 401) {
      clearToken();
    }
    const message = typeof data === "string" ? data : data?.message;
    throw new Error(message ?? `HTTP ${resp.status}`);
  }

  return data as T;
}
