export const FB_ORIGIN = 'https://www.facebook.com'
export const FB_GRAPHQL_URL = `${FB_ORIGIN}/api/graphql/`
export const FB_UPLOAD_URL = 'https://upload.facebook.com/ajax/react_composer/attachments/photo/upload'

// Facebook can rotate doc_ids; environment values override the last captured IDs.
export const FB_DOC_IDS = {
  COMPOSER_ROOT: process.env.FB_DOC_ID_COMPOSER_ROOT || '28529225726732793',
  CATEGORY_PREDICTION:
    process.env.FB_DOC_ID_CATEGORY_PREDICTION || '8975911135844322',
  CREATE_LISTING: process.env.FB_DOC_ID_CREATE_LISTING || '9551550371629242',
  DELETE_LISTING: process.env.FB_DOC_ID_DELETE_LISTING || '30073389588942699',
  GET_LISTING_FOR_EDIT: process.env.FB_DOC_ID_GET_LISTING_FOR_EDIT || '28939900068975315',
  UPDATE_LISTING: process.env.FB_DOC_ID_UPDATE_LISTING || '28657844880538521',
  INVENTORY_PAGINATION:
    process.env.FB_DOC_ID_INVENTORY_PAGINATION ?? '27189364780746738',
} as const

export const FB_FRIENDLY_NAMES = {
  COMPOSER_ROOT:
    process.env.FB_FRIENDLY_NAME_COMPOSER_ROOT ||
    'CometMarketplaceComposerRootComponentQuery',
  CATEGORY_PREDICTION:
    process.env.FB_FRIENDLY_NAME_CATEGORY_PREDICTION ||
    'useSherlockPhotoPredictionMutation',
  CREATE_LISTING:
    process.env.FB_FRIENDLY_NAME_CREATE_LISTING ||
    'useCometMarketplaceListingCreateMutation',
  DELETE_LISTING:
    process.env.FB_FRIENDLY_NAME_DELETE_LISTING ||
    'useCometMarketplaceForSaleItemDeleteMutation',
  GET_LISTING_FOR_EDIT:
    process.env.FB_FRIENDLY_NAME_GET_LISTING_FOR_EDIT || 'MarketplacePDPContainerQuery',
  UPDATE_LISTING:
    process.env.FB_FRIENDLY_NAME_UPDATE_LISTING ||
    'useCometMarketplaceListingEditMutation',
  INVENTORY_PAGINATION:
    process.env.FB_FRIENDLY_NAME_INVENTORY_PAGINATION ??
    'MarketplaceSellerProfileInventoryListPaginationQuery',
} as const

export const FB_LISTING_FOR_EDIT_VARIABLES = {
  enableJobEmployerActionBar: false,
  enableJobSeekerActionBar: false,
  feedbackSource: 56,
  feedLocation: 'MARKETPLACE_MEGAMALL',
  referralCode: null,
  referralSurfaceString: null,
  scale: 1,
  shouldFetchLoggedOutSimilarListings: false,
  useDefaultActor: false,
  __relay_internal__pv__MarketplacePDPShouldUseListingRevamprelayprovider: false,
  __relay_internal__pv__MarketplacePDPCometSimilarListingsrelayprovider: false,
  __relay_internal__pv__MarketplacePDPShouldShowRelatedSearchesrelayprovider: true,
  __relay_internal__pv__MarketplacePDPShouldShowLoggedOutSellerTrustrelayprovider: false,
  __relay_internal__pv__ShouldUpdateMarketplaceBoostListingBoostedStatusrelayprovider: false,
  __relay_internal__pv__MarketplacePDPIsLoggedOutrelayprovider: false,
  __relay_internal__pv__CometUFIShareActionMigrationrelayprovider: false,
  __relay_internal__pv__GHLShouldChangeSponsoredDataFieldNamerelayprovider: true,
  __relay_internal__pv__GHLShouldChangeAdIdFieldNamerelayprovider: true,
  __relay_internal__pv__CometUFI_dedicated_comment_routable_dialog_gkrelayprovider: false,
  __relay_internal__pv__CometUFICommentAutoTranslationTyperelayprovider: 'ORIGINAL',
  __relay_internal__pv__CometUFICommentAvatarStickerAnimatedImagerelayprovider: false,
  __relay_internal__pv__CometUFICommentActionLinksRewriteEnabledrelayprovider: true,
  __relay_internal__pv__IsWorkUserrelayprovider: false,
  __relay_internal__pv__CometUFIReactionsEnableShortNamerelayprovider: false,
  __relay_internal__pv__CometUFISingleLineUFIrelayprovider: true,
  __relay_internal__pv__MarketplacePDPShouldShowBSGRecommendationsrelayprovider: false,
  __relay_internal__pv__MarketplacePDPJobShouldShowSharedGroupsSectionrelayprovider: false,
  __relay_internal__pv__MarketplacePDPJobIsShareToGroupsEnabledOnCometrelayprovider: false,
  __relay_internal__pv__MarketplacePDPShouldShowFAQrelayprovider: false,
  __relay_internal__pv__MarketplacePDPShouldShowRelatedCategoriesrelayprovider: false,
  __relay_internal__pv__MarketplacePDPShouldShowSupportFooterrelayprovider: false,
} as const

export const FB_COMPOSER_ROOT_VARIABLES = {
  category_id: '0',
  composer_mode: 'CREATE',
  delivery_types: ['in_person'],
  has_prefetched_category: false,
  has_prefill: false,
  is_edit: false,
  listingId: '0',
  prefill_id: '0',
  scale: 1,
  should_prefill_c2c_jobs_address: false,
  __relay_internal__pv__MarketplaceComposerShouldShowJobsCrosspostrelayprovider: false,
  __relay_internal__pv__MarketplaceComposerShouldFetchImporterDetailsrelayprovider: false,
  __relay_internal__pv__MarketplaceComposerShouldFetchBISCertificationNumberrelayprovider: false,
}

export const FB_INVENTORY_PAGE_SIZE = 8
export const FB_INVENTORY_QUERY = {
  docId: process.env.FB_DOC_ID_INVENTORY_QUERY ?? '36929885949989832',
  friendlyName: 'MarketplaceSellerProfileInventoryQuery',
} as const

function parseFacebookCategoryIds(): Record<string, string> {
  const raw = process.env.FB_CATEGORY_IDS_JSON
  if (!raw) return { default: process.env.FB_CATEGORY_DEFAULT ?? '' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('FB_CATEGORY_IDS_JSON debe contener un objeto JSON válido.')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('FB_CATEGORY_IDS_JSON debe ser un objeto con categorías.')
  }

  const ids: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string' && value.trim()) ids[key] = value.trim()
  }
  return {
    ...ids,
    default: process.env.FB_CATEGORY_DEFAULT || ids.default || '',
  }
}

export const FB_CATEGORY_IDS = parseFacebookCategoryIds()

export const FB_DEFAULT_LOCATION = {
  latitude: 40.4168,
  longitude: -3.7038,
  text: 'Madrid',
}

export const FB_TITLE_MAX = 150
