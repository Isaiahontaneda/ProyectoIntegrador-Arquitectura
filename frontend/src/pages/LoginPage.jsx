import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import './LoginPage.css'

const LOGO = 'https://res.cloudinary.com/dcabuupn1/image/upload/v1782615005/Logo_ECOMM_ttq36x.png'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IconBack = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}>
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

function Field({ label, type = 'text', value, onChange, error, placeholder, autoComplete, right }) {
  return (
    <div className="lp-field">
      <div className="lp-field-header">
        <label>{label}</label>
        {right}
      </div>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={error ? 'error' : ''}
      />
      {error && <div className="lp-field-error">{error}</div>}
    </div>
  )
}

export default function LoginPage() {
  const { loginAdmin, loginCustomer, register, forgotPassword } = useAuth()
  const navigate = useNavigate()

  const [panel, setPanel]       = useState('auth')
  const [tab, setTab]           = useState('login')
  const [form, setForm]         = useState({})
  const [errors, setErrors]     = useState({})
  const [apiErr, setApiErr]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')

  const set = (field, val) => {
    setForm(f => ({ ...f, [field]: val }))
    setErrors(e => ({ ...e, [field]: '' }))
    setApiErr('')
  }

  const switchTab = (t) => { setTab(t); setForm({}); setErrors({}); setApiErr('') }

  const validateLogin = () => {
    const e = {}
    if (!form.identifier?.trim()) e.identifier = 'Ingresa tu correo o usuario'
    if (!form.password?.trim())   e.password   = 'Ingresa tu contraseña'
    setErrors(e); return !Object.keys(e).length
  }

  const validateRegister = () => {
    const e = {}
    if (!form.nombre?.trim() || form.nombre.trim().length < 2) e.nombre   = 'Mínimo 2 caracteres'
    if (!form.apellido?.trim())                                e.apellido = 'Requerido'
    if (!form.email?.trim())                                   e.email    = 'Ingresa tu correo'
    else if (!EMAIL_RE.test(form.email))                       e.email    = 'Formato inválido'
    if (!form.password || form.password.length < 6)            e.password = 'Mínimo 6 caracteres'
    if (form.password !== form.confirm)                        e.confirm  = 'No coinciden'
    setErrors(e); return !Object.keys(e).length
  }

  const handleLogin = (e) => {
    e.preventDefault()
    if (!validateLogin()) return
    setLoading(true)
    const id = form.identifier.trim()
    const pw = form.password
    const adminRes = loginAdmin(id, pw)
    if (adminRes.ok) { navigate('/admin', { replace: true }); return }
    const custRes = loginCustomer(id, pw)
    setLoading(false)
    if (custRes.ok) { navigate('/', { replace: true }); return }
    setApiErr('Correo o contraseña incorrectos')
  }

  const handleRegister = (e) => {
    e.preventDefault()
    if (!validateRegister()) return
    setLoading(true)
    const fullName = `${form.nombre.trim()} ${form.apellido.trim()}`
    const res = register(fullName, form.email.trim(), form.password)
    setLoading(false)
    if (res.ok) navigate('/', { replace: true })
    else setApiErr(res.error)
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    const email = form.forgotEmail?.trim() || ''
    if (!email)                { setErrors({ forgotEmail: 'Ingresa tu correo' }); return }
    if (!EMAIL_RE.test(email)) { setErrors({ forgotEmail: 'Formato inválido' }); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 900))
    forgotPassword(email)
    setForgotEmail(email)
    setLoading(false)
    setPanel('forgot-sent')
  }

  const goToStore = (e) => { e.preventDefault(); navigate('/') }

  return (
    <div className="lp-root">

      {/* ── Left panel ── */}
      <div className="lp-left">
        <div className="lp-left-dots" />
        <div className="lp-left-glow" />

        <div className="lp-left-content">
          <img src={LOGO} alt="EcommStore" className="lp-brand-img" />

          <h1 className="lp-brand-title">EcommStore</h1>

          <div className="lp-brand-tagline">
            <span className="lp-tagline-line" />
            <span>DOS MUNDOS, UNA PLATAFORMA</span>
            <span className="lp-tagline-line" />
          </div>

          <p className="lp-brand-desc">
            Plataforma de comercio electrónico construida con arquitectura de
            microservicios, diseñada para escalar tu negocio.
          </p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="lp-right">
        <div className="lp-right-glow" />

        <div className="lp-form-wrap">

          <div className="lp-mini-logo">
            <img src={LOGO} alt="Logo" className="lp-mini-img" />
            <span className="lp-mini-name">EcommStore</span>
          </div>

          {panel === 'auth' && (
            <>
              <div className="lp-tabs">
                <button
                  className={`lp-tab${tab === 'login' ? ' active' : ''}`}
                  onClick={() => switchTab('login')}
                >Iniciar sesión</button>
                <button
                  className={`lp-tab${tab === 'register' ? ' active' : ''}`}
                  onClick={() => switchTab('register')}
                >Crear cuenta</button>
              </div>

              {apiErr && <div className="lp-api-err">{apiErr}</div>}

              {tab === 'login' && (
                <form className="lp-form" onSubmit={handleLogin} noValidate>
                  <Field
                    label="CORREO ELECTRÓNICO O USUARIO"
                    value={form.identifier}
                    onChange={v => set('identifier', v)}
                    error={errors.identifier}
                    placeholder="tu@correo.com"
                    autoComplete="username"
                  />
                  <Field
                    label="CONTRASEÑA"
                    type="password"
                    value={form.password}
                    onChange={v => set('password', v)}
                    error={errors.password}
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    right={
                      <button type="button" className="lp-forgot-link" onClick={() => setPanel('forgot')}>
                        ¿Olvidaste tu contraseña?
                      </button>
                    }
                  />
                  <button className="lp-btn" type="submit" disabled={loading}>
                    {loading && <span className="lp-spinner" />}
                    Iniciar sesión
                  </button>
                  <div className="lp-store-link">
                    <span>¿Solo quieres explorar la tienda? </span>
                    <a href="/" onClick={goToStore}>Ver storefront →</a>
                  </div>
                </form>
              )}

              {tab === 'register' && (
                <form className="lp-form" onSubmit={handleRegister} noValidate>
                  <div className="lp-grid-2">
                    <Field
                      label="NOMBRE"
                      value={form.nombre}
                      onChange={v => set('nombre', v)}
                      error={errors.nombre}
                      placeholder="Juan"
                      autoComplete="given-name"
                    />
                    <Field
                      label="APELLIDO"
                      value={form.apellido}
                      onChange={v => set('apellido', v)}
                      error={errors.apellido}
                      placeholder="García"
                      autoComplete="family-name"
                    />
                  </div>
                  <Field
                    label="CORREO ELECTRÓNICO"
                    type="email"
                    value={form.email}
                    onChange={v => set('email', v)}
                    error={errors.email}
                    placeholder="tu@correo.com"
                    autoComplete="email"
                  />
                  <Field
                    label="CONTRASEÑA"
                    type="password"
                    value={form.password}
                    onChange={v => set('password', v)}
                    error={errors.password}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                  />
                  <Field
                    label="CONFIRMAR CONTRASEÑA"
                    type="password"
                    value={form.confirm}
                    onChange={v => set('confirm', v)}
                    error={errors.confirm}
                    placeholder="Repite tu contraseña"
                    autoComplete="new-password"
                  />
                  <button className="lp-btn" type="submit" disabled={loading}>
                    {loading && <span className="lp-spinner" />}
                    Crear mi cuenta
                  </button>
                  <p className="lp-terms">
                    Al registrarte aceptas nuestros{' '}
                    <a href="#">Términos de uso</a> y{' '}
                    <a href="#">Política de privacidad</a>
                  </p>
                </form>
              )}
            </>
          )}

          {panel === 'forgot' && (
            <div className="lp-form">
              <button className="lp-back" onClick={() => { setPanel('auth'); setForm({}); setErrors({}) }}>
                <IconBack /> Volver al login
              </button>
              <div className="lp-section-head">
                <p className="lp-section-title">Recuperar contraseña</p>
                <p className="lp-section-sub">Te enviaremos un enlace para restablecer tu contraseña</p>
              </div>
              <form onSubmit={handleForgot} noValidate>
                <Field
                  label="CORREO ELECTRÓNICO"
                  type="email"
                  value={form.forgotEmail}
                  onChange={v => set('forgotEmail', v)}
                  error={errors.forgotEmail}
                  placeholder="tu@correo.com"
                  autoComplete="email"
                />
                <button className="lp-btn" type="submit" disabled={loading} style={{marginTop: 16}}>
                  {loading && <span className="lp-spinner" />}
                  Enviar enlace
                </button>
              </form>
            </div>
          )}

          {panel === 'forgot-sent' && (
            <div className="lp-sent">
              <div className="lp-sent-icon"><IconCheck /></div>
              <p className="lp-sent-title">Enlace enviado</p>
              <p className="lp-sent-desc">
                Si el correo <span className="lp-sent-email">{forgotEmail}</span> está
                registrado, recibirás un enlace para restablecer tu contraseña.
                Revisa también tu carpeta de spam.
              </p>
              <button
                className="lp-btn"
                onClick={() => { setPanel('auth'); setTab('login'); setForm({}); setErrors({}) }}
              >
                Volver al inicio de sesión
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
