import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type { TemplateSummary } from '../../lib/templates'

type TemplateSelectorProps = {
  template: TemplateSummary | null
  templates: TemplateSummary[]
  loading: boolean
  onSelect: (template: TemplateSummary) => void
}

export function TemplateSelector({ template, templates, loading, onSelect }: TemplateSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle style={{ fontSize: '1rem' }}>Card Design Template</CardTitle>
        <CardDescription>Select a card design to export</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p style={{ fontSize: '0.875rem', color: '#71717a' }}>Loading templates...</p>
        ) : templates.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#71717a' }}>
            No templates available. Upload one in the Design tab.
          </p>
        ) : (
          <Select
            value={template?.id || 'none'}
            onValueChange={(value) => {
              if (value !== 'none') {
                const selectedTemplate = templates.find(t => t.id === value)
                if (selectedTemplate) {
                  onSelect(selectedTemplate)
                }
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a design template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" disabled>Select a template</SelectItem>
              {templates.map((tmpl) => (
                <SelectItem key={tmpl.id} value={tmpl.id}>
                  {tmpl.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardContent>
    </Card>
  )
}
