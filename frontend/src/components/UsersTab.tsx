import { useState } from 'react'
import { useUsers } from '../hooks/useUsers'
import { Button } from './ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Input } from './ui/input'
import type { UserData } from '../lib/fieldParser'
import { Plus, Pencil, Trash2, Download, Upload } from 'lucide-react'

export function UsersTab() {
  const { users, loading, error, createUser, updateUser, deleteUser, refresh } = useUsers()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [formData, setFormData] = useState<Partial<UserData>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const handleOpenCreate = () => {
    setEditingUser(null)
    setFormData({})
    setFormError(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (user: UserData) => {
    setEditingUser(user)
    setFormData(user)
    setFormError(null)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    try {
      if (editingUser) {
        await updateUser(editingUser.id!, formData)
      } else {
        if (!formData.firstName || !formData.lastName) {
          setFormError('First name and last name are required')
          return
        }
        await createUser(formData as Omit<UserData, 'id'>)
      }
      setDialogOpen(false)
      setFormData({})
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      await deleteUser(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const handleImportCSV = () => {
    alert('CSV import coming soon!')
  }

  const handleExportCSV = () => {
    alert('CSV export coming soon!')
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#71717a' }}>
        Loading users...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#dc2626', marginBottom: '1rem' }}>Error: {error}</p>
        <Button onClick={refresh} variant="outline">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <>
      <div style={{ padding: '1.5rem', maxWidth: '100%', height: '100%', overflow: 'auto', backgroundColor: '#fff' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>User Database</h2>
            <p style={{ fontSize: '0.875rem', color: '#71717a' }}>
              Manage users for batch card generation
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button onClick={handleImportCSV} variant="outline" size="sm">
              <Upload style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
              Import CSV
            </Button>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              disabled={users.length === 0}
            >
              <Download style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
              Export CSV
            </Button>
            <Button onClick={handleOpenCreate} size="sm">
              <Plus style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
              Add User
            </Button>
          </div>
        </div>

        {users.length === 0 ? (
          <div style={{
            borderRadius: '0.5rem',
            border: '2px dashed #d4d4d8',
            padding: '3rem',
            textAlign: 'center'
          }}>
            <p style={{ marginBottom: '1rem', color: '#71717a' }}>No users yet</p>
            <Button onClick={handleOpenCreate}>
              <Plus style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
              Add Your First User
            </Button>
          </div>
        ) : (
          <div style={{ borderRadius: '0.5rem', border: '1px solid #e4e4e7', overflow: 'hidden' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead style={{ width: '100px', textAlign: 'right' }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell style={{ fontWeight: 500 }}>
                      {user.firstName} {user.middleName && `${user.middleName}. `}
                      {user.lastName}
                    </TableCell>
                    <TableCell>{user.studentId || '-'}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>{user.department || '-'}</TableCell>
                    <TableCell>{user.position || '-'}</TableCell>
                    <TableCell>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(user)}
                          title="Edit user"
                        >
                          <Pencil style={{ width: '1rem', height: '1rem' }} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(user.id!)}
                          title="Delete user"
                        >
                          <Trash2 style={{ width: '1rem', height: '1rem', color: '#dc2626' }} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Edit User' : 'Add New User'}
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? 'Update user information'
                  : 'Enter user information to add to the database'}
              </DialogDescription>
            </DialogHeader>

            <div style={{ display: 'grid', gap: '1rem', paddingTop: '1rem', paddingBottom: '1rem' }}>
              {formError && (
                <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '0.375rem', fontSize: '0.875rem' }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label htmlFor="firstName" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    First Name *
                  </label>
                  <Input
                    id="firstName"
                    value={formData.firstName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    required
                  />
                </div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label htmlFor="lastName" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    Last Name *
                  </label>
                  <Input
                    id="lastName"
                    value={formData.lastName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label htmlFor="middleName" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  Middle Name
                </label>
                <Input
                  id="middleName"
                  value={formData.middleName || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, middleName: e.target.value })
                  }
                />
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label htmlFor="studentId" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  Student ID
                </label>
                <Input
                  id="studentId"
                  value={formData.studentId || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, studentId: e.target.value })
                  }
                />
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label htmlFor="email" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label htmlFor="department" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    Department
                  </label>
                  <Input
                    id="department"
                    value={formData.department || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                  />
                </div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label htmlFor="position" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    Position
                  </label>
                  <Input
                    id="position"
                    value={formData.position || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingUser ? 'Save Changes' : 'Add User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
