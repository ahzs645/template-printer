import { openDB, type IDBPDatabase } from 'idb'
import type { CardDesign, PrintLayout, TemplateMeta } from '../types'
import type { TemplateSummary, TemplateType } from '../templates'
import type { UserData } from '../fieldParser'
import type { FieldMapping, FontData, CardDesignPayload } from '../api'
import type { ColorProfile } from '../calibration/exportUtils'
import type { StorageProvider, ExportData } from './types'

const DB_NAME = 'template-printer'
const DB_VERSION = 1

// Built-in print layouts for local/offline mode
const BUILTIN_PRINT_LAYOUTS: PrintLayout[] = [
  {
    id: 'layout-canon-g',
    sourceId: 10,
    name: 'Canon G PVC Card Tray - 2 cards',
    pageWidth: '5.1600',
    pageHeight: '10.0100',
    orientation: 'P',
    cardsPerRow: 1,
    cardsPerPage: 2,
    pageMarginTop: '4.1952',
    pageMarginLeft: '0.3250',
    cardMarginRight: '0.2945',
    cardMarginBottom: '0.0000',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0750',
    bleedHeight: '0.0750',
    paperSize: 'Disc Tray G',
    printMedia: 'Printable Disc (recommended)',
    instructions: '<ol><li>Open the generated PDF using Adobe Acrobat Reader.</li><li>Select File &gt; Print</li><li>Make sure that any "Scaling" settings are set to 100%.</li><li>Select Paper Size: Disc Tray G</li><li>Select Media Type: Other Papers &gt; Printable Disc (Recommended)</li><li>Place 2 cards in the PVC Card Tray.</li><li>Press Print on your computer.</li></ol><p>Note: On macOS 10.14+ you may need to use Adobe Acrobat Reader instead of Preview.</p>',
    isBuiltin: true,
  },
  {
    id: 'layout-canon-j',
    sourceId: 15,
    name: 'Canon J PVC Card Tray - 2 cards',
    pageWidth: '5.1600',
    pageHeight: '8.5000',
    orientation: 'P',
    cardsPerRow: 1,
    cardsPerPage: 2,
    pageMarginTop: '3.0700',
    pageMarginLeft: '0.2950',
    cardMarginRight: '0.2950',
    cardMarginBottom: '0.0000',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0750',
    bleedHeight: '0.0750',
    paperSize: 'Disc Tray J',
    printMedia: 'Printable Disc (recommended)',
    instructions: '<ol><li>Open the generated PDF using Adobe Acrobat Reader.</li><li>Select File &gt; Print</li><li>Make sure that any "Scaling" settings are set to 100%.</li><li>Select Paper Size: Disc Tray J</li><li>Select Media Type: Printable Disc (Recommended)</li><li>Place 2 cards in the PVC Card Tray.</li><li>Press Print.</li></ol>',
    isBuiltin: true,
  },
  {
    id: 'layout-canon-j-alt',
    sourceId: 20,
    name: 'Canon J PVC Card Tray (Alternate) - 2 cards',
    pageWidth: '5.1600',
    pageHeight: '8.5000',
    orientation: 'P',
    cardsPerRow: 1,
    cardsPerPage: 2,
    pageMarginTop: '3.6700',
    pageMarginLeft: '0.2950',
    cardMarginRight: '0.2950',
    cardMarginBottom: '0.0000',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0750',
    bleedHeight: '0.0750',
    paperSize: 'Disc Tray J',
    printMedia: 'Printable Disc (recommended)',
    instructions: '<ol><li>Open the generated PDF using Adobe Acrobat Reader.</li><li>Select File &gt; Print</li><li>Set Scaling to 100%.</li><li>Select Paper Size: Disc Tray J</li><li>Select Media Type: Printable Disc (Recommended)</li><li>Place 2 cards in the PVC Card Tray.</li><li>Press Print.</li></ol><p>This is an alternate positioning for Canon J trays.</p>',
    isBuiltin: true,
  },
  {
    id: 'layout-canon-k',
    sourceId: 25,
    name: 'Canon K PVC Card Tray - 2 cards',
    pageWidth: '8.5000',
    pageHeight: '11.0000',
    orientation: 'P',
    cardsPerRow: 1,
    cardsPerPage: 2,
    pageMarginTop: '5.8088',
    pageMarginLeft: '1.5094',
    cardMarginRight: '0.0000',
    cardMarginBottom: '0.1700',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0750',
    bleedHeight: '0.0750',
    paperSize: 'Disc Tray K',
    printMedia: 'Printable Disc (Recommended)',
    instructions: '<ol><li>Open the generated PDF using Adobe Acrobat Reader.</li><li>Select File &gt; Print</li><li>Set Scaling to 100%.</li><li>Select Paper Size: Disc Tray K</li><li>Select Media Type: Printable Disc (Recommended)</li><li>Place 2 cards in the PVC Card Tray.</li><li>Press Print.</li></ol>',
    isBuiltin: true,
  },
  {
    id: 'layout-canon-m',
    sourceId: 30,
    name: 'Canon M PVC Card Tray - 2 cards',
    pageWidth: '5.1600',
    pageHeight: '8.5000',
    orientation: 'P',
    cardsPerRow: 1,
    cardsPerPage: 2,
    pageMarginTop: '1.9349',
    pageMarginLeft: '1.2234',
    cardMarginRight: '0.0000',
    cardMarginBottom: '0.0864',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0750',
    bleedHeight: '0.0750',
    paperSize: 'Disc Tray M',
    printMedia: 'Printable Disc (Recommended)',
    instructions: '<ol><li>Open the generated PDF using Adobe Acrobat Reader.</li><li>Select File &gt; Print</li><li>Set Scaling to 100%.</li><li>Select Paper Size: Disc Tray M</li><li>Select Media Type: Printable Disc (Recommended)</li><li>Place 2 cards in the PVC Card Tray.</li><li>Press Print.</li></ol>',
    isBuiltin: true,
  },
  {
    id: 'layout-canon-m-120mm',
    sourceId: 35,
    name: 'Canon M PVC Card Tray (120 x 120 mm) - 2 cards',
    pageWidth: '4.7244',
    pageHeight: '4.7244',
    orientation: 'P',
    cardsPerRow: 1,
    cardsPerPage: 2,
    pageMarginTop: '0.1940',
    pageMarginLeft: '0.6747',
    cardMarginRight: '0.0000',
    cardMarginBottom: '0.0864',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0750',
    bleedHeight: '0.0750',
    paperSize: '120 x 120 mm',
    printMedia: 'Printable Disc (Recommended)',
    instructions: '<ol><li>Open the generated PDF using Adobe Acrobat Reader.</li><li>Select File &gt; Print</li><li>Set Scaling to 100%.</li><li>Select Paper Size: 120 x 120 mm</li><li>Select Media Type: Printable Disc (Recommended)</li><li>Place 2 cards in the PVC Card Tray.</li><li>Press Print.</li></ol>',
    isBuiltin: true,
  },
  {
    id: 'layout-canon-mp',
    sourceId: 40,
    name: 'Canon MP PVC Card Tray - 2 cards',
    pageWidth: '5.1600',
    pageHeight: '5.1600',
    orientation: 'P',
    cardsPerRow: 1,
    cardsPerPage: 2,
    pageMarginTop: '0.1304',
    pageMarginLeft: '0.6736',
    cardMarginRight: '0.0000',
    cardMarginBottom: '0.2392',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0750',
    bleedHeight: '0.0750',
    paperSize: 'Multi-purpose Tray',
    printMedia: 'Printable Disc',
    instructions: '<ol><li>Open the generated PDF using Adobe Acrobat Reader.</li><li>Select File &gt; Print</li><li>Set Scaling to 100%.</li><li>Select Paper Size: Multi-purpose Tray</li><li>Select Media Type: Printable Disc</li><li>Place 2 cards in the MP Tray.</li><li>Press Print.</li></ol>',
    isBuiltin: true,
  },
  {
    id: 'layout-canon-cd',
    sourceId: 42,
    name: 'Canon CD Tray Insert - 2 cards',
    pageWidth: '8.5000',
    pageHeight: '5.5000',
    orientation: 'L',
    cardsPerRow: 2,
    cardsPerPage: 2,
    pageMarginTop: '0.3840',
    pageMarginLeft: '0.0800',
    cardMarginRight: '0.2630',
    cardMarginBottom: '0.0000',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0750',
    bleedHeight: '0.0750',
    paperSize: 'Disc Tray Insert',
    printMedia: 'Printable Disc',
    instructions: '<ol><li>Open the generated PDF using Adobe Acrobat Reader.</li><li>Select File &gt; Print</li><li>Set Scaling to 100%.</li><li>Select Paper Size: Disc Tray Insert</li><li>Select Media Type: Printable Disc</li><li>Place cards in the CD Tray Insert.</li><li>Press Print.</li></ol>',
    isBuiltin: true,
  },
  {
    id: 'layout-epson-r200',
    sourceId: 45,
    name: 'Epson R200/R280 PVC Card Tray - 2 cards',
    pageWidth: '8.2677',
    pageHeight: '11.6929',
    orientation: 'P',
    cardsPerRow: 1,
    cardsPerPage: 2,
    pageMarginTop: '0.4479',
    pageMarginLeft: '1.2653',
    cardMarginRight: '0.0000',
    cardMarginBottom: '0.2431',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0750',
    bleedHeight: '0.0750',
    paperSize: 'A4 (Not Borderless)',
    printMedia: 'CD/DVD',
    instructions: '<ol><li>Open the generated PDF using Adobe Acrobat Reader.</li><li>Select File &gt; Print</li><li>Set Scaling to 100%.</li><li>Select Paper Size: A4 (Not Borderless)</li><li>Select Media Type: CD/DVD</li><li>Place 2 cards in the PVC Card Tray.</li><li>Press Print.</li></ol>',
    isBuiltin: true,
  },
  {
    id: 'layout-epson-1430',
    sourceId: 50,
    name: 'Epson Artisan 1430 - 4 cards',
    pageWidth: '8.2677',
    pageHeight: '11.6929',
    orientation: 'P',
    cardsPerRow: 2,
    cardsPerPage: 4,
    pageMarginTop: '0.5444',
    pageMarginLeft: '0.2072',
    cardMarginRight: '0.0483',
    cardMarginBottom: '0.1395',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0750',
    bleedHeight: '0.0750',
    paperSize: 'A4 (Not Borderless)',
    printMedia: 'CD/DVD',
    instructions: '<ol><li>Open the generated PDF using Adobe Acrobat Reader.</li><li>Select File &gt; Print</li><li>Set Scaling to 100%.</li><li>Select Paper Size: A4 (Not Borderless)</li><li>Select Media Type: CD/DVD</li><li>Place 4 cards in the tray.</li><li>Press Print.</li></ol>',
    isBuiltin: true,
  },
  {
    id: 'layout-teslin-1up',
    sourceId: 910,
    name: 'Teslin 1-Up - 1 card',
    pageWidth: '4.0000',
    pageHeight: '6.0000',
    orientation: 'P',
    cardsPerRow: 1,
    cardsPerPage: 1,
    pageMarginTop: '1.3125',
    pageMarginLeft: '0.9375',
    cardMarginRight: '0.0000',
    cardMarginBottom: '0.0000',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0750',
    bleedHeight: '0.0750',
    paperSize: '4 x 6 inches',
    printMedia: 'Plain Paper',
    instructions: '<ol><li>Open the generated PDF using Adobe Acrobat Reader.</li><li>Select File &gt; Print</li><li>Set Scaling to 100%.</li><li>Select Paper Size: 4 x 6 inches</li><li>Load Teslin paper.</li><li>Press Print.</li></ol>',
    isBuiltin: true,
  },
  {
    id: 'layout-teslin-2up',
    sourceId: 915,
    name: 'Teslin 2-Up - 2 cards',
    pageWidth: '4.0000',
    pageHeight: '6.0000',
    orientation: 'P',
    cardsPerRow: 1,
    cardsPerPage: 2,
    pageMarginTop: '0.4375',
    pageMarginLeft: '0.3125',
    cardMarginRight: '0.0000',
    cardMarginBottom: '0.8750',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0750',
    bleedHeight: '0.0750',
    paperSize: '4 x 6 inches',
    printMedia: 'Plain Paper',
    instructions: '<ol><li>Open the generated PDF using Adobe Acrobat Reader.</li><li>Select File &gt; Print</li><li>Set Scaling to 100%.</li><li>Select Paper Size: 4 x 6 inches</li><li>Load Teslin paper.</li><li>Press Print.</li></ol>',
    isBuiltin: true,
  },
  {
    id: 'layout-teslin-8up',
    sourceId: 920,
    name: 'Teslin 8-up - 8 cards',
    pageWidth: '8.5000',
    pageHeight: '11.0000',
    orientation: 'P',
    cardsPerRow: 2,
    cardsPerPage: 8,
    pageMarginTop: '0.6000',
    pageMarginLeft: '0.6600',
    cardMarginRight: '0.4600',
    cardMarginBottom: '0.4300',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0750',
    bleedHeight: '0.0750',
    paperSize: 'US Letter',
    printMedia: 'Plain Paper',
    instructions: '<ol><li>Open the generated PDF using Adobe Acrobat Reader.</li><li>Select File &gt; Print</li><li>Set Scaling to 100%.</li><li>Select Paper Size: US Letter</li><li>Load Teslin paper.</li><li>Press Print.</li></ol>',
    isBuiltin: true,
  },
  {
    id: 'layout-teslin-8up-die',
    sourceId: 922,
    name: 'Teslin 8-up - 8 Cards (Die Cutter)',
    pageWidth: '8.5000',
    pageHeight: '11.0000',
    orientation: 'P',
    cardsPerRow: 2,
    cardsPerPage: 8,
    pageMarginTop: '0.6000',
    pageMarginLeft: '0.3125',
    cardMarginRight: '1.1250',
    cardMarginBottom: '0.0980',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0750',
    bleedHeight: '0.0750',
    paperSize: 'US Letter',
    printMedia: 'Plain Paper',
    instructions: '<ol><li>Open the generated PDF using Adobe Acrobat Reader.</li><li>Select File &gt; Print</li><li>Set Scaling to 100%.</li><li>Select Paper Size: US Letter</li><li>Load Teslin paper.</li><li>Press Print.</li><li>Use die cutter for precise cutting.</li></ol>',
    isBuiltin: true,
  },
  {
    id: 'layout-teslin-8up-v2',
    sourceId: 930,
    name: 'Teslin 8-up - 8 cards (Updated)',
    pageWidth: '8.5000',
    pageHeight: '11.0000',
    orientation: 'P',
    cardsPerRow: 2,
    cardsPerPage: 8,
    pageMarginTop: '0.6700',
    pageMarginLeft: '0.6210',
    cardMarginRight: '0.4600',
    cardMarginBottom: '0.4300',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0750',
    bleedHeight: '0.0750',
    paperSize: 'US Letter',
    printMedia: 'Plain Paper',
    instructions: '<ol><li>Open the generated PDF using Adobe Acrobat Reader.</li><li>Select File &gt; Print</li><li>Set Scaling to 100%.</li><li>Select Paper Size: US Letter</li><li>Load Teslin paper.</li><li>Press Print.</li></ol><p>This is an updated version with improved alignment.</p>',
    isBuiltin: true,
  },
  {
    id: 'layout-thermal',
    sourceId: 1000,
    name: 'Thermal PVC Card Printer - 1 card',
    pageWidth: '3.3750',
    pageHeight: '2.1250',
    orientation: 'L',
    cardsPerRow: 1,
    cardsPerPage: 1,
    pageMarginTop: '0.0000',
    pageMarginLeft: '0.0000',
    cardMarginRight: '0.0000',
    cardMarginBottom: '0.0000',
    cardWidth: '3.3750',
    cardHeight: '2.1250',
    bleedWidth: '0.0000',
    bleedHeight: '0.0000',
    paperSize: 'CR-80',
    printMedia: 'PVC Card',
    instructions: '<ol><li>Open the generated PDF.</li><li>Select File &gt; Print</li><li>Choose your thermal card printer.</li><li>Ensure card is loaded in the printer.</li><li>Press Print.</li></ol><p>Thermal printers print directly onto PVC cards at exact card size.</p>',
    isBuiltin: true,
  },
]

