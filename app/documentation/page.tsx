import { Suspense } from "react";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface DocSubsection {
  id: string;
  title: string;
  points: string[];
}

interface DocSection {
  id: string;
  title: string;
  description: string;
  points: string[];
  subsections?: DocSubsection[];
  screenshotHint: string;
  image?: string;
  ordered?: boolean;
}

const docSections: DocSection[] = [
  {
    id: "primeros-pasos",
    title: "Primeros pasos",
    description:
      "Reventa Libertad tiene dos partes: contabilidad de Vinted (desde Gmail) y cross-listing (publicar el mismo producto en varias tiendas).",
    points: [
      "Inicia sesión con Google. Es obligatorio: Gmail sirve para sincronizar ventas y gastos de Vinted.",
      "Ve al Dashboard y pulsa Sincronizar. La primera vez descarga todo el historial de correos de Vinted. Repítelo cada día para mantener los datos al día.",
      "Revisa ventas completadas y asigna cada venta a un lote de inventario para ver tu beneficio real y el ROI.",
      "Descarga etiquetas de envío desde ventas pendientes (una o varias a la vez).",
      "Para vender en más sitios (Wallapop, Shopify, eBay…), instala la extensión de Chrome y conecta tus cuentas en Ajustes → Cuentas vinculadas.",
    ],
    screenshotHint: "",
    ordered: true,
  },
  {
    id: "resumen-panel",
    title: "Resumen del panel",
    description: "Métricas globales y seguimiento de rendimiento desde Dashboard.",
    points: [
      "Muestra KPIs de ingresos, ganancia bruta/neta, ROI y volumen de ventas.",
      "Incluye filtros por rango de fechas para comparar periodos rápidamente.",
    ],
    screenshotHint: "Añadir captura de métricas y gráfica de evolución en Dashboard.",
    image: "/dashboard.png",
  },
  {
    id: "ventas",
    title: "Módulo de ventas",
    description: "Gestión de ventas pendientes y completadas, con edición manual.",
    points: [
      "Separa ventas pendientes de envío y ventas completadas.",
      "Permite crear, editar y eliminar ventas manuales cuando sea necesario.",
      "Incluye vinculación/desvinculación de ventas con bundles del inventario.",
      "Desde pendientes, puedes descargar etiqueta individual o varias combinadas.",
    ],
    screenshotHint: "Añadir captura de la tabla de ventas pendientes y el botón de descarga.",
    image: "/ventas-et.png",
  },
  {
    id: "inventario",
    title: "Módulo de inventario",
    description:
      "Aquí guardas tus productos (listings) y ves dónde están publicados (publicaciones). También puedes gestionar lotes de compra.",
    points: [
      "Listings: tus productos con fotos, título, precio y descripción. Es tu catálogo central.",
      "Publicaciones: cada listing publicado en una tienda concreta (Vinted, Wallapop, Shopify…).",
      "Puedes crear un producto nuevo, importarlo desde una tienda donde ya lo tengas, o publicarlo en varias a la vez.",
      "Los bundles siguen disponibles para controlar lotes de compra, coste por unidad y rentabilidad.",
      "Al eliminar un bundle, las ventas vinculadas se desvinculan automáticamente.",
    ],
    screenshotHint: "Añadir captura del listado de listings y de publicaciones.",
    image: "/inventario.png",
  },
  {
    id: "cross-listing",
    title: "Cross-listing",
    description:
      "Piensa que tienes una camiseta en el armario y quieres enseñarla en muchas tiendas a la vez. Aquí creas el producto una sola vez y la app te ayuda a ponerlo en Vinted, Wallapop, Shopify, eBay y más.",
    points: [
      "Listing = tu producto guardado en Reventa Libertad (como una ficha en un cuaderno).",
      "Publicación = ese mismo producto ya colgado en una tienda concreta (como una foto pegada en el escaparate de Vinted).",
      "Flujo típico: conectar cuenta → importar lo que ya tienes o crear producto → publicar → editar o borrar desde Publicaciones.",
      "Algunas tiendas usan la extensión de Chrome (Vinted, Wallapop, Vestiaire, Depop). Otras usan login directo en la web (Shopify, eBay).",
    ],
    subsections: [
      {
        id: "extension-chrome",
        title: "La extensión de Chrome",
        points: [
          "Instala la extensión de Reventa Libertad en Chrome. Sin ella, esas plataformas no pueden conectarse.",
          "Abre la tienda (por ejemplo vinted.es) e inicia sesión con tu cuenta de vendedor.",
          "La extensión habla con la tienda por ti, usando tu sesión, como si fueras tú haciendo clic.",
          "Si algo falla, lo más habitual es que no tengas la pestaña abierta o la sesión haya caducado. Abre la tienda, entra de nuevo y pulsa Sincronizar en Ajustes.",
        ],
      },
      {
        id: "vinted-cross",
        title: "Vinted",
        points: [
          "Conectar: Ajustes → Cuentas vinculadas → Añadir cuenta → Vinted. La extensión detecta tu usuario.",
          "Importar: Inventario → Añadir listing → Importar → eliges tu cuenta de Vinted. Trae lo que ya tienes en el armario de Vinted.",
          "Publicar: creas o editas un listing y pulsas Publicar. Eliges cuenta y la app sube fotos, categoría, talla, etc.",
          "Editar o borrar: en Publicaciones, cambias precio o eliminas el anuncio en Vinted.",
          "Nota: la sincronización de ventas y gastos de Vinted por Gmail es otra cosa (Dashboard → Sincronizar). Esto es solo para gestionar anuncios.",
        ],
      },
      {
        id: "wallapop-cross",
        title: "Wallapop",
        points: [
          "Conectar: igual que Vinted, pero con wallapop.com abierto e iniciada sesión.",
          "Importar: trae tus anuncios actuales de Wallapop a tu inventario central.",
          "Publicar: la app rellena categoría, fotos, peso del paquete y crea el anuncio por ti.",
          "Editar o borrar: desde Publicaciones, como en las demás tiendas.",
        ],
      },
      {
        id: "vestiaire-cross",
        title: "Vestiaire Collective",
        points: [
          "Conectar: extensión + sesión en vestiairecollective.com.",
          "Importar: descarga tu guardarropa de lujo que ya tengas en Vestiaire.",
          "Publicar: proceso más largo (marca, categoría, fotos, borrador). Algunas marcas de fast fashion no están permitidas.",
          "Editar precio o borrar: desde Publicaciones.",
        ],
      },
      {
        id: "depop-cross",
        title: "Depop",
        points: [
          "Conectar: extensión + sesión en depop.com.",
          "Importar: trae los productos de tu tienda Depop.",
          "Publicar y gestionar: mismo flujo que Vinted y Wallapop (listing → publicar → publicaciones).",
        ],
      },
      {
        id: "shopify-cross",
        title: "Shopify",
        points: [
          "Conectar: Ajustes → Añadir cuenta → Shopify. Escribes el dominio de tu tienda (ej. mi-tienda.myshopify.com) y autorizas en la página de Shopify.",
          "No hace falta extensión: la conexión es directa por OAuth, como cuando entras con Google.",
          "Importar: trae tus productos de Shopify al inventario.",
          "Publicar: crea el producto en Shopify con fotos, precio y stock desde un listing.",
          "Editar o borrar: desde Publicaciones, sin abrir Shopify manualmente.",
        ],
      },
      {
        id: "ebay-cross",
        title: "eBay",
        points: [
          "Conectar: Ajustes → Añadir cuenta → eBay. Te lleva a la página de eBay para autorizar la app (OAuth).",
          "Tampoco usa extensión: es login oficial de eBay, igual que Shopify.",
          "Tras conectar verás tu nombre de usuario de eBay en Cuentas vinculadas. El botón Verificar comprueba que el enlace sigue activo.",
          "Importar, publicar y sincronizar ventas en eBay están en desarrollo; por ahora solo puedes vincular la cuenta.",
        ],
      },
      {
        id: "cola-publicacion",
        title: "Cola de publicación",
        points: [
          "Si publicas varios productos seguidos, la app los pone en fila para no saturar cada tienda.",
          "Cada tienda tiene su ritmo: Vinted espera un poco más entre anuncios que Wallapop, por ejemplo.",
          "Verás el progreso en pantalla. Si uno falla, los demás siguen.",
        ],
      },
    ],
    screenshotHint: "Añadir captura del modal Añadir cuenta y del flujo Publicar listing.",
  },
  {
    id: "gastos",
    title: "Módulo de gastos",
    description: "Seguimiento de gastos de Vinted y gastos manuales con filtros.",
    points: [
      "Gestiona gastos por tipo (armario/destacado) y por rango de fechas.",
      "Permite registrar gastos manuales y también editar o eliminar existentes.",
      "Incluye paginación para facilitar revisión de histórico.",
      "Los importes se integran con Dashboard para métricas de beneficio neto.",
    ],
    screenshotHint: "Añadir captura de filtros por fecha/tipo y listado de gastos.",
    image: "/gastos.png",
  },
  {
    id: "flujo-etiquetas",
    title: "Flujo de etiquetas de envío",
    description: "Obtención y transformación de etiquetas según transportista.",
    points: [
      "Las etiquetas se obtienen desde correos asociados a ventas pendientes.",
      "La descarga puede ser individual o combinada en un único PDF.",
      "Se aplican transformaciones específicas por transportista (rotación/recorte/desplazamiento).",
    ],
    screenshotHint: "Añadir captura del resultado final de etiquetas por transportista.",
    image: "/ventas-et.png",
  },
  {
    id: "ajustes",
    title: "Ajustes y cuentas vinculadas",
    description: "Conecta tus tiendas y revisa que todo siga funcionando.",
    points: [
      "Ve a Ajustes → Cuentas vinculadas para conectar Vinted, Wallapop, Shopify, eBay y el resto.",
      "Cada tarjeta muestra tus cuentas por plataforma y si están activas o necesitan sincronizar.",
      "Sincronizar (o Verificar en eBay) comprueba que la sesión o el token siguen válidos.",
      "Eliminar desvincula la cuenta de Reventa Libertad; no borra tu tienda en la plataforma externa.",
    ],
    screenshotHint: "Añadir captura de la página de cuentas vinculadas.",
  },
];

