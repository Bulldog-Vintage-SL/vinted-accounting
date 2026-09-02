import type { ReactNode } from "react";

interface InventoryPageShellProps {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}

export function InventoryPageShell({
  title,
  description,
  action,
  children,
}: InventoryPageShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-3 sm:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-xl sm:p-6">
        <div className="mb-4 flex min-h-11 flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-800 sm:text-3xl">{title}</h1>
          {action ? <div className="w-full sm:w-auto">{action}</div> : null}
        </div>

        <p className="mb-6 text-sm text-gray-600 sm:mb-8 sm:text-base">{description}</p>

        {children}
      </div>
    </div>
  );
}
