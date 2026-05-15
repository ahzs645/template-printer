import type { GenericQueryCtx, GenericMutationCtx } from 'convex/server'
import { mutation, query } from './_generated/server'
import type { DataModel, TableNames } from './_generated/dataModel'
import { v } from 'convex/values'

const tableValidator = v.union(
  v.literal('templates'),
  v.literal('templateContents'),
  v.literal('fieldMappings'),
  v.literal('users'),
  v.literal('cardDesigns'),
  v.literal('fonts'),
  v.literal('colorProfiles'),
)

type StorageTable = Exclude<TableNames, '_scheduled_functions'>
type StorageCtx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>

async function getOwnerKey(ctx: StorageCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  return identity?.tokenIdentifier ?? 'anonymous'
}

function valueWithAppId(value: unknown, appId: string): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...value, id: appId }
  }

  return { id: appId, value }
}

function getSecondaryFields(table: StorageTable, value: unknown): { templateId?: string; fontName?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  if (table === 'fieldMappings' && 'templateId' in value && typeof value.templateId === 'string') {
    return { templateId: value.templateId }
  }

  if (table === 'fonts' && 'fontName' in value && typeof value.fontName === 'string') {
    return { fontName: value.fontName }
  }

  return {}
}

export const list = query({
  args: { table: tableValidator },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const ownerKey = await getOwnerKey(ctx)
    const records = await ctx.db
      .query(args.table)
      .withIndex('by_owner', (q) => q.eq('ownerKey', ownerKey))
      .collect()

    return records.map((record) => record.value)
  },
})

export const get = query({
  args: {
    table: tableValidator,
    appId: v.string(),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const ownerKey = await getOwnerKey(ctx)
    const record = await ctx.db
      .query(args.table)
      .withIndex('by_owner_and_appId', (q) => q.eq('ownerKey', ownerKey).eq('appId', args.appId))
      .unique()

    return record?.value ?? null
  },
})

export const put = mutation({
  args: {
    table: tableValidator,
    appId: v.string(),
    value: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerKey = await getOwnerKey(ctx)
    const existing = await ctx.db
      .query(args.table)
      .withIndex('by_owner_and_appId', (q) => q.eq('ownerKey', ownerKey).eq('appId', args.appId))
      .unique()

    const value = valueWithAppId(args.value, args.appId)
    const secondaryFields = getSecondaryFields(args.table, value)
    const document = {
      appId: args.appId,
      ownerKey,
      value,
      updatedAt: Date.now(),
      ...secondaryFields,
    }

    if (existing) {
      await ctx.db.patch(existing._id, document)
      return null
    }

    await ctx.db.insert(args.table, document)
    return null
  },
})

export const remove = mutation({
  args: {
    table: tableValidator,
    appId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerKey = await getOwnerKey(ctx)
    const existing = await ctx.db
      .query(args.table)
      .withIndex('by_owner_and_appId', (q) => q.eq('ownerKey', ownerKey).eq('appId', args.appId))
      .unique()

    if (existing) {
      await ctx.db.delete(existing._id)
    }

    return null
  },
})

export const clearTables = mutation({
  args: { tables: v.array(tableValidator) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerKey = await getOwnerKey(ctx)
    const uniqueTables = new Set(args.tables)

    for (const table of uniqueTables) {
      const records = await ctx.db
        .query(table)
        .withIndex('by_owner', (q) => q.eq('ownerKey', ownerKey))
        .collect()

      await Promise.all(records.map((record) => ctx.db.delete(record._id)))
    }

    return null
  },
})
