import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { ScrollArea } from '../ui/scroll-area'
import type { UserData } from '../../lib/fieldParser'

type UserSelectorProps = {
  users: UserData[]
  selectedUserIds: string[]
  loading: boolean
  onToggleUser: (userId: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

export function UserSelector({
  users,
  selectedUserIds,
  loading,
  onToggleUser,
  onSelectAll,
  onDeselectAll,
}: UserSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CardTitle style={{ fontSize: '1rem' }}>Select Users</CardTitle>
          <Badge>{selectedUserIds.length} selected</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p style={{ fontSize: '0.875rem', color: '#71717a' }}>Loading users...</p>
        ) : users.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#71717a' }}>
            No users in database. Add users in the Users tab.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Button size="sm" variant="outline" onClick={onSelectAll}>
                Select All
              </Button>
              <Button size="sm" variant="outline" onClick={onDeselectAll}>
                Deselect All
              </Button>
            </div>
            <ScrollArea style={{ height: '200px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {users.map((user) => (
                  <label
                    key={user.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      border: '1px solid #e4e4e7',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      backgroundColor: selectedUserIds.includes(user.id!)
                        ? '#f0fdf4'
                        : '#fff',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id!)}
                      onChange={() => onToggleUser(user.id!)}
                      style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                        {user.firstName} {user.lastName}
                      </div>
                      {user.studentId && (
                        <div style={{ fontSize: '0.75rem', color: '#71717a' }}>
                          {user.studentId}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  )
}
