export async function api<T = any>(
  path: string,
  method = "GET",
  body?: any,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res
    .json()
    .catch(() => ({ message: "پاسخ سرور نامعتبر است" }));
  if (res.status === 401) window.dispatchEvent(new Event("qa-session-expired"));
  if (!res.ok || data.success === false) {
    const err: any = new Error(data.message || data.error || "ذخیره انجام نشد");
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}
