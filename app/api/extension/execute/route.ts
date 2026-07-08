import { processStepResult } from "@/lib/workflows/step-executor";
import { buildVintedSteps } from "@/lib/workflows/vinted/vinted-steps";
import {
  buildSearchAccountSteps,
  buildSyncAccountSteps,
} from "@/lib/workflows/vinted/sync-steps";
import {
  buildSearchWallapopAccountSteps,
  buildSyncWallapopAccountSteps,
} from "@/lib/workflows/wallapop/wallapop-sync-steps";
import { buildImportWardrobeSteps } from "@/lib/workflows/vinted/import-steps";
import { buildWallapopImportSteps } from "@/lib/workflows/wallapop/wallapop-import-steps";
import { buildWallapopSteps } from "@/lib/workflows/wallapop/wallapop-upload-steps";
import { buildVintedDeleteListingSteps } from "@/lib/workflows/vinted/vinted-delete-steps";
import { buildWallapopDeleteListingSteps } from "@/lib/workflows/wallapop/wallapop-delete-steps";
import { buildVestiaireDeleteListingSteps } from "@/lib/workflows/vestiaire/vestiaire-delete-steps";
import { buildGetVintedItemSteps } from "@/lib/workflows/vinted/vinted-get-item-steps";
import { buildGetWallapopItemSteps } from "@/lib/workflows/wallapop/wallapop-get-item-steps";
import { buildUpdateVintedItemSteps } from "@/lib/workflows/vinted/vinted-update-steps";
import { buildUpdateWallapopItemSteps } from "@/lib/workflows/wallapop/wallapop-update-steps";
import {
  buildSearchVestiaireAccountSteps,
  buildSyncVestiaireAccountSteps,
} from "@/lib/workflows/vestiaire/vestiaire-sync-steps";
import { buildImportVestiaireSteps } from "@/lib/workflows/vestiaire/vestiaire-import-steps";
import { buildVestiaireUploadSteps } from "@/lib/workflows/vestiaire/vestiaire-upload-steps";
import { buildUpdateVestiaireItemSteps } from "@/lib/workflows/vestiaire/vestiaire-update-steps";
import { getUserFromRequest } from "@/libs/accounts/get-user";

export const dynamic = "force-dynamic";

const activeSessions = new Map<
  string,
  {
    steps: any[];
    currentStep: number;
    state: any;
  }
>();

const flowBuilders: Record<string, (payload: any) => any[]> = {
  UPLOAD_ITEM: (p) => buildVintedSteps(p.listing, p.uploadSessionId),
  SEARCH_ACCOUNT: () => buildSearchAccountSteps(),
  SYNC_ACCOUNT: (p) => buildSyncAccountSteps(p.externalId),
  IMPORT_WARDROBE: (p) => buildImportWardrobeSteps(p.externalId),
  DELETE_VINTED_ITEM: (p) => buildVintedDeleteListingSteps(p.itemExternalId),
  GET_VINTED_ITEM: (p) => buildGetVintedItemSteps(p.itemExternalId),
  UPDATE_VINTED_ITEM: (p) => buildUpdateVintedItemSteps(p.itemExternalId),

  UPLOAD_WALLAPOP_ITEM: (p) => buildWallapopSteps(p.listing),
  SEARCH_WALLAPOP_ACCOUNT: () => buildSearchWallapopAccountSteps(),
  SYNC_WALLAPOP_ACCOUNT: () => buildSyncWallapopAccountSteps(),
  IMPORT_WALLAPOP_WARDROBE: () => buildWallapopImportSteps(),
  DELETE_WALLAPOP_ITEM: (p) => buildWallapopDeleteListingSteps(p.itemExternalId),
  GET_WALLAPOP_ITEM: (p) => buildGetWallapopItemSteps(p.itemExternalId),
  UPDATE_WALLAPOP_ITEM: (p) => buildUpdateWallapopItemSteps(p.itemExternalId),

  SEARCH_VESTIAIRE_ACCOUNT: () => buildSearchVestiaireAccountSteps(),
  SYNC_VESTIAIRE_ACCOUNT: (p) => buildSyncVestiaireAccountSteps(p.vestiaireId),
  IMPORT_VESTIAIRE_WARDROBE: (p) => buildImportVestiaireSteps(p.externalId),
  UPLOAD_VESTIAIRE_ITEM: (p) => buildVestiaireUploadSteps(p.listing),
  DELETE_VESTIAIRE_ITEM: (p) =>
    buildVestiaireDeleteListingSteps(p.itemExternalId),
  UPDATE_VESTIAIRE_ITEM: (p) =>
    buildUpdateVestiaireItemSteps(
      p.userExternalId,
      p.itemExternalId,
      p.fields.price
    ),
};

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return Response.json({ error: "Usuario no autenticado" }, { status: 401 });
  }

  const body = await req.json();

  if (body.type === "START") {
    const { sessionId, flow, payload } = body;
    const builder = flowBuilders[flow];
    if (!builder) {
      return Response.json({ error: `Unknown flow: ${flow}` }, { status: 400 });
    }

    const uploadSessionId = crypto.randomUUID();
    const steps = builder({ ...payload, uploadSessionId });

    activeSessions.set(sessionId, {
      steps,
      currentStep: 0,
      state: {
        originalPayload: payload,
        photoIds: [],
        uploadSessionId,
      },
    });

    const firstStep = enrichStep(steps[0], payload);
    return Response.json({ step: firstStep, done: false });
  }

  if (body.type === "STEP_RESULT") {
    const { sessionId, result, error } = body;
    const session = activeSessions.get(sessionId);

    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (error) {
      activeSessions.delete(sessionId);
      return Response.json({ error, done: true });
    }

    const { nextStep, updatedState, nextIndex } = processStepResult(
      session.steps,
      session.currentStep,
      result,
      session.state
    );

    session.state = updatedState;
    session.currentStep = nextIndex;

    if (!nextStep) {
      activeSessions.delete(sessionId);
      return Response.json({ done: true, state: session.state, result });
    }

    const enriched = enrichStep(nextStep, session.state.originalPayload);
    return Response.json({ step: enriched, done: false });
  }

  return Response.json({ error: "Unknown type" }, { status: 400 });
}

function enrichStep(step: any, payload: any) {
  if (step.type !== "UPLOAD_PHOTO") return step;
  return {
    ...step,
    request: {
      ...step.request,
      photoUrl: payload.listing?.photo_url?.[step.request.photoIndex ?? 0],
    },
  };
}
