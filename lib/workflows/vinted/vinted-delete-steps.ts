export function buildVintedDeleteListingSteps(itemExternalId: string): any[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'vinted',
      type: 'DELETE_VINTED',
      request: {
        url: `https://www.vinted.es/api/v2/items/${itemExternalId}/delete`,
        method: 'POST'
      }
    }
  ]
}