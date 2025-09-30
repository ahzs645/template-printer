export type TemplateType = 'design' | 'print'

export type TemplateSummary = {
  id: string
  name: string
  description?: string | null
  svgPath: string
  thumbnailPath?: string | null
  templateType?: TemplateType
  createdAt?: string | null
}
