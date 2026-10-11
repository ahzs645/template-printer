import { useMemo, useState } from 'react'
import { Search, Users } from 'lucide-react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import type { UserData } from '../lib/fieldParser'
import { personName } from '../lib/personName'

/** Show a search box above the list once there are more people than fit at a glance. */
const PERSON_SEARCH_THRESHOLD = 8


type SlotPersonPickerProps = {
  users: UserData[]
  selectedUserId: string
  onSelect: (userId: string) => void
}

/** Pick the person a slot prints from the database, with a search for long lists. */
export function SlotPersonPicker({ users, selectedUserId, onSelect }: SlotPersonPickerProps) {
  const [query, setQuery] = useState('')
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return users
    return users.filter((user) =>
      [personName(user), user.position, user.department, user.studentId, user.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    )
  }, [users, query])

  // The chosen person stays in the list while searching, or the control
  // would show nothing selected.
  const options = selectedUser && !matches.includes(selectedUser) ? [selectedUser, ...matches] : matches

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {users.length > PERSON_SEARCH_THRESHOLD && (
        <div style={{ position: 'relative' }}>
          <Search
            size={12}
            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            type="search"
            className="form-input"
            style={{ fontSize: 12, paddingLeft: 26 }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
            aria-label="Search people"
          />
        </div>
      )}
      <Select value={selectedUserId} onValueChange={onSelect}>
        <SelectTrigger style={{ fontSize: 12 }} aria-label="Person">
          <SelectValue placeholder="Choose a person" />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <div style={{ padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>No one matches "{query}"</div>
          ) : (
            options.map((user) => (
              <SelectItem key={user.id} value={user.id!}>
                <span className="select-option">
                  <Users size={12} />
                  <span className="select-option__label">{personName(user)}</span>
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {selectedUser && (selectedUser.position || selectedUser.department) && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {[selectedUser.position, selectedUser.department].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  )
}
