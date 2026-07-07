import { ReactNode } from "react";
import { AccountsListener } from "./components/AccountListener";

export default function AccountsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <AccountsListener />
      {children}
    </>
  );
}
