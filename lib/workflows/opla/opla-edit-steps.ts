import type { WorkflowStep } from '../types'

const OPLA_API = 'https://www.opla.co/api/public'

function articleUrl(articleId: string): string {
  if (!articleId.trim()) throw new Error('Falta el id de la publicación de Opla.')
  return `${OPLA_API}/me/articles/${encodeURIComponent(articleId)}`
}

function publicArticleUrl(articleId: string): string {
  if (!articleId.trim()) throw new Error('Falta el id de la publicación de Opla.')
  return `${OPLA_API}/articles/${encodeURIComponent(articleId)}`
}

export function buildGetOplaItemSteps(articleId: string): WorkflowStep[] {
  return [{
    id: crypto.randomUUID(),
    platform: 'opla',
    type: 'GET_OPLA_ITEM',
    request: {
      url: publicArticleUrl(articleId),
      method: 'GET',
    },
  }]
}

export function buildUpdateOplaItemSteps(articleId: string): WorkflowStep[] {
  return [
    ...buildGetOplaItemSteps(articleId),
    {
      id: crypto.randomUUID(),
      platform: 'opla',
      type: 'UPDATE_OPLA_ITEM',
      request: {
        url: articleUrl(articleId),
        method: 'PATCH',
        body: {},
      },
    },
  ]
}

export function buildDeleteOplaItemSteps(articleId: string): WorkflowStep[] {
  return [{
    id: crypto.randomUUID(),
    platform: 'opla',
    type: 'DELETE_OPLA_ITEM',
    request: {
      url: articleUrl(articleId),
      method: 'DELETE',
    },
  }]
}
