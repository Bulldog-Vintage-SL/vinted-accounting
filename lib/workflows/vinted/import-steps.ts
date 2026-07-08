/*
  Builder de pasos de un workflow concreto.
*/

export function buildImportWardrobeSteps(userId: string): any[] {
  return [
    {
      id: crypto.randomUUID(),
      type: 'GET_WARDROBE',
      platform: 'vinted',
      request: {
        url: `https://www.vinted.es/api/v2/wardrobe/${userId}/items?page=1&per_page=20`,
        method: 'GET'
      }
    }
  ]
}