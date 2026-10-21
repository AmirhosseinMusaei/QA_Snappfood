import type { Response } from "express";

// Defence in depth: sanitise nested relations as well as top-level mutation DTOs.
export function publicData(value: any): any {
  if (
    value instanceof Date ||
    Buffer.isBuffer(value) ||
    value === null ||
    typeof value !== "object"
  )
    return value;
  if (Array.isArray(value)) return value.map(publicData);
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          ![
            "password",
            "token_hash",
            "request_hash",
            "idempotency_key",
          ].includes(key),
      )
      .map(([key, val]) => [key, publicData(val)]),
  );
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any,
  ) {
    super(message);
  }
}
export function apiFailure(res: Response, err: any) {
  const status =
    err instanceof ApiError
      ? err.status
      : err?.name === "ZodError"
        ? 400
        : ["P2002", "P2025", "P2034", "P2028"].includes(err?.code)
          ? 409
          : 500;
  if (status === 500) console.error(err);
  return res
    .status(status)
    .json({
      success: false,
      message:
        status === 500
          ? "خطای داخلی سرور؛ دوباره تلاش کنید"
          : err?.name === "ZodError"
            ? "اطلاعات نامعتبر: " +
              err.issues.map((i: any) => i.path.join(".")).join("، ")
            : err.message,
      ...(err?.details || {}),
    });
}