function renderPoints(points: string[], ordered = false) {
  if (ordered) {
    return (
      <ol className="mt-2 space-y-3 text-sm text-base-content/80 list-decimal list-inside">
        {points.map((point) => (
          <li key={point} className="pl-2">
            {point}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ul className="mt-2 space-y-2 text-sm text-base-content/80 list-disc pl-5">
      {points.map((point) => (
        <li key={point}>{point}</li>
      ))}
    </ul>
  );
}

export default function DocumentationPage() {
  return (
    <>
      <Suspense>
        <Header />
      </Suspense>

      <main className="bg-base-100">
        <section className="container mx-auto px-6 py-10 lg:py-14">
          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-extrabold">Documentación</h1>
            <p className="mt-2 text-base-content/70 max-w-3xl">
              Guía de uso de Reventa Libertad: contabilidad de Vinted, inventario y
              cross-listing en varias tiendas.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="card bg-base-200">
                <div className="card-body p-4">
                  <h2 className="font-semibold text-sm uppercase tracking-wide text-base-content/70">
                    Secciones
                  </h2>
                  <nav aria-label="Secciones de documentación" className="mt-3">
                    <ul className="flex flex-col gap-2">
                      {docSections.map((section) => (
                        <li key={section.id}>
                          <a
                            href={`#${section.id}`}
                            className="link link-hover text-sm text-base-content font-medium"
                          >
                            {section.title}
                          </a>
                          {section.subsections && (
                            <ul className="mt-1 ml-3 flex flex-col gap-1 border-l border-base-content/10 pl-3">
                              {section.subsections.map((sub) => (
                                <li key={sub.id}>
                                  <a
                                    href={`#${sub.id}`}
                                    className="link link-hover text-xs text-base-content/70"
                                  >
                                    {sub.title}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  </nav>
                </div>
              </div>
            </aside>

            <div className="space-y-6">
              {docSections.map((section) => (
                <section
                  id={section.id}
                  key={section.id}
                  className="card bg-base-200 scroll-mt-24"
                >
                  <div className="card-body">
                    <h3 className="card-title text-2xl">{section.title}</h3>
                    <p className="text-base-content/70">{section.description}</p>
                    {renderPoints(section.points, section.ordered)}

                    {section.subsections && (
                      <div className="mt-6 space-y-5">
                        {section.subsections.map((sub) => (
                          <div
                            key={sub.id}
                            id={sub.id}
                            className="scroll-mt-24 rounded-lg border border-base-content/10 bg-base-100 p-4"
                          >
                            <h4 className="font-semibold text-lg text-base-content">
                              {sub.title}
                            </h4>
                            {renderPoints(sub.points)}
                          </div>
                        ))}
                      </div>
                    )}

                    {section.image && (
                      <div className="mt-4 flex justify-center">
                        <Image
                          src={section.image}
                          alt={`Captura de ${section.title}`}
                          width={800}
                          height={600}
                          className="rounded-lg border border-base-content/10 shadow-md max-w-3xl w-full h-auto"
                        />
                      </div>
                    )}

                    {!section.image && section.screenshotHint && (
                      <div className="mt-4 rounded-lg border border-dashed border-base-content/20 p-4 text-sm text-base-content/60">
                        <span className="font-semibold">Captura sugerida:</span>{" "}
                        {section.screenshotHint}
                      </div>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
