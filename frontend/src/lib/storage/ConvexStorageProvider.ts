import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import type { CardDesign, PrintLayout, TemplateMeta } from '../types'
import type { TemplateSummary, TemplateType } from '../templates'
import type { UserData } from '../fieldParser'
import type { FieldMapping, FontData, CardDesignPayload } from '../api'
import type { ColorProfile } from '../calibration/exportUtils'
import type { StorageProvider, ExportData } from './types'
import { BUILTIN_PRINT_LAYOUTS } from './IndexedDBStorageProvider'

type ConvexTable =
  | 'templates'
  | 'templateContents'
  | 'fieldMappings'
  | 'users'
  | 'cardDesigns'
  | 'fonts'
  | 'colorProfiles'

type TemplateContent = {
  id: string
  svgContent: string
}

type FieldMappingRecord = FieldMapping & {
  id: string
  templateId: string
}

const listRecords = makeFunctionReference<'query', { table: ConvexTable }, unknown[]>('storage:list')
const getRecord = makeFunctionReference<'query', { table: ConvexTable; appId: string }, unknown | null>('storage:get')
const putRecord = makeFunctionReference<'mutation', { table: ConvexTable; appId: string; value: unknown }, null>('storage:put')
const deleteRecord = makeFunctionReference<'mutation', { table: ConvexTable; appId: string }, null>('storage:remove')
const clearRecords = makeFunctionReference<'mutation', { tables: ConvexTable[] }, null>('storage:clearTables')

export class ConvexStorageProvider implements StorageProvider {
  private client: ConvexHttpClient

