import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { CoordinatorLayout } from "./components/CoordinatorLayout";
import { LandingPage } from "./pages/LandingPage";
import { RequestHelpPage } from "./pages/RequestHelpPage";
import { OverviewPage } from "./pages/coordinator/OverviewPage";
import { RequestsPage } from "./pages/coordinator/RequestsPage";
import { OperationsPage } from "./pages/coordinator/OperationsPage";
import { DeliveriesPage } from "./pages/coordinator/DeliveriesPage";

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-[11px] uppercase tracking-[0.16em] text-faint">404</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          The page you’re looking for doesn’t exist or has moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 text-sm text-white underline-offset-4 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Lifeline
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/request" element={<RequestHelpPage />} />
        <Route path="/coordinator" element={<CoordinatorLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="requests" element={<RequestsPage />} />
          <Route path="operations" element={<OperationsPage />} />
          <Route path="deliveries" element={<DeliveriesPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
