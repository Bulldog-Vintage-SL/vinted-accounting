export const dynamic = "force-dynamic";

import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import PlatformCard from "./components/PlatformCard";
import AddAccountButton from "./components/AddAccountButton";
import { ShopifyConnectionListener } from "@/components/ShopifyConnectionListener";
import { getAuthenticatedUserId } from "@/libs/accounts/get-user";
import type { Account as LinkedAccount } from "./types";

export default async function AccountsPage() {
  const userId = await getAuthenticatedUserId();
  let accounts: LinkedAccount[] = [];

  if (userId) {
    await connectMongo();
    const data = await Account.find({ userId }).sort({ createdAt: -1 });
    accounts = data.map((doc) => ({
      id: doc._id.toString(),
      platform: doc.platform,
      profile_link: doc.profileLink ?? null,
      external_id: doc.externalId,
      account_name: doc.accountName ?? null,
      sync_status: doc.syncStatus,
      created_at: doc.createdAt?.toISOString() ?? new Date().toISOString(),
      vestiaire_id: doc.vestiaireId ?? null,
      shopify_shop_domain: doc.shopifyShopDomain ?? null,
    }));
  }

  const grouped = accounts.reduce<Record<string, LinkedAccount[]>>((acc, account) => {
    const key = account.platform || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(account);
    return acc;
  }, {});

  const platforms = Object.keys(grouped);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <ShopifyConnectionListener />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
              Cuentas vinculadas
            </h1>
            <p className="text-gray-500">
              Conecta y gestiona tus cuentas de marketplace.
            </p>
          </div>
          <AddAccountButton />
        </div>

        {platforms.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-8 shadow-sm text-center">
            <p className="text-base-content/70">
              No tienes ninguna cuenta vinculada todavía.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {platforms.map((platform) => (
            <PlatformCard
              key={platform}
              platform={platform}
              accounts={grouped[platform]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
