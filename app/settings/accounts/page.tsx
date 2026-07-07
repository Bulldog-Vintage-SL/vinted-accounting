export const dynamic = "force-dynamic";

import { createAdminClient } from "@/libs/supabase/admin";
import { getAuthenticatedProfileId } from "@/libs/accounts/get-profile-id";
import PlatformCard from "./components/PlatformCard";
import AddAccountButton from "./components/AddAccountButton";
import { ShopifyConnectionListener } from "@/components/ShopifyConnectionListener";
import type { Account } from "./types";

export default async function AccountsPage() {
  const profileId = await getAuthenticatedProfileId();
  const supabase = createAdminClient();

  let accounts: Account[] = [];

  if (profileId) {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching accounts:", error);
    } else {
      accounts = (data as Account[]) ?? [];
    }
  }

  const grouped = accounts.reduce<Record<string, Account[]>>((acc, account) => {
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
