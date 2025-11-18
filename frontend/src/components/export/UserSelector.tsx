import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { ScrollArea } from '../ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type { UserData } from '../../lib/fieldParser'
import type { ExportMode } from '../ExportPage'

type UserSelectorProps = {
  users: UserData[]
  selectedUserIds: string[]
  loading: boolean
  mode: ExportMode
  layoutSlotCount: number
  hasPrintLayout: boolean
  slotUserIds: string[]
  onSlotUserChange: (slotIndex: number, userId: string | null) => void
  onToggleUser: (userId: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

export function UserSelector({
  users,
  selectedUserIds,
  loading,
  mode,
  layoutSlotCount,
  hasPrintLayout,
  slotUserIds,
  onSlotUserChange,
  onToggleUser,
  onSelectAll,
  onDeselectAll,
}: UserSelectorProps) {
  const isDatabaseMode = mode === 'database'
  const isSlotAssignmentActive = isDatabaseMode && hasPrintLayout && layoutSlotCount > 0

  const effectiveSelectedIds = isSlotAssignmentActive
    ? Array.from(new Set(slotUserIds.filter((id) => id)))
    : selectedUserIds

  return (
    <Card>
      <CardHeader>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <CardTitle style={{ fontSize: '1rem' }}>Select Users</CardTitle>
          <Badge>{effectiveSelectedIds.length} selected</Badge>
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
            {isSlotAssignmentActive && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <p style={{ fontSize: '0.75rem', color: '#52525b' }}>
                  Assign which user appears in each card position of the selected print layout.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {Array.from({ length: layoutSlotCount }).map((_, index) => {
                    const value = slotUserIds[index] ?? ''
                    return (
                      <div key={index} style={{ minWidth: '140px' }}>
                        <p style={{ fontSize: '0.75rem', marginBottom: '0.25rem', color: '#3f3f46' }}>
                          Card {index + 1}
                        </p>
                        <Select
                          value={value || '__none'}
                          onValueChange={(next) =>
                            onSlotUserChange(index, next === '__none' ? null : next)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Choose user" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">None</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id!}>
                                {user.firstName} {user.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {!isSlotAssignmentActive && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Button size="sm" variant="outline" onClick={onSelectAll}>
                  Select All
                </Button>
                <Button size="sm" variant="outline" onClick={onDeselectAll}>
                  Deselect All
                </Button>
              </div>
            )}

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
                      backgroundColor: effectiveSelectedIds.includes(user.id!)
                        ? '#f0fdf4'
                        : '#fff',
                    }}
                  >
                    {!isSlotAssignmentActive && (
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id!)}
                        onChange={() => onToggleUser(user.id!)}
                        style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                      />
                    )}
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
