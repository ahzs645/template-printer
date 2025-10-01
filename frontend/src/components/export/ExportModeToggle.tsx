import { User, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import type { ExportMode } from '../ExportPage'

type ExportModeToggleProps = {
  mode: ExportMode
  onModeChange: (mode: ExportMode) => void
}

export function ExportModeToggle({ mode, onModeChange }: ExportModeToggleProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle style={{ fontSize: '1rem' }}>Export Mode</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(value) => onModeChange(value as ExportMode)}>
          <TabsList style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <TabsTrigger value="quick" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User style={{ width: '1rem', height: '1rem' }} />
              Quick Mode
            </TabsTrigger>
            <TabsTrigger value="database" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users style={{ width: '1rem', height: '1rem' }} />
              Database Mode
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.75rem' }}>
          {mode === 'quick'
            ? 'Export with manually entered data'
            : 'Export for multiple users from database'}
        </p>
      </CardContent>
    </Card>
  )
}
