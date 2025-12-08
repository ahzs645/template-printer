import { useState } from 'react'
import { Download, Upload, Plus, Trash2, Palette, ScanLine, Settings2 } from 'lucide-react'
import { DockablePanel, PanelSection } from '../ui/dockable-panel'
import { Slider } from '../ui/slider'
import { Button } from '../ui/button'
import { CardPreview } from './CardPreview'
import { ColorSwatchChart } from './ColorSwatchChart'
import { useCardLayout, useColorChart, useColorProfiles, useImageAnalysis } from '../../hooks/calibration'
import { generateSVG, generatePDF, exportTestPrint, importTestPrint, exportProfiles, importProfiles, type TestPrintConfig, type ColorProfile } from '../../lib/calibration/exportUtils'
import {
  ImageContainer,
  FileUpload,
  AnalysisDisplay,
  ControlPanel,
} from './color-comparison'
import { cn } from '../../lib/utils'

type CalibrationMode = 'swatch' | 'compare' | 'profiles'

export function CalibrationTab() {
  const [mode, setMode] = useState<CalibrationMode>('swatch')
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

  // Initialize hooks
  const { useArucoMarkers, setUseArucoMarkers, margin, setMargin, cardLayout } = useCardLayout()
  const {
    selectedColor,
    setSelectedColor,
    colorChart,
    setColorChart,
    hoveredSwatch,
    setHoveredSwatch,
    handleAddToChart,
    handleRemoveSwatch,
    handleReplaceSwatch,
    getRGBValues
  } = useColorChart(useArucoMarkers)

  const {
    profiles,
    loading: profilesLoading,
    handleCreateProfileFromComparison,
    handleDeleteProfile,
    handleImportProfiles,
  } = useColorProfiles()

  const {
    scannedImage,
    colorComparisons,
    isAnalyzing,
    analysisResult,
    canvasRef,
    handleImageUpload,
    clearImage
  } = useImageAnalysis()

  const [showOverlay, setShowOverlay] = useState(true)

  const handleCreateProfile = async (
    colorAdjustments: Array<{ color: string, adjustment: { r: number, g: number, b: number } }>,
    profileName: string,
    deviceName: string
  ) => {
    const adjustmentsRecord: Record<string, { r: number; g: number; b: number }> = {}
    colorAdjustments.forEach(({ color, adjustment }) => {
      adjustmentsRecord[color] = adjustment
    })

    try {
      await handleCreateProfileFromComparison(adjustmentsRecord, profileName, deviceName)
      setMode('profiles')
    } catch (error) {
      console.error('Failed to create profile:', error)
      alert('Failed to create color profile. Please try again.')
    }
  }

  const handleExportProfiles = () => {
    exportProfiles(profiles)
  }

  const handleImportProfilesFromFile = (file: File) => {
    importProfiles(
      file,
      async (importedProfiles: ColorProfile[]) => {
        try {
          await handleImportProfiles(importedProfiles)
          alert(`Successfully imported ${importedProfiles.length} profile(s)`)
        } catch (error) {
          console.error('Failed to import profiles:', error)
          alert('Failed to import profiles. Please try again.')
        }
      },
      (error: string) => {
        alert(error)
      }
    )
  }

  const handleExportTestPrint = () => {
    exportTestPrint(useArucoMarkers, margin, colorChart, cardLayout)
  }

  const handleImportTestPrint = (file: File) => {
    importTestPrint(
      file,
      (config: TestPrintConfig) => {
        setUseArucoMarkers(config.settings.useArucoMarkers)
        setMargin(config.settings.margin || 5)
        setColorChart(config.colorChart)
      },
      (error: string) => {
        alert(error)
      }
    )
  }

  const selectedProfile = profiles.find(p => p.id === selectedProfileId)

  if (profilesLoading) {
    return (
      <div className="app-content" style={{ height: '100%' }}>
        <div className="app-workspace">
          <div className="empty-state">
            <p className="empty-state__text">Loading calibration data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="app-content" style={{ height: '100%' }}>
        {/* Left Panel - Mode Selection & Settings */}
        <DockablePanel title="Calibration" side="left" width={300}>
          <PanelSection title="Mode">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                className={cn('field-item', mode === 'swatch' && 'field-item--selected')}
                onClick={() => setMode('swatch')}
              >
                <Palette size={16} style={{ marginRight: 8 }} />
                <div>
                  <div className="field-item__name">Swatch Generator</div>
                  <div className="field-item__type">Create test charts</div>
                </div>
              </button>
              <button
                className={cn('field-item', mode === 'compare' && 'field-item--selected')}
                onClick={() => setMode('compare')}
              >
                <ScanLine size={16} style={{ marginRight: 8 }} />
                <div>
                  <div className="field-item__name">Color Comparison</div>
                  <div className="field-item__type">Analyze printed results</div>
                </div>
              </button>
              <button
                className={cn('field-item', mode === 'profiles' && 'field-item--selected')}
                onClick={() => setMode('profiles')}
              >
                <Settings2 size={16} style={{ marginRight: 8 }} />
                <div>
                  <div className="field-item__name">Profiles ({profiles.length})</div>
                  <div className="field-item__type">Manage calibrations</div>
                </div>
              </button>
            </div>
          </PanelSection>

          {mode === 'swatch' && (
            <>
              <PanelSection title="Color Picker">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input
                    type="color"
                    className="w-10 h-10 rounded cursor-pointer border-0"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    style={{ width: 40, height: 40 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontFamily: 'monospace' }}>{selectedColor}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{getRGBValues(selectedColor)}</div>
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAddToChart}
                  disabled={colorChart.length >= (useArucoMarkers ? 73 : 77)}
                  style={{ width: '100%' }}
                >
                  <Plus size={14} style={{ marginRight: 4 }} />
                  Add ({colorChart.length}/{useArucoMarkers ? 73 : 77})
                </button>
              </PanelSection>

              <PanelSection title="Card Settings">
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label style={{ fontSize: 12 }}>Margin</label>
                    <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{margin}mm</span>
                  </div>
                  <Slider
                    value={[margin]}
                    onValueChange={([value]) => setMargin(value)}
                    min={2}
                    max={10}
                    step={0.5}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={useArucoMarkers}
                    onChange={(e) => setUseArucoMarkers(e.target.checked)}
                  />
                  ArUco markers (auto-align)
                </label>
              </PanelSection>

              <PanelSection title="Export">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => generatePDF(cardLayout, colorChart, useArucoMarkers)}>
                    <Download size={14} style={{ marginRight: 4 }} />
                    Download PDF
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => generateSVG(cardLayout, colorChart, useArucoMarkers)}>
                    <Download size={14} style={{ marginRight: 4 }} />
                    Download SVG
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={handleExportTestPrint}>
                      Export
                    </button>
                    <label className="btn btn-secondary btn-sm" style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Import
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => e.target.files?.[0] && handleImportTestPrint(e.target.files[0])}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>
              </PanelSection>
            </>
          )}

          {mode === 'compare' && (
            <>
              <PanelSection title="Upload Image">
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Print the swatch chart, then photograph or scan it and upload here.
                </p>
                <label className="btn btn-primary btn-sm" style={{ width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={14} style={{ marginRight: 4 }} />
                  {scannedImage ? 'Replace Image' : 'Upload Image'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], colorChart, cardLayout)}
                    style={{ display: 'none' }}
                  />
                </label>
                {scannedImage && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      className={cn('btn btn-sm', showOverlay ? 'btn-primary' : 'btn-secondary')}
                      onClick={() => setShowOverlay(!showOverlay)}
                      style={{ flex: 1 }}
                    >
                      {showOverlay ? 'Hide' : 'Show'} Grid
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={clearImage} style={{ flex: 1 }}>
                      Clear
                    </button>
                  </div>
                )}
              </PanelSection>

              <PanelSection title="Expected Colors" defaultOpen={false}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
                  {colorChart.slice(0, 24).map((color, index) => (
                    <div
                      key={index}
                      style={{
                        aspectRatio: '1',
                        backgroundColor: color,
                        borderRadius: 2,
                        border: '1px solid var(--border)'
                      }}
                      title={`#${index}: ${color}`}
                    />
                  ))}
                </div>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  {colorChart.length} colors in chart
                </p>
              </PanelSection>
            </>
          )}

          {mode === 'profiles' && (
            <>
              <PanelSection
                title={`Saved Profiles (${profiles.length})`}
                actions={
                  <div style={{ display: 'flex', gap: 4 }}>
                    <label className="btn btn-ghost btn-sm btn-icon" title="Import" style={{ cursor: 'pointer' }}>
                      <Upload size={14} />
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => e.target.files?.[0] && handleImportProfilesFromFile(e.target.files[0])}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      onClick={handleExportProfiles}
                      disabled={profiles.length === 0}
                      title="Export All"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                }
              >
                {profiles.length === 0 ? (
                  <div className="empty-state" style={{ padding: '16px 0' }}>
                    <Settings2 size={24} className="empty-state__icon" />
                    <p className="empty-state__text">No profiles yet</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Create profiles by analyzing printed charts
                    </p>
                  </div>
                ) : (
                  <div className="field-list" style={{ maxHeight: 300, overflow: 'auto' }}>
                    {profiles.map((profile) => {
                      const adjustmentCount = Object.keys(profile.adjustments || {}).length
                      return (
                        <button
                          key={profile.id}
                          className={cn('field-item', selectedProfileId === profile.id && 'field-item--selected')}
                          onClick={() => setSelectedProfileId(profile.id)}
                          style={{ textAlign: 'left' }}
                        >
                          <div style={{ flex: 1 }}>
                            <div className="field-item__name">{profile.name}</div>
                            <div className="field-item__type">{profile.device}</div>
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {adjustmentCount} colors
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </PanelSection>
            </>
          )}
        </DockablePanel>

        {/* Main Canvas */}
        <div className="app-workspace">
          <div className="canvas-container">
            {mode === 'swatch' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Color Swatch Chart</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    CR80 Card: 85.6mm x 54mm | {useArucoMarkers ? '73 colors + 4 markers' : '77 colors'}
                  </p>
                </div>
                <ColorSwatchChart
                  colorChart={colorChart}
                  useArucoMarkers={useArucoMarkers}
                  cardLayout={cardLayout}
                  hoveredSwatch={hoveredSwatch}
                  onSwatchHover={setHoveredSwatch}
                  onReplaceSwatch={handleReplaceSwatch}
                  onRemoveSwatch={handleRemoveSwatch}
                />
              </div>
            )}

            {mode === 'compare' && (
              <div style={{ width: '100%', maxWidth: 900, padding: '0 16px' }}>
                {!scannedImage ? (
                  <div className="empty-state">
                    <ScanLine size={48} className="empty-state__icon" />
                    <p className="empty-state__text">Upload a scanned color chart to begin analysis</p>
                    <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                      <Upload size={16} style={{ marginRight: 8 }} />
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], colorChart, cardLayout)}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <ImageContainer
                      scannedImage={scannedImage}
                      showOverlay={showOverlay}
                      cardLayout={cardLayout}
                      colorChart={colorChart}
                      analysisResult={analysisResult}
                    />
                    <AnalysisDisplay
                      isAnalyzing={isAnalyzing}
                      colorComparisons={colorComparisons}
                      onCreateProfile={handleCreateProfile}
                    />
                  </div>
                )}
              </div>
            )}

            {mode === 'profiles' && (
              <div style={{ width: '100%', maxWidth: 800, padding: '0 16px' }}>
                {!selectedProfile ? (
                  <div className="empty-state">
                    <Settings2 size={48} className="empty-state__icon" />
                    <p className="empty-state__text">
                      {profiles.length === 0
                        ? 'Create a profile by analyzing a printed chart'
                        : 'Select a profile to view details'}
                    </p>
                  </div>
                ) : (
                  <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 24, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{selectedProfile.name}</h2>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selectedProfile.device}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Created: {new Date(selectedProfile.createdAt || selectedProfile.created || '').toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this profile?')) {
                            handleDeleteProfile(selectedProfile.id)
                            setSelectedProfileId(null)
                          }
                        }}
                      >
                        <Trash2 size={14} style={{ marginRight: 4 }} />
                        Delete
                      </Button>
                    </div>

                    <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
                      Color Adjustments ({Object.keys(selectedProfile.adjustments || {}).length})
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, maxHeight: 400, overflow: 'auto' }}>
                      {Object.entries(selectedProfile.adjustments || {}).map(([color, adjustment]) => {
                        const scannedR = parseInt(color.slice(1, 3), 16) + adjustment.r
                        const scannedG = parseInt(color.slice(3, 5), 16) + adjustment.g
                        const scannedB = parseInt(color.slice(5, 7), 16) + adjustment.b
                        const scannedColor = `#${[
                          Math.max(0, Math.min(255, scannedR)).toString(16).padStart(2, '0'),
                          Math.max(0, Math.min(255, scannedG)).toString(16).padStart(2, '0'),
                          Math.max(0, Math.min(255, scannedB)).toString(16).padStart(2, '0')
                        ].join('')}`

                        return (
                          <div key={color} style={{ background: 'var(--bg-hover)', borderRadius: 4, padding: 8 }}>
                            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                              <div style={{ width: 24, height: 24, borderRadius: 2, backgroundColor: color, border: '1px solid var(--border)' }} title="Original" />
                              <div style={{ width: 24, height: 24, borderRadius: 2, backgroundColor: scannedColor, border: '1px solid var(--border)' }} title="Scanned" />
                            </div>
                            <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                              {color}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                              R{adjustment.r >= 0 ? '+' : ''}{adjustment.r} G{adjustment.g >= 0 ? '+' : ''}{adjustment.g} B{adjustment.b >= 0 ? '+' : ''}{adjustment.b}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Card Preview */}
        <DockablePanel title="Preview" side="right" width={280}>
          <PanelSection title="CR80 Card">
            <div
              className="aspect-[85.6/54] border-2 border-border rounded-lg overflow-hidden bg-white relative"
              style={{ marginBottom: 8 }}
            >
              {/* Mini card preview */}
              {Array.from({ length: 77 }).map((_, gridIndex) => {
                const isMarkerPosition = useArucoMarkers && cardLayout.excludedIndices.includes(gridIndex)
                const row = Math.floor(gridIndex / 11)
                const col = gridIndex % 11

                if (isMarkerPosition) {
                  return (
                    <div
                      key={`marker-${gridIndex}`}
                      className="absolute bg-gray-800"
                      style={{
                        left: `${(col / 11) * 100}%`,
                        top: `${(row / 7) * 100}%`,
                        width: `${(1 / 11) * 100}%`,
                        height: `${(1 / 7) * 100}%`,
                      }}
                    />
                  )
                }

                let swatchIndex = 0
                for (let i = 0; i < gridIndex; i++) {
                  if (!cardLayout.excludedIndices.includes(i)) {
                    swatchIndex++
                  }
                }

                const color = colorChart[swatchIndex]
                return (
                  <div
                    key={`swatch-${gridIndex}`}
                    className="absolute"
                    style={{
                      left: `${(col / 11) * 100}%`,
                      top: `${(row / 7) * 100}%`,
                      width: `${(1 / 11) * 100}%`,
                      height: `${(1 / 7) * 100}%`,
                      backgroundColor: color || '#E5E7EB'
                    }}
                  />
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <div>Size: 85.6mm x 54mm</div>
              <div>Grid: 11 x 7</div>
              <div>Colors: {colorChart.length}</div>
            </div>
          </PanelSection>

          {hoveredSwatch !== null && colorChart[hoveredSwatch] && (
            <PanelSection title="Selected Swatch">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 4,
                    backgroundColor: colorChart[hoveredSwatch],
                    border: '1px solid var(--border)'
                  }}
                />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>Swatch #{hoveredSwatch}</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {colorChart[hoveredSwatch]}
                  </div>
                </div>
              </div>
            </PanelSection>
          )}

          <PanelSection title="Info">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <p><strong>Swatch Generator:</strong> Create color test charts with optional ArUco markers for auto-alignment.</p>
              <p style={{ marginTop: 8 }}><strong>Color Comparison:</strong> Upload a photo of your printed chart to analyze color accuracy.</p>
              <p style={{ marginTop: 8 }}><strong>Profiles:</strong> Save calibration data for different printers.</p>
            </div>
          </PanelSection>
        </DockablePanel>
      </div>

      {/* Hidden canvas for analysis */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  )
}
