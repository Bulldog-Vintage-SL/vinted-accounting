# Campos enviados a la Inventory API de eBay

Referencia de **todos** los campos que construimos al publicar (`POST /api/ebay/upload-product`). Los valores de ejemplo son para **EBAY_ES** en producción.

Headers comunes de `ebayApiRequest` (`libs/ebay/api.ts`):

| Header | Valor EBAY_ES | Si falta |
|--------|---------------|----------|
| `Authorization` | `Bearer {accessToken}` | 401 |
| `Content-Type` | `application/json` | — |
| `Content-Language` | `es-ES` | 25709 idioma |
| `Accept-Language` | `es-ES` | 25709 |
| `X-EBAY-C-MARKETPLACE-ID` | `EBAY_ES` | 2004 serialize `marketplaceId` |

`null` / `undefined` se eliminan del body antes de enviar.

---

## 0. Validación nuestra (antes de eBay)

`validateListingRequiredFields(listing, 'ebay')` en `lib/external-integrations/validators.ts`. Se ejecuta en cliente (`uploadEbayItem`) y otra vez en `app/api/ebay/upload-product/route.ts`.

| Campo listing | ¿Obligatorio? | Error nuestro |
|---------------|---------------|---------------|
| `title` | Sí | `missingFields: [{ key: 'title', label: 'título' }]` |
| `description` | Sí | `missingFields: [{ key: 'description', label: 'descripción' }]` |
| `price` > 0 | Sí | `missingFields: [{ key: 'price', label: 'precio' }]` |
| `photo_url` / `photoUrl` | Sí | `missingFields: [{ key: 'photo_url', label: 'foto' }]` |

En cliente, `MissingFieldsError` abre el formulario de `PublishProgressModal` para rellenar el campo y reintentar. En API, HTTP 422 con `{ error, missingFields }`.

**No validamos** (pero eBay sí los usa): `attributes.size`, `attributes.brand`, `colors`, `condition`, `gender`, `stock`, categoría.

---

## 1. PUT `/sell/inventory/v1/inventory_item/{sku}`

Construido por `buildInventoryItemPayload` (`libs/ebay/mappers.ts`).

| Campo | Origen | ¿eBay lo exige? | Ejemplo | Si falta / inválido |
|-------|--------|-----------------|---------|---------------------|
| `{sku}` URL | `listing.sku` (máx. 50) o `RL-{últimos 12 del _id}` | Sí | `RL-A1B2C3D4E5F6` | Siempre se genera |
| `sku` body | Igual | Sí | `RL-A1B2C3D4E5F6` | — |
| `locale` | `getEbayContentLanguage()` con `_` | Sí | `es_ES` | Debe coincidir con `Content-Language` |
| `product.title` | `listing.title` recortado a 80 | Sí | `Camiseta Zara básica` | Fallback `"Artículo"` |
| `product.description` | `listing.description` | Sí | texto/HTML | `""` |
| `product.imageUrls` | `listing.photoUrl` (máx. 12) | Sí (≥1 para publish) | `["https://…jpg"]` | `[]` → fallo al publicar |
| `product.aspects` | `resolveEbayProductAspects` | Depende de la categoría (25002 / 25129) | ver tabla de aspectos | Omitido si `{}` |
| `condition` | `resolveEbayConditionForCategory` | Sí | `USED_EXCELLENT` | Default `USED_EXCELLENT`; 25059 si el enum no vale en la categoría |
| `conditionDescription` | `listing.condition` texto UI | No | `Muy bueno` | Se omite |
| `availability.shipToLocationAvailability.quantity` | `listing.stock ?? 1` | Sí | `1` | Default `1` |

El envío **no** va en el inventory item: va en la fulfillment policy de la offer.

### 1.1 `product.aspects` (item specifics)

Se consultan con:

```
GET /commerce/taxonomy/v1/category_tree/{treeId}/get_item_aspects_for_category?category_id={leafId}
```

Para cada aspecto de la hoja:

1. Se normaliza el nombre localizado (`Talla` → `talla`).
2. Se traduce a una fuente del listing (`talla` → `size`, `marca` → `brand`, `color` → `color`).
3. Se elige un valor de la **lista estándar** de eBay (exacto o parcial). Si hay lista, **nunca** se envía un valor custom (error 25129).
4. Si el aspecto es obligatorio y no hay match, se usa el **primer valor permitido**.

