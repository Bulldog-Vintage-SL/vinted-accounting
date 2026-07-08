export function buildSearchVestiaireAccountSteps(): any[] {
  return [
    {
      id: crypto.randomUUID(),
      platform: 'vestiaire',
      type: 'GET_VEST_USER_ID',
      request: {
        url: 'https://es.vestiairecollective.com/',
        method: 'GET',
        extractFromDom: 'userId' 
      }
    }
  ]
}

export function buildSyncVestiaireAccountSteps(vestiaireId: string): any[] {
  return [
    {
      id: crypto.randomUUID(),
      type: 'CHECK_ACCOUNT',
      platform: 'vestiaire',
      request: {
        url: 'https://es.vestiairecollective.com/',
        method: 'GET',
        extractFromDom: 'userId',
        expectedUserId: vestiaireId
      }
    }
  ]
}
