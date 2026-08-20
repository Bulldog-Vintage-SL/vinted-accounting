import connectMongo from "@/libs/mongoose";
import Account from "@/models/Account";
import type { IAccount } from "@/models/Account";
import { getValidEbayAccessToken } from "@/libs/ebay/account-token";
import {
  getEbayMarketplaceId,
  getEbayCurrency,
  hasEbaySellAccountScope,
  normalizeEbayMarketplaceId,
} from "@/libs/ebay/client";
import { EbayApiError } from "@/libs/ebay/api";

export interface EbayAccountContext {
  account: IAccount;
  accessToken: string;
}

export class EbayPoliciesPermissionError extends Error {
  constructor() {
    super(
      "Tu cuenta de eBay no tiene permisos para gestionar políticas de venta (sell.account). " +
        "Pulsa Reconectar en Ajustes → Cuentas vinculadas. Si sigue fallando, activa el scope " +
        "sell.account en developer.ebay.com para tu app sandbox. " +
        "Alternativa: configura EBAY_FULFILLMENT_POLICY_ID, EBAY_PAYMENT_POLICY_ID, " +
        "EBAY_RETURN_POLICY_ID y EBAY_MERCHANT_LOCATION_KEY en el servidor."
    );
    this.name = "EbayPoliciesPermissionError";
  }
}

export async function getEbayAccountContext(
  accountId: string,
  userId: string
): Promise<EbayAccountContext> {
  await connectMongo();
  const account = await Account.findOne({
    _id: accountId,
    userId,
    platform: "ebay",
  });

  if (!account) {
    throw new Error("cuenta de eBay no encontrada");
  }

  const accessToken = await getValidEbayAccessToken(account);
  return { account, accessToken };
}

export interface EbayListingPolicies {
  marketplaceId: string;
  merchantLocationKey: string;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
}

interface PolicyListResponse {
  fulfillmentPolicies?: { fulfillmentPolicyId: string }[];
  paymentPolicies?: { paymentPolicyId: string }[];
  returnPolicies?: { returnPolicyId: string }[];
}

interface LocationListResponse {
  locations?: { merchantLocationKey: string }[];
}

function firstId(
  items: { [key: string]: string }[] | undefined,
  key: string
): string | null {
  const id = items?.[0]?.[key];
  return typeof id === "string" && id ? id : null;
}

function policiesFromEnv(marketplaceId: string): Partial<EbayListingPolicies> {
  return {
    marketplaceId,
    merchantLocationKey: process.env.EBAY_MERCHANT_LOCATION_KEY,
    fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID,
    paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID,
    returnPolicyId: process.env.EBAY_RETURN_POLICY_ID,
  };
}

function hasEnvPolicies(marketplaceId: string): boolean {
  const env = policiesFromEnv(marketplaceId);
  return Boolean(
    env.merchantLocationKey &&
      env.fulfillmentPolicyId &&
      env.paymentPolicyId &&
      env.returnPolicyId
  );
}

/** Tokens issued before sell.account was added cannot read/create listing policies. */
export function accountMissingEbayPolicyScope(account: IAccount): boolean {
  if (hasEbaySellAccountScope(account.ebayScopes)) return false;
  if (!account.ebayScopes) return false;
  return true;
}

function assertEbayPolicyAccess(account: IAccount, marketplaceId: string) {
  const cachedOnAccount = Boolean(
    account.ebayMerchantLocationKey &&
      account.ebayFulfillmentPolicyId &&
      account.ebayPaymentPolicyId &&
      account.ebayReturnPolicyId
  );
  if (cachedOnAccount || hasEnvPolicies(marketplaceId)) return;

  if (accountMissingEbayPolicyScope(account)) {
    throw new EbayPoliciesPermissionError();
  }
}

const LOCATION_BY_MARKETPLACE: Record<
  string,
  {
    addressLine1: string;
    city: string;
    stateOrProvince?: string;
    postalCode: string;
    country: string;
  }
> = {
  EBAY_US: {
    addressLine1: "2125 Hamilton Ave",
    city: "San Jose",
    stateOrProvince: "CA",
    postalCode: "95125",
    country: "US",
  },
  EBAY_GB: {
    addressLine1: "1 High Street",
    city: "London",
    postalCode: "SW1A 1AA",
    country: "GB",
  },
  EBAY_ES: {
    addressLine1: "Calle Principal 1",
    city: "Madrid",
    postalCode: "28001",
    country: "ES",
  },
  EBAY_DE: {
    addressLine1: "Hauptstrasse 1",
    city: "Berlin",
    postalCode: "10115",
    country: "DE",
  },
  EBAY_FR: {
    addressLine1: "1 Rue de Rivoli",
    city: "Paris",
    postalCode: "75001",
    country: "FR",
  },
  EBAY_IT: {
    addressLine1: "Via Roma 1",
    city: "Roma",
    postalCode: "00100",
    country: "IT",
  },
};

