interface ControlPanelProps {
  showOverlay: boolean
  onToggleOverlay: () => void
  onClearImage: () => void
}

export function ControlPanel({
  showOverlay,
  onToggleOverlay,
  onClearImage
}: ControlPanelProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggleOverlay}
        className={`px-3 py-1 text-sm rounded ${showOverlay
            ? 'bg-accent-soft text-accent hover:bg-hover'
            : 'bg-surface-alt text-ink hover:bg-hover'
          }`}
      >
        {showOverlay ? 'Hide' : 'Show'} Grid
      </button>
      <button
        onClick={onClearImage}
        className="rounded-control bg-danger-soft px-3 py-1 text-sm text-danger hover:bg-hover"
      >
        Clear
      </button>
    </div>
  )
}
