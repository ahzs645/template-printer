import { useState, useEffect } from "react"
import { Slider } from "../ui/slider"
import type { ColorProfile } from "../../lib/calibration/exportUtils"

interface ProfileManagerProps {
  selectedColor: string
  adjustments: {
    brightness: number
    contrast: number
    saturation: number
    red: number
    green: number
    blue: number
  }
  setAdjustments: (adjustments: ProfileManagerProps['adjustments']) => void
  applyAdjustments: (color: string) => string
  profiles: ColorProfile[]
  newProfileName: string
  setNewProfileName: (name: string) => void
  newProfileDevice: string
  setNewProfileDevice: (device: string) => void
  onSaveProfile: () => void
  onResetAdjustments: () => void
  onLoadProfile: (profile: ColorProfile) => void
  onDeleteProfile: (profileId: string) => void
  onExportProfiles: () => void
  onImportProfiles: (file: File) => void
}

export function ProfileManager({
  profiles,
  onLoadProfile,
  onDeleteProfile,
  onExportProfiles,
  onImportProfiles
}: ProfileManagerProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showFineTuning, setShowFineTuning] = useState<boolean>(false)
  const [fineTuneAdjustments, setFineTuneAdjustments] = useState<Record<string, { r: number, g: number, b: number }>>({})

  const selectedProfile = selectedProfileId ? profiles.find(p => p.id === selectedProfileId) : null

  // Initialize fine-tune adjustments when profile changes
  useEffect(() => {
    if (selectedProfile && selectedProfile.adjustments) {
      const initialAdjustments: Record<string, { r: number, g: number, b: number }> = {}
      Object.keys(selectedProfile.adjustments).forEach(color => {
        const baseAdjustment = selectedProfile.adjustments[color]
        // Pre-populate with the inverse of the original difference (the correction)
        initialAdjustments[color] = {
          r: -baseAdjustment.r, // Inverse to get from scanned back to original
          g: -baseAdjustment.g,
          b: -baseAdjustment.b
        }
      })
      setFineTuneAdjustments(initialAdjustments)
    }
  }, [selectedProfile?.id])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Color Profile Manager</h2>
        <p className="text-muted-foreground">Manage calibration profiles created from color comparison analysis.</p>
      </div>

      {/* Profile Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map(profile => {
          const adjustmentCount = Object.keys(profile.adjustments || {}).length
          const avgAdjustment = adjustmentCount > 0 ?
            Object.values(profile.adjustments || {}).reduce((sum, adj) => {
              return sum + Math.abs(adj.r) + Math.abs(adj.g) + Math.abs(adj.b)
            }, 0) / (adjustmentCount * 3) : 0

          return (
            <div
              key={profile.id}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedProfileId === profile.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              onClick={() => setSelectedProfileId(profile.id)}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium truncate">{profile.name}</h3>
                <span className={`px-2 py-1 text-xs rounded ${avgAdjustment < 10 ? 'bg-green-100 text-green-800' :
                    avgAdjustment < 25 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                  }`}>
                  {avgAdjustment < 10 ? 'Fine' : avgAdjustment < 25 ? 'Moderate' : 'Heavy'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{profile.device}</p>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{adjustmentCount} colors</span>
                <span>{new Date(profile.createdAt || profile.created || '').toLocaleDateString()}</span>
              </div>
            </div>
          )
        })}

        {profiles.length === 0 && (
          <div className="col-span-full p-8 text-center border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500 mb-2">No calibration profiles yet</p>
            <p className="text-sm text-gray-400">Create profiles by analyzing printed color charts in the Color Comparison tab</p>
          </div>
        )}
      </div>


      {/* Selected Profile Details */}
      {selectedProfile && (
        <div className="border rounded-lg p-6 bg-gray-50">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-medium">{selectedProfile.name}</h3>
              <p className="text-gray-600">{selectedProfile.device}</p>
              <p className="text-sm text-gray-500">
                Created: {new Date(selectedProfile.createdAt || selectedProfile.created || '').toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
                onClick={() => onLoadProfile(selectedProfile)}
              >
                Apply Profile
              </button>
              <button
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/80"
                onClick={() => {
                  onDeleteProfile(selectedProfile.id)
                  setSelectedProfileId(null)
                }}
              >
                Delete
              </button>
            </div>
          </div>

          {/* Color Adjustments Grid with Fine-Tuning */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium">Profile Color Adjustments ({Object.keys(selectedProfile.adjustments || {}).length} colors)</h4>
              <button
                className="px-3 py-1 border rounded text-sm hover:bg-gray-100"
                onClick={() => setShowFineTuning(!showFineTuning)}
              >
                {showFineTuning ? 'Hide' : 'Enable'} Fine-Tuning
              </button>
            </div>

            {!showFineTuning ? (
              // Compact View
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto">
                {Object.entries(selectedProfile.adjustments || {}).map(([color, adjustment]) => {
                  // Calculate scanned color (original + initial adjustment)
                  const scannedColor = `#${[
                    Math.max(0, Math.min(255, parseInt(color.slice(1, 3), 16) + adjustment.r)).toString(16).padStart(2, '0'),
                    Math.max(0, Math.min(255, parseInt(color.slice(3, 5), 16) + adjustment.g)).toString(16).padStart(2, '0'),
                    Math.max(0, Math.min(255, parseInt(color.slice(5, 7), 16) + adjustment.b)).toString(16).padStart(2, '0')
                  ].join('')
                    }`

                  return (
                    <div key={color} className="bg-white p-3 rounded border">
                      <div className="flex gap-1 mb-2">
                        <div className="flex-1">
                          <div
                            className="w-full h-6 rounded-t border border-gray-300"
                            style={{ backgroundColor: color }}
                            title="Original"
                          />
                          <div
                            className="w-full h-6 rounded-b border border-gray-300 border-t-0"
                            style={{ backgroundColor: scannedColor }}
                            title="Scanned"
                          />
                        </div>
                      </div>
                      <div className="text-xs font-mono text-gray-600">
                        {color}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        R{adjustment.r >= 0 ? '+' : ''}{adjustment.r}
                        G{adjustment.g >= 0 ? '+' : ''}{adjustment.g}
                        B{adjustment.b >= 0 ? '+' : ''}{adjustment.b}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              // Fine-Tuning View
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {Object.entries(selectedProfile.adjustments || {}).map(([color, adjustment]) => {
                  // Calculate scanned color (what was actually printed)
                  const scannedR = parseInt(color.slice(1, 3), 16) + adjustment.r
                  const scannedG = parseInt(color.slice(3, 5), 16) + adjustment.g
                  const scannedB = parseInt(color.slice(5, 7), 16) + adjustment.b
                  const scannedColor = `#${[
                    Math.max(0, Math.min(255, scannedR)).toString(16).padStart(2, '0'),
                    Math.max(0, Math.min(255, scannedG)).toString(16).padStart(2, '0'),
                    Math.max(0, Math.min(255, scannedB)).toString(16).padStart(2, '0')
                  ].join('')
                    }`

                  // Get fine-tune adjustments for this color
                  const fineTuneAdjustment = fineTuneAdjustments[color] || { r: 0, g: 0, b: 0 }

                  // Calculate final adjusted color (scanned + fine-tune)
                  const adjustedColor = `#${[
                    Math.max(0, Math.min(255, scannedR + fineTuneAdjustment.r)).toString(16).padStart(2, '0'),
                    Math.max(0, Math.min(255, scannedG + fineTuneAdjustment.g)).toString(16).padStart(2, '0'),
                    Math.max(0, Math.min(255, scannedB + fineTuneAdjustment.b)).toString(16).padStart(2, '0')
                  ].join('')
                    }`

                  return (
                    <div key={color} className="bg-white p-4 rounded-lg border-2 border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Color Display */}
                        <div>
                          <div className="flex gap-3 items-center">
                            <div className="text-center">
                              <div
                                className="w-16 h-16 rounded border-2 border-gray-300"
                                style={{ backgroundColor: color }}
                              />
                              <div className="text-xs mt-1 font-medium">Original</div>
                              <div className="text-xs text-gray-500">{color}</div>
                            </div>
                            <div className="text-xl">-&gt;</div>
                            <div className="text-center">
                              <div
                                className="w-16 h-16 rounded border-2 border-gray-300"
                                style={{ backgroundColor: scannedColor }}
                              />
                              <div className="text-xs mt-1 font-medium">Scanned</div>
                              <div className="text-xs text-gray-500">{scannedColor}</div>
                            </div>
                            <div className="text-xl">-&gt;</div>
                            <div className="text-center">
                              <div
                                className="w-16 h-16 rounded border-2 border-green-500"
                                style={{ backgroundColor: adjustedColor }}
                              />
                              <div className="text-xs mt-1 font-medium text-green-700">Adjusted</div>
                              <div className="text-xs text-gray-500">{adjustedColor}</div>
                            </div>
                          </div>
                        </div>

                        {/* Fine-Tune Controls */}
                        <div className="space-y-2">
                          <div className="text-sm font-medium mb-2">Fine-Tune Adjustments</div>

                          {/* Red */}
                          <div className="flex items-center gap-2">
                            <label className="text-xs w-8 text-red-700 font-medium">R</label>
                            <Slider
                              value={[fineTuneAdjustment.r]}
                              onValueChange={([value]) => {
                                setFineTuneAdjustments(prev => ({
                                  ...prev,
                                  [color]: { ...fineTuneAdjustment, r: value }
                                }))
                              }}
                              min={-127}
                              max={127}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-xs font-mono w-12 text-right">
                              {fineTuneAdjustment.r > 0 ? '+' : ''}{fineTuneAdjustment.r}
                            </span>
                          </div>

                          {/* Green */}
                          <div className="flex items-center gap-2">
                            <label className="text-xs w-8 text-green-700 font-medium">G</label>
                            <Slider
                              value={[fineTuneAdjustment.g]}
                              onValueChange={([value]) => {
                                setFineTuneAdjustments(prev => ({
                                  ...prev,
                                  [color]: { ...fineTuneAdjustment, g: value }
                                }))
                              }}
                              min={-127}
                              max={127}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-xs font-mono w-12 text-right">
                              {fineTuneAdjustment.g > 0 ? '+' : ''}{fineTuneAdjustment.g}
                            </span>
                          </div>

                          {/* Blue */}
                          <div className="flex items-center gap-2">
                            <label className="text-xs w-8 text-blue-700 font-medium">B</label>
                            <Slider
                              value={[fineTuneAdjustment.b]}
                              onValueChange={([value]) => {
                                setFineTuneAdjustments(prev => ({
                                  ...prev,
                                  [color]: { ...fineTuneAdjustment, b: value }
                                }))
                              }}
                              min={-127}
                              max={127}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-xs font-mono w-12 text-right">
                              {fineTuneAdjustment.b > 0 ? '+' : ''}{fineTuneAdjustment.b}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {showFineTuning && (
              <div className="mt-4 pt-4 border-t bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h5 className="font-medium text-blue-900">Apply Fine-Tuning Adjustments</h5>
                    <p className="text-sm text-blue-700">Save your fine-tuning adjustments to this profile</p>
                  </div>
                  <button
                    onClick={() => {
                      // Update the profile with fine-tuning adjustments
                      if (selectedProfile) {
                        const updatedProfile = { ...selectedProfile }
                        Object.entries(fineTuneAdjustments).forEach(([color, fineTune]) => {
                          const baseAdjustment = selectedProfile.adjustments[color]
                          // Combine base adjustment with fine-tuning
                          updatedProfile.adjustments[color] = {
                            r: baseAdjustment.r + fineTune.r,
                            g: baseAdjustment.g + fineTune.g,
                            b: baseAdjustment.b + fineTune.b
                          }
                        })
                        onLoadProfile(updatedProfile)
                        alert('Fine-tuning adjustments applied to profile!')
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Apply Adjustments
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import/Export Section */}
      <div className="border-t pt-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Profile Management</h3>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
              onClick={onExportProfiles}
              disabled={profiles.length === 0}
            >
              Export All Profiles ({profiles.length})
            </button>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={(e) => e.target.files?.[0] && onImportProfiles(e.target.files[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button className="px-4 py-2 border rounded hover:bg-gray-50">
                Import Profiles
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">How to Use Profiles</h4>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. <strong>Create:</strong> Use Color Comparison tab to analyze printed charts and create profiles</li>
            <li>2. <strong>Apply:</strong> Click "Apply Profile" to load adjustments for future print jobs</li>
            <li>3. <strong>Export:</strong> Share profiles between devices or back up your calibrations</li>
            <li>4. <strong>Fine-tune:</strong> Use manual adjustments in combination with profiles if needed</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
