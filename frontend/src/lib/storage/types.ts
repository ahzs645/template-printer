import type { CardDesign, TemplateMeta } from '../types'
import type { TemplateSummary, TemplateType } from '../templates'
import type { UserData } from '../fieldParser'
import type { FieldMapping, FontData, CardDesignPayload } from '../api'
import type { ColorProfile } from '../calibration/exportUtils'

/**
 * Storage provider interface - abstraction layer for data persistence
 * Implemented by ApiStorageProvider (server mode) and IndexedDBStorageProvider (local mode)
 */
export interface StorageProvider {
  // Templates
  listTemplates(type?: TemplateType): Promise<TemplateSummary[]>
  getTemplate(id: string): Promise<TemplateSummary | null>
  createTemplate(file: File, metadata: TemplateMeta, type: TemplateType): Promise<TemplateSummary>
  updateTemplate(id: string, updates: { name?: string; description?: string | null }): Promise<TemplateSummary>
  deleteTemplate(id: string): Promise<void>
  getTemplateSvgContent(id: string): Promise<string>

  // Field Mappings
  getFieldMappings(templateId: string): Promise<FieldMapping[]>
  saveFieldMappings(templateId: string, mappings: FieldMapping[]): Promise<FieldMapping[]>

  // Users
  listUsers(): Promise<UserData[]>
  getUser(id: string): Promise<UserData | null>
  createUser(user: Omit<UserData, 'id'>): Promise<UserData>
  updateUser(id: string, updates: Partial<UserData>): Promise<UserData>
  deleteUser(id: string): Promise<void>

  // Card Designs
  listCardDesigns(): Promise<CardDesign[]>
  getCardDesign(id: string): Promise<CardDesign | null>
  createCardDesign(design: CardDesignPayload): Promise<CardDesign>
  updateCardDesign(id: string, updates: Partial<CardDesignPayload>): Promise<CardDesign>
  deleteCardDesign(id: string): Promise<void>

  // Fonts
  listFonts(): Promise<FontData[]>
  uploadFont(fontName: string, file: File): Promise<FontData>
  deleteFont(fontName: string): Promise<void>

  // Color Profiles
  listColorProfiles(): Promise<ColorProfile[]>
  getColorProfile(id: string): Promise<ColorProfile | null>
  createColorProfile(profile: Omit<ColorProfile, 'id'>): Promise<ColorProfile>
  updateColorProfile(id: string, updates: Partial<ColorProfile>): Promise<ColorProfile>
  deleteColorProfile(id: string): Promise<void>

  // Export/Import for data portability
  exportAllData(): Promise<ExportData>
  importAllData(data: ExportData): Promise<void>
}

/**
 * Data export format for transferring data between storage modes
 */
export interface ExportData {
  version: string
  exportedAt: string
  templates: TemplateSummary[]
  templateSvgContents: Record<string, string> // id -> SVG content
  fieldMappings: Record<string, FieldMapping[]> // templateId -> mappings
  users: UserData[]
  cardDesigns: CardDesign[]
  fonts: FontData[]
  colorProfiles: ColorProfile[]
}

export type StorageMode = 'server' | 'local'
