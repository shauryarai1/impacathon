import { useMemo, useState, type FormEvent } from "react";
import {
  ChevronDown,
  ChevronUp,
  KeyRound,
  PackagePlus,
  Settings2,
} from "lucide-react";
import { useAuth } from "../../../lib/auth";
import { useApiQuery } from "../../../lib/query";
import { useAccessDialog } from "../../../lib/access";
import type {
  ReportCategory,
  SupplierVerificationStatus,
} from "../../../types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Notice,
  Select,
  StatusBadge,
  TableShell,
} from "../../../components/ui";
import { formatCategory, formatNumber } from "../../../lib/format";

const categories: ReportCategory[] = [
  "water",
  "food",
  "shelter",
  "medical",
  "other",
];

const verificationOptions: SupplierVerificationStatus[] = [
  "pending",
  "verified",
  "rejected",
];

interface NoticeState {
  tone: "success" | "error";
  text: string;
}

export function ResourcesTab() {
  const { api, hasCoordinator } = useAuth();
  const { openAccess } = useAccessDialog();

  const suppliers = useApiQuery(() => api.suppliers.list(), [api]);
  const resources = useApiQuery(() => api.resources.list(), [api]);
  const routes = useApiQuery(() => api.routes.list(), [api]);

  const [manageOpen, setManageOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [newSupplier, setNewSupplier] = useState({
    name: "",
    location: "",
    contact: "",
  });
  const [supplierEdit, setSupplierEdit] = useState({
    id: "",
    verification_status: "verified" as SupplierVerificationStatus,
    active: "true",
    contact: "",
    reason: "",
  });
  const [newResource, setNewResource] = useState({
    supplier_id: "",
    name: "",
    category: "water" as ReportCategory,
    quantity: "",
  });
  const [restock, setRestock] = useState({
    resource_id: "",
    quantity: "",
    reason: "Emergency resupply.",
  });
  const [routeAccess, setRouteAccess] = useState({
    route_id: "",
    action: "block" as "block" | "unblock",
    reason: "Access is currently unsafe.",
  });

  const supplierMap = useMemo(
    () => new Map((suppliers.data ?? []).map((supplier) => [supplier.id, supplier])),
    [suppliers.data],
  );

  const setSuccess = (text: string) => setNotice({ tone: "success", text });
  const setFailure = (error: unknown) =>
    setNotice({
      tone: "error",
      text: error instanceof Error ? error.message : "The action could not be completed.",
    });

  const requireCoordinator = (): boolean => {
    if (!hasCoordinator) {
      openAccess();
      return false;
    }
    return true;
  };

  const submitSupplier = async (event: FormEvent) => {
    event.preventDefault();
    if (!requireCoordinator()) return;
    setBusy("supplier");
    try {
      await api.suppliers.create({
        name: newSupplier.name.trim(),
        location: newSupplier.location.trim(),
        contact_name: newSupplier.contact.trim() || null,
        verification_status: "pending",
        active: true,
      });
      setNewSupplier({ name: "", location: "", contact: "" });
      setSuccess("Supplier added as pending verification.");
      suppliers.reload();
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(null);
    }
  };

  const selectSupplierForEdit = (rawId: string) => {
    const supplier = supplierMap.get(Number(rawId));
    setSupplierEdit({
      id: rawId,
      verification_status: supplier?.verification_status ?? "pending",
      active: supplier ? String(supplier.active) : "true",
      contact: supplier?.contact_name ?? "",
      reason: supplier ? "Supplier details reviewed." : "",
    });
  };

  const submitSupplierEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!requireCoordinator()) return;
    if (!supplierEdit.id) {
      setNotice({ tone: "error", text: "Choose a supplier to update." });
      return;
    }
    if (supplierEdit.reason.trim().length < 3) {
      setNotice({ tone: "error", text: "Add a short reason for the update." });
      return;
    }

    setBusy("supplier-edit");
    try {
      await api.suppliers.update(Number(supplierEdit.id), {
        verification_status: supplierEdit.verification_status,
        active: supplierEdit.active === "true",
        contact_name: supplierEdit.contact.trim() || null,
        reason: supplierEdit.reason.trim(),
      });
      setSuccess("Supplier updated.");
      suppliers.reload();
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(null);
    }
  };

  const submitResource = async (event: FormEvent) => {
    event.preventDefault();
    if (!requireCoordinator()) return;
    if (!newResource.supplier_id) {
      setNotice({ tone: "error", text: "Choose a supplier for this stock." });
      return;
    }
    setBusy("resource");
    try {
      await api.resources.create({
        supplier_id: Number(newResource.supplier_id),
        name: newResource.name.trim(),
        category: newResource.category,
        quantity_available: Number(newResource.quantity),
      });
      setNewResource((current) => ({
        ...current,
        name: "",
        quantity: "",
      }));
      setSuccess("Resource stock added.");
      resources.reload();
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(null);
    }
  };

  const submitRestock = async (event: FormEvent) => {
    event.preventDefault();
    if (!requireCoordinator()) return;
    if (!restock.resource_id) {
      setNotice({ tone: "error", text: "Choose a resource to restock." });
      return;
    }
    if (restock.reason.trim().length < 3) {
      setNotice({ tone: "error", text: "Add a short reason for the restock." });
      return;
    }
    setBusy("restock");
    try {
      await api.resources.restock(Number(restock.resource_id), {
        quantity: Number(restock.quantity),
        reason: restock.reason.trim(),
      });
      setRestock((current) => ({ ...current, quantity: "" }));
      setSuccess("Stock added to available inventory.");
      resources.reload();
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(null);
    }
  };

  const selectRouteForAccess = (rawId: string) => {
    const route = routes.data?.find((item) => item.id === Number(rawId));
    setRouteAccess({
      route_id: rawId,
      action: route?.blocked ? "unblock" : "block",
      reason: route?.blocked
        ? "Access has been inspected and reopened."
        : "Access is currently unsafe.",
    });
  };

  const submitRouteAccess = async (event: FormEvent) => {
    event.preventDefault();
    if (!requireCoordinator()) return;
    if (!routeAccess.route_id) {
      setNotice({ tone: "error", text: "Choose a route." });
      return;
    }
    if (routeAccess.reason.trim().length < 3) {
      setNotice({ tone: "error", text: "Add a short reason for the route change." });
      return;
    }
    setBusy("route");
    try {
      if (routeAccess.action === "block") {
        await api.routes.block(Number(routeAccess.route_id), routeAccess.reason.trim());
        setSuccess("Route blocked. Affected suggestions were flagged for review.");
      } else {
        await api.routes.unblock(Number(routeAccess.route_id), routeAccess.reason.trim());
        setSuccess("Route reopened.");
      }
      routes.reload();
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(null);
    }
  };

  const allRoutes = routes.data ?? [];
  const allResources = resources.data ?? [];
  const allSuppliers = suppliers.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-muted">
          Only verified, active suppliers are eligible for allocation. Reserved
          stock cannot be promised twice.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setManageOpen((open) => !open)}
        >
          <Settings2 className="h-3.5 w-3.5" />
          {manageOpen ? "Hide controls" : "Manage resources"}
          {manageOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {manageOpen ? (
        <Card className="p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium text-white">Management controls</h2>
              <p className="mt-1 text-xs leading-5 text-faint">
                Changes are coordinator-only and recorded in the audit trail.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setManageOpen(false)}>
              Close
            </Button>
          </div>

          {!hasCoordinator ? (
            <div className="mb-5 flex flex-col gap-3 rounded-lg border border-warning/25 bg-warning/[0.06] p-3 text-xs leading-5 text-warning sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-start gap-2">
                <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Coordinator access is required to change suppliers, stock, or
                routes.
              </span>
              <Button variant="secondary" size="sm" onClick={openAccess}>
                Add demo access
              </Button>
            </div>
          ) : null}

          {notice ? (
            <div className="mb-5">
              <Notice
                tone={notice.tone}
                onDismiss={() => setNotice(null)}
              >
                {notice.text}
              </Notice>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={submitSupplier} className="space-y-4">
              <div className="flex items-center gap-2">
                <PackagePlus className="h-4 w-4 text-muted" />
                <h3 className="text-sm font-medium text-white">Add supplier</h3>
              </div>
              <Field label="Name">
                <Input
                  value={newSupplier.name}
                  onChange={(event) =>
                    setNewSupplier((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Supplier or relief center"
                  required
                  minLength={2}
                  disabled={!hasCoordinator}
                />
              </Field>
              <Field label="Location">
                <Input
                  value={newSupplier.location}
                  onChange={(event) =>
                    setNewSupplier((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                  placeholder="Area or neighborhood"
                  required
                  minLength={2}
                  disabled={!hasCoordinator}
                />
              </Field>
              <Field label="Contact" hint="Optional">
                <Input
                  value={newSupplier.contact}
                  onChange={(event) =>
                    setNewSupplier((current) => ({
                      ...current,
                      contact: event.target.value,
                    }))
                  }
                  disabled={!hasCoordinator}
                />
              </Field>
              <Button
                type="submit"
                size="sm"
                loading={busy === "supplier"}
                disabled={!hasCoordinator || Boolean(busy)}
              >
                Add supplier
              </Button>
            </form>

            <form onSubmit={submitSupplierEdit} className="space-y-4">
              <h3 className="text-sm font-medium text-white">Update supplier</h3>
              <Field label="Supplier">
                <Select
                  value={supplierEdit.id}
                  onChange={(event) => selectSupplierForEdit(event.target.value)}
                  disabled={!hasCoordinator}
                  required
                >
                  <option value="">Choose a supplier</option>
                  {allSuppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      #{supplier.id} · {supplier.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Verification">
                  <Select
                    value={supplierEdit.verification_status}
                    onChange={(event) =>
                      setSupplierEdit((current) => ({
                        ...current,
                        verification_status: event.target
                          .value as SupplierVerificationStatus,
                      }))
                    }
                    disabled={!hasCoordinator || !supplierEdit.id}
                  >
                    {verificationOptions.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Availability">
                  <Select
                    value={supplierEdit.active}
                    onChange={(event) =>
                      setSupplierEdit((current) => ({
                        ...current,
                        active: event.target.value,
                      }))
                    }
                    disabled={!hasCoordinator || !supplierEdit.id}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </Select>
                </Field>
              </div>
              <Field label="Contact" hint="Leave blank to clear">
                <Input
                  value={supplierEdit.contact}
                  onChange={(event) =>
                    setSupplierEdit((current) => ({
                      ...current,
                      contact: event.target.value,
                    }))
                  }
                  disabled={!hasCoordinator || !supplierEdit.id}
                />
              </Field>
              <Field label="Reason">
                <Input
                  value={supplierEdit.reason}
                  onChange={(event) =>
                    setSupplierEdit((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  disabled={!hasCoordinator || !supplierEdit.id}
                  required
                  minLength={3}
                />
              </Field>
              <Button
                type="submit"
                size="sm"
                loading={busy === "supplier-edit"}
                disabled={!hasCoordinator || Boolean(busy)}
              >
                Save supplier
              </Button>
            </form>

            <form onSubmit={submitResource} className="space-y-4">
              <h3 className="text-sm font-medium text-white">Add inventory</h3>
              <Field label="Supplier">
                <Select
                  value={newResource.supplier_id}
                  onChange={(event) =>
                    setNewResource((current) => ({
                      ...current,
                      supplier_id: event.target.value,
                    }))
                  }
                  disabled={!hasCoordinator}
                  required
                >
                  <option value="">Choose a supplier</option>
                  {allSuppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      #{supplier.id} · {supplier.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Resource name">
                  <Input
                    value={newResource.name}
                    onChange={(event) =>
                      setNewResource((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="e.g. Bottled water"
                    required
                    minLength={2}
                    disabled={!hasCoordinator}
                  />
                </Field>
                <Field label="Category">
                  <Select
                    value={newResource.category}
                    onChange={(event) =>
                      setNewResource((current) => ({
                        ...current,
                        category: event.target.value as ReportCategory,
                      }))
                    }
                    disabled={!hasCoordinator}
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {formatCategory(category)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Units available">
                <Input
                  type="number"
                  min={1}
                  value={newResource.quantity}
                  onChange={(event) =>
                    setNewResource((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                  required
                  disabled={!hasCoordinator}
                />
              </Field>
              <Button
                type="submit"
                size="sm"
                loading={busy === "resource"}
                disabled={!hasCoordinator || Boolean(busy)}
              >
                Add stock
              </Button>
            </form>

            <form onSubmit={submitRestock} className="space-y-4">
              <h3 className="text-sm font-medium text-white">Restock</h3>
              <Field label="Resource">
                <Select
                  value={restock.resource_id}
                  onChange={(event) =>
                    setRestock((current) => ({
                      ...current,
                      resource_id: event.target.value,
                    }))
                  }
                  disabled={!hasCoordinator}
                  required
                >
                  <option value="">Choose a resource</option>
                  {allResources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      #{resource.id} · {resource.name} ·{" "}
                      {resource.quantity_available} available
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Units to add">
                <Input
                  type="number"
                  min={1}
                  value={restock.quantity}
                  onChange={(event) =>
                    setRestock((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                  required
                  disabled={!hasCoordinator}
                />
              </Field>
              <Field label="Reason">
                <Input
                  value={restock.reason}
                  onChange={(event) =>
                    setRestock((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  required
                  minLength={3}
                  disabled={!hasCoordinator}
                />
              </Field>
              <Button
                type="submit"
                size="sm"
                loading={busy === "restock"}
                disabled={!hasCoordinator || Boolean(busy)}
              >
                Add stock to resource
              </Button>
            </form>

            <form onSubmit={submitRouteAccess} className="space-y-4 lg:col-span-2">
              <h3 className="text-sm font-medium text-white">Route access</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Route">
                  <Select
                    value={routeAccess.route_id}
                    onChange={(event) => selectRouteForAccess(event.target.value)}
                    disabled={!hasCoordinator}
                    required
                  >
                    <option value="">Choose a route</option>
                    {allRoutes.map((route) => (
                      <option key={route.id} value={route.id}>
                        #{route.id} · {route.origin} → {route.destination}
                        {route.blocked ? " · blocked" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Action">
                  <Select
                    value={routeAccess.action}
                    onChange={(event) =>
                      setRouteAccess((current) => ({
                        ...current,
                        action: event.target.value as "block" | "unblock",
                      }))
                    }
                    disabled={!hasCoordinator || !routeAccess.route_id}
                  >
                    <option value="block">Block route</option>
                    <option value="unblock">Reopen route</option>
                  </Select>
                </Field>
                <Field label="Reason">
                  <Input
                    value={routeAccess.reason}
                    onChange={(event) =>
                      setRouteAccess((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                    required
                    minLength={3}
                    disabled={!hasCoordinator || !routeAccess.route_id}
                  />
                </Field>
              </div>
              <Button
                type="submit"
                size="sm"
                loading={busy === "route"}
                disabled={!hasCoordinator || Boolean(busy)}
              >
                Update route
              </Button>
            </form>
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-medium text-white">Suppliers</h2>
          <p className="mt-1 text-xs text-faint">
            Verified and active suppliers are eligible for matching.
          </p>
        </div>
        {suppliers.loading && !suppliers.data ? (
          <LoadingState />
        ) : suppliers.error ? (
          <ErrorState error={suppliers.error} onRetry={suppliers.reload} />
        ) : !allSuppliers.length ? (
          <EmptyState title="No suppliers" description="Add a supplier to begin." />
        ) : (
          <TableShell className="border-0">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-[0.08em] text-faint">
                  <th className="px-5 py-3 font-medium">Supplier</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium">Verification</th>
                  <th className="px-5 py-3 font-medium">Availability</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {allSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td className="px-5 py-4 text-white">{supplier.name}</td>
                    <td className="px-5 py-4 text-muted">{supplier.location}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={supplier.verification_status} />
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={supplier.active ? "success" : "neutral"}>
                        {supplier.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-muted">
                      {supplier.contact_name || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </Card>

      <Card>
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-medium text-white">Available stock</h2>
          <p className="mt-1 text-xs text-faint">
            Available and reserved units are tracked separately.
          </p>
        </div>
        {resources.loading && !resources.data ? (
          <LoadingState />
        ) : resources.error ? (
          <ErrorState error={resources.error} onRetry={resources.reload} />
        ) : !allResources.length ? (
          <EmptyState title="No inventory" description="Add stock for a supplier." />
        ) : (
          <TableShell className="border-0">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-[0.08em] text-faint">
                  <th className="px-5 py-3 font-medium">Resource</th>
                  <th className="px-5 py-3 font-medium">Supplier</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 text-right font-medium">Available</th>
                  <th className="px-5 py-3 text-right font-medium">Reserved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {allResources.map((resource) => (
                  <tr key={resource.id}>
                    <td className="px-5 py-4 text-white">{resource.name}</td>
                    <td className="px-5 py-4 text-muted">
                      {supplierMap.get(resource.supplier_id)?.name ??
                        `Supplier #${resource.supplier_id}`}
                    </td>
                    <td className="px-5 py-4 text-muted">
                      {formatCategory(resource.category)}
                    </td>
                    <td className="px-5 py-4 text-right text-white">
                      {formatNumber(resource.quantity_available)}
                    </td>
                    <td className="px-5 py-4 text-right text-muted">
                      {formatNumber(resource.quantity_reserved)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </Card>

      <Card>
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-medium text-white">Routes</h2>
          <p className="mt-1 text-xs text-faint">
            Blocked routes are excluded from new suggestions.
          </p>
        </div>
        {routes.loading && !routes.data ? (
          <LoadingState />
        ) : routes.error ? (
          <ErrorState error={routes.error} onRetry={routes.reload} />
        ) : !allRoutes.length ? (
          <EmptyState title="No routes" description="Route information will appear here." />
        ) : (
          <TableShell className="border-0">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-[0.08em] text-faint">
                  <th className="px-5 py-3 font-medium">Route</th>
                  <th className="px-5 py-3 text-right font-medium">Travel cost</th>
                  <th className="px-5 py-3 font-medium">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {allRoutes.map((route) => (
                  <tr key={route.id}>
                    <td className="px-5 py-4 text-white">
                      {route.origin} → {route.destination}
                    </td>
                    <td className="px-5 py-4 text-right text-muted">
                      {route.travel_cost}
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={route.blocked ? "danger" : "success"}>
                        {route.blocked ? "Blocked" : "Open"}
                      </Badge>
                      {route.blocked_reason ? (
                        <p className="mt-1 max-w-sm text-xs leading-5 text-faint">
                          {route.blocked_reason}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </Card>
    </div>
  );
}