| Aspecto eBay (ES) | Fuente listing | Preferencias que enviamos | Fallback si no hay match |
|-------------------|----------------|---------------------------|--------------------------|
| `Talla` / Size | `attributes.size` (`XS`…`Talla única`) | talla + sinónimos (`XXL`/`2XL`, `Talla única`/`One Size`/`TU`) | Primer valor de la taxonomía; si no hay talla: `Talla única` / `One Size` |
| `Color` | `colors[]` (ES) | original + inglés (`Negro` + `Black`) | `Negro` / `Black` |
| `Marca` / Brand | `attributes.brand` | marca tal cual | `Unbranded` / `Sin marca` |
| `Department` / Departamento | `gender` | `mujer→Women`, `hombre→Men`, `unisex→Unisex Adults` | `Women` / `Mujer` |
| `Style` / Estilo | hardcoded | `Casual` | primer permitido si es required |
| `Material` | hardcoded | `Unknown` | primer permitido |
| `Pattern` / Estampado | hardcoded | `Solid` | primer permitido |
| Dimensiones bolso | hardcoded | `N/A` | primer permitido |

**Bug histórico (corregido):** `Talla` no estaba aliasado a `size`. El fallback genérico de aspectos required era `["Black","Other","N/A"]` y, si eBay marcaba Talla como FREE_TEXT, se publicaba `"Talla": ["Black"]` → error **25129**.

Campos del listing que hay que rellenar para moda ES:

| Listing | Recomendado | Notas |
|---------|-------------|-------|
| `attributes.size` | **Sí** | Debe coincidir con un valor de `getItemAspectsForCategory` (p.ej. `M`, `Talla única`). |
| `colors[0]` | **Sí** | Preferir nombres de `COLOR_OPTIONS` (`Negro`, `Blanco`…). |
| `attributes.brand` | Recomendado | Sin marca → `Unbranded`. |
| `gender` | Recomendado | Afecta Department. |
| `condition` | Recomendado | Ver tabla de condiciones. |
| `attributes.ebayCategoryId` | Opcional | Si es hoja válida, se usa primero. |

### 1.2 Condición

| `listing.condition` | Enum enviado |
|---------------------|--------------|
| Nuevo / new / Nuevo con etiquetas | `NEW` |
| Nuevo sin etiquetas | `NEW_OTHER` |
| Como nuevo / Muy bueno / Bueno / like new / good | `USED_EXCELLENT` |
| Aceptable / fair / Satisfactorio | `USED_ACCEPTABLE` |
| (vacío) | `USED_EXCELLENT` |

Luego se valida contra `GET /sell/metadata/v1/marketplace/EBAY_ES/get_item_condition_policies?filter=categoryIds:{id}`. En moda **no** se usa `USED_GOOD` (error 25059).

---

## 2. POST `/sell/inventory/v1/offer` (o PUT `/{offerId}`)

`createEbayOffer` / `updateEbayOffer` en `libs/ebay/inventory.ts`.

| Campo | Origen | ¿Obligatorio? | Ejemplo EBAY_ES | Si falta / inválido |
|-------|--------|---------------|-----------------|---------------------|
| `sku` | mismo SKU del inventory item | Sí | `RL-A1B2C3D4E5F6` | 25710 SKU no existe |
| `marketplaceId` | `getEbayMarketplaceId()` | Sí | `EBAY_ES` | 2004 serialize |
| `format` | hardcoded | Sí | `FIXED_PRICE` | — |
| `categoryId` | `resolveEbayLeafCategoryId` | Sí, **hoja** | `260023` (candidato ES) | **25005** no-leaf |
| `merchantLocationKey` | `ensureMerchantLocation` | Sí | `RL-ES-{accountSuffix}` | **25709** |
| `listingDescription` | `description` o `title` | Sí | texto | `""` |
| `listingPolicies.fulfillmentPolicyId` | cuenta / env / auto | Sí | id string | **25709** / **25007** envío inválido |
| `listingPolicies.paymentPolicyId` | cuenta / env / auto | Sí | id string | **25709** |
| `listingPolicies.returnPolicyId` | cuenta / env / auto | Sí | id string | **25709** |
| `pricingSummary.price.value` | `String(listing.price ?? 0)` | Sí | `"29.99"` | `"0"` si price null |
| `pricingSummary.price.currency` | `getEbayCurrency` | Sí | `EUR` | — |
| `quantity` | `listing.stock ?? 1` | Sí | `1` | Default 1 |
| `includeCatalogProductDetails` | hardcoded | Sí | `false` | — |

