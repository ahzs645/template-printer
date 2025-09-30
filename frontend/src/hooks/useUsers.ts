import { useState, useEffect } from 'react'
import type { UserData } from '../lib/fieldParser'

const API_BASE = '/api/users'

export function useUsers() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(API_BASE)
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      const data = await response.json()
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const createUser = async (userData: Omit<UserData, 'id'>): Promise<UserData> => {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create user')
    }

    const newUser = await response.json()
    setUsers((prev) => [...prev, newUser])
    return newUser
  }

  const updateUser = async (id: string, userData: Partial<UserData>): Promise<UserData> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update user')
    }

    const updatedUser = await response.json()
    setUsers((prev) => prev.map((u) => (u.id === id ? updatedUser : u)))
    return updatedUser
  }

  const deleteUser = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete user')
    }

    setUsers((prev) => prev.filter((u) => u.id !== id))
  }

  useEffect(() => {
    fetchUsers()
  }, [])

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
