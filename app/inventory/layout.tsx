import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/libs/next-auth";
import config from "@/config";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import InventorySubnav from "@/components/InventorySubnav";

export default async function InventoryLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect(config.auth.loginUrl);
  }

  return (
    <AuthenticatedLayout>
      <InventorySubnav />
      {children}
    </AuthenticatedLayout>
  );
}
