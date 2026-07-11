"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import toast from "react-hot-toast";

/**
 * Component to handle session refresh errors
 * If the refresh token fails, it will sign out the user and show a message
 */
export default function SessionRefreshHandler(): null {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") {
      // Show a toast notification
      toast.error(
        "Tu sesión de Gmail ha expirado. Por favor, inicia sesión nuevamente.",
        {
          duration: 6000,
        }
      );

      // Sign out after a delay to let the user see the message
      setTimeout(() => {
        signOut({ callbackUrl: "/login" });
      }, 2000);
    }
  }, [session]);

  return null;
}

