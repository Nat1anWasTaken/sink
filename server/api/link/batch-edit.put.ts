import type { Link } from '#shared/schemas/link'
import type { LinkBatchEditResponse } from '#shared/types/link'
import { LinkBatchEditSchema } from '#shared/schemas/batch-edit'

defineRouteMeta({
  openAPI: {
    description: 'Batch edit existing short links',
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['slugs', 'updates'],
            properties: {
              slugs: {
                type: 'array',
                description: 'List of link slugs to update',
                items: { type: 'string' },
              },
              updates: {
                type: 'object',
                description: 'Partial fields to update on all matched links',
                properties: {
                  comment: { type: 'string', nullable: true, description: 'Set comment (null to clear)' },
                  cloaking: { type: 'boolean', nullable: true, description: 'Set cloaking (null to clear override)' },
                  redirectWithQuery: { type: 'boolean', nullable: true, description: 'Set query forwarding (null to clear override)' },
                  password: { type: 'string', nullable: true, description: 'Set password (null to clear)' },
                },
              },
            },
          },
        },
      },
    },
  },
})

function toOptionalString(value: string | null | undefined): string | undefined {
  if (value === null)
    return undefined
  return value
}

function toOptionalBoolean(value: boolean | null | undefined): boolean | undefined {
  if (value === null)
    return undefined
  return value
}

export default eventHandler(async (event) => {
  const { previewMode, kvBatchLimit } = useRuntimeConfig(event).public
  if (previewMode) {
    throw createError({
      status: 403,
      statusText: 'Preview mode cannot edit links.',
    })
  }

  const payload = await readValidatedBody(event, LinkBatchEditSchema.parse)
  const uniqueSlugs = Array.from(new Set(payload.slugs.map(slug => normalizeSlug(event, slug))))
  const maxLinks = Math.max(1, Math.floor(+kvBatchLimit / 2))

  if (uniqueSlugs.length > maxLinks) {
    throw createError({
      status: 400,
      statusText: `Too many links. Maximum ${maxLinks} links per request.`,
    })
  }

  const result: LinkBatchEditResponse = {
    updated: 0,
    failed: 0,
    links: [],
    failedItems: [],
  }

  for (const slug of uniqueSlugs) {
    try {
      const existingLink = await getLink(event, slug)
      if (!existingLink) {
        result.failed++
        result.failedItems.push({
          slug,
          reason: 'Link not found',
        })
        continue
      }

      const updatedLink: Link = {
        ...existingLink,
        updatedAt: Math.floor(Date.now() / 1000),
      }

      if (payload.updates.comment !== undefined)
        updatedLink.comment = toOptionalString(payload.updates.comment)

      if (payload.updates.password !== undefined)
        updatedLink.password = toOptionalString(payload.updates.password)

      if (payload.updates.cloaking !== undefined)
        updatedLink.cloaking = toOptionalBoolean(payload.updates.cloaking)

      if (payload.updates.redirectWithQuery !== undefined)
        updatedLink.redirectWithQuery = toOptionalBoolean(payload.updates.redirectWithQuery)

      await putLink(event, updatedLink)

      result.updated++
      result.links.push(updatedLink)
    }
    catch (error) {
      result.failed++
      result.failedItems.push({
        slug,
        reason: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return result
})
