import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AccessDialog } from "../components/AccessDialog";

interface AccessDialogContextValue {
  openAccess: () => void;
}

const AccessDialogContext = createContext<AccessDialogContextValue | null>(null);

export function AccessDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const value = useMemo<AccessDialogContextValue>(
    () => ({ openAccess: () => setOpen(true) }),
    [],
  );

  return (
    <AccessDialogContext.Provider value={value}>
      {children}
      <AccessDialog open={open} onClose={() => setOpen(false)} />
    </AccessDialogContext.Provider>
  );
}

export function useAccessDialog(): AccessDialogContextValue {
  const context = useContext(AccessDialogContext);
  if (!context) {
    throw new Error("useAccessDialog must be used inside AccessDialogProvider");
  }
  return context;
}
