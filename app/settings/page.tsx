import Link from "next/link";
import { ChevronRight, Link2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
            Settings
          </h1>
          <p className="text-gray-500">
            Configura las preferencias y cuentas de tu workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/settings/accounts"
            className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:border-gray-200 transition-colors group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Link2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">
                    Cuentas vinculadas
                  </h2>
                  <p className="text-sm text-gray-500">
                    Conecta Vinted, Wallapop, Vestiaire Collective y Shopify.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors shrink-0 mt-1" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
