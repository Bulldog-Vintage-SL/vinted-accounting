import { ConfigProps } from "./types/config";
import { brandColors } from "./libs/brand";

const themes = {
  light: {
    primary: brandColors.red,
  }
};

const config = {
  // REQUIRED
  appName: "Reventa Libertad",
  // REQUIRED: a short description of your app for SEO tags (can be overwritten)
  appDescription:
    "La plataforma de contabilidad creada exclusivamente para revendedores. Controla ventas, pedidos, gastos, inventario y beneficios reales sin Excel, sin líos y sin perder dinero.",
  // REQUIRED (no https://, not trailing slash at the end, just the naked domain)
  domainName: "Reventa Libertad.com",
  crisp: {
    // Crisp website ID. IF YOU DON'T USE CRISP: just remove this => Then add a support email in this config file (resend.supportEmail) otherwise customer support won't work.
    id: "",
    // Hide Crisp by default, except on route "/". Crisp is toggled with <ButtonSupport/>. If you want to show Crisp on every routes, just remove this below
    onlyShowOnRoutes: ["/"],
  },
  stripe: {
    plans: [
      {
        priceId:
          process.env.NODE_ENV === "development"
            ? "price_1SevlPERxtxjzj6apzk66kd3"  // Development priceId
            : "price_1SevlPERxtxjzj6apzk66kd3",                    // Production priceId
        name: "Starter",
        description: "Perfecto para tu negocio de reventa",
        price: 19.95,
        priceAnchor: 24.95,
        features: [
          { name: "Ventas y pedidos ilimitados" },
          { name: "Registro de gastos" },
          { name: "Impresión de etiquetas" },
          { name: "Control de inventario" },
        ],
      },
      {
        priceId:
          process.env.NODE_ENV === "development"
            ? "price_1SevlxERxtxjzj6aMyZAZvys"  // Development priceId
            : "price_1SevlxERxtxjzj6aMyZAZvys",                    // Production priceId
        isFeatured: true,
        name: "Advanced",
        description: "Para revendedores que quieren escalar con control total",
        price: 29.95,
        priceAnchor: 49.95,
        features: [
          { name: "Ventas y pedidos ilimitados" },
          { name: "Registro de gastos" },
          { name: "Impresión de etiquetas con impresora térmica" },
          { name: "Control de inventario" },
          { name: "Descarga de datos en Excel" },
          { name: "Soporte técnico" },
        ],
      },
    ],
  },

  aws: {
    // If you use AWS S3/Cloudfront, put values in here
    bucket: "bucket-name",
    bucketUrl: `https://bucket-name.s3.amazonaws.com/`,
    cdn: "https://cdn-id.cloudfront.net/",
  },
  resend: {
    // REQUIRED — Email 'From' field to be used when sending magic login links
    fromNoReply: `ShipFast <noreply@resend.shipfa.st>`,
    // REQUIRED — Email 'From' field to be used when sending other emails, like abandoned carts, updates etc..
    fromAdmin: `Marc at ShipFast <marc@resend.shipfa.st>`,
    // Email shown to customer if they need support. Leave empty if not needed => if empty, set up Crisp above, otherwise you won't be able to offer customer support."
    supportEmail: "marc.louvion@gmail.com",
  },
  colors: {
    // REQUIRED — The DaisyUI theme to use (added to the main layout.js). Leave blank for default (light & dark mode). If you use any theme other than light/dark, you need to add it in config.tailwind.js in daisyui.themes.
    theme: "light",
    // REQUIRED — This color will be reflected on the whole app outside of the document (loading bar, Chrome tabs, etc..). By default it takes the primary color from your DaisyUI theme (make sure to update your the theme name after "data-theme=")
    // OR you can just do this to use a custom color: main: "#f37055". HEX only.
    main: brandColors.red,
  },
  auth: {
    // REQUIRED — the path to log in users. It's use to protect private routes (like /dashboard). It's used in apiClient (/libs/api.js) upon 401 errors from our API
    loginUrl: "/login",
    // REQUIRED — the path you want to redirect users to after a successful login (i.e. /dashboard, /private). This is normally a private page for users to manage their accounts. It's used in apiClient (/libs/api.js) upon 401 errors from our API & in ButtonSignin.js
    callbackUrl: "/dashboard",
  },
} as ConfigProps;

export default config;
