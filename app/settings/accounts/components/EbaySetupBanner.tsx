import { getEbaySetupInfo } from "@/libs/ebay/client";

export default function EbaySetupBanner() {
  const setup = getEbaySetupInfo();

  if (setup.configured) return null;

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
      <p className="font-semibold mb-2">Configuración de eBay pendiente</p>
      <p className="mb-3">
        Falta <code className="rounded bg-amber-100 px-1">EBAY_RUNAME</code> en{" "}
        <code className="rounded bg-amber-100 px-1">.env.local</code>. eBay no
        usa la URL de callback directamente: necesitas registrar un RuName en su
        portal.
      </p>
      <ol className="list-decimal list-inside space-y-2 mb-3">
        <li>
          Abre el{" "}
          <a
            href={setup.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline"
          >
            portal de eBay ({setup.environment})
          </a>
        </li>
        <li>
          Pulsa <strong>Get a Token from eBay via Your Application</strong> →{" "}
          <strong>Add eBay Redirect URL</strong>
        </li>
        <li>
          En <strong>Auth Accepted URL</strong>, pega esta URL:
          <br />
          <code className="mt-1 inline-block rounded bg-white border border-amber-200 px-2 py-1 text-xs break-all">
            {setup.callbackUrl}
          </code>
        </li>
        <li>
          Guarda y copia el <strong>RuName</strong> generado (no es una URL)
        </li>
        <li>
          Añádelo a <code className="rounded bg-amber-100 px-1">.env.local</code>:
          <br />
          <code className="mt-1 inline-block rounded bg-white border border-amber-200 px-2 py-1 text-xs">
            EBAY_RUNAME=tu-runame-aqui
          </code>
        </li>
        <li>Reinicia el servidor de desarrollo</li>
      </ol>
    </div>
  );
}
