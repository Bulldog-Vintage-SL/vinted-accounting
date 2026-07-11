import Image from "next/image";
import Link from "next/link";
import config from "@/config";
import { getSEOTags } from "@/libs/seo";
import { signInWithEmail, signInWithGoogle } from "./actions";

export const metadata = getSEOTags({
  title: `Iniciar sesión | ${config.appName}`,
  description: "Accede a tu cuenta de Vintflow con Google o email.",
  canonicalUrlRelative: "/login",
});

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

const errorMessages: Record<string, string> = {
  MissingCSRF: "La sesión expiró. Vuelve a intentarlo.",
  Configuration:
    "No se pudo completar el inicio de sesión. Inténtalo de nuevo desde /login.",
  OAuthSignin: "No se pudo iniciar sesión con Google.",
  OAuthCallback: "Error al completar el inicio de sesión con Google.",
  OAuthCallbackError: "Google rechazó el inicio de sesión. Vuelve a intentarlo.",
  OAuthAccountNotLinked:
    "Este email ya está vinculado a otro método de acceso.",
  EmailSignin: "No se pudo enviar el enlace mágico.",
  SessionRequired: "Debes iniciar sesión para continuar.",
  Default: "No se pudo iniciar sesión. Vuelve a intentarlo.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? config.auth.callbackUrl;
  const showEmailLogin = Boolean(process.env.RESEND_API_KEY);
  const errorMessage = params.error
    ? (errorMessages[params.error] ?? errorMessages.Default)
    : null;

  return (
    <main className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body items-center gap-6">
          <Link href="/" className="flex flex-col items-center gap-3">
            <Image
              src={`https://${config.domainName}/icon.png`}
              alt={config.appName}
              width={64}
              height={64}
              className="rounded-xl"
              priority
            />
            <h1 className="text-2xl font-bold">{config.appName}</h1>
          </Link>

          <p className="text-center text-base-content/70">
            Elige cómo quieres iniciar sesión
          </p>

          {errorMessage ? (
            <div role="alert" className="alert alert-error w-full">
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <form action={signInWithGoogle} className="w-full">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <button type="submit" className="btn btn-outline w-full gap-3">
              <Image
                src="https://authjs.dev/img/providers/google.svg"
                alt=""
                width={20}
                height={20}
                aria-hidden
              />
              Iniciar sesión con Google
            </button>
          </form>

          {showEmailLogin ? (
            <>
              <div className="divider w-full text-sm">o</div>

              <form action={signInWithEmail} className="w-full space-y-3">
                <input type="hidden" name="callbackUrl" value={callbackUrl} />
                <label className="form-control w-full">
                  <span className="label-text mb-2">Email</span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="email@example.com"
                    className="input input-bordered w-full"
                    required
                    autoComplete="email"
                  />
                </label>
                <button type="submit" className="btn btn-primary w-full">
                  Iniciar sesión con Email
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