  constructor(convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined) {
    if (!convexUrl) {
      throw new Error('VITE_CONVEX_URL is required for Convex storage mode. Run `pnpm convex:dev:local` first or set the hosted Convex URL.')
    }

    this.client = new ConvexHttpClient(convexUrl)
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  private async list<T>(table: ConvexTable): Promise<T[]> {
    return (await this.client.query(listRecords, { table })) as T[]
  }

  private async get<T>(table: ConvexTable, id: string): Promise<T | null> {
    return (await this.client.query(getRecord, { table, appId: id })) as T | null
  }

  private async put<T extends { id: string }>(table: ConvexTable, value: T): Promise<T> {
    await this.client.mutation(putRecord, { table, appId: value.id, value })
    return value
  }

  private async delete(table: ConvexTable, id: string): Promise<void> {
    await this.client.mutation(deleteRecord, { table, appId: id })
  }

  async listTemplates(type?: TemplateType): Promise<TemplateSummary[]> {
    const templates = await this.list<TemplateSummary>('templates')
    return type ? templates.filter((template) => template.templateType === type) : templates
  }

  async getTemplate(id: string): Promise<TemplateSummary | null> {
    return this.get<TemplateSummary>('templates', id)
  }

  async createTemplate(file: File, metadata: TemplateMeta, type: TemplateType): Promise<TemplateSummary> {
    const id = this.generateId('template')
    const svgContent = await file.text()
    const template: TemplateSummary = {
      id,
      name: metadata.name?.trim() || file.name.replace(/\.svg$/i, '').trim() || 'Uploaded Template',
      svgPath: `convex://${id}`,
      templateType: type,
      createdAt: new Date().toISOString(),
    }

    await Promise.all([
      this.put('templates', template),
      this.put('templateContents', { id, svgContent }),
    ])

    return template
  }

  async updateTemplate(id: string, updates: { name?: string; description?: string | null }): Promise<TemplateSummary> {
    const template = await this.getTemplate(id)
    if (!template) throw new Error('Template not found')
    return this.put('templates', { ...template, ...updates })
  }

  async deleteTemplate(id: string): Promise<void> {
    const mappings = await this.list<FieldMappingRecord>('fieldMappings')
    await Promise.all([
      this.delete('templates', id),
      this.delete('templateContents', id),
      ...mappings.filter((mapping) => mapping.templateId === id).map((mapping) => this.delete('fieldMappings', mapping.id)),
    ])
  }

  async getTemplateSvgContent(id: string): Promise<string> {
    const content = await this.get<TemplateContent>('templateContents', id)
    if (!content) throw new Error('Template content not found')
    return content.svgContent
  }

  async getFieldMappings(templateId: string): Promise<FieldMapping[]> {
    const mappings = await this.list<FieldMappingRecord>('fieldMappings')
    return mappings
      .filter((mapping) => mapping.templateId === templateId)
      .map(({ svgLayerId, standardFieldName, customValue }) => ({ svgLayerId, standardFieldName, customValue }))
  }

  async saveFieldMappings(templateId: string, mappings: FieldMapping[]): Promise<FieldMapping[]> {
    const existing = await this.list<FieldMappingRecord>('fieldMappings')
    await Promise.all(existing.filter((mapping) => mapping.templateId === templateId).map((mapping) => this.delete('fieldMappings', mapping.id)))
    await Promise.all(mappings.map((mapping) => this.put('fieldMappings', { id: this.generateId('mapping'), templateId, ...mapping })))
    return mappings
  }

  async listUsers(): Promise<UserData[]> {
    return this.list<UserData>('users')
  }

  async getUser(id: string): Promise<UserData | null> {
    return this.get<UserData>('users', id)
  }

  async createUser(userData: Omit<UserData, 'id'>): Promise<UserData> {
    const now = new Date().toISOString()
    const user = { ...userData, id: this.generateId('user'), createdAt: now, updatedAt: now } as UserData & { id: string }
    return this.put('users', user)
  }

  async updateUser(id: string, updates: Partial<UserData>): Promise<UserData> {
    const user = await this.getUser(id)
    if (!user) throw new Error('User not found')
    return this.put('users', { ...user, ...updates, id, updatedAt: new Date().toISOString() } as UserData & { id: string })
  }

  async deleteUser(id: string): Promise<void> {
    await this.delete('users', id)
  }

  async listCardDesigns(): Promise<CardDesign[]> {
    const designs = await this.list<CardDesign>('cardDesigns')
    return Promise.all(designs.map((design) => this.populateCardDesignTemplates(design)))
  }

  async getCardDesign(id: string): Promise<CardDesign | null> {
    const design = await this.get<CardDesign>('cardDesigns', id)
    return design ? this.populateCardDesignTemplates(design) : null
  }

  async createCardDesign(payload: CardDesignPayload): Promise<CardDesign> {
    const now = new Date().toISOString()
    const design: CardDesign = {
      id: this.generateId('design'),
      name: payload.name,
      description: payload.description ?? null,
      frontTemplateId: payload.frontTemplateId ?? null,
      backTemplateId: payload.backTemplateId ?? null,
      designerMode: payload.designerMode ?? 'template',
      frontCanvasData: payload.frontCanvasData ?? null,
      backCanvasData: payload.backCanvasData ?? null,
      cardWidth: payload.cardWidth ?? 86,
      cardHeight: payload.cardHeight ?? 54,
      createdAt: now,
      updatedAt: now,
    }

    await this.put('cardDesigns', design)
    return this.populateCardDesignTemplates(design)
  }

  async updateCardDesign(id: string, updates: Partial<CardDesignPayload>): Promise<CardDesign> {
    const design = await this.get<CardDesign>('cardDesigns', id)
    if (!design) throw new Error('Card design not found')
    const updated = { ...design, ...updates, id, updatedAt: new Date().toISOString() }
    await this.put('cardDesigns', updated)
    return this.populateCardDesignTemplates(updated)
  }

  async deleteCardDesign(id: string): Promise<void> {
    await this.delete('cardDesigns', id)
  }

  async listFonts(): Promise<FontData[]> {
    return this.list<FontData>('fonts')
  }

  async uploadFont(fontName: string, file: File): Promise<FontData> {
    const existing = await this.listFonts()
    await Promise.all(existing.filter((font) => font.fontName === fontName).map((font) => this.delete('fonts', font.id)))

    const font: FontData = {
      id: this.generateId('font'),
      fontName,
      fileName: file.name,
      fontData: await this.fileToBase64(file),
      mimeType: file.type || 'application/octet-stream',
      createdAt: new Date().toISOString(),
    }

    return this.put('fonts', font)
  }

  async deleteFont(fontName: string): Promise<void> {
    const fonts = await this.listFonts()
    await Promise.all(fonts.filter((font) => font.fontName === fontName).map((font) => this.delete('fonts', font.id)))
  }

  async listColorProfiles(): Promise<ColorProfile[]> {
    return this.list<ColorProfile>('colorProfiles')
  }

  async getColorProfile(id: string): Promise<ColorProfile | null> {
    return this.get<ColorProfile>('colorProfiles', id)
  }

  async createColorProfile(profile: Omit<ColorProfile, 'id'>): Promise<ColorProfile> {
    const now = new Date().toISOString()
    return this.put('colorProfiles', { ...profile, id: this.generateId('profile'), createdAt: now, updatedAt: now })
  }

  async updateColorProfile(id: string, updates: Partial<ColorProfile>): Promise<ColorProfile> {
    const profile = await this.getColorProfile(id)
    if (!profile) throw new Error('Color profile not found')
    return this.put('colorProfiles', { ...profile, ...updates, id, updatedAt: new Date().toISOString() })
  }

  async deleteColorProfile(id: string): Promise<void> {
    await this.delete('colorProfiles', id)
  }

  async listPrintLayouts(): Promise<PrintLayout[]> {
    return BUILTIN_PRINT_LAYOUTS
  }

  async getPrintLayout(id: string): Promise<PrintLayout | null> {
    return BUILTIN_PRINT_LAYOUTS.find((layout) => layout.id === id) ?? null
  }

  async exportAllData(): Promise<ExportData> {
    const templates = await this.listTemplates()
    const templateSvgContents: Record<string, string> = {}
    const fieldMappings: Record<string, FieldMapping[]> = {}

    for (const template of templates) {
      templateSvgContents[template.id] = await this.getTemplateSvgContent(template.id)
      const mappings = await this.getFieldMappings(template.id)
      if (mappings.length > 0) fieldMappings[template.id] = mappings
    }

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      templates,
      templateSvgContents,
      fieldMappings,
      users: await this.listUsers(),
      cardDesigns: await this.listCardDesigns(),
      fonts: await this.listFonts(),
      colorProfiles: await this.listColorProfiles(),
      printLayouts: BUILTIN_PRINT_LAYOUTS,
    }
  }

