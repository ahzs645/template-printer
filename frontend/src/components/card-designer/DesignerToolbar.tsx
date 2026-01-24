import {
  Type,
  Image,
  Square,
  Circle,
  Minus,
  QrCode,
  Trash2,
  ArrowUpToLine,
  ArrowDownToLine,
  Grid3X3,
  Undo2,
  Redo2,
  Variable,
} from 'lucide-react'
import { Button } from '../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { CARD_PRESETS } from './types'

type DesignerToolbarProps = {
  // Element actions
  onAddText: () => void
  onAddDynamicText: () => void
  onAddImagePlaceholder: () => void
  onAddRectangle: () => void
  onAddCircle: () => void
  onAddLine: () => void
  // Object actions
  onDelete: () => void
  onBringToFront: () => void
  onSendToBack: () => void
  // View actions
  showGrid: boolean
  onToggleGrid: () => void
  // History actions
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  // Card size
  cardWidth: number
  cardHeight: number
  onCardSizeChange: (width: number, height: number) => void
  // State
  hasSelection: boolean
}

export function DesignerToolbar({
  onAddText,
  onAddDynamicText,
  onAddImagePlaceholder,
  onAddRectangle,
  onAddCircle,
  onAddLine,
  onDelete,
  onBringToFront,
  onSendToBack,
  showGrid,
  onToggleGrid,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  cardWidth,
  cardHeight,
  onCardSizeChange,
  hasSelection,
}: DesignerToolbarProps) {
  const handlePresetChange = (presetName: string) => {
    const preset = CARD_PRESETS.find((p) => p.name === presetName)
    if (preset) {
      onCardSizeChange(preset.width, preset.height)
    }
  }

  const currentPreset = CARD_PRESETS.find(
    (p) => Math.abs(p.width - cardWidth) < 1 && Math.abs(p.height - cardHeight) < 1
  )?.name ?? 'Custom'

  return (
    <div
      className="designer-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 16px',
        backgroundColor: 'var(--bg-surface, #fff)',
        borderBottom: '1px solid var(--border-color, #e5e5e5)',
      }}
    >
      {/* Elements Group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginRight: 4,
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          Add
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddText}
          title="Add Text"
          style={{ padding: '6px 8px' }}
        >
          <Type size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddDynamicText}
          title="Add Dynamic Field"
          style={{ padding: '6px 8px' }}
        >
          <Variable size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddImagePlaceholder}
          title="Add Image Placeholder"
          style={{ padding: '6px 8px' }}
        >
          <Image size={16} />
        </Button>
      </div>

      {/* Shapes Group */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          borderLeft: '1px solid var(--border-color, #e5e5e5)',
          paddingLeft: 16,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginRight: 4,
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          Shapes
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddRectangle}
          title="Add Rectangle"
          style={{ padding: '6px 8px' }}
        >
          <Square size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddCircle}
          title="Add Circle"
          style={{ padding: '6px 8px' }}
        >
          <Circle size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddLine}
          title="Add Line"
          style={{ padding: '6px 8px' }}
        >
          <Minus size={16} />
        </Button>
      </div>

      {/* Object Actions Group */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          borderLeft: '1px solid var(--border-color, #e5e5e5)',
          paddingLeft: 16,
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onBringToFront}
          disabled={!hasSelection}
          title="Bring to Front"
          style={{ padding: '6px 8px' }}
        >
          <ArrowUpToLine size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSendToBack}
          disabled={!hasSelection}
          title="Send to Back"
          style={{ padding: '6px 8px' }}
        >
          <ArrowDownToLine size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete (Del)"
          style={{ padding: '6px 8px', color: hasSelection ? 'var(--danger, #dc2626)' : undefined }}
        >
          <Trash2 size={16} />
        </Button>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* View Group */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderLeft: '1px solid var(--border-color, #e5e5e5)',
          paddingLeft: 16,
        }}
      >
        <Button
          variant={showGrid ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onToggleGrid}
          title="Toggle Grid"
          style={{ padding: '6px 8px' }}
        >
          <Grid3X3 size={16} />
        </Button>
      </div>

      {/* History Group */}
      {onUndo && onRedo && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            borderLeft: '1px solid var(--border-color, #e5e5e5)',
            paddingLeft: 16,
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            style={{ padding: '6px 8px' }}
          >
            <Undo2 size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            style={{ padding: '6px 8px' }}
          >
            <Redo2 size={16} />
          </Button>
        </div>
      )}

      {/* Card Size */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderLeft: '1px solid var(--border-color, #e5e5e5)',
          paddingLeft: 16,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          Size
        </span>
        <Select value={currentPreset} onValueChange={handlePresetChange}>
          <SelectTrigger style={{ width: 140, height: 32 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CARD_PRESETS.map((preset) => (
              <SelectItem key={preset.name} value={preset.name}>
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {cardWidth.toFixed(1)} × {cardHeight.toFixed(1)} mm
        </span>
      </div>
    </div>
  )
}