/** Códigos de envío conocidos como válidos por marketplace (fallback del metadata). */
const SHIPPING_SERVICE_BY_MARKETPLACE: Record<string, string> = {
  EBAY_US: "USPSPriority",
  EBAY_GB: "UK_RoyalMailFirstClassStandard",
  EBAY_ES: "ES_CorreosNationalPostal",
  EBAY_DE: "DE_DHLPaket",
  EBAY_FR: "FR_LaPosteColissimo",
  EBAY_IT: "IT_ExpressCourier",
};

async function ensureMerchantLocation(
  accessToken: string,
  account: IAccount,
  marketplaceId: string,
  existingKey?: string | null
): Promise<string> {
  // Clave por marketplace: una ubicación ES no sirve para ofertas EBAY_US
  // (el envío doméstico queda inválido → error 25007).
  const merchantLocationKey =
    existingKey && existingKey.includes(marketplaceId.slice(-2))
      ? existingKey
      : `RL-${marketplaceId.replace("EBAY_", "")}-${account._id?.toString().slice(-8)}`;

  if (existingKey === merchantLocationKey) return existingKey;

  const { ebayApiRequest } = await import("@/libs/ebay/api");

  try {
    const locations = await ebayApiRequest<LocationListResponse>(
      accessToken,
      "GET",
      "/sell/inventory/v1/location?limit=20"
    );
    const keys = (locations.locations ?? [])
      .map((l) => l.merchantLocationKey)
      .filter(Boolean);
    if (keys.includes(merchantLocationKey)) return merchantLocationKey;
    const found = keys[0];
    // Solo reutilizamos una ubicación existente si su clave ya es la del marketplace
    if (found && found.includes(marketplaceId.replace("EBAY_", ""))) {
      return found;
    }
  } catch (err) {
    if (err instanceof EbayApiError && err.status === 403) {
      throw new EbayPoliciesPermissionError();
    }
    // eBay responde 500 (25001 "System error") al listar ubicaciones en
    // cuentas que aún no tienen ninguna: seguimos adelante y creamos una.
    if (!(err instanceof EbayApiError && err.status === 500)) {
      throw err;
    }
  }

  const address =
    LOCATION_BY_MARKETPLACE[marketplaceId] ?? LOCATION_BY_MARKETPLACE.EBAY_ES;

  try {
    await ebayApiRequest(
      accessToken,
      "POST",
      `/sell/inventory/v1/location/${encodeURIComponent(merchantLocationKey)}`,
      {
        location: { address },
        locationTypes: ["WAREHOUSE"],
        name: `Reventa Libertad ${marketplaceId}`,
      }
    );
  } catch (err) {
    // 409: la ubicación ya existe con esta clave; podemos reutilizarla.
    if (!(err instanceof EbayApiError && err.status === 409)) {
      throw err;
    }
  }

  return merchantLocationKey;
}

async function fetchAccountPolicies(
  accessToken: string,
  marketplaceId: string
): Promise<{
  fulfillmentPolicyId: string | null;
  paymentPolicyId: string | null;
  returnPolicyId: string | null;
}> {
  const { ebayApiRequest } = await import("@/libs/ebay/api");

  try {
    const [fulfillment, payment, returns] = await Promise.all([
      ebayApiRequest<PolicyListResponse>(
        accessToken,
        "GET",
        `/sell/account/v1/fulfillment_policy?marketplace_id=${marketplaceId}`
      ),
      ebayApiRequest<PolicyListResponse>(
        accessToken,
        "GET",
        `/sell/account/v1/payment_policy?marketplace_id=${marketplaceId}`
      ),
      ebayApiRequest<PolicyListResponse>(
        accessToken,
        "GET",
        `/sell/account/v1/return_policy?marketplace_id=${marketplaceId}`
      ),
    ]);

    return {
      fulfillmentPolicyId: firstId(
        fulfillment.fulfillmentPolicies as { fulfillmentPolicyId: string }[] | undefined,
        "fulfillmentPolicyId"
      ),
      paymentPolicyId: firstId(
        payment.paymentPolicies as { paymentPolicyId: string }[] | undefined,
        "paymentPolicyId"
      ),
      returnPolicyId: firstId(
        returns.returnPolicies as { returnPolicyId: string }[] | undefined,
        "returnPolicyId"
      ),
    };
  } catch (err) {
    if (err instanceof EbayApiError && err.status === 403) {
      throw new EbayPoliciesPermissionError();
    }
    throw err;
  }
}

