import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const ownedDocument = {
  appId: v.string(),
  ownerKey: v.string(),
  value: v.any(),
  updatedAt: v.number(),
}

export default defineSchema({
  templates: defineTable(ownedDocument)
    .index('by_owner', ['ownerKey'])
    .index('by_owner_and_appId', ['ownerKey', 'appId']),
  templateContents: defineTable(ownedDocument)
    .index('by_owner', ['ownerKey'])
    .index('by_owner_and_appId', ['ownerKey', 'appId']),
  fieldMappings: defineTable({
    ...ownedDocument,
    templateId: v.string(),
  })
    .index('by_owner', ['ownerKey'])
    .index('by_owner_and_appId', ['ownerKey', 'appId'])
    .index('by_owner_and_templateId', ['ownerKey', 'templateId']),
  users: defineTable(ownedDocument)
    .index('by_owner', ['ownerKey'])
    .index('by_owner_and_appId', ['ownerKey', 'appId']),
  cardDesigns: defineTable(ownedDocument)
    .index('by_owner', ['ownerKey'])
    .index('by_owner_and_appId', ['ownerKey', 'appId']),
  fonts: defineTable({
    ...ownedDocument,
    fontName: v.string(),
  })
    .index('by_owner', ['ownerKey'])
    .index('by_owner_and_appId', ['ownerKey', 'appId'])
    .index('by_owner_and_fontName', ['ownerKey', 'fontName']),
  colorProfiles: defineTable(ownedDocument)
    .index('by_owner', ['ownerKey'])
    .index('by_owner_and_appId', ['ownerKey', 'appId']),
})
