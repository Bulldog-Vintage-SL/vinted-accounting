"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn } from "@/libs/next-auth";
import config from "@/config";

async function handleSignIn(
  provider: "google" | "email",
  options: { email?: string; redirectTo: string }
): Promise<void> {
  try {
    if (provider === "google") {
      await signIn("google", { redirectTo: options.redirectTo });
      return;
    }

    await signIn("email", {
      email: options.email!,
      redirectTo: options.redirectTo,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) throw new Error(error.message);
    throw error;
  }
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const callbackUrl =
    (formData.get("callbackUrl") as string) || config.auth.callbackUrl;

  await handleSignIn("google", { redirectTo: callbackUrl });
}

export async function signInWithEmail(formData: FormData): Promise<void> {
  const email = formData.get("email");
  const callbackUrl =
    (formData.get("callbackUrl") as string) || config.auth.callbackUrl;

  if (typeof email !== "string" || !email.trim()) {
    throw new Error("Introduce un email válido");
  }

  await handleSignIn("email", {
    email: email.trim(),
    redirectTo: callbackUrl,
  });
}
