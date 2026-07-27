"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn } from "@/libs/next-auth";
import { registerUserWithPassword } from "@/libs/auth-credentials";
import config from "@/config";

async function handleSignIn(
  provider: "google" | "email" | "credentials",
  options: { email?: string; password?: string; redirectTo: string }
): Promise<void> {
  try {
    if (provider === "google") {
      await signIn("google", { redirectTo: options.redirectTo });
      return;
    }

    if (provider === "credentials") {
      await signIn("credentials", {
        email: options.email!,
        password: options.password!,
        redirectTo: options.redirectTo,
      });
      return;
    }

    await signIn("email", {
      email: options.email!,
      redirectTo: options.redirectTo,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) throw error;
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

export async function signInWithCredentials(formData: FormData): Promise<void> {
  const email = formData.get("email");
  const password = formData.get("password");
  const callbackUrl =
    (formData.get("callbackUrl") as string) || config.auth.callbackUrl;

  if (typeof email !== "string" || !email.trim()) {
    throw new Error("Introduce un email válido");
  }

  if (typeof password !== "string" || !password) {
    throw new Error("Introduce tu contraseña");
  }

  await handleSignIn("credentials", {
    email: email.trim(),
    password,
    redirectTo: callbackUrl,
  });
}

export async function registerWithCredentials(formData: FormData): Promise<void> {
  const email = formData.get("email");
  const password = formData.get("password");
  const name = formData.get("name");
  const callbackUrl =
    (formData.get("callbackUrl") as string) || config.auth.callbackUrl;

  if (typeof email !== "string" || !email.trim()) {
    throw new Error("Introduce un email válido");
  }

  if (typeof password !== "string" || !password) {
    throw new Error("Introduce una contraseña");
  }

  await registerUserWithPassword({
    email: email.trim(),
    password,
    name: typeof name === "string" ? name.trim() : undefined,
  });

  await handleSignIn("credentials", {
    email: email.trim(),
    password,
    redirectTo: callbackUrl,
  });
}
