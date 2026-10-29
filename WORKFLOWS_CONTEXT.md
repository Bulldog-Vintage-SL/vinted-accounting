# Reventa Libertad — Sistema de workflows + extensión Chrome

> Contexto para un agente/conversación nueva. Léelo entero antes de tocar nada.
> Última actualización: 2026-10-21. Plataformas implementadas: Vinted, Wallapop, Vestiaire, Depop, Grailed, Milanuncios. En curso: **Facebook Marketplace**.

## 1. Idea central

La extensión es un **ejecutor tonto**. Toda la lógica vive en el servidor (Next.js en Vercel + MongoDB). El servidor decide el siguiente paso; la extensión lo ejecuta dentro de la sesión del usuario (cookies/tokens de la pestaña de la plataforma) y devuelve el resultado en crudo.

```
Web (Next.js)                Background SW (extensión)            Content script (pestaña plataforma)
─────────────                ─────────────────────────            ───────────────────────────────────
runFlow(flow, payload) ───►  onMessageExternal RUN_FLOW
                             startFlow():
                               ensurePlatformTabReady()
                               POST /api/extension/execute START ─► servidor crea WorkflowSession, devuelve step 0
                               loop while !done:
                                 executeStepInContentScript(step) ─► EXECUTE_STEP → executeStep(step)
                                                                    ◄─ resultado crudo (JSON) o {error}
                                 POST STEP_RESULT {result|error}  ─► servidor: processStepResult → siguiente step
                             ◄─ {done:true, state, result}
◄─ {ok:true, result}
```

Cliente: `result.result.state` contiene el estado final acumulado (ej. `state.depopPublicationUrl`).

## 2. Piezas y dónde viven

| Pieza | Fichero | Responsabilidad |
|---|---|---|
| Cliente por plataforma | `uploadXItem(listing, accountId)` (ej. `uploadDepopItem`) | Valida campos, `runFlow(...)`, lee `result.result.state`, guarda en `/api/publications` |
| Definición de workflow | `lib/workflows/<plat>/<plat>-*-steps.ts` | Devuelve `WorkflowStep[]` **esqueleto** (URLs `'DYNAMIC'`/`''` y bodies `{}` que se rellenan luego) |
| Endpoint | `app/api/extension/execute/route.ts` | `START` / `STEP_RESULT`. Registro `flowBuilders` (flow → builder). Persiste `WorkflowSession`, `WorkflowErrorLog` |
| Procesador | `lib/workflows/step-executor.ts` → `processStepResult()` | **Dos switches** (ver §4) |
| Background | `background.js` | Orquestación, gestión de pestañas, fetches privilegiados (imágenes, cookies, DNR) |
| Content scripts | `content-<plat>.js` | Ejecutan `EXECUTE_STEP` con la sesión de la página |

## 3. Contratos

### WorkflowStep
```ts
{ id: string, platform: 'vinted'|'wallapop'|..., type: 'GET_MA_USER'|..., request: {
    url: string,                 // 'DYNAMIC' o '' = se rellena en processStepResult
    method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE',
    body?: any, headers?: Record<string,string>,
    isMultipart?: boolean, photoUrl?: string, photoIndex?: number,   // subida de fotos
    extractFromDom?: 'userId',   // el content script responde sin red
    expectedUserId?: string,     // modo "check account": devuelve {matches}
    skipDelay?: boolean, runInBackground?: boolean, streamChat?: boolean, // chats
    // plataforma-específicos (ej. FB: graphql:{friendlyName, docId, variables})
}}
```

### Mensajes content script ⇄ background
- `CONTENT_SCRIPT_READY {platform, domainInfo}` — al inyectarse; el background guarda `domainInfo` y lo usa para esperar tras abrir/recargar pestañas.
- `PING → {status:'PONG', ready:true}` — health check (`pingTab`, timeout 2s).
- `REFRESH_SESSION → {ok}` — refresco ligero (Vinted: `/web/api/auth/refresh`; MA/FB: re-anunciar).
- `EXECUTE_STEP {step} → resultado | {error, debugInfo?}`.
- Helpers del background invocables desde content scripts: `FETCH_IMAGE_AS_BASE64 → {base64, mime}` (convierte webp→jpeg), `GET_*_COOKIES`, etc.

