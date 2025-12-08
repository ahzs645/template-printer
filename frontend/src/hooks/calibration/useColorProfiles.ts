import { useState, useEffect, useCallback } from 'react'
import type { ColorProfile } from '../../lib/calibration/exportUtils'

const API_BASE = '/api/color-profiles'

export function useColorProfiles() {
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

  // Fetch profiles from the backend
  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(API_BASE)
      if (!response.ok) {
        throw new Error('Failed to fetch color profiles')
      }
      const data = await response.json()
      setProfiles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error fetching color profiles:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load profiles on mount
  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  const handleSaveProfile = async () => {
    if (!newProfileName || !newProfileDevice) return

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProfileName,
          device: newProfileDevice,
          adjustments
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save profile')
      }

      const newProfile = await response.json()
      setProfiles(prev => [...prev, newProfile])
      setNewProfileName("")
      setNewProfileDevice("")
    } catch (err) {
      console.error('Error saving profile:', err)
      throw err
    }
  }

  const handleCreateProfileFromComparison = async (
    colorAdjustments: Record<string, { r: number; g: number; b: number }>,
    profileName: string,
    deviceName: string
  ) => {
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName,
          device: deviceName,
          adjustments: colorAdjustments
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save profile')
      }

      const newProfile = await response.json()
      setProfiles(prev => [...prev, newProfile])
      return newProfile
    } catch (err) {
      console.error('Error creating profile from comparison:', err)
      throw err
    }
  }

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

  const handleDeleteProfile = async (profileId: string) => {
    try {
      const response = await fetch(`${API_BASE}/${profileId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete profile')
      }

      setProfiles(prev => prev.filter(p => p.id !== profileId))
    } catch (err) {
      console.error('Error deleting profile:', err)
      throw err
    }
  }

  const handleUpdateProfile = async (profileId: string, updates: Partial<ColorProfile>) => {
    try {
      const response = await fetch(`${API_BASE}/${profileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      const updatedProfile = await response.json()
      setProfiles(prev => prev.map(p => p.id === profileId ? updatedProfile : p))
      return updatedProfile
    } catch (err) {
      console.error('Error updating profile:', err)
      throw err
    }
  }

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

  // Import profiles from file and save to backend
  const handleImportProfiles = async (importedProfiles: ColorProfile[]) => {
    try {
      for (const profile of importedProfiles) {
        await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: profile.name,
            device: profile.device,
            adjustments: profile.adjustments
          })
        })
      }
      await fetchProfiles()
    } catch (err) {
      console.error('Error importing profiles:', err)
      throw err
    }
  }

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
