export async function syncEbayAccount(accountId: string) {
  const res = await fetch("/api/ebay/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });

  const data = await res.json();
  return {
    ok: res.ok && data?.ok,
    message: data?.message ?? data?.error ?? "Error desconocido",
  };
}
