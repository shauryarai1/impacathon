import { ArrowUpRight } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { Logo } from '../components/UI'

export default function PublicShell() {
  return <div className="public-shell"><header className="public-header"><Link to="/" aria-label="LIFELINE home"><Logo /></Link><div className="public-header__right"><span className="live-indicator"><span /> Local preview</span></div></header><main><Outlet /></main><footer className="public-footer"><span>LIFELINE</span><span>When systems fail, communities connect.</span><span className="public-footer__links"><Link to="/for-organizations">For organizations</Link><Link to="/coordinator/login">Are you a coordinator? Log in here <ArrowUpRight size={13} /></Link></span></footer></div>
}
