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
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
      >
        {showOverlay ? 'Hide' : 'Show'} Grid
      </button>
      <button
        onClick={onClearImage}
        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
      >
        Clear
      </button>
    </div>
  )
}