/**
 * Los códigos de servicio de envío varían por marketplace. Preferimos un
 * código conocido-bueno; si Metadata API responde, validamos que esté en la
 * lista o elegimos uno doméstico de tarifa plana.
 */
async function resolveDomesticShippingServiceCode(
  accessToken: string,
  marketplaceId: string
): Promise<string> {
  const knownGood = SHIPPING_SERVICE_BY_MARKETPLACE[marketplaceId];

  try {
    const { ebayApiRequest } = await import("@/libs/ebay/api");
    const data = await ebayApiRequest<Record<string, unknown>>(
      accessToken,
      "GET",
      `/sell/metadata/v1/shipping/marketplace/${marketplaceId}/get_shipping_services`
    );

    const rawList = (data.shippingServices ??
      data.shipping_services ??
      []) as Record<string, unknown>[];

    const services = rawList
      .map((raw) => ({
        code: (raw.shippingService ??
          raw.shippingServiceCode ??
          raw.shipping_service ??
          null) as string | null,
        international: Boolean(
          raw.internationalService ?? raw.international_service ?? false
        ),
        category: (raw.shippingCategory ??
          raw.shipping_category ??
          "") as string,
        costTypes: (raw.shippingCostTypes ??
          raw.shipping_cost_types ??
          []) as string[],
        valid: (raw.validForSellingFlow ??
          raw.valid_for_selling_flow ??
          true) as boolean,
      }))
      .filter(
        (s) => s.code && s.valid && !s.international && s.category !== "PICKUP"
      );

    if (knownGood && services.some((s) => s.code === knownGood)) {
      return knownGood;
    }

    const flatRate = (s: (typeof services)[number]) =>
      s.costTypes.length === 0 || s.costTypes.includes("FLAT_RATE");

    const preferred =
      services.find((s) => s.category === "STANDARD" && flatRate(s)) ??
      services.find(flatRate) ??
      services.find((s) => s.category === "STANDARD") ??
      services[0];

    if (preferred?.code) return preferred.code;
  } catch {
    // Metadata puede fallar en sandbox; usamos el código conocido
  }

  if (knownGood) return knownGood;

  throw new Error(
    `No hay código de envío conocido para el marketplace ${marketplaceId}`
  );
}

async function createFulfillmentPolicy(
  accessToken: string,
  marketplaceId: string
): Promise<string> {
  const { ebayApiRequest } = await import("@/libs/ebay/api");
  const shippingServiceCode = await resolveDomesticShippingServiceCode(
    accessToken,
    marketplaceId
  );

  const created = await ebayApiRequest<{ fulfillmentPolicyId: string }>(
    accessToken,
    "POST",
    "/sell/account/v1/fulfillment_policy",
    {
      name: `Reventa Libertad Envío ${marketplaceId} ${Date.now()}`,
      marketplaceId,
      categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES", default: true }],
      handlingTime: { value: 1, unit: "DAY" },
      shippingOptions: [
        {
          optionType: "DOMESTIC",
          costType: "FLAT_RATE",
          shippingServices: [
            {
              sortOrder: 1,
              shippingServiceCode,
              shippingCost: {
                value: "4.99",
                currency: getEbayCurrency(marketplaceId),
              },
            },
          ],
        },
      ],
    }
  );

  return created.fulfillmentPolicyId;
}

async function fulfillmentPolicyHasShipping(
  accessToken: string,
  fulfillmentPolicyId: string
): Promise<boolean> {
  try {
    const { ebayApiRequest } = await import("@/libs/ebay/api");
    const policy = await ebayApiRequest<{
      shippingOptions?: Array<{
        shippingServices?: Array<{ shippingServiceCode?: string }>;
      }>;
    }>(
      accessToken,
      "GET",
      `/sell/account/v1/fulfillment_policy/${encodeURIComponent(fulfillmentPolicyId)}`
    );

    return Boolean(
      policy.shippingOptions?.some((opt) =>
        opt.shippingServices?.some((s) => Boolean(s.shippingServiceCode))
      )
    );
  } catch {
    return false;
  }
}

/** eBay 20403: la cuenta no está adherida al programa de Business Policies. */
function isBusinessPolicyEligibilityError(err: unknown): boolean {
  return (
    err instanceof EbayApiError &&
    err.status === 400 &&
    /not eligible for Business Policy/i.test(err.body)
  );
}

