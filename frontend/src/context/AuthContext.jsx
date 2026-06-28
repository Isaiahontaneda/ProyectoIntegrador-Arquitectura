'use strict'
import { createContext, useContext, useState } from 'react'

const AuthCtx = createContext(null)

const ADMIN_SESSION = { id: 'admin-0', name: 'Admin', role: 'admin' }

const loadUsers    = () => { try { return JSON.parse(localStorage.getItem('ec_users')   || '[]')   } catch { return [] }   }
const saveUsers    = u  => localStorage.setItem('ec_users',   JSON.stringify(u))
const loadSession  = () => { try { return JSON.parse(localStorage.getItem('ec_session') || 'null') } catch { return null } }
const saveSession  = s  => s ? localStorage.setItem('ec_session', JSON.stringify(s)) : localStorage.removeItem('ec_session')

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadSession)

  const loginAdmin = (username, password) => {
    if (username === 'Admin' && password === '123Admin123') {
      setUser(ADMIN_SESSION); saveSession(ADMIN_SESSION)
      return { ok: true }
    }
    return { ok: false, error: 'Usuario o contraseña incorrectos' }
  }

  const loginCustomer = (email, password) => {
    const found = loadUsers().find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    )
    if (!found) return { ok: false, error: 'Correo o contraseña incorrectos' }
    const session = { id: found.id, name: found.name, email: found.email, role: 'customer' }
    setUser(session); saveSession(session)
    return { ok: true }
  }

  const register = (name, email, password) => {
    const users = loadUsers()
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase()))
      return { ok: false, error: 'Este correo ya está registrado' }
    const newUser = { id: `u-${Date.now()}`, name, email, password }
    saveUsers([...users, newUser])
    const session = { id: newUser.id, name, email, role: 'customer' }
    setUser(session); saveSession(session)
    return { ok: true }
  }

  // Always returns ok – never reveal if email exists (security best practice)
  const forgotPassword = (_email) => ({ ok: true })

  const logout = () => { setUser(null); saveSession(null) }

  return (
    <AuthCtx.Provider value={{ user, loginAdmin, loginCustomer, register, forgotPassword, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