  async importAllData(data: ExportData): Promise<void> {
    await this.client.mutation(clearRecords, {
      tables: ['templates', 'templateContents', 'fieldMappings', 'users', 'cardDesigns', 'fonts', 'colorProfiles'],
    })

    for (const template of data.templates) {
      await this.put('templates', template)
      const svgContent = data.templateSvgContents[template.id]
      if (svgContent) await this.put('templateContents', { id: template.id, svgContent })
      const mappings = data.fieldMappings[template.id]
      if (mappings) await this.saveFieldMappings(template.id, mappings)
    }

    await Promise.all([
      ...data.cardDesigns.map((design) => this.put('cardDesigns', design)),
      ...data.users.filter((user): user is UserData & { id: string } => typeof user.id === 'string').map((user) => this.put('users', user)),
      ...data.fonts.map((font) => this.put('fonts', font)),
      ...data.colorProfiles.map((profile) => this.put('colorProfiles', profile)),
    ])
  }

  private async populateCardDesignTemplates(design: CardDesign): Promise<CardDesign> {
    return {
      ...design,
      frontTemplate: design.frontTemplateId ? (await this.getTemplate(design.frontTemplateId)) ?? undefined : design.frontTemplate,
      backTemplate: design.backTemplateId ? (await this.getTemplate(design.backTemplateId)) ?? undefined : design.backTemplate,
    }
  }

  private async fileToBase64(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
}