interface TemplateContent {
  id: string
  svgContent: string
}

interface FieldMappingRecord extends FieldMapping {
  id: string
  templateId: string
}

interface TemplatePrinterDBSchema {
  templates: {
    key: string
    value: TemplateSummary
    indexes: { 'by-type': TemplateType }
  }
  templateContents: {
    key: string
    value: TemplateContent
  }
  fieldMappings: {
    key: string
    value: FieldMappingRecord
    indexes: { 'by-templateId': string }
  }
  users: {
    key: string
    value: UserData & { id: string }
  }
  cardDesigns: {
    key: string
    value: CardDesign
  }
  fonts: {
    key: string
    value: FontData
    indexes: { 'by-fontName': string }
  }
  colorProfiles: {
    key: string
    value: ColorProfile
  }
}

/**
 * IndexedDB-based storage provider for client-only mode
 * Stores all data in the browser's IndexedDB
 */
export class IndexedDBStorageProvider implements StorageProvider {
  private db: IDBPDatabase<TemplatePrinterDBSchema> | null = null

  private async getDB(): Promise<IDBPDatabase<TemplatePrinterDBSchema>> {
    if (!this.db) {
      this.db = await openDB<TemplatePrinterDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Templates store
          if (!db.objectStoreNames.contains('templates')) {
            const templateStore = db.createObjectStore('templates', { keyPath: 'id' })
            templateStore.createIndex('by-type', 'templateType')
          }

          // Template SVG contents
          if (!db.objectStoreNames.contains('templateContents')) {
            db.createObjectStore('templateContents', { keyPath: 'id' })
          }

          // Field mappings
          if (!db.objectStoreNames.contains('fieldMappings')) {
            const mappingStore = db.createObjectStore('fieldMappings', { keyPath: 'id' })
            mappingStore.createIndex('by-templateId', 'templateId')
          }

          // Users
          if (!db.objectStoreNames.contains('users')) {
            db.createObjectStore('users', { keyPath: 'id' })
          }

          // Card designs
          if (!db.objectStoreNames.contains('cardDesigns')) {
            db.createObjectStore('cardDesigns', { keyPath: 'id' })
          }

          // Fonts
          if (!db.objectStoreNames.contains('fonts')) {
            const fontStore = db.createObjectStore('fonts', { keyPath: 'id' })
            fontStore.createIndex('by-fontName', 'fontName')
          }

          // Color profiles
          if (!db.objectStoreNames.contains('colorProfiles')) {
            db.createObjectStore('colorProfiles', { keyPath: 'id' })
          }
        },
      })
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
      return db.getAllFromIndex('templates', 'by-type', type)
    }
    return db.getAll('templates')
  }

  async getTemplate(id: string): Promise<TemplateSummary | null> {
    const db = await this.getDB()
    return (await db.get('templates', id)) ?? null
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

    await db.put('templates', template)
    await db.put('templateContents', { id, svgContent })

    return template
  }

  async updateTemplate(id: string, updates: { name?: string; description?: string | null }): Promise<TemplateSummary> {
    const db = await this.getDB()
    const template = await db.get('templates', id)
    if (!template) {
      throw new Error('Template not found')
    }

    const updated: TemplateSummary = {
      ...template,
      ...updates,
    }

    await db.put('templates', updated)
    return updated
  }

  async deleteTemplate(id: string): Promise<void> {
    const db = await this.getDB()

    // Delete template and its content
    await db.delete('templates', id)
    await db.delete('templateContents', id)

    // Delete associated field mappings
    const mappings = await db.getAllFromIndex('fieldMappings', 'by-templateId', id)
    for (const mapping of mappings) {
      await db.delete('fieldMappings', mapping.id)
    }
  }

  async getTemplateSvgContent(id: string): Promise<string> {
    const db = await this.getDB()
    const content = await db.get('templateContents', id)
    if (!content) {
      throw new Error('Template content not found')
    }
    return content.svgContent
  }

  // Field Mappings
  async getFieldMappings(templateId: string): Promise<FieldMapping[]> {
    const db = await this.getDB()
    const mappings = await db.getAllFromIndex('fieldMappings', 'by-templateId', templateId)
    return mappings.map(({ svgLayerId, standardFieldName, customValue }) => ({
      svgLayerId,
      standardFieldName,
      customValue,
    }))
  }

  async saveFieldMappings(templateId: string, mappings: FieldMapping[]): Promise<FieldMapping[]> {
    const db = await this.getDB()

    // Delete existing mappings for this template
    const existing = await db.getAllFromIndex('fieldMappings', 'by-templateId', templateId)
    for (const mapping of existing) {
      await db.delete('fieldMappings', mapping.id)
    }

    // Save new mappings
    for (const mapping of mappings) {
      const record: FieldMappingRecord = {
        id: this.generateId('mapping'),
        templateId,
        ...mapping,
      }
      await db.put('fieldMappings', record)
    }

    return mappings
  }

  // Users
  async listUsers(): Promise<UserData[]> {
    const db = await this.getDB()
    return db.getAll('users')
  }

  async getUser(id: string): Promise<UserData | null> {
    const db = await this.getDB()
    return (await db.get('users', id)) ?? null
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

    await db.put('users', user)
    return user
  }

  async updateUser(id: string, updates: Partial<UserData>): Promise<UserData> {
    const db = await this.getDB()
    const user = await db.get('users', id)
    if (!user) {
      throw new Error('User not found')
    }

    const updated: UserData & { id: string } = {
      ...user,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    } as UserData & { id: string; updatedAt: string }

    await db.put('users', updated)
    return updated
  }

  async deleteUser(id: string): Promise<void> {
    const db = await this.getDB()
    await db.delete('users', id)
  }

  // Card Designs
  async listCardDesigns(): Promise<CardDesign[]> {
    const db = await this.getDB()
    const designs = await db.getAll('cardDesigns')

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
    const design = await db.get('cardDesigns', id)
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
      createdAt: now,
      updatedAt: now,
    }

    await db.put('cardDesigns', design)

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
    const design = await db.get('cardDesigns', id)
    if (!design) {
      throw new Error('Card design not found')
    }

    const updated: CardDesign = {
      ...design,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    }

    await db.put('cardDesigns', updated)

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
    await db.delete('cardDesigns', id)
  }

  // Fonts
  async listFonts(): Promise<FontData[]> {
    const db = await this.getDB()
    return db.getAll('fonts')
  }

  async uploadFont(fontName: string, file: File): Promise<FontData> {
    const db = await this.getDB()

    // Check if font with same name exists
    const existing = await db.getAllFromIndex('fonts', 'by-fontName', fontName)
    if (existing.length > 0) {
      // Delete existing font with same name
      await db.delete('fonts', existing[0].id)
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

    await db.put('fonts', font)
    return font
  }

  async deleteFont(fontName: string): Promise<void> {
    const db = await this.getDB()
    const fonts = await db.getAllFromIndex('fonts', 'by-fontName', fontName)
    for (const font of fonts) {
      await db.delete('fonts', font.id)
    }
  }

  // Color Profiles
  async listColorProfiles(): Promise<ColorProfile[]> {
    const db = await this.getDB()
    return db.getAll('colorProfiles')
  }

  async getColorProfile(id: string): Promise<ColorProfile | null> {
    const db = await this.getDB()
    return (await db.get('colorProfiles', id)) ?? null
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

    await db.put('colorProfiles', colorProfile)
    return colorProfile
  }

  async updateColorProfile(id: string, updates: Partial<ColorProfile>): Promise<ColorProfile> {
    const db = await this.getDB()
    const profile = await db.get('colorProfiles', id)
    if (!profile) {
      throw new Error('Color profile not found')
    }

    const updated: ColorProfile = {
      ...profile,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    }

    await db.put('colorProfiles', updated)
    return updated
  }

  async deleteColorProfile(id: string): Promise<void> {
    const db = await this.getDB()
    await db.delete('colorProfiles', id)
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

    const templates = await db.getAll('templates')
    const users = await db.getAll('users')
    const cardDesigns = await db.getAll('cardDesigns')
    const fonts = await db.getAll('fonts')
    const colorProfiles = await db.getAll('colorProfiles')

    // Get SVG contents and field mappings
    const templateSvgContents: Record<string, string> = {}
    const fieldMappings: Record<string, FieldMapping[]> = {}

    for (const template of templates) {
      const content = await db.get('templateContents', template.id)
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
    const stores: (keyof TemplatePrinterDBSchema)[] = [
      'templates',
      'templateContents',
      'fieldMappings',
      'users',
      'cardDesigns',
      'fonts',
      'colorProfiles',
    ]

    for (const store of stores) {
      await db.clear(store)
    }

    // Import templates
    for (const template of data.templates) {
      await db.put('templates', template)

      const svgContent = data.templateSvgContents[template.id]
      if (svgContent) {
        await db.put('templateContents', { id: template.id, svgContent })
      }

      const mappings = data.fieldMappings[template.id]
      if (mappings) {
        await this.saveFieldMappings(template.id, mappings)
      }
    }

    // Import card designs
    for (const design of data.cardDesigns) {
      await db.put('cardDesigns', design)
    }

    // Import users
    for (const user of data.users) {
      await db.put('users', user as UserData & { id: string })
    }

    // Import fonts
    for (const font of data.fonts) {
      await db.put('fonts', font)
    }

    // Import color profiles
    for (const profile of data.colorProfiles) {
      await db.put('colorProfiles', profile)
    }
  }
}
