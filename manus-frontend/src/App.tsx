import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import PublicShell from './layouts/PublicShell'
import CoordinatorShell from './layouts/CoordinatorShell'
import Landing from './pages/Landing'
import RequestHelp from './pages/RequestHelp'
import CoordinatorLogin from './pages/CoordinatorLogin'
import Organizations from './pages/Organizations'
import Overview from './pages/Overview'
import Requests from './pages/Requests'
import Operations from './pages/Operations'
import Deliveries from './pages/Deliveries'

export default function App() {
  return <BrowserRouter><Routes><Route element={<PublicShell />}><Route path="/" element={<Landing />} /><Route path="/request-help" element={<RequestHelp />} /><Route path="/coordinator/login" element={<CoordinatorLogin />} /><Route path="/for-organizations" element={<Organizations />} /></Route><Route path="/coordinator" element={<CoordinatorShell />}><Route index element={<Overview />} /><Route path="requests" element={<Requests />} /><Route path="operations" element={<Operations />} /><Route path="deliveries" element={<Deliveries />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></BrowserRouter>
}
