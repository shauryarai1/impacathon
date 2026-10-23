import { FormEvent, useState } from 'react'
import { ArrowLeft, ArrowRight, KeyRound, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Notice } from '../components/UI'

export default function CoordinatorLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const demoEnabled = import.meta.env.VITE_USE_DEMO_DATA !== 'false'
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const configuredEmail = import.meta.env.VITE_DEMO_COORDINATOR_EMAIL
    const configuredPassword = import.meta.env.VITE_DEMO_COORDINATOR_PASSWORD
    if (!configuredEmail || !configuredPassword) {
      setError('Demo credentials are not configured in this environment. Add them locally, or connect the backend authentication contract.')
      return
    }
    if (email.trim() !== configuredEmail || password !== configuredPassword) {
      setError('Those demo credentials did not match the locally configured values.')
      return
    }
    sessionStorage.setItem('lifeline-coordinator-session', 'demo')
    navigate('/coordinator')
  }
  const demoAccess = () => { if (demoEnabled) { sessionStorage.setItem('lifeline-coordinator-session', 'demo'); navigate('/coordinator') } }

  return <div className="login-page"><div className="login-card"><Link className="back-link" to="/"><ArrowLeft size={15} /> Back to LIFELINE</Link><div className="login-icon"><KeyRound size={20} /></div><p className="eyebrow eyebrow--signal">Coordinator access</p><h1>Enter the response workspace.</h1><p className="login-copy">This area is for approved coordinators and volunteers. Residents never need an account to request help.</p>{error && <Notice tone="error">{error}</Notice>}<form className="login-form" onSubmit={submit}><label>Email<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@organization.org" /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" /></label><Button type="submit">Log in <ArrowRight size={15} /></Button></form>{demoEnabled && <><div className="login-divider"><span>Preview only</span></div><button className="demo-access-button" type="button" onClick={demoAccess}><ShieldCheck size={15} /> Use demo access</button><p className="login-disclaimer">Demo access is a local preview gate, not production-grade authentication. Live coordinator authentication must use the backend’s existing auth flow.</p></>}</div></div>
}