async function optInToSellingPolicyManagement(accessToken: string) {
  const { ebayApiRequest } = await import("@/libs/ebay/api");
  await ebayApiRequest(accessToken, "POST", "/sell/account/v1/program/opt_in", {
    programType: "SELLING_POLICY_MANAGEMENT",
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function createMissingPolicies(
  accessToken: string,
  marketplaceId: string,
  current: {
    fulfillmentPolicyId: string | null;
    paymentPolicyId: string | null;
    returnPolicyId: string | null;
  }
) {
  const { ebayApiRequest } = await import("@/libs/ebay/api");

  let { fulfillmentPolicyId, paymentPolicyId, returnPolicyId } = current;

  try {
    if (!fulfillmentPolicyId) {
      fulfillmentPolicyId = await createFulfillmentPolicy(
        accessToken,
        marketplaceId
      );
    }

    if (!paymentPolicyId) {
      const created = await ebayApiRequest<{ paymentPolicyId: string }>(
        accessToken,
        "POST",
        "/sell/account/v1/payment_policy",
        {
          name: "Reventa Libertad Pago",
          marketplaceId,
          categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES", default: true }],
          immediatePay: false,
        }
      );
      paymentPolicyId = created.paymentPolicyId;
    }

    if (!returnPolicyId) {
      const created = await ebayApiRequest<{ returnPolicyId: string }>(
        accessToken,
        "POST",
        "/sell/account/v1/return_policy",
        {
          name: "Reventa Libertad Devoluciones",
          marketplaceId,
          categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES", default: true }],
          returnsAccepted: true,
          returnPeriod: { value: 14, unit: "DAY" },
          refundMethod: "MONEY_BACK",
          returnShippingCostPayer: "BUYER",
        }
      );
      returnPolicyId = created.returnPolicyId;
    }
  } catch (err) {
    if (err instanceof EbayApiError && err.status === 403) {
      throw new EbayPoliciesPermissionError();
    }
    throw err;
  }

  return { fulfillmentPolicyId, paymentPolicyId, returnPolicyId };
}

/**
 * eBay responde 400 (25709) "Invalid value for xxxPolicyId" cuando la oferta
 * referencia políticas que ya no existen o pertenecen a otro entorno
 * (p. ej. IDs de sandbox/EBAY_US cacheados y reutilizados en EBAY_ES).
 * El mensaje puede venir en inglés o español según Content-Language.
 * El 25007 indica una política de envío sin servicio válido.
 */
export function isInvalidEbayPolicyError(err: unknown): boolean {
  if (!(err instanceof EbayApiError) || err.status !== 400) return false;
  const text = `${err.message}\n${err.body}`;
  return (
    /Invalid value for (fulfillment|payment|return)PolicyId|merchantLocationKey/i.test(
      text
    ) ||
    /Valor no v[aá]lido para (fulfillment|payment|return)PolicyId|merchantLocationKey/i.test(
      text
    ) ||
    /invalid data in the associated Fulfillment policy|add at least one valid shipping service/i.test(
      text
    ) ||
    /"errorId":25007/.test(text) ||
    /"errorId":25709/.test(text)
  );
}

export async function ensureEbayListingPolicies(
  account: IAccount,
  accessToken: string,
  options: { skipCache?: boolean; forceNewFulfillment?: boolean } = {}
): Promise<EbayListingPolicies> {
  const skipCache = options.skipCache ?? false;
  const forceNewFulfillment = options.forceNewFulfillment ?? false;

  // La fuente de verdad es la config del servidor (EBAY_MARKETPLACE_ID), no un
  // ebayMarketplaceId antiguo de sandbox (EBAY_US) guardado en la cuenta.
  const marketplaceId = getEbayMarketplaceId();
  const cachedMarketplace = normalizeEbayMarketplaceId(account.ebayMarketplaceId);
  const marketplaceChanged =
    Boolean(cachedMarketplace) && cachedMarketplace !== marketplaceId;

  assertEbayPolicyAccess(account, marketplaceId);

  if (
    !skipCache &&
    !forceNewFulfillment &&
    !marketplaceChanged &&
    account.ebayMerchantLocationKey &&
    account.ebayFulfillmentPolicyId &&
    account.ebayPaymentPolicyId &&
    account.ebayReturnPolicyId
  ) {
    return {
      marketplaceId,
      merchantLocationKey: account.ebayMerchantLocationKey,
      fulfillmentPolicyId: account.ebayFulfillmentPolicyId,
      paymentPolicyId: account.ebayPaymentPolicyId,
      returnPolicyId: account.ebayReturnPolicyId,
    };
  }

  // Si cambió el marketplace (US→ES) o pedimos recrear, ignoramos IDs cacheados.
  const ignoreCachedIds = skipCache || forceNewFulfillment || marketplaceChanged;

  const envPolicies: Partial<EbayListingPolicies> = ignoreCachedIds
    ? {}
    : policiesFromEnv(marketplaceId);

  let fulfillmentPolicyId =
    (ignoreCachedIds ? null : account.ebayFulfillmentPolicyId) ||
    envPolicies.fulfillmentPolicyId ||
    null;
  let paymentPolicyId =
    (ignoreCachedIds ? null : account.ebayPaymentPolicyId) ||
    envPolicies.paymentPolicyId ||
    null;
  let returnPolicyId =
    (ignoreCachedIds ? null : account.ebayReturnPolicyId) ||
    envPolicies.returnPolicyId ||
    null;
  let merchantLocationKey =
    (ignoreCachedIds ? null : account.ebayMerchantLocationKey) ||
    envPolicies.merchantLocationKey ||
    null;

  // Si el marketplace cambió, siempre crear fulfillment fresco para EBAY_ES.
  if (forceNewFulfillment || marketplaceChanged) {
    fulfillmentPolicyId = await createFulfillmentPolicy(
      accessToken,
      marketplaceId
    );
  }

  if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
    const resolveFromEbay = async () => {
      const fetched = await fetchAccountPolicies(accessToken, marketplaceId);

      let fetchedFulfillment =
        fulfillmentPolicyId || fetched.fulfillmentPolicyId;

      // Si la política existente no tiene servicio de envío, no la reutilizamos
      // (es la causa típica del error 25007).
      if (
        fetchedFulfillment &&
        !(await fulfillmentPolicyHasShipping(accessToken, fetchedFulfillment))
      ) {
        fetchedFulfillment = null;
      }

      return createMissingPolicies(accessToken, marketplaceId, {
        fulfillmentPolicyId: fetchedFulfillment,
        paymentPolicyId: paymentPolicyId || fetched.paymentPolicyId,
        returnPolicyId: returnPolicyId || fetched.returnPolicyId,
      });
    };

    let resolved: Awaited<ReturnType<typeof resolveFromEbay>> | null = null;
    try {
      resolved = await resolveFromEbay();
    } catch (err) {
      if (!isBusinessPolicyEligibilityError(err)) throw err;

      // La cuenta de eBay no está adherida a Business Policies (error 20403):
      // la adherimos vía API. El alta es asíncrona en eBay, así que
      // reintentamos unas cuantas veces antes de rendirnos.
      try {
        await optInToSellingPolicyManagement(accessToken);
      } catch {
        // Si el propio opt-in falla, dejamos que el mensaje final lo explique
      }

      for (let attempt = 0; attempt < 3 && !resolved; attempt++) {
        await sleep(3000);
        try {
          resolved = await resolveFromEbay();
        } catch (retryErr) {
          if (!isBusinessPolicyEligibilityError(retryErr)) throw retryErr;
        }
      }

      if (!resolved) {
        throw new Error(
          "Tu cuenta de eBay no está adherida a las políticas de venta (Business Policies) " +
            "y no se pudo activar automáticamente. Actívalas manualmente en " +
            "https://www.bizpolicy.ebay.es/businesspolicy/manage y vuelve a intentarlo."
        );
      }
    }

    fulfillmentPolicyId = resolved.fulfillmentPolicyId;
    paymentPolicyId = resolved.paymentPolicyId;
    returnPolicyId = resolved.returnPolicyId;
  }

  merchantLocationKey = await ensureMerchantLocation(
    accessToken,
    account,
    marketplaceId,
    merchantLocationKey
  );

  const policies: EbayListingPolicies = {
    marketplaceId,
    merchantLocationKey,
    fulfillmentPolicyId: fulfillmentPolicyId!,
    paymentPolicyId: paymentPolicyId!,
    returnPolicyId: returnPolicyId!,
  };

  await Account.findByIdAndUpdate(account._id, {
    ebayMarketplaceId: marketplaceId,
    ebayMerchantLocationKey: policies.merchantLocationKey,
    ebayFulfillmentPolicyId: policies.fulfillmentPolicyId,
    ebayPaymentPolicyId: policies.paymentPolicyId,
    ebayReturnPolicyId: policies.returnPolicyId,
  });

  return policies;
}
