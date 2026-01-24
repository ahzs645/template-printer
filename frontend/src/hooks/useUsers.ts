import { useState, useEffect, useCallback } from 'react'
import type { UserData } from '../lib/fieldParser'
import { useStorage } from '../lib/storage'

export function useUsers() {
  const storage = useStorage()
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await storage.listUsers()
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [storage])

  const createUser = useCallback(async (userData: Omit<UserData, 'id'>): Promise<UserData> => {
    const newUser = await storage.createUser(userData)
    setUsers((prev) => [...prev, newUser])
    return newUser
  }, [storage])

  const updateUser = useCallback(async (id: string, userData: Partial<UserData>): Promise<UserData> => {
    const updatedUser = await storage.updateUser(id, userData)
    setUsers((prev) => prev.map((u) => (u.id === id ? updatedUser : u)))
    return updatedUser
  }, [storage])

  const deleteUser = useCallback(async (id: string): Promise<void> => {
    await storage.deleteUser(id)
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }, [storage])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  return {
    users,
    loading,
    error,
    createUser,
    updateUser,
    deleteUser,
    refresh: fetchUsers,
  }
}
