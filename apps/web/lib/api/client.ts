import type { ApiErrorResponse } from "@/lib/api/types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function resolvePath(path: string): string {
  if (path.startsWith("/api/")) {
    return path;
  }
  if (path.startsWith("/")) {
    return `/api/v1${path}`;
  }
  return `/api/v1/${path}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T | ApiErrorResponse) : undefined;

  if (!response.ok) {
    const detail =
      typeof data === "object" && data && "detail" in data && typeof data.detail === "string"
        ? data.detail
        : `Request failed with status ${response.status}.`;
    throw new ApiError(detail, response.status);
  }

  return data as T;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(resolvePath(path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  return parseResponse<T>(response);
}

export async function apiDelete(path: string): Promise<void> {
  await apiRequest<void>(path, { method: "DELETE" });
}
