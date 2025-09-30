import express from 'express'
import { listUsers, getUserById, createUser, updateUser, deleteUser } from '../db.js'

const router = express.Router()

// GET /api/users - List all users
router.get('/', (req, res, next) => {
  try {
    const users = listUsers()
    res.json(users)
  } catch (error) {
    next(error)
  }
})

// GET /api/users/:id - Get single user
router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const user = getUserById(id)
    if (!user) {
      res.status(404).json({ error: 'User not found.' })
      return
    }
    res.json(user)
  } catch (error) {
    next(error)
  }
})

// POST /api/users - Create new user
router.post('/', (req, res, next) => {
  try {
    const userData = req.body

    // Validate required fields
    if (!userData.firstName || !userData.lastName) {
      res.status(400).json({ error: 'firstName and lastName are required.' })
      return
    }

    const newUser = createUser(userData)
    res.status(201).json(newUser)
  } catch (error) {
    next(error)
  }
})

// PUT /api/users/:id - Update user
router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const userData = req.body

    const existing = getUserById(id)
    if (!existing) {
      res.status(404).json({ error: 'User not found.' })
      return
    }

    // Validate required fields
    if (!userData.firstName || !userData.lastName) {
      res.status(400).json({ error: 'firstName and lastName are required.' })
      return
    }

    const updated = updateUser(id, userData)
    res.json(updated)
  } catch (error) {
    next(error)
  }
})

// DELETE /api/users/:id - Delete user
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params
    const deleted = deleteUser(id)

    if (!deleted) {
      res.status(404).json({ error: 'User not found.' })
      return
    }

    res.json({ message: 'User deleted successfully.', user: deleted })
  } catch (error) {
    next(error)
  }
})

export default router
