import Dexie, { type Table } from 'dexie'
import type { CardDesign, PrintLayout, TemplateMeta } from '../types'
import type { TemplateSummary, TemplateType } from '../templates'
import type { UserData } from '../fieldParser'
import type { FieldMapping, FontData, CardDesignPayload } from '../api'
import type { ColorProfile } from '../calibration/exportUtils'
import type { StorageProvider, ExportData } from './types'
import { BUILTIN_PRINT_LAYOUTS } from '../printLayouts'

const DB_NAME = 'template-printer'
const DB_VERSION = 1

// Built-in print layouts for local/offline mode, re-exported where they used to live
export { BUILTIN_PRINT_LAYOUTS }

interface TemplateContent {
  id: string
  svgContent: string
}

interface FieldMappingRecord extends FieldMapping {
  id: string
  templateId: string
}

class TemplatePrinterDexieDB extends Dexie {
  templates!: Table<TemplateSummary, string>
  templateContents!: Table<TemplateContent, string>
  fieldMappings!: Table<FieldMappingRecord, string>
  users!: Table<UserData & { id: string }, string>
  cardDesigns!: Table<CardDesign, string>
  fonts!: Table<FontData, string>
  colorProfiles!: Table<ColorProfile, string>

  constructor() {
    super(DB_NAME)

    this.version(DB_VERSION).stores({
      templates: 'id, templateType',
      templateContents: 'id',
      fieldMappings: 'id, templateId',
      users: 'id',
      cardDesigns: 'id',
      fonts: 'id, fontName',
      colorProfiles: 'id',
    })
  }
}

/**
 * Dexie-backed storage provider for client-only mode.
 * Dexie wraps the browser's IndexedDB with typed tables, indexes, and migrations.
 */
export class IndexedDBStorageProvider implements StorageProvider {
  private db: TemplatePrinterDexieDB | null = null

