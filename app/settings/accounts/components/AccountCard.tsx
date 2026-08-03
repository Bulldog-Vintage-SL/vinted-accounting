"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { RefreshCw } from "lucide-react";
import type { SyncStatus } from "../types";
import { deleteAccount } from "../actions";
import type { Account } from "../types";
import {
  syncVintedAccount,
  syncWallapopAccount,
  syncVestiaireAccount,
  syncDepopAccount,
  syncEbayAccount,
} from '@/lib/external-integrations';
import { hasEbaySellAccountScope } from "@/libs/ebay/client";

interface Props {
  account: Account;
}

export default function AccountCard({ account }: Props) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  const status = normalizeStatus(account.sync_status);
  const isShopify = account.platform === "shopify";
  const isEbay = account.platform === "ebay";
  const ebayNeedsReconnect =
    isEbay && account.ebay_scopes && !hasEbaySellAccountScope(account.ebay_scopes);
  const ebayNeedsPolicies = isEbay && !account.ebay_policies_ready;

  const syncMap: Record<string, (externalId: string) => Promise<any>> = {
    vinted: syncVintedAccount,
    wallapop: syncWallapopAccount,
    vestiaire: (externalId) =>
      syncVestiaireAccount(externalId, account.vestiaire_id ?? null),
    depop: syncDepopAccount,
    ebay: () => syncEbayAccount(account.id),
  };

  const platformNames: Record<string, string> = {
    vinted: "Vinted",
    wallapop: "Wallapop",
    vestiaire: "Vestiaire Collective",
    depop: "Depop",
    shopify: "Shopify",
    ebay: "eBay",
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const syncFn = syncMap[account.platform];
      if (!syncFn) {
        toast.error(
          `Plataforma "${account.platform}" no soportada para sincronización`
        );
        return;
      }

      const res = await syncFn(account.external_id);

      if (res?.ok) {
        toast.success(res.message);
      } else {
        const platformName = platformNames[account.platform] || account.platform;
        toast.error(
          res?.message ??
            `Asegúrate de tener la pestaña de ${platformName} abierta e iniciada sesión.`
        );
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Error inesperado al sincronizar");
    } finally {
      setSyncing(false);
      router.refresh();
    }
  };

  const profileUrl = isShopify
    ? `https://${account.shopify_shop_domain}/admin`
    : account.profile_link || "#";

  return (
    <div className="flex items-center justify-between border border-gray-200 rounded-lg p-3 bg-gray-50/50">
      <div className="flex flex-col min-w-0">
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 hover:underline truncate"
        >
          {account.account_name || "Cuenta"}
        </a>
        <span className={`text-sm mt-1 ${statusColor(status)}`}>
          {statusLabel(status)}
        </span>
        {isEbay && (ebayNeedsReconnect || ebayNeedsPolicies) && (
          <span className="text-xs mt-1 text-amber-700">
            {ebayNeedsReconnect
              ? "Faltan permisos de políticas — pulsa Reconectar"
              : "Políticas de venta pendientes — pulsa Verificar"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        {isEbay && (
          <a
            href="/api/ebay/install"
            className="px-3 py-1.5 text-sm rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 transition"
          >
            Reconectar
          </a>
        )}
        {!isShopify && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : isEbay ? "Verificar" : "Sincronizar"}
          </button>
        )}

        <button
          onClick={async () => {
            await deleteAccount(account.id);
            router.refresh();
          }}
          disabled={syncing}
          className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

function normalizeStatus(status: Account["sync_status"]): SyncStatus {
  if (status === "connected") return "OK";
  if (status === "OK" || status === "NEEDS_SYNC" || status === "ACCOUNT_NOT_FOUND") {
    return status;
  }
  return "OK";
}

function statusLabel(status: SyncStatus) {
  const labels: Record<SyncStatus, string> = {
    OK: "Activa",
    NEEDS_SYNC: "Requiere sincronización",
    ACCOUNT_NOT_FOUND: "Sesión expirada",
  };
  return labels[status];
}

function statusColor(status: SyncStatus) {
  const colors: Record<SyncStatus, string> = {
    OK: "text-emerald-700",
    NEEDS_SYNC: "text-amber-700",
    ACCOUNT_NOT_FOUND: "text-red-700",
  };
  return colors[status];
}
