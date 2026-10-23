import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { EMPTY_CREDENTIALS, useAuth, type DemoCredentials } from "../lib/auth";
import { Button, Field, Input, Notice } from "./ui";
import { Modal } from "./Modal";

export function AccessDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { credentials, setCredentials } = useAuth();
  const [draft, setDraft] = useState<DemoCredentials>(credentials);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(credentials);
      setSaved(false);
    }
  }, [credentials, open]);

  const update = (field: keyof DemoCredentials, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setSaved(false);
  };

  const save = () => {
    setCredentials(draft);
    setSaved(true);
    onClose();
  };

  const clear = () => {
    setDraft(EMPTY_CREDENTIALS);
    setCredentials(EMPTY_CREDENTIALS);
    setSaved(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Demo access"
      description="Add the local demo keys from backend/.env. They unlock coordinator decisions and volunteer delivery updates."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={clear}
            className="text-xs text-faint underline-offset-4 hover:text-white hover:underline"
          >
            Clear saved access
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>Save for this tab</Button>
          </div>
        </div>
      }
    >
      <div className="mb-5 flex items-start gap-3 rounded-lg border border-line bg-[#0F0F0F] p-3.5 text-sm leading-6 text-muted">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
        <p>
          This is a hackathon-only access mechanism. Keys stay in this browser
          tab’s session storage, are sent only to the configured Lifeline API,
          and are never included in the build.
        </p>
      </div>

      {saved ? <Notice tone="success">Demo access saved for this tab.</Notice> : null}

      <div className="mt-5 space-y-6">
        <section>
          <h3 className="mb-3 text-sm font-medium text-white">Coordinator</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Coordinator key">
              <Input
                type="password"
                autoComplete="off"
                value={draft.coordinatorKey}
                onChange={(event) =>
                  update("coordinatorKey", event.target.value)
                }
                placeholder="From backend/.env"
              />
            </Field>
            <Field label="Coordinator name">
              <Input
                autoComplete="off"
                value={draft.coordinatorName}
                onChange={(event) =>
                  update("coordinatorName", event.target.value)
                }
                placeholder="Demo Coordinator"
              />
            </Field>
          </div>
        </section>

        <section className="border-t border-line pt-5">
          <h3 className="mb-3 text-sm font-medium text-white">Volunteer</h3>
          <p className="mb-4 text-sm leading-6 text-muted">
            Required only for delivery status updates.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Volunteer key">
              <Input
                type="password"
                autoComplete="off"
                value={draft.volunteerKey}
                onChange={(event) => update("volunteerKey", event.target.value)}
                placeholder="From backend/.env"
              />
            </Field>
            <Field label="Volunteer name">
              <Input
                autoComplete="off"
                value={draft.volunteerName}
                onChange={(event) =>
                  update("volunteerName", event.target.value)
                }
                placeholder="Demo Volunteer"
              />
            </Field>
          </div>
        </section>
      </div>
    </Modal>
  );
}
