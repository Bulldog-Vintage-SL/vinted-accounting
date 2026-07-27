"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { AuthError } from "next-auth";
import {
  registerWithCredentials,
  signInWithCredentials,
  signInWithEmail,
  signInWithGoogle,
} from "./actions";

interface LoginFormProps {
  callbackUrl: string;
  showEmailMagicLink: boolean;
  initialError?: string | null;
}

export function LoginForm({
  callbackUrl,
  showEmailMagicLink,
  initialError,
}: LoginFormProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isPending, startTransition] = useTransition();

  const handleError = (err: unknown) => {
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") {
        setError("Email o contraseña incorrectos");
        return;
      }
      setError(err.message || "No se pudo iniciar sesión");
      return;
    }

    if (err instanceof Error) {
      setError(err.message);
      return;
    }

    setError("No se pudo completar la operación");
  };

  const runAction = (action: (formData: FormData) => Promise<void>, formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await action(formData);
      } catch (err) {
        handleError(err);
      }
    });
  };

  return (
    <div className="card w-full max-w-md bg-base-100 shadow-xl">
      <div className="card-body gap-6">
        <div className="flex rounded-lg bg-base-200 p-1 mb-2">
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === "login" ? "bg-base-100 shadow-sm" : "text-base-content/70"
            }`}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === "register" ? "bg-base-100 shadow-sm" : "text-base-content/70"
            }`}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            Crear cuenta
          </button>
        </div>

        {error ? (
          <div role="alert" className="alert alert-error mt-2">
            <span>{error}</span>
          </div>
        ) : null}

        <form
          className="flex flex-col gap-5 mt-8"
          action={(formData) =>
            runAction(
              mode === "login" ? signInWithCredentials : registerWithCredentials,
              formData
            )
          }
        >
          <input type="hidden" name="callbackUrl" value={callbackUrl} />

          {mode === "register" ? (
            <label className="form-control w-full">
              <span className="label-text mb-2">Nombre</span>
              <input
                name="name"
                type="text"
                placeholder="Tu nombre"
                className="input input-bordered w-full"
                autoComplete="name"
              />
            </label>
          ) : null}

          <label className="form-control w-full">
            <span className="label-text mb-2">Email</span>
            <input
              name="email"
              type="email"
              placeholder="email@example.com"
              className="input input-bordered w-full"
              required
              autoComplete="email"
            />
          </label>

          <label className="form-control w-full">
            <span className="label-text mb-2">Contraseña</span>
            <input
              name="password"
              type="password"
              placeholder={mode === "register" ? "Mínimo 8 caracteres" : "Tu contraseña"}
              className="input input-bordered w-full"
              required
              minLength={mode === "register" ? 8 : 1}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
          </label>

          <button
            type="submit"
            className="btn btn-primary w-full mt-4"
            disabled={isPending}
          >
            {isPending
              ? "Cargando..."
              : mode === "login"
                ? "Iniciar sesión"
                : "Crear cuenta"}
          </button>
        </form>

        <div className="divider text-sm">o continúa con</div>

        <form action={signInWithGoogle}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <button
            type="submit"
            className="btn btn-outline w-full gap-3"
            disabled={isPending}
          >
            <Image
              src="https://authjs.dev/img/providers/google.svg"
              alt=""
              width={20}
              height={20}
              aria-hidden
            />
            Google (Gmail sync)
          </button>
        </form>

        {showEmailMagicLink ? (
          <form
            className="space-y-3"
            action={(formData) => runAction(signInWithEmail, formData)}
          >
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <label className="form-control w-full">
              <span className="label-text mb-2">Enlace mágico por email</span>
              <input
                name="email"
                type="email"
                placeholder="email@example.com"
                className="input input-bordered w-full"
                required
                autoComplete="email"
              />
            </label>
            <button
              type="submit"
              className="btn btn-ghost w-full"
              disabled={isPending}
            >
              Enviar enlace de acceso
            </button>
          </form>
        ) : null}

        <p className="text-center text-sm text-base-content/60">
          <Link href="/" className="link link-hover">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
