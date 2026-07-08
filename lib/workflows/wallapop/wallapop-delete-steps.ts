export function buildWallapopDeleteListingSteps(itemExternalId: string): any[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'wallapop',
      type: 'DELETE_WALLA',
      request: {
        url: `https://api.wallapop.com/api/v3/items/${itemExternalId}`,
        method: 'DELETE'
      }
    }
  ]
}