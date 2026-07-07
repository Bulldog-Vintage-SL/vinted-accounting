"use client";

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID!;
declare const chrome: any;

async function runFlow(flow: string, payload: any = {}): Promise<any> {
  if (typeof chrome === "undefined" || !chrome.runtime) return;

  return new Promise<any>((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { type: "RUN_FLOW", flow, payload },
        (response: any) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}

export async function searchVintedAccount() {
  try {
    const result = await runFlow("SEARCH_ACCOUNT");

    if (!result?.result?.state) {
      return {
        ok: false,
        message: "No se pudo obtener la cuenta desde la extensión",
      };
    }

    const { userId, profileLink } = result.result.state;
    const { accountName } = result.result.result;

    const res = await fetch("/api/accounts/vinted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalId: userId, profileLink, accountName }),
    });

    const data = await res.json();

    if (!res.ok || data.status !== "success") {
      return {
        ok: false,
        message: data.message || "Error guardando la cuenta",
      };
    }

    return { ok: true, message: data.message, data };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || "Error inesperado",
    };
  }
}

export async function searchWallapopAccount() {
  try {
    const result = await runFlow("SEARCH_WALLAPOP_ACCOUNT", {
      platform: "wallapop",
    });

    if (!result?.result?.state) {
      return {
        ok: false,
        message: "No se pudo obtener la cuenta desde la extensión",
      };
    }

    const { userId, profileLink, accountName } = result.result.state;

    const res = await fetch("/api/accounts/wallapop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalId: userId,
        profileLink,
        accountName,
      }),
    });
    const data = await res.json();

    if (!res.ok || data.status !== "success") {
      return {
        ok: false,
        message: data.message || "Error guardando la cuenta",
      };
    }

    return { ok: true, message: data.message, data };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || "Error inesperado",
    };
  }
}

export async function searchVestiaireAccount() {
  try {
    const result = await runFlow("SEARCH_VESTIAIRE_ACCOUNT");

    if (!result?.result?.state) {
      return {
        ok: false,
        message: "No se pudo obtener la cuenta desde la extensión",
      };
    }

    const { userId, profileLink, vestiaireId } = result.result.state;
    const { accountName } = result.result.result;

    const res = await fetch("/api/accounts/vestiaire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalId: userId,
        profileLink,
        accountName,
        vestiaireId,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.status !== "success") {
      return {
        ok: false,
        message: data.message || "Error guardando la cuenta",
      };
    }

    return { ok: true, message: data.message, data };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || "Error inesperado",
    };
  }
}

export async function syncWallapopAccount(externalId: string) {
  try {
    const result = await runFlow("SYNC_WALLAPOP_ACCOUNT", { externalId });

    if (!result?.result?.state) {
      await fetch("/api/accounts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalId,
          syncStatus: "ACCOUNT_NOT_FOUND",
          platform: "wallapop",
        }),
      });

      return {
        ok: false,
        message: "No se pudo obtener la cuenta desde la extensión",
      };
    }

    const { userId } = result.result.state;
    const syncStatus = userId === externalId ? "OK" : "ACCOUNT_NOT_FOUND";

    const res = await fetch("/api/accounts/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalId,
        syncStatus,
        platform: "wallapop",
      }),
    });

    const data = await res.json();

    if (!res.ok || data.status !== "success") {
      return {
        ok: false,
        message: data.message || "Error guardando la cuenta",
      };
    }

    return { ok: true, message: data.message, data };
  } catch (err: any) {
    await fetch("/api/accounts/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalId,
        syncStatus: "ACCOUNT_NOT_FOUND",
        platform: "wallapop",
      }),
    });

    return {
      ok: false,
      message: err?.message || "Error inesperado",
    };
  }
}

export async function syncVintedAccount(externalId: string) {
  try {
    const result = await runFlow("SYNC_ACCOUNT", { externalId });

    if (result?.result?.state) {
      const { syncStatus } = result.result.state;

      const res = await fetch("/api/accounts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalId,
          syncStatus,
          platform: "vinted",
        }),
      });

      const data = await res.json();

      if (!res.ok || data.status !== "success") {
        return {
          ok: false,
          message: data.message || "Error guardando la cuenta",
        };
      }

      return { ok: true, message: data.message, data };
    }

    return {
      ok: false,
      message: "No se pudo sincronizar la cuenta",
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || "Error inesperado",
    };
  }
}

export async function syncVestiaireAccount(
  externalId: string,
  vestiaireId: string | null
) {
  try {
    const result = await runFlow("SYNC_VESTIAIRE_ACCOUNT", { vestiaireId });

    if (!result?.result?.state) {
      await fetch("/api/accounts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalId,
          syncStatus: "ACCOUNT_NOT_FOUND",
          platform: "vestiaire",
        }),
      });

      return {
        ok: false,
        message: "No se pudo obtener la cuenta desde la extensión",
      };
    }

    const { syncStatus } = result.result.state;

    const res = await fetch("/api/accounts/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalId,
        syncStatus,
        platform: "vestiaire",
      }),
    });

    const data = await res.json();

    if (!res.ok || data.status !== "success") {
      return {
        ok: false,
        message: data.message || "Error guardando la cuenta",
      };
    }

    return { ok: true, message: data.message, data };
  } catch (err: any) {
    await fetch("/api/accounts/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalId,
        syncStatus: "ACCOUNT_NOT_FOUND",
        platform: "vestiaire",
      }),
    });

    return {
      ok: false,
      message: err?.message || "Error inesperado",
    };
  }
}