### Endpoint
- `START {sessionId, flow, payload}` → crea sesión, devuelve `{step, done:false}`.
- `STEP_RESULT {sessionId, result}` → `{step, done:false}` o `{done:true, state, result}`.
- `STEP_RESULT {sessionId, error}` → guarda `WorkflowErrorLog` (saneado: redacta claves `token|cookie|auth|jwt|secret|password|bearer`, trunca strings a 500 y arrays a 20), borra la sesión, `{error, done:true}`.
- Auth: `Authorization: Bearer <token>` (la web lo manda a la extensión vía `SET_TOKEN`).

## 4. `processStepResult` (el corazón)

Se ejecuta tras cada paso y tiene **dos switches sobre el mismo `s` (estado)**:

1. **Switch sobre `completed.type`** → *acumula* el resultado en `s` (ids, tokens, listas paginadas…). También puede **insertar pasos** con `steps.splice(currentStep + 1, 0, {...})` (paginación, reintentos, `MARK_*_READ`, campos de formulario dinámicos en Vestiaire).
2. **Switch sobre `next.type`** (sobre un **clon** del siguiente paso) → *rellena* URL/body/headers con lo acumulado.

Reglas:
- Lanzar `throw new Error(...)` aquí aborta con mensaje útil (devuelve 500; el background lo trata como error del paso en la siguiente iteración).
- Todo lo que un paso posterior necesite debe estar en `s`. `s.originalPayload` = payload original (`listing`, `externalId`…).
- `s.history` (reservado por la ruta) guarda resultados saneados de cada paso.
- Cada plataforma usa prefijo propio en `s` (`depop*`, `grailed*`, `ma*`, `vest*`, `walla*`, `fb*`).
- Las funciones `pickX/resolveX/buildXBody` viven en ficheros auxiliares por plataforma (no en el switch).

## 5. Background: reglas importantes

- **Keep-alive** del service worker MV3: alarma 0.4 min + `setInterval` 20 s con `chrome.runtime.getPlatformInfo` mientras corre un flow.
- `ensurePlatformTabReady(platform)`:
  - `PLATFORMS_WITH_LIGHT_REFRESH` (wallapop, vinted, grailed, milanuncios, facebook): ping → `REFRESH_SESSION`; si falla, recarga.
  - `PLATFORMS_REQUIRING_FORCED_RELOAD` (depop, vestiaire): recarga siempre.
  - Sin pestaña: `openPlatformTabAndWaitForScript` (pinned, `active:false`), timeout 15 s esperando `CONTENT_SCRIPT_READY`.
- `executeStepInContentScript` reintenta 1 vez si `sendMessage` falla (reabre) o si el error es de red transitorio.
- **Flujos de chat** (`BACKGROUND_CHAT_FLOWS`, `isBackgroundChatStep`) corren *sin tocar pestañas* (`suppressPlatformTabOps`). Ojo: es una variable **global de módulo** → dos flows concurrentes se pisan.
- `declarativeNetRequest` dinámico reescribe `Origin/Referer` para Depop (`webapi.depop.com`) y Milanuncios (`gw.milanuncios.com`) en fetches `xmlhttprequest`.
- Descarga de imágenes: `fetchImageAsBase64` (3 reintentos, convierte a JPEG con `OffscreenCanvas` si no es jpeg/png). Siempre se hace en background (evita CORS del content script).
- `ALLOWED_ORIGINS` limita quién puede hablar por `onMessageExternal`.

## 6. Patrones de content script

