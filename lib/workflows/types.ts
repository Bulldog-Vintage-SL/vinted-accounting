/*
  Tipos para el motor de workflows de extension, enum de plataformas y tipos de pasos, tipos de paso y estado de workflow.
*/

export type Platform = 'vinted' | 'wallapop' | 'vestiaire'

export type StepType =
  // Vinted
  | 'GET_ITEMS_NEW'
  | 'GET_CONFIGURATION'
  | 'UPLOAD_PHOTO'
  | 'GET_VINT_ITEM'
  | 'GET_CATEGORY_SUGGESTIONS'
  | 'GET_PACKAGE_SUGGESTION'
  | 'GET_ITEM_ATTRIBUTES'
  | 'GET_BRAND'
  | 'GET_COLORS'
  | 'CREATE_ITEM'
  | 'GET_PROFILE'
  | 'DELETE_VINTED'
  | 'UPDATE_VINTED_ITEM'
  // Compartido
  | 'GET_USER_ME'
  | 'GET_USER_ID'
  | 'CHECK_ACCOUNT'
  | 'GET_WARDROBE'
  // Wallapop
  | 'GET_USER_TYPE'
  | 'GET_SUBSCRIPTIONS'
  | 'GET_WALLA_WARDROBE'
  | 'GET_WALLA_CATEGORIES'
  | 'GET_WALLA_COMPONENTS'
  | 'GET_WALLA_WEIGHT_TIERS'
  | 'CREATE_WALLA_ITEM'
  | 'UPLOAD_WALLA_PHOTO'
  | 'GET_WALLA_ITEM'
  | 'DELETE_WALLA'
  | 'UPDATE_WALLA_ITEM'
  // Vestiaire Collective
  | 'GET_VEST_USER_ID'
  | 'GET_VEST_BRANDS'
  | 'GET_VEST_CATALOG'
  | 'ADD_VEST_PRODUCT'
  | 'GET_VEST_FORM_OPTIONS'
  | 'FILL_VEST_FIELDS'
  | 'UPLOAD_VEST_PHOTO'
  | 'GET_VEST_PHOTOS'
  | 'FILL_VEST_DESCRIPTION'
  | 'SET_VEST_SHIPPING_ADDRESS'
  | 'SUBMIT_VEST_PRODUCT'
  | 'GET_VEST_ADDRESSES'
  | 'GET_VEST_DRAFT_DETAILS'
  | 'DELETE_VEST_ITEM'
  | 'UPDATE_VEST_ITEM'

export interface WorkflowStep {
  id: string
  type: StepType
  platform: Platform
  request: {
    url: string
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'
    body?: any
    isMultipart?: boolean
    photoIndex?: number
    photoUrl?: string
    extractFromDom?: string
    expectedUserId?: string
    extractTitle?: boolean
    isFormData?: boolean
  }
}

export interface WallaLocation {
  latitude: number
  longitude: number
  approximated: boolean
}

export interface WorkflowState {
  originalPayload: any

  // Compartido
  userId?: string
  profileLink?: string
  accountName?: string
  email?: string
  syncStatus?: 'OK' | 'ACCOUNT_NOT_FOUND'
  items?: any[]

  // Vinted
  photoIds: number[]
  uploadSessionId?: string
  categoryId?: number
  packageSizeId?: number
  sizeGroups?: any
  sizeId?: number
  statusId?: number
  brandId?: number
  brandName?: string
  colorIds?: number[]
  vintedItem?: any
  itemAttributesRaw?: any

  // Wallapop
  uploadId?: string          
  userType?: string
  isCommercial?: boolean
  subscriptions?: any[]
  root_category_id?: string
  category_leaf_id?: string
  subcategoryIds?: string[]
  wallaLocation?: WallaLocation
  wallaSizeId?: string       
  wallaMaxWeightKg?: number  
  wallaItemId?: string       
  wallaItem?: any

  // Vestiaire Collective
  vestiaireId?: string
  vestBrandId?: string
  vestBrandName?: string
  vestUniverseId?: string
  vestCategoryId?: string 
  vestSubcategoryId?: string
  vestDraftId?: string
  vestFormOptions?: any
  vestPhotoIds?: string[]
  vestAddressId?: string
  vestProductId?: string
  vestPublicationUrl?: string

}