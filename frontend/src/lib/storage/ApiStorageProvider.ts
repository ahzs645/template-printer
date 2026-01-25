import type { CardDesign, PrintLayout, TemplateMeta } from '../types'
import type { TemplateSummary, TemplateType } from '../templates'
import type { UserData } from '../fieldParser'
import type { FieldMapping, FontData, CardDesignPayload } from '../api'
import type { ColorProfile } from '../calibration/exportUtils'
import type { StorageProvider, ExportData } from './types'

/**
 * API-based storage provider for server mode
 * Wraps fetch calls to the Express backend
 */
export class ApiStorageProvider implements StorageProvider {
  // Templates
  async listTemplates(type?: TemplateType): Promise<TemplateSummary[]> {
    const url = type ? `/api/templates?type=${type}` : '/api/templates'
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch templates (${response.status})`)
    }
    return response.json()
  }

  async getTemplate(id: string): Promise<TemplateSummary | null> {
    const response = await fetch(`/api/templates/${id}`)
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Failed to fetch template (${response.status})`)
    }
    return response.json()
  }

  async createTemplate(file: File, metadata: TemplateMeta, type: TemplateType): Promise<TemplateSummary> {
    const fallbackName = file.name.replace(/\.svg$/i, '').trim() || 'Uploaded Template'
    const name = metadata.name?.trim() || fallbackName
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', name)
    formData.append('templateType', type)

    const response = await fetch('/api/templates', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await this.safeReadErrorMessage(response)
      throw new Error(error ?? `Failed to save template (${response.status})`)
    }

    return response.json()
  }

  async updateTemplate(id: string, updates: { name?: string; description?: string | null }): Promise<TemplateSummary> {
    const response = await fetch(`/api/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const error = await this.safeReadErrorMessage(response)
      throw new Error(error ?? `Failed to update template (${response.status})`)
    }

    return response.json()
  }

  async deleteTemplate(id: string): Promise<void> {
    const response = await fetch(`/api/templates/${id}`, { method: 'DELETE' })

    if (!response.ok) {
      const error = await this.safeReadErrorMessage(response)
      throw new Error(error ?? `Failed to delete template (${response.status})`)
    }
  }

  async getTemplateSvgContent(id: string): Promise<string> {
    // In server mode, we fetch the SVG from its path
    const template = await this.getTemplate(id)
    if (!template) throw new Error('Template not found')

    const response = await fetch(template.svgPath)
    if (!response.ok) {
      throw new Error(`Failed to fetch SVG content (${response.status})`)
    }
    return response.text()
  }

  // Field Mappings
  async getFieldMappings(templateId: string): Promise<FieldMapping[]> {
    const response = await fetch(`/api/templates/${templateId}/field-mappings`)

    if (!response.ok) {
      const error = await this.safeReadErrorMessage(response)
      throw new Error(error ?? `Failed to get field mappings (${response.status})`)
    }

    return response.json()
  }

  async saveFieldMappings(templateId: string, mappings: FieldMapping[]): Promise<FieldMapping[]> {
    const response = await fetch(`/api/templates/${templateId}/field-mappings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mappings }),
    })

    if (!response.ok) {
      const error = await this.safeReadErrorMessage(response)
      throw new Error(error ?? `Failed to save field mappings (${response.status})`)
    }

    return response.json()
  }

  // Users
  async listUsers(): Promise<UserData[]> {
    const response = await fetch('/api/users')
    if (!response.ok) {
      throw new Error('Failed to fetch users')
    }
    return response.json()
  }

  async getUser(id: string): Promise<UserData | null> {
    const response = await fetch(`/api/users/${id}`)
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error('Failed to fetch user')
    }
    return response.json()
  }

  async createUser(userData: Omit<UserData, 'id'>): Promise<UserData> {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create user')
    }

    return response.json()
  }

  async updateUser(id: string, userData: Partial<UserData>): Promise<UserData> {
    const response = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update user')
    }

    return response.json()
  }

  async deleteUser(id: string): Promise<void> {
    const response = await fetch(`/api/users/${id}`, { method: 'DELETE' })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete user')
    }
  }

  // Card Designs
  async listCardDesigns(): Promise<CardDesign[]> {
    const response = await fetch('/api/card-designs')

    if (!response.ok) {
      const error = await this.safeReadErrorMessage(response)
      throw new Error(error ?? `Failed to list card designs (${response.status})`)
    }

    return response.json()
  }

  async getCardDesign(id: string): Promise<CardDesign | null> {
    const response = await fetch(`/api/card-designs/${id}`)
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error('Failed to fetch card design')
    }
    return response.json()
  }

  async createCardDesign(payload: CardDesignPayload): Promise<CardDesign> {
    const response = await fetch('/api/card-designs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await this.safeReadErrorMessage(response)
      throw new Error(error ?? `Failed to create card design (${response.status})`)
    }

    return response.json()
  }

  async updateCardDesign(id: string, payload: Partial<CardDesignPayload>): Promise<CardDesign> {
    const response = await fetch(`/api/card-designs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await this.safeReadErrorMessage(response)
      throw new Error(error ?? `Failed to update card design (${response.status})`)
    }

    return response.json()
  }

  async deleteCardDesign(id: string): Promise<void> {
    const response = await fetch(`/api/card-designs/${id}`, { method: 'DELETE' })

    if (!response.ok) {
      const error = await this.safeReadErrorMessage(response)
      throw new Error(error ?? `Failed to delete card design (${response.status})`)
    }
  }

  // Fonts
  async listFonts(): Promise<FontData[]> {
    const response = await fetch('/api/fonts')

    if (!response.ok) {
      const error = await this.safeReadErrorMessage(response)
      throw new Error(error ?? `Failed to list fonts (${response.status})`)
    }

    return response.json()
  }

  async uploadFont(fontName: string, file: File): Promise<FontData> {
    const formData = new FormData()
    formData.append('font', file)
    formData.append('fontName', fontName)

    const response = await fetch('/api/fonts', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await this.safeReadErrorMessage(response)
      throw new Error(error ?? `Failed to upload font (${response.status})`)
    }

    return response.json()
  }

  async deleteFont(fontName: string): Promise<void> {
    const response = await fetch(`/api/fonts/${encodeURIComponent(fontName)}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await this.safeReadErrorMessage(response)
      throw new Error(error ?? `Failed to delete font (${response.status})`)
    }
  }

  // Color Profiles
  async listColorProfiles(): Promise<ColorProfile[]> {
    const response = await fetch('/api/color-profiles')
    if (!response.ok) {
      throw new Error('Failed to fetch color profiles')
    }
    return response.json()
  }

  async getColorProfile(id: string): Promise<ColorProfile | null> {
    const response = await fetch(`/api/color-profiles/${id}`)
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error('Failed to fetch color profile')
    }
    return response.json()
  }

  async createColorProfile(profile: Omit<ColorProfile, 'id'>): Promise<ColorProfile> {
    const response = await fetch('/api/color-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to save profile')
    }

    return response.json()
  }

  async updateColorProfile(id: string, updates: Partial<ColorProfile>): Promise<ColorProfile> {
    const response = await fetch(`/api/color-profiles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      throw new Error('Failed to update profile')
    }

    return response.json()
  }

  async deleteColorProfile(id: string): Promise<void> {
    const response = await fetch(`/api/color-profiles/${id}`, { method: 'DELETE' })

    if (!response.ok) {
      throw new Error('Failed to delete profile')
    }
  }

  // Print Layouts
  async listPrintLayouts(): Promise<PrintLayout[]> {
    const response = await fetch('/api/print-layouts')
    if (!response.ok) {
      throw new Error('Failed to fetch print layouts')
    }
    return response.json()
  }

  async getPrintLayout(id: string): Promise<PrintLayout | null> {
    const response = await fetch(`/api/print-layouts/${id}`)
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error('Failed to fetch print layout')
    }
    return response.json()
  }

  // Export/Import
  async exportAllData(): Promise<ExportData> {
    const [templates, users, cardDesigns, fonts, colorProfiles, printLayouts] = await Promise.all([
      this.listTemplates(),
      this.listUsers(),
      this.listCardDesigns(),
      this.listFonts(),
      this.listColorProfiles(),
      this.listPrintLayouts(),
    ])

    // Fetch SVG contents and field mappings for all templates
    const templateSvgContents: Record<string, string> = {}
    const fieldMappings: Record<string, FieldMapping[]> = {}

    for (const template of templates) {
      try {
        templateSvgContents[template.id] = await this.getTemplateSvgContent(template.id)
        fieldMappings[template.id] = await this.getFieldMappings(template.id)
      } catch (error) {
        console.warn(`Failed to export data for template ${template.id}:`, error)
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
      printLayouts,
    }
  }

  async importAllData(data: ExportData): Promise<void> {
    // Import templates first (card designs depend on them)
    for (const template of data.templates) {
      const svgContent = data.templateSvgContents[template.id]
      if (svgContent) {
        const blob = new Blob([svgContent], { type: 'image/svg+xml' })
        const file = new File([blob], `${template.name}.svg`, { type: 'image/svg+xml' })

        try {
          const created = await this.createTemplate(
            file,
            { name: template.name } as any,
            template.templateType || 'design'
          )

          // Save field mappings
          const mappings = data.fieldMappings[template.id]
          if (mappings?.length) {
            await this.saveFieldMappings(created.id, mappings)
          }
        } catch (error) {
          console.warn(`Failed to import template ${template.name}:`, error)
        }
      }
    }

    // Import card designs
    for (const design of data.cardDesigns) {
      try {
        await this.createCardDesign({
          name: design.name,
          description: design.description,
          frontTemplateId: design.frontTemplateId,
          backTemplateId: design.backTemplateId,
        })
      } catch (error) {
        console.warn(`Failed to import card design ${design.name}:`, error)
      }
    }

    // Import users
    for (const user of data.users) {
      try {
        const { id, ...userData } = user
        await this.createUser(userData as Omit<UserData, 'id'>)
      } catch (error) {
        console.warn(`Failed to import user ${user.firstName} ${user.lastName}:`, error)
      }
    }

    // Import fonts
    for (const font of data.fonts) {
      try {
        const binaryString = atob(font.fontData)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: font.mimeType })
        const file = new File([blob], font.fileName, { type: font.mimeType })
        await this.uploadFont(font.fontName, file)
      } catch (error) {
        console.warn(`Failed to import font ${font.fontName}:`, error)
      }
    }

    // Import color profiles
    for (const profile of data.colorProfiles) {
      try {
        const { id, ...profileData } = profile
        await this.createColorProfile(profileData)
      } catch (error) {
        console.warn(`Failed to import color profile ${profile.name}:`, error)
      }
    }
  }

  private async safeReadErrorMessage(response: Response): Promise<string | null> {
    try {
      const data = await response.json()
      if (data && typeof data === 'object' && 'error' in data) {
        const { error } = data as { error?: string }
        return typeof error === 'string' ? error : null
      }
    } catch {
      return null
    }
    return null
  }
}
