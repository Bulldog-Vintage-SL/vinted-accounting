/*
  Builder de pasos de un workflow concreto.
*/

export function buildSearchAccountSteps(): any[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'vinted',
      type: 'GET_USER_ID',
      request: {
        url: 'https://www.vinted.es/',
        method: 'GET',
        extractFromDom: 'userId' 
      }
    },
    {
      id: crypto.randomUUID(),
      type: 'GET_PROFILE',
      platform: 'vinted',
      request: {
        url: 'DYNAMIC',
        method: 'GET',
        extractTitle: true
      }
    }
  ]
}

export function buildSyncAccountSteps(externalId: string): any[] {
  return [
    {
      id: crypto.randomUUID(),
      type: 'CHECK_ACCOUNT',
      platform: 'vinted',
      request: {
        url: 'https://www.vinted.es/',
        method: 'GET',
        extractFromDom: 'userId',
        expectedUserId: externalId
      }
    }
  ]
}
