import { useState } from 'react'
import { useUsers } from '../hooks/useUsers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Badge } from './ui/badge'
import { Checkbox } from './ui/checkbox'
import type { UserData } from '../lib/fieldParser'
import { Users, UserCheck } from 'lucide-react'

interface UserSelectorProps {
  selectedUserIds: string[]
  onSelectionChange: (userIds: string[]) => void
}

export function UserSelector({ selectedUserIds, onSelectionChange }: UserSelectorProps) {
  const { users, loading, error } = useUsers()
  const [mode, setMode] = useState<'single' | 'multiple'>('single')

  const handleToggleUser = (userId: string) => {
    if (mode === 'single') {
      onSelectionChange([userId])
    } else {
      const isSelected = selectedUserIds.includes(userId)
      if (isSelected) {
        onSelectionChange(selectedUserIds.filter(id => id !== userId))
      } else {
        onSelectionChange([...selectedUserIds, userId])
      }
    }
  }

  const handleSelectAll = () => {
    onSelectionChange(users.map(u => u.id!))
  }

  const handleClearSelection = () => {
    onSelectionChange([])
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: '1rem' }}>User Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <p style={{ fontSize: '0.875rem', color: '#71717a' }}>Loading users...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: '1rem' }}>User Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <p style={{ fontSize: '0.875rem', color: '#dc2626' }}>Error: {error}</p>
        </CardContent>
      </Card>
    )
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: '1rem' }}>User Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <p style={{ fontSize: '0.875rem', color: '#71717a' }}>
            No users in database. Go to Users tab to add users.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle style={{ fontSize: '1rem' }}>User Selection</CardTitle>
        <CardDescription>
          Select users for batch export ({selectedUserIds.length} selected)
        </CardDescription>
      </CardHeader>
      <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Mode Toggle */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            variant={mode === 'single' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setMode('single')
              if (selectedUserIds.length > 1) {
                onSelectionChange([selectedUserIds[0]])
              }
            }}
            style={{ flex: 1 }}
          >
            Single
          </Button>
          <Button
            variant={mode === 'multiple' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('multiple')}
            style={{ flex: 1 }}
          >
            Multiple
          </Button>
        </div>

        {/* Batch Actions */}
        {mode === 'multiple' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={selectedUserIds.length === users.length}
              style={{ flex: 1 }}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearSelection}
              disabled={selectedUserIds.length === 0}
              style={{ flex: 1 }}
            >
              Clear
            </Button>
          </div>
        )}

        {/* User List */}
        <ScrollArea style={{ maxHeight: '400px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {users.map((user) => {
              const isSelected = selectedUserIds.includes(user.id!)

              return (
                <div
                  key={user.id}
                  onClick={() => handleToggleUser(user.id!)}
                  style={{
                    padding: '0.75rem',
                    border: '1px solid',
                    borderColor: isSelected ? '#18181b' : '#e4e4e7',
                    backgroundColor: isSelected ? '#fafafa' : '#fff',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#f9f9f9'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#fff'
                    }
                  }}
                >
                  {mode === 'multiple' ? (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ flexShrink: 0, width: '1rem', height: '1rem', cursor: 'pointer' }}
                    />
                  ) : (
                    <input
                      type="radio"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ flexShrink: 0, width: '1rem', height: '1rem', cursor: 'pointer' }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.firstName} {user.lastName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.studentId || user.email || user.position || 'No details'}
                    </div>
                  </div>
                  {isSelected && (
                    <UserCheck style={{ width: '1rem', height: '1rem', color: '#16a34a', flexShrink: 0 }} />
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
