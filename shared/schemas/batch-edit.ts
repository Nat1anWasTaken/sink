import { z } from 'zod'

import { LinkSchema } from './link'

const slugSchema = LinkSchema.shape.slug.removeDefault().min(1)

export const LinkBatchEditUpdatesSchema = z.object({
  comment: z.string().trim().max(2048).nullable().optional(),
  cloaking: z.boolean().nullable().optional(),
  redirectWithQuery: z.boolean().nullable().optional(),
  password: z.string().trim().min(1).max(128).nullable().optional(),
}).refine(
  value => Object.values(value).some(field => field !== undefined),
  { message: 'At least one update field is required' },
)

export const LinkBatchEditSchema = z.object({
  slugs: z.array(slugSchema).min(1),
  updates: LinkBatchEditUpdatesSchema,
})

export type LinkBatchEditBody = z.infer<typeof LinkBatchEditSchema>
export type LinkBatchEditUpdates = z.infer<typeof LinkBatchEditUpdatesSchema>
