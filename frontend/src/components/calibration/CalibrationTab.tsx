import { useState } from 'react'
import { Download, Upload, Plus, Trash2, Settings2, ScanLine, Printer } from 'lucide-react'
import { Slider } from '../ui/slider'
import { Button } from '../ui/button'
import { ColorSwatchChart } from './ColorSwatchChart'
import { useCardLayout, useColorChart, useColorProfiles, useImageAnalysis } from '../../hooks/calibration'
import { generateSVG, generatePDF, exportTestPrint, importTestPrint, exportProfiles, importProfiles, type TestPrintConfig, type ColorProfile } from '../../lib/calibration/exportUtils'
import { generateArucoMarker } from '../../lib/calibration/aruco'
import { getGridPosition } from '../../lib/calibration/layoutCalculator'
import {
  ImageContainer,
  AnalysisDisplay,
} from './color-comparison'
import { cn } from '../../lib/utils'

export type CalibrationMode = 'swatch' | 'compare' | 'profiles'

interface CalibrationTabProps {
  mode: CalibrationMode
  onModeChange: (mode: CalibrationMode) => void
}

export function CalibrationTab({ mode, onModeChange }: CalibrationTabProps) {
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
      onModeChange('profiles')
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
  const maxColors = useArucoMarkers ? 73 : 77

  if (profilesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted">Loading calibration data...</p>
      </div>
    )
  }

  // Swatch Generator Mode - Dashboard Layout
  if (mode === 'swatch') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, padding: 16, height: '100%', overflow: 'auto' }}>
        {/* Main Content - Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Chart Card */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', padding: 20, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Color Calibration Chart</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  CR80 Card (85.6mm × 54mm) • {colorChart.length}/{maxColors} colors {useArucoMarkers && '• 4 ArUco markers'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => generatePDF(cardLayout, colorChart, useArucoMarkers)}>
                  <Download size={14} style={{ marginRight: 4 }} />
                  PDF
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => generateSVG(cardLayout, colorChart, useArucoMarkers)}>
                  <Download size={14} style={{ marginRight: 4 }} />
                  SVG
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
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
          </div>

          {/* Color Palette Quick Add */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Quick Add Colors</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3',
                '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
                '#8B4513', '#A0522D', '#CD853F', '#DEB887', '#F5DEB3',
                '#FF69B4', '#FF1493', '#C71585', '#DB7093',
                '#00CED1', '#20B2AA', '#008B8B', '#5F9EA0',
                '#FFD700', '#FFA500', '#FF8C00', '#FF6347'].map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    if (colorChart.length < maxColors && !colorChart.includes(color)) {
                      setColorChart([...colorChart, color])
                    }
                  }}
                  disabled={colorChart.includes(color) || colorChart.length >= maxColors}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    backgroundColor: color,
                    border: colorChart.includes(color) ? '2px solid var(--primary)' : '1px solid var(--border)',
                    cursor: colorChart.includes(color) || colorChart.length >= maxColors ? 'not-allowed' : 'pointer',
                    opacity: colorChart.includes(color) ? 0.5 : 1
                  }}
                  title={colorChart.includes(color) ? 'Already in chart' : `Add ${color}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Color Picker Card */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Custom Color</h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                style={{ width: 56, height: 56, borderRadius: 8, cursor: 'pointer', border: 'none' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'monospace' }}>{selectedColor}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{getRGBValues(selectedColor)}</div>
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleAddToChart}
              disabled={colorChart.length >= maxColors}
              style={{ width: '100%' }}
            >
              <Plus size={14} style={{ marginRight: 4 }} />
              Add to Chart
            </button>
          </div>

          {/* Settings Card */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Chart Settings</h3>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12 }}>Margin</label>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{margin}mm</span>
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
              <span>ArUco markers for auto-alignment</span>
            </label>
          </div>

          {/* Selected Swatch Info */}
          {hoveredSwatch !== null && colorChart[hoveredSwatch] && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', padding: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Selected Swatch</h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 6,
                    backgroundColor: colorChart[hoveredSwatch],
                    border: '1px solid var(--border)'
                  }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Swatch #{hoveredSwatch + 1}</div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {colorChart[hoveredSwatch]}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {getRGBValues(colorChart[hoveredSwatch])}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Import/Export Card */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Configuration</h3>
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

          {/* CR80 Card Preview */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>CR80 Card Preview</h3>
            <div
              style={{
                aspectRatio: '85.6 / 54',
                border: '2px solid var(--border)',
                borderRadius: 6,
                overflow: 'hidden',
                backgroundColor: 'white',
                position: 'relative',
                marginBottom: 12
              }}
            >
              {Array.from({ length: 77 }).map((_, gridIndex) => {
                const isMarkerPosition = useArucoMarkers && cardLayout.excludedIndices.includes(gridIndex)
                const gridPos = getGridPosition(cardLayout, gridIndex)

                if (isMarkerPosition) {
                  const markerData = cardLayout.markerPositions.find(m => m.gridIndex === gridIndex)
                  if (!markerData) return null

                  return (
                    <div
                      key={`marker-${gridIndex}`}
                      style={{
                        position: 'absolute',
                        left: `${(gridPos.x / cardLayout.cardWidth) * 100}%`,
                        top: `${(gridPos.y / cardLayout.cardHeight) * 100}%`,
                        width: `${(gridPos.width / cardLayout.cardWidth) * 100}%`,
                        height: `${(gridPos.height / cardLayout.cardHeight) * 100}%`,
                        border: '1px solid #333',
                        backgroundColor: 'white'
                      }}
                    >
                      <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(6, 1fr)' }}>
                        {Array.from({ length: 36 }).map((_, cellIdx) => {
                          const row = Math.floor(cellIdx / 6)
                          const col = cellIdx % 6
                          const marker = generateArucoMarker(markerData.id)
                          const isBlack = marker.matrix[row] && marker.matrix[row][col] === 0
                          return (
                            <div
                              key={cellIdx}
                              style={{ backgroundColor: isBlack ? 'black' : 'white' }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                } else {
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
                      style={{
                        position: 'absolute',
                        left: `${(gridPos.x / cardLayout.cardWidth) * 100}%`,
                        top: `${(gridPos.y / cardLayout.cardHeight) * 100}%`,
                        width: `${(gridPos.width / cardLayout.cardWidth) * 100}%`,
                        height: `${(gridPos.height / cardLayout.cardHeight) * 100}%`,
                        backgroundColor: color || '#E5E7EB'
                      }}
                    />
                  )
                }
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <div>Size: 85.60mm × 54.00mm</div>
              <div>Swatch: {cardLayout.swatchGrid.swatchWidth.toFixed(1)}mm × {cardLayout.swatchGrid.swatchHeight.toFixed(1)}mm</div>
              <div>Grid: 11 × 7 ({useArucoMarkers ? '73 colors + 4 markers' : '77 colors'})</div>
            </div>
          </div>
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    )
  }

  // Color Comparison Mode - Split View
  if (mode === 'compare') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: scannedImage ? '1fr 1fr' : '1fr', gap: 16, padding: 16, height: '100%', overflow: 'auto' }}>
        {/* Left - Expected Colors / Upload */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', padding: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Expected Colors</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                {colorChart.length} colors in reference chart
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 2, marginBottom: 16 }}>
            {colorChart.map((color, index) => (
              <div
                key={index}
                style={{
                  aspectRatio: '1',
                  backgroundColor: color,
                  borderRadius: 2,
                  border: '1px solid var(--border)'
                }}
                title={`#${index + 1}: ${color}`}
              />
            ))}
          </div>

          {!scannedImage && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderTop: '1px solid var(--border)', paddingTop: 24 }}>
              <ScanLine size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
              <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Upload Scanned Chart</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 300, marginBottom: 16 }}>
                Print the swatch chart, then photograph or scan it to analyze color accuracy
              </p>
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
          )}
        </div>

        {/* Right - Scanned Image & Analysis */}
        {scannedImage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Scanned Result</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    {isAnalyzing ? 'Analyzing...' : `${colorComparisons.length} colors detected`}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className={cn('btn btn-sm', showOverlay ? 'btn-primary' : 'btn-secondary')}
                    onClick={() => setShowOverlay(!showOverlay)}
                  >
                    {showOverlay ? 'Hide' : 'Show'} Grid
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={clearImage}>
                    Clear
                  </button>
                </div>
              </div>

              <ImageContainer
                scannedImage={scannedImage}
                showOverlay={showOverlay}
                cardLayout={cardLayout}
                colorChart={colorChart}
                analysisResult={analysisResult}
              />
            </div>

            <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', padding: 20, flex: 1, overflow: 'auto' }}>
              <AnalysisDisplay
                isAnalyzing={isAnalyzing}
                colorComparisons={colorComparisons}
                onCreateProfile={handleCreateProfile}
              />
            </div>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    )
  }

  // Profiles Mode - Table/Cards Layout
  if (mode === 'profiles') {
    return (
      <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: selectedProfile ? '300px 1fr' : '1fr', gap: 16, height: '100%' }}>
          {/* Profiles List */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Color Profiles</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  {profiles.length} saved profile{profiles.length !== 1 ? 's' : ''}
                </p>
              </div>
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
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
              {profiles.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24 }}>
                  <Printer size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                    No profiles yet. Create one by analyzing a printed chart in the Compare tab.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {profiles.map((profile) => {
                    const adjustmentCount = Object.keys(profile.adjustments || {}).length
                    return (
                      <button
                        key={profile.id}
                        onClick={() => setSelectedProfileId(profile.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 12,
                          borderRadius: 6,
                          border: 'none',
                          background: selectedProfileId === profile.id ? 'var(--bg-hover)' : 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%'
                        }}
                      >
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          background: 'linear-gradient(135deg, #ff6b6b, #4ecdc4, #45b7d1)',
                          flexShrink: 0
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {profile.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {profile.device} • {adjustmentCount} colors
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Profile Details */}
          {selectedProfile && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{selectedProfile.name}</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>{selectedProfile.device}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
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

              <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>
                  Color Adjustments ({Object.keys(selectedProfile.adjustments || {}).length})
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                  {Object.entries(selectedProfile.adjustments || {}).map(([color, adjustment]) => {
                    const r = parseInt(color.slice(1, 3), 16)
                    const g = parseInt(color.slice(3, 5), 16)
                    const b = parseInt(color.slice(5, 7), 16)
                    const scannedR = Math.max(0, Math.min(255, r + adjustment.r))
                    const scannedG = Math.max(0, Math.min(255, g + adjustment.g))
                    const scannedB = Math.max(0, Math.min(255, b + adjustment.b))
                    const scannedColor = `#${scannedR.toString(16).padStart(2, '0')}${scannedG.toString(16).padStart(2, '0')}${scannedB.toString(16).padStart(2, '0')}`

                    return (
                      <div key={color} style={{ background: 'var(--bg-hover)', borderRadius: 6, padding: 12 }}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>EXPECTED</div>
                            <div style={{ width: '100%', height: 28, borderRadius: 4, backgroundColor: color, border: '1px solid var(--border)' }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>PRINTED</div>
                            <div style={{ width: '100%', height: 28, borderRadius: 4, backgroundColor: scannedColor, border: '1px solid var(--border)' }} />
                          </div>
                        </div>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {color}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          ΔR{adjustment.r >= 0 ? '+' : ''}{adjustment.r}
                          ΔG{adjustment.g >= 0 ? '+' : ''}{adjustment.g}
                          ΔB{adjustment.b >= 0 ? '+' : ''}{adjustment.b}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Empty state when no profile selected */}
          {!selectedProfile && profiles.length > 0 && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Settings2 size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  Select a profile to view details
                </p>
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    )
  }

  return null
}
