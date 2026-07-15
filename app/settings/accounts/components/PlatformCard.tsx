"use client";

import AccountCard from "./AccountCard";
import type { Account, SyncStatus } from "../types";

interface Props {
  platform: string;
  accounts: Account[];
}

export default function PlatformCard({ platform, accounts }: Props) {
  const status = computePlatformStatus(accounts);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <PlatformIcon platform={platform} />
          <h2 className="text-lg font-semibold capitalize text-gray-900">
            {platform}
          </h2>
        </div>

        <PlatformStatusBadge status={status} />
      </div>

      <div className="space-y-3">
        {accounts.map((acc) => (
          <AccountCard key={acc.id} account={acc} />
        ))}
      </div>
    </div>
  );
}

function computePlatformStatus(accounts: Account[]): SyncStatus {
  if (accounts.some((a) => normalizeStatus(a.sync_status) === "ACCOUNT_NOT_FOUND")) {
    return "ACCOUNT_NOT_FOUND";
  }

  if (accounts.some((a) => normalizeStatus(a.sync_status) === "NEEDS_SYNC")) {
    return "NEEDS_SYNC";
  }

  return "OK";
}

function normalizeStatus(status: Account["sync_status"]): SyncStatus {
  if (status === "connected") return "OK";
  if (status === "OK" || status === "NEEDS_SYNC" || status === "ACCOUNT_NOT_FOUND") {
    return status;
  }
  return "OK";
}

function PlatformStatusBadge({ status }: { status: SyncStatus }) {
  const styles: Record<SyncStatus, string> = {
    OK: "bg-emerald-100 text-emerald-700",
    NEEDS_SYNC: "bg-amber-100 text-amber-700",
    ACCOUNT_NOT_FOUND: "bg-red-100 text-red-700",
  };

  const labels: Record<SyncStatus, string> = {
    OK: "Activa",
    NEEDS_SYNC: "Requiere sincronización",
    ACCOUNT_NOT_FOUND: "Sesiones expiradas",
  };

  return (
    <span
      className={`px-3 py-1 text-sm rounded-lg font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  const icons: Record<string, string> = {
    vinted: "/icons/vinted.svg",
    wallapop: "/icons/wallapop.svg",
    vestiaire: "/icons/vestiaire.jpeg",
    shopify: "/icons/shopify.svg",
    unknown: "/icons/vinted.svg",
  };

  return (
    <img
      src={icons[platform] || icons.unknown}
      alt={platform}
      className="w-7 h-7 rounded-md"
    />
  );
}