- Misma estructura en todos: `announceReady()` → listener (`PING`/`REFRESH_SESSION`/`EXECUTE_STEP`) → `executeStep(step)`.
- Auth por plataforma: Vinted = CSRF extraído de `<script>`; Milanuncios = cookies + `ajs_user_id`; Depop = token cookie leído por `executeScript` en `world:'MAIN'`; Vestiaire = `window.varLoggedInSession`.
- `randomDelay` antes de cada paso (anti-bot). Vinted además resuelve DataDome (iframe captcha).
- Multipart de fotos: base64 desde background → `Blob/File` → `FormData` (el nombre del campo cambia por plataforma: Vinted `photo[file]`, MA `media`, Vestiaire `photoN`).
- `extractFromDom:'userId'` + `expectedUserId` = verificar que la sesión abierta es la cuenta esperada (sin red).

## 7. Checklist para añadir una plataforma

1. `lib/workflows/<plat>/<plat>-constants.ts` (URLs, ids).
2. `<plat>-upload-steps.ts` (+ `sync-steps`: `SEARCH_*_ACCOUNT`, `SYNC_*_ACCOUNT`; opcional import/delete/update/chat).
3. Registrar en `flowBuilders` (`route.ts`).
4. Añadir `case`s en **ambos** switches de `processStepResult` + helpers.
5. `content-<plat>.js` + entrada en `manifest.json` (`content_scripts` + `host_permissions`).
6. `background.js`: `*_URL_PATTERNS`, `PLATFORM_URL_PATTERNS`, `PLATFORM_DEFAULT_HOME`, lista de refresco (ligero/forzado), DNR si hace falta.
7. Tipos: `platform` union, `PLATFORM_PHOTO_LIMITS`, `validateListingRequiredFields`, `truncateForPlatform`, modelo `Publication`/`Account`.
8. Cliente `uploadXItem` + UI de plataformas.

## 8. Gotchas conocidos

- `processStepResult` muta `steps` (splice): la ruta hace `markModified('steps')` y persiste; no clones el array antes.
- Los pasos legacy (`GET_MA_FORM_SCHEMA`, `UPDATE_MA_DRAFT`) siguen en el switch por compatibilidad; no los borres sin revisar sesiones en curso.
- `enrichStep` solo inyecta `photoUrl` en `UPLOAD_PHOTO` (Vinted) y `UPLOAD_MA_PHOTO`; el resto de plataformas ponen `photoUrl` al construir los steps.
- Errores de plataforma deben llegar con `debugInfo` (status, body) para el `WorkflowErrorLog`.
- Las APIs internas cambian sin avisar: IDs/categorías/nombres de campos se verifican contra tráfico real (DevTools → Network).

## 9. Facebook Marketplace (estado)

**Hecho (scaffolding):** content script, constantes, steps de upload y sync, cases de `processStepResult`, cliente `uploadFacebookItem`. Ver `INTEGRATION_FACEBOOK.md`.

**Diseño:** FB web usa **GraphQL Relay** (`POST /api/graphql/`, form-urlencoded con `fb_dtsg`, `lsd`, `jazoest`, `av`, `doc_id`, `variables`) y subida de fotos a `upload.facebook.com/ajax/react_composer/attachments/photo/upload` (multipart, campo `farr`, devuelve `photoID`). Los tokens se leen del HTML de la página (`DTSGInitialData`, `LSD`, `c_user`). El paso genérico es `request.graphql = {friendlyName, docId, variables}`.

**Pendiente (bloqueante):** capturar con DevTools una publicación manual en Marketplace y rellenar:
- `doc_id` + `friendlyName` del create-listing (variables de entorno `FB_DOC_ID_CREATE_LISTING`, etc.).
- Forma exacta de `variables` en `buildFacebookCreateListingVariables` (hoy es una aproximación marcada `VERIFICAR`).
- IDs de categoría de Marketplace (`FB_CATEGORY_IDS`) y valores de `condition`.
- Los `doc_id` de FB **rotan con los despliegues**: por eso van por env var y no hardcodeados.
