export type Me = {
  user: { id: string; email: string; name: string | null };
  organizations: { id: string; name: string; slug: string; role: "OWNER" | "ADMIN" | "MEMBER" }[];
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error ?? "Error inesperado"), { status: res.status });
  return body as T;
}