### 2.1 Políticas (no van en el body de offer más que como IDs)

Creadas por `ensureEbayListingPolicies` (`libs/ebay/policies.ts`).

| Recurso | Endpoint | Valores que enviamos (ES) |
|---------|----------|---------------------------|
| Ubicación | `POST /sell/inventory/v1/location/{key}` | Madrid, `28001`, `ES`, `WAREHOUSE` |
| Fulfillment | `POST /sell/account/v1/fulfillment_policy` | `ES_CorreosNationalPostal`, flat `4.99 EUR`, handling 1 DAY |
| Payment | `POST /sell/account/v1/payment_policy` | `immediatePay: false` |
| Return | `POST /sell/account/v1/return_policy` | 14 días, `MONEY_BACK`, return shipping `BUYER` |

Override por env: `EBAY_MERCHANT_LOCATION_KEY`, `EBAY_FULFILLMENT_POLICY_ID`, `EBAY_PAYMENT_POLICY_ID`, `EBAY_RETURN_POLICY_ID`.

---

## 3. POST `/sell/inventory/v1/offer/{offerId}/publish`

| Campo | Enviado | Notas |
|-------|---------|-------|
| Body | **ninguno** | POST vacío |
| `offerId` URL | de create/update | — |
| Respuesta `listingId` | eBay | Si no viene, lanzamos error |

Si la oferta ya está `PUBLISHED` con `listingId`, se omite el publish.

---

## 4. Resolución de `categoryId`

Orden en `resolveEbayLeafCategoryId`:

1. `EBAY_DEFAULT_CATEGORY_ID` (env)
2. `listing.attributes.ebayCategoryId`
3. `listing.itemType` si es solo dígitos
4. Leafs conocidos: ES `260023`, `15724`, `163570`
5. Producción: `get_category_suggestions(title + itemType)`
6. Producción: primer leaf bajo padre moda `260019`
7. Fallback `"163570"`

Un ID solo se acepta si `get_item_aspects_for_category` responde OK (es hoja).

---

## 5. Errores frecuentes de campos

| errorId | Causa | Qué rellenar / cambiar |
|---------|-------|------------------------|
| **25129** | Valor custom en aspecto cerrado (p.ej. Talla=`Black`) | `attributes.size` de la lista estándar; no enviar custom |
| **25002** | Falta un item specific required | Completar size/color/brand; la taxonomía marca cuáles son required |
| **25005** | `categoryId` no es hoja | Dejar que el resolver elija leaf; no usar 11450 |
| **25007** | Fulfillment sin servicio de envío | Recrear política (retry automático) |
| **25059** | `condition` no válido en la categoría | Usar `USED_EXCELLENT` en moda, no `USED_GOOD` |
| **25709** | Policy ID / location / Accept-Language inválidos | Reconectar cuenta o recrear políticas |
| **2004** | `marketplaceId` mal serializado | Debe ser `EBAY_ES`, no `ES` ni `null` |
| **20403** | Cuenta sin Business Policies | Opt-in Seller Hub |

---

## Source Files

- `app/api/ebay/upload-product/route.ts`
- `libs/ebay/inventory.ts`
- `libs/ebay/mappers.ts`
- `libs/ebay/policies.ts`
- `libs/ebay/api.ts`
- `libs/ebay/client.ts`

## Important Decisions

- Aspectos required usan la lista de taxonomía, no valores inventados.
- Alias de nombres ES (`Talla`, `Marca`) hacia campos del listing.
- Retry único de políticas y retry de categoría no-hoja; el 25129 **no** se reintenta (hay que corregir el aspecto).

## External Dependencies

- eBay Sell Inventory, Sell Account, Commerce Taxonomy, Sell Metadata
- Marketplace `EBAY_ES`, currency `EUR`, locale `es_ES`
