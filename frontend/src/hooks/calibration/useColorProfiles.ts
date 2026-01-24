import { useState, useEffect, useCallback } from 'react'
import type { ColorProfile } from '../../lib/calibration/exportUtils'
import { useStorage } from '../../lib/storage'

export function useColorProfiles() {
  const storage = useStorage()
  const [profiles, setProfiles] = useState<ColorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adjustments, setAdjustments] = useState({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    red: 0,
    green: 0,
    blue: 0
  })
  const [newProfileName, setNewProfileName] = useState("")
  const [newProfileDevice, setNewProfileDevice] = useState("")

  // Fetch profiles from storage
  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await storage.listColorProfiles()
      setProfiles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error fetching color profiles:', err)
    } finally {
      setLoading(false)
    }
  }, [storage])

  // Load profiles on mount
  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  const handleSaveProfile = useCallback(async () => {
    if (!newProfileName || !newProfileDevice) return

    try {
      // Note: The adjustments type here is for UI sliders, which differs from
      // the per-color adjustments stored in profiles. This cast maintains
      // backward compatibility with the existing API behavior.
      const newProfile = await storage.createColorProfile({
        name: newProfileName,
        device: newProfileDevice,
        adjustments: adjustments as unknown as Record<string, { r: number; g: number; b: number }>
      })
      setProfiles(prev => [...prev, newProfile])
      setNewProfileName("")
      setNewProfileDevice("")
    } catch (err) {
      console.error('Error saving profile:', err)
      throw err
    }
  }, [storage, newProfileName, newProfileDevice, adjustments])

  const handleCreateProfileFromComparison = useCallback(async (
    colorAdjustments: Record<string, { r: number; g: number; b: number }>,
    profileName: string,
    deviceName: string
  ) => {
    try {
      const newProfile = await storage.createColorProfile({
        name: profileName,
        device: deviceName,
        adjustments: colorAdjustments
      })
      setProfiles(prev => [...prev, newProfile])
      return newProfile
    } catch (err) {
      console.error('Error creating profile from comparison:', err)
      throw err
    }
  }, [storage])

  const handleResetAdjustments = () => {
    setAdjustments({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      red: 0,
      green: 0,
      blue: 0
    })
  }

  const handleLoadProfile = (profile: ColorProfile) => {
    // Profiles now use per-color adjustments
    // We just log that the profile has been loaded
    console.log('Profile loaded:', profile.name, 'with', Object.keys(profile.adjustments || {}).length, 'color adjustments')
  }

  const handleDeleteProfile = useCallback(async (profileId: string) => {
    try {
      await storage.deleteColorProfile(profileId)
      setProfiles(prev => prev.filter(p => p.id !== profileId))
    } catch (err) {
      console.error('Error deleting profile:', err)
      throw err
    }
  }, [storage])

  const handleUpdateProfile = useCallback(async (profileId: string, updates: Partial<ColorProfile>) => {
    try {
      const updatedProfile = await storage.updateColorProfile(profileId, updates)
      setProfiles(prev => prev.map(p => p.id === profileId ? updatedProfile : p))
      return updatedProfile
    } catch (err) {
      console.error('Error updating profile:', err)
      throw err
    }
  }, [storage])

  const applyAdjustments = (color: string) => {
    // Convert hex to RGB
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)

    // Apply adjustments
    const adjustedR = Math.max(0, Math.min(255, r + adjustments.red))
    const adjustedG = Math.max(0, Math.min(255, g + adjustments.green))
    const adjustedB = Math.max(0, Math.min(255, b + adjustments.blue))

    // Convert back to hex
    return `#${adjustedR.toString(16).padStart(2, '0')}${adjustedG.toString(16).padStart(2, '0')}${adjustedB.toString(16).padStart(2, '0')}`
  }

  // Import profiles from file and save to storage
  const handleImportProfiles = useCallback(async (importedProfiles: ColorProfile[]) => {
    try {
      for (const profile of importedProfiles) {
        await storage.createColorProfile({
          name: profile.name,
          device: profile.device,
          adjustments: profile.adjustments
        })
      }
      await fetchProfiles()
    } catch (err) {
      console.error('Error importing profiles:', err)
      throw err
    }
  }, [storage, fetchProfiles])

  return {
    profiles,
    setProfiles,
    loading,
    error,
    adjustments,
    setAdjustments,
    newProfileName,
    setNewProfileName,
    newProfileDevice,
    setNewProfileDevice,
    handleSaveProfile,
    handleCreateProfileFromComparison,
    handleResetAdjustments,
    handleLoadProfile,
    handleDeleteProfile,
    handleUpdateProfile,
    handleImportProfiles,
    applyAdjustments,
    refetch: fetchProfiles
  }
}
