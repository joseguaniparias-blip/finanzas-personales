import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, name)
    if (result.error) setError(result.error.message)
    setLoading(false)
  }

  const switchMode = (next: 'login' | 'register') => {
    setMode(next)
    setError('')
    setName('')
    setEmail('')
    setPassword('')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">💰</div>
          <h1 className="text-2xl font-bold text-slate-100">Mis Finanzas</h1>
          <p className="text-slate-400 text-sm mt-1">Control financiero para trabajadores de apps</p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
          <h2 className="text-slate-100 font-semibold text-base mb-5">
            {mode === 'login' ? 'Ingresar a tu cuenta' : 'Crear cuenta nueva'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">NOMBRE</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Tu nombre"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">CORREO</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">CONTRASEÑA</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-950 border border-red-800 rounded-lg p-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-strong disabled:opacity-50 text-on-accent font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>

          <div className="mt-5 text-center text-sm">
            {mode === 'login' ? (
              <p className="text-slate-400">
                ¿No tienes cuenta?{' '}
                <button onClick={() => switchMode('register')} className="text-blue-400 hover:text-blue-300 font-medium">
                  Regístrate
                </button>
              </p>
            ) : (
              <p className="text-slate-400">
                ¿Ya tienes cuenta?{' '}
                <button onClick={() => switchMode('login')} className="text-blue-400 hover:text-blue-300 font-medium">
                  Ingresar
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
