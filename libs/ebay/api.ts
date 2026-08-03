import { getEbayApiBaseUrl } from "@/libs/ebay/client";

export class EbayApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string
  ) {
    super(message);
    this.name = "EbayApiError";
  }
}

export async function ebayApiRequest<T = unknown>(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${getEbayApiBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Content-Language": "es-ES",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new EbayApiError(
      `eBay API ${method} ${path} failed (${res.status})`,
      res.status,
      text
    );
  }

  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
