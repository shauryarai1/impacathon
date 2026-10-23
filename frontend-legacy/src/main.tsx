import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { AccessDialogProvider } from "./lib/access";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <AccessDialogProvider>
        <App />
      </AccessDialogProvider>
    </AuthProvider>
  </React.StrictMode>,
);
