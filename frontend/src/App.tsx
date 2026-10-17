import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Role = 'admin' | 'user'
type TaskStatus = 'Pending' | 'In Progress' | 'Completed'

type User = {
  id: number
  name: string
  email: string
  role: Role
}

type Task = {
  id: number
  user_id: number
  title: string
  description: string | null
  status: TaskStatus
  created_at: string
  user?: {
    id: number
    name: string
    email: string
  }
}

type Pagination = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

const API_BASE = '/api'
const STATUSES: TaskStatus[] = ['Pending', 'In Progress', 'Completed']

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token')

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = data?.message || 'Something went wrong.'
    const validationErrors = data?.errors ? Object.values(data.errors).flat().join(' ') : ''
    throw new Error(validationErrors || message)
  }

  return data as T
}

function App() {
  const [view, setView] = useState<'login' | 'register'>('login')
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const [tasks, setTasks] = useState<Task[]>([])
  const [taskLoading, setTaskLoading] = useState(false)
  const [taskError, setTaskError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | TaskStatus>('All')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<Pagination | null>(null)

  const [editId, setEditId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'Pending' as TaskStatus,
  })
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isAuthenticated = Boolean(token)

  const totalTasks = useMemo(() => tasks.length, [tasks])
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.status === 'Completed').length,
    [tasks],
  )

  const fetchCurrentUser = async () => {
    try {
      const response = await apiRequest<{ user: User }>('/me')
      setUser(response.user)
    } catch {
      setToken(null)
      localStorage.removeItem('token')
      setUser(null)
    }
  }

  const fetchTasks = async (nextPage = page) => {
    if (!token) {
      setTasks([])
      return
    }

    setTaskLoading(true)
    setTaskError('')

    try {
      const params = new URLSearchParams({ page: String(nextPage) })
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter !== 'All') params.set('status', statusFilter)

      const response = await apiRequest<{ data: Task[]; pagination: Pagination }>(`/tasks?${params.toString()}`)
      setTasks(response.data)
      setPagination(response.pagination)
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : 'Unable to load tasks.')
    } finally {
      setTaskLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      fetchCurrentUser()
    }
  }, [token])

  useEffect(() => {
    if (token) {
      fetchTasks(1)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      fetchTasks(page)
    }
  }, [page, search, statusFilter])

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    if (!email || !password) {
      setAuthError('Email and password are required.')
      setAuthLoading(false)
      return
    }

    try {
      const response = await apiRequest<{ token: string; user: User }>('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      localStorage.setItem('token', response.token)
      setToken(response.token)
      setUser(response.user)
      setView('login')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to log in.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    const passwordConfirmation = String(form.get('password_confirmation') ?? '')
    const role = String(form.get('role') ?? 'user') as Role

    if (!name || !email || !password) {
      setAuthError('Name, email, and password are required.')
      setAuthLoading(false)
      return
    }

    if (password.length < 8) {
      setAuthError('Password must be at least 8 characters long.')
      setAuthLoading(false)
      return
    }

    if (password !== passwordConfirmation) {
      setAuthError('Passwords do not match.')
      setAuthLoading(false)
      return
    }

    try {
      const response = await apiRequest<{ token: string; user: User }>('/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, password_confirmation: passwordConfirmation, role }),
      })

      localStorage.setItem('token', response.token)
      setToken(response.token)
      setUser(response.user)
      setView('login')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to register.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setTasks([])
    setPagination(null)
    setSearch('')
    setStatusFilter('All')
    setPage(1)
    setEditId(null)
    setFormData({ title: '', description: '', status: 'Pending' })
  }

  const handleFormChange = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  const resetForm = () => {
    setFormData({ title: '', description: '', status: 'Pending' })
    setEditId(null)
    setFormError('')
  }

  const handleSubmitTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')

    const title = formData.title.trim()

    if (!title) {
      setFormError('Task title is required.')
      return
    }

    if (!STATUSES.includes(formData.status)) {
      setFormError('Please choose a valid task status.')
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        title,
        description: formData.description.trim(),
        status: formData.status,
      }

      if (editId !== null) {
        await apiRequest(`/tasks/${editId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        await apiRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }

      resetForm()
      setPage(1)
      await fetchTasks(1)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save task.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (task: Task) => {
    setEditId(task.id)
    setFormData({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
    })
    setFormError('')
  }

  const handleDelete = async (taskId: number) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return
    }

    try {
      await apiRequest(`/tasks/${taskId}`, { method: 'DELETE' })
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId))
      if (tasks.length === 1 && page > 1) {
        setPage((currentPage) => currentPage - 1)
      }
      await fetchTasks(page)
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : 'Unable to delete task.')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-header">
            <span className="brand-badge">TaskFlow</span>
            <h1>{view === 'login' ? 'Welcome back' : 'Create account'}</h1>
            <p>{view === 'login' ? 'Sign in to manage your tasks.' : 'Register to start managing work.'}</p>
          </div>

          {view === 'login' ? (
            <form onSubmit={handleLogin} className="auth-form">
              <label>
                Email
                <input type="email" name="email" placeholder="you@example.com" required />
              </label>
              <label>
                Password
                <input type="password" name="password" placeholder="••••••••" required />
              </label>
              {authError && <div className="message error">{authError}</div>}
              <button type="submit" disabled={authLoading}>
                {authLoading ? 'Signing in...' : 'Login'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="auth-form">
              <label>
                Name
                <input type="text" name="name" placeholder="John Doe" required />
              </label>
              <label>
                Email
                <input type="email" name="email" placeholder="you@example.com" required />
              </label>
              <label>
                Role
                <select name="role" defaultValue="user">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label>
                Password
                <input type="password" name="password" placeholder="Minimum 8 characters" required />
              </label>
              <label>
                Confirm Password
                <input type="password" name="password_confirmation" placeholder="Repeat password" required />
              </label>
              {authError && <div className="message error">{authError}</div>}
              <button type="submit" disabled={authLoading}>
                {authLoading ? 'Creating account...' : 'Register'}
              </button>
            </form>
          )}

          <div className="toggle-link">
            {view === 'login' ? 'Need an account?' : 'Already have an account?'}
            <button type="button" onClick={() => setView((current) => (current === 'login' ? 'register' : 'login'))}>
              {view === 'login' ? 'Register' : 'Login'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-badge">TaskFlow</div>
          <div className="user-card">
            <strong>{user?.name ?? 'User'}</strong>
            <span>{user?.email ?? ''}</span>
            <em>{user?.role ?? 'user'}</em>
          </div>
        </div>
        <button type="button" className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="content-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h2>Task overview</h2>
          </div>
          <div className="stats">
            <div className="stat-pill">
              <span>Total</span>
              <strong>{pagination?.total ?? totalTasks}</strong>
            </div>
            <div className="stat-pill accent">
              <span>Completed</span>
              <strong>{completedTasks}</strong>
            </div>
          </div>
        </header>

        <section className="task-layout">
          <div className="task-form-card">
            <h3>{editId !== null ? 'Edit task' : 'Create task'}</h3>
            <form onSubmit={handleSubmitTask} className="task-form">
              <label>
                Title
                <input
                  type="text"
                  value={formData.title}
                  onChange={(event) => handleFormChange('title', event.target.value)}
                  placeholder="Task title"
                />
              </label>
              <label>
                Description
                <textarea
                  value={formData.description}
                  onChange={(event) => handleFormChange('description', event.target.value)}
                  placeholder="Add task details"
                  rows={4}
                />
              </label>
              <label>
                Status
                <select
                  value={formData.status}
                  onChange={(event) => handleFormChange('status', event.target.value)}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              {formError && <div className="message error">{formError}</div>}

              <div className="form-actions">
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editId !== null ? 'Update task' : 'Create task'}
                </button>
                {editId !== null && (
                  <button type="button" className="secondary" onClick={resetForm}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="task-table-card">
            <div className="toolbar">
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search by title"
              />
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as 'All' | TaskStatus)
                  setPage(1)
                }}
              >
                <option value="All">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {taskError && <div className="message error">{taskError}</div>}

            {taskLoading ? (
              <div className="loader">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="empty-state">No tasks match your current filters.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Owner</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id}>
                        <td>
                          <div className="task-title-block">
                            <strong>{task.title}</strong>
                            <span>{task.description || 'No description provided.'}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge ${task.status.toLowerCase().replace(/\s+/g, '-')}`}>
                            {task.status}
                          </span>
                        </td>
                        <td>{task.user ? task.user.name : user?.name}</td>
                        <td>{new Date(task.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="action-buttons">
                            <button type="button" className="secondary small" onClick={() => handleEdit(task)}>
                              Edit
                            </button>
                            <button type="button" className="danger small" onClick={() => handleDelete(task.id)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pagination && pagination.last_page > 1 && (
              <div className="pagination">
                <button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  Previous
                </button>
                <span>
                  Page {pagination.current_page} of {pagination.last_page}
                </span>
                <button
                  type="button"
                  disabled={page >= pagination.last_page}
                  onClick={() => setPage((value) => Math.min(pagination.last_page, value + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