  private async getDB(): Promise<TemplatePrinterDexieDB> {
    if (!this.db) {
      this.db = new TemplatePrinterDexieDB()
      await this.db.open()
    }
    return this.db
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  // Templates
  async listTemplates(type?: TemplateType): Promise<TemplateSummary[]> {
    const db = await this.getDB()
    if (type) {
      return db.templates.where('templateType').equals(type).toArray()
    }
    return db.templates.toArray()
  }

  async getTemplate(id: string): Promise<TemplateSummary | null> {
    const db = await this.getDB()
    return (await db.templates.get(id)) ?? null
  }

  async createTemplate(file: File, metadata: TemplateMeta, type: TemplateType): Promise<TemplateSummary> {
    const db = await this.getDB()
    const id = this.generateId('template')
    const svgContent = await file.text()

    const template: TemplateSummary = {
      id,
      name: metadata.name?.trim() || file.name.replace(/\.svg$/i, '').trim() || 'Uploaded Template',
      svgPath: `indexeddb://${id}`, // Virtual path indicating local storage
      templateType: type,
      createdAt: new Date().toISOString(),
    }

    await db.transaction('rw', db.templates, db.templateContents, async () => {
      await db.templates.put(template)
      await db.templateContents.put({ id, svgContent })
    })

    return template
  }

  async updateTemplate(id: string, updates: { name?: string; description?: string | null }): Promise<TemplateSummary> {
    const db = await this.getDB()
    const template = await db.templates.get(id)
    if (!template) {
      throw new Error('Template not found')
    }

    const updated: TemplateSummary = {
      ...template,
      ...updates,
    }

    await db.templates.put(updated)
    return updated
  }

  async deleteTemplate(id: string): Promise<void> {
    const db = await this.getDB()

    // Delete template and its content
    await db.transaction('rw', db.templates, db.templateContents, db.fieldMappings, async () => {
      await db.templates.delete(id)
      await db.templateContents.delete(id)
      await db.fieldMappings.where('templateId').equals(id).delete()
    })
  }

  async getTemplateSvgContent(id: string): Promise<string> {
    const db = await this.getDB()
    const content = await db.templateContents.get(id)
    if (!content) {
      throw new Error('Template content not found')
    }
    return content.svgContent
  }

  // Field Mappings
  async getFieldMappings(templateId: string): Promise<FieldMapping[]> {
    const db = await this.getDB()
    const mappings = await db.fieldMappings.where('templateId').equals(templateId).toArray()
    return mappings.map(({ svgLayerId, standardFieldName, customValue }) => ({
      svgLayerId,
      standardFieldName,
      customValue,
    }))
  }

  async saveFieldMappings(templateId: string, mappings: FieldMapping[]): Promise<FieldMapping[]> {
    const db = await this.getDB()

    // Delete existing mappings for this template
    await db.transaction('rw', db.fieldMappings, async () => {
      await db.fieldMappings.where('templateId').equals(templateId).delete()

      const records = mappings.map((mapping) => ({
        id: this.generateId('mapping'),
        templateId,
        ...mapping,
      }))
      await db.fieldMappings.bulkPut(records)
    })

    return mappings
  }

  // Users
  async listUsers(): Promise<UserData[]> {
    const db = await this.getDB()
    return db.users.toArray()
  }

  async getUser(id: string): Promise<UserData | null> {
    const db = await this.getDB()
    return (await db.users.get(id)) ?? null
  }

  async createUser(userData: Omit<UserData, 'id'>): Promise<UserData> {
    const db = await this.getDB()
    const id = this.generateId('user')
    const now = new Date().toISOString()

    const user: UserData & { id: string } = {
      ...userData,
      id,
      createdAt: now,
      updatedAt: now,
    } as UserData & { id: string; createdAt: string; updatedAt: string }

    await db.users.put(user)
    return user
  }

  async updateUser(id: string, updates: Partial<UserData>): Promise<UserData> {
    const db = await this.getDB()
    const user = await db.users.get(id)
    if (!user) {
      throw new Error('User not found')
    }

    const updated: UserData & { id: string } = {
      ...user,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    } as UserData & { id: string; updatedAt: string }

    await db.users.put(updated)
    return updated
  }

  async deleteUser(id: string): Promise<void> {
    const db = await this.getDB()
    await db.users.delete(id)
  }

  // Card Designs
  async listCardDesigns(): Promise<CardDesign[]> {
    const db = await this.getDB()
    const designs = await db.cardDesigns.toArray()

    // Populate template references
    for (const design of designs) {
      if (design.frontTemplateId) {
        design.frontTemplate = (await this.getTemplate(design.frontTemplateId)) ?? undefined
      }
      if (design.backTemplateId) {
        design.backTemplate = (await this.getTemplate(design.backTemplateId)) ?? undefined
      }
    }

    return designs
  }

  async getCardDesign(id: string): Promise<CardDesign | null> {
    const db = await this.getDB()
    const design = await db.cardDesigns.get(id)
    if (!design) return null

    // Populate template references
    if (design.frontTemplateId) {
      design.frontTemplate = (await this.getTemplate(design.frontTemplateId)) ?? undefined
    }
    if (design.backTemplateId) {
      design.backTemplate = (await this.getTemplate(design.backTemplateId)) ?? undefined
    }

    return design
  }

  async createCardDesign(payload: CardDesignPayload): Promise<CardDesign> {
    const db = await this.getDB()
    const id = this.generateId('design')
    const now = new Date().toISOString()

    const design: CardDesign = {
      id,
      name: payload.name,
      description: payload.description ?? null,
      frontTemplateId: payload.frontTemplateId ?? null,
      backTemplateId: payload.backTemplateId ?? null,
      // Canvas designer fields
      designerMode: payload.designerMode ?? 'template',
      frontCanvasData: payload.frontCanvasData ?? null,
      backCanvasData: payload.backCanvasData ?? null,
      cardWidth: payload.cardWidth ?? 86,
      cardHeight: payload.cardHeight ?? 54,
      variants: payload.variants ?? null,
      variantField: payload.variantField ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await db.cardDesigns.put(design)

    // Populate template references for return value
    if (design.frontTemplateId) {
      design.frontTemplate = (await this.getTemplate(design.frontTemplateId)) ?? undefined
    }
    if (design.backTemplateId) {
      design.backTemplate = (await this.getTemplate(design.backTemplateId)) ?? undefined
    }

    return design
  }

  async updateCardDesign(id: string, updates: Partial<CardDesignPayload>): Promise<CardDesign> {
    const db = await this.getDB()
    const design = await db.cardDesigns.get(id)
    if (!design) {
      throw new Error('Card design not found')
    }

    const updated: CardDesign = {
      ...design,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    }

    await db.cardDesigns.put(updated)

    // Populate template references
    if (updated.frontTemplateId) {
      updated.frontTemplate = (await this.getTemplate(updated.frontTemplateId)) ?? undefined
    }
    if (updated.backTemplateId) {
      updated.backTemplate = (await this.getTemplate(updated.backTemplateId)) ?? undefined
    }

    return updated
  }

  async deleteCardDesign(id: string): Promise<void> {
    const db = await this.getDB()
    await db.cardDesigns.delete(id)
  }

  // Fonts
  async listFonts(): Promise<FontData[]> {
    const db = await this.getDB()
    return db.fonts.toArray()
  }

  async uploadFont(fontName: string, file: File): Promise<FontData> {
    const db = await this.getDB()

    // Check if font with same name exists
    const existing = await db.fonts.where('fontName').equals(fontName).toArray()
    if (existing.length > 0) {
      // Delete existing font with same name
      await db.fonts.delete(existing[0].id)
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const fontData = btoa(binary)

    const font: FontData = {
      id: this.generateId('font'),
      fontName,
      fileName: file.name,
      fontData,
      mimeType: file.type || 'application/octet-stream',
      createdAt: new Date().toISOString(),
    }

    await db.fonts.put(font)
    return font
  }

  async deleteFont(fontName: string): Promise<void> {
    const db = await this.getDB()
    const fonts = await db.fonts.where('fontName').equals(fontName).toArray()
    await db.fonts.bulkDelete(fonts.map((font) => font.id))
  }

  // Color Profiles
  async listColorProfiles(): Promise<ColorProfile[]> {
    const db = await this.getDB()
    return db.colorProfiles.toArray()
  }

  async getColorProfile(id: string): Promise<ColorProfile | null> {
    const db = await this.getDB()
    return (await db.colorProfiles.get(id)) ?? null
  }

  async createColorProfile(profile: Omit<ColorProfile, 'id'>): Promise<ColorProfile> {
    const db = await this.getDB()
    const id = this.generateId('profile')
    const now = new Date().toISOString()

    const colorProfile: ColorProfile = {
      ...profile,
      id,
      createdAt: now,
      updatedAt: now,
    }

    await db.colorProfiles.put(colorProfile)
    return colorProfile
  }

  async updateColorProfile(id: string, updates: Partial<ColorProfile>): Promise<ColorProfile> {
    const db = await this.getDB()
    const profile = await db.colorProfiles.get(id)
    if (!profile) {
      throw new Error('Color profile not found')
    }

    const updated: ColorProfile = {
      ...profile,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    }

    await db.colorProfiles.put(updated)
    return updated
  }

  async deleteColorProfile(id: string): Promise<void> {
    const db = await this.getDB()
    await db.colorProfiles.delete(id)
  }

  // Print Layouts (read-only built-in layouts for local mode)
  async listPrintLayouts(): Promise<PrintLayout[]> {
    return BUILTIN_PRINT_LAYOUTS
  }

  async getPrintLayout(id: string): Promise<PrintLayout | null> {
    return BUILTIN_PRINT_LAYOUTS.find((layout) => layout.id === id) ?? null
  }

  // Export/Import
  async exportAllData(): Promise<ExportData> {
    const db = await this.getDB()

    const templates = await db.templates.toArray()
    const users = await db.users.toArray()
    const cardDesigns = await db.cardDesigns.toArray()
    const fonts = await db.fonts.toArray()
    const colorProfiles = await db.colorProfiles.toArray()

    // Get SVG contents and field mappings
    const templateSvgContents: Record<string, string> = {}
    const fieldMappings: Record<string, FieldMapping[]> = {}

    for (const template of templates) {
      const content = await db.templateContents.get(template.id)
      if (content) {
        templateSvgContents[template.id] = content.svgContent
      }

      const mappings = await this.getFieldMappings(template.id)
      if (mappings.length > 0) {
        fieldMappings[template.id] = mappings
      }
    }

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      templates,
      templateSvgContents,
      fieldMappings,
      users,
      cardDesigns,
      fonts,
      colorProfiles,
      printLayouts: BUILTIN_PRINT_LAYOUTS,
    }
  }

  async importAllData(data: ExportData): Promise<void> {
    const db = await this.getDB()

    // Clear existing data
    await db.transaction(
      'rw',
      [
        db.templates,
        db.templateContents,
        db.fieldMappings,
        db.users,
        db.cardDesigns,
        db.fonts,
        db.colorProfiles,
      ],
      async () => {
        await Promise.all([
          db.templates.clear(),
          db.templateContents.clear(),
          db.fieldMappings.clear(),
          db.users.clear(),
          db.cardDesigns.clear(),
          db.fonts.clear(),
          db.colorProfiles.clear(),
        ])
      },
    )

    // Import templates
    for (const template of data.templates) {
      await db.templates.put(template)

      const svgContent = data.templateSvgContents[template.id]
      if (svgContent) {
        await db.templateContents.put({ id: template.id, svgContent })
      }

      const mappings = data.fieldMappings[template.id]
      if (mappings) {
        await this.saveFieldMappings(template.id, mappings)
      }
    }

    // Import card designs
    for (const design of data.cardDesigns) {
      await db.cardDesigns.put(design)
    }

    // Import users
    for (const user of data.users) {
      await db.users.put(user as UserData & { id: string })
    }

    // Import fonts
    for (const font of data.fonts) {
      await db.fonts.put(font)
    }

    // Import color profiles
    for (const profile of data.colorProfiles) {
      await db.colorProfiles.put(profile)
    }
  }
}
