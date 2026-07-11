"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn } from "@/libs/next-auth";
import config from "@/config";

export async function signInWithEmail(formData: FormData): Promise<void> {
  const email = formData.get("email");
  const callbackUrl =
    (formData.get("callbackUrl") as string) || config.auth.callbackUrl;

  if (typeof email !== "string" || !email.trim()) {
    throw new Error("Introduce un email válido");
  }

  try {
    await signIn("email", { email: email.trim(), redirectTo: callbackUrl });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) throw new Error(error.message);
    throw error;
  }
}
