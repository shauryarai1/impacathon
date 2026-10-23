"""Supplier, resource, and route endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import ReportCategory, SupplierVerification
from app.core.security import get_current_coordinator
from app.db.session import get_db
from app.models.coordinator import Coordinator
from app.models.resource import Resource
from app.models.route import Route
from app.models.supplier import Supplier
from app.schemas.common import ApiResponse
from app.schemas.logistics import (
    ResourceCreate,
    ResourceRead,
    ResourceRestock,
    RouteBlockRequest,
    RouteCreate,
    RouteRead,
    RouteUnblockRequest,
    SupplierCreate,
    SupplierRead,
    SupplierUpdate,
    SupplierVerifyRequest,
)
from app.services.audit import add_audit
from app.services.routing import block_route, get_route_or_404, unblock_route

router = APIRouter(tags=["3. Supply & Routes"])


@router.post(
    "/suppliers",
    response_model=ApiResponse[SupplierRead],
    status_code=status.HTTP_201_CREATED,
    summary="Create a supplier (coordinator only)",
)
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[SupplierRead]:
    supplier = Supplier(
        name=payload.name,
        location=payload.location,
        contact_name=payload.contact_name,
        verification_status=payload.verification_status.value,
        active=payload.active,
    )
    db.add(supplier)
    db.flush()
    add_audit(
        db,
        action="supplier_created",
        entity_type="supplier",
        entity_id=supplier.id,
        actor_type="coordinator",
        actor_name=coordinator.name,
        details={"verification_status": supplier.verification_status, "active": supplier.active},
    )
    db.commit()
    db.refresh(supplier)
    return ApiResponse(
        message="Supplier created (simulation data)" if payload.verification_status.value == "verified" else "Supplier created; verification is still pending",
        data=SupplierRead.model_validate(supplier),
    )


@router.get(
    "/suppliers",
    response_model=ApiResponse[list[SupplierRead]],
    summary="List suppliers",
)
def list_suppliers(
    verification_status: SupplierVerification | None = None,
    active: bool | None = None,
    db: Session = Depends(get_db),
) -> ApiResponse[list[SupplierRead]]:
    statement = select(Supplier).order_by(Supplier.name.asc(), Supplier.id.asc())
    if verification_status:
        statement = statement.where(
            Supplier.verification_status == verification_status.value
        )
    if active is not None:
        statement = statement.where(Supplier.active.is_(active))
    suppliers = list(db.scalars(statement).all())
    return ApiResponse(
        message=f"Found {len(suppliers)} supplier(s)",
        data=[SupplierRead.model_validate(supplier) for supplier in suppliers],
    )


@router.get(
    "/suppliers/{supplier_id}",
    response_model=ApiResponse[SupplierRead],
    summary="Get one supplier",
)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
) -> ApiResponse[SupplierRead]:
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status_code=404, detail=f"Supplier #{supplier_id} not found")
    return ApiResponse(data=SupplierRead.model_validate(supplier))


@router.patch(
    "/suppliers/{supplier_id}",
    response_model=ApiResponse[SupplierRead],
    summary="Update a supplier's details, verification, or active status (coordinator only)",
)
def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[SupplierRead]:
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status_code=404, detail=f"Supplier #{supplier_id} not found")

    updates = payload.model_dump(exclude_unset=True, exclude={"reason"})
    if not updates:
        raise HTTPException(status_code=422, detail="No supplier fields to update")

    before = {
        field: getattr(supplier, field)
        for field in ["name", "location", "contact_name", "verification_status", "active"]
    }
    if "verification_status" in updates and updates["verification_status"] is not None:
        verification = updates["verification_status"]
        updates["verification_status"] = (
            verification.value if hasattr(verification, "value") else verification
        )

    for field, value in updates.items():
        if field in {"name", "location"} and value is None:
            raise HTTPException(status_code=422, detail=f"{field} cannot be null")
        setattr(supplier, field, value)

    add_audit(
        db,
        action="supplier_updated",
        entity_type="supplier",
        entity_id=supplier.id,
        actor_type="coordinator",
        actor_name=coordinator.name,
        reason=payload.reason,
        details={
            "before": before,
            "after": {
                field: getattr(supplier, field)
                for field in ["name", "location", "contact_name", "verification_status", "active"]
            },
        },
    )
    db.commit()
    db.refresh(supplier)
    return ApiResponse(message="Supplier updated", data=SupplierRead.model_validate(supplier))


@router.post(
    "/suppliers/{supplier_id}/verify",
    response_model=ApiResponse[SupplierRead],
    summary="Verify a supplier (coordinator only)",
)
def verify_supplier(
    supplier_id: int,
    payload: SupplierVerifyRequest,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[SupplierRead]:
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status_code=404, detail=f"Supplier #{supplier_id} not found")
    if supplier.verification_status == SupplierVerification.VERIFIED.value:
        raise HTTPException(status_code=409, detail="Supplier is already verified")
    supplier.verification_status = SupplierVerification.VERIFIED.value
    add_audit(
        db,
        action="supplier_verified",
        entity_type="supplier",
        entity_id=supplier.id,
        actor_type="coordinator",
        actor_name=coordinator.name,
        reason=payload.reason,
    )
    db.commit()
    db.refresh(supplier)
    return ApiResponse(message="Supplier verified", data=SupplierRead.model_validate(supplier))


@router.post(
    "/resources",
    response_model=ApiResponse[ResourceRead],
    status_code=status.HTTP_201_CREATED,
    summary="Add inventory for a supplier (coordinator only)",
)
def create_resource(
    payload: ResourceCreate,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[ResourceRead]:
    supplier = db.get(Supplier, payload.supplier_id)
    if supplier is None:
        raise HTTPException(
            status_code=404, detail=f"Supplier #{payload.supplier_id} not found"
        )
    resource = Resource(
        supplier_id=supplier.id,
        name=payload.name,
        category=payload.category.value,
        quantity_total=payload.quantity_available,
        quantity_available=payload.quantity_available,
        quantity_reserved=0,
    )
    db.add(resource)
    db.flush()
    add_audit(
        db,
        action="resource_created",
        entity_type="resource",
        entity_id=resource.id,
        actor_type="coordinator",
        actor_name=coordinator.name,
        details={
            "supplier_id": supplier.id,
            "category": resource.category,
            "quantity_available": resource.quantity_available,
        },
    )
    db.commit()
    db.refresh(resource)
    return ApiResponse(message="Resource inventory added", data=ResourceRead.model_validate(resource))


@router.get(
    "/resources",
    response_model=ApiResponse[list[ResourceRead]],
    summary="List resource inventory",
)
def list_resources(
    supplier_id: int | None = None,
    category: ReportCategory | None = None,
    db: Session = Depends(get_db),
) -> ApiResponse[list[ResourceRead]]:
    statement = select(Resource).order_by(Resource.id.asc())
    if supplier_id is not None:
        statement = statement.where(Resource.supplier_id == supplier_id)
    if category is not None:
        statement = statement.where(Resource.category == category.value)
    resources = list(db.scalars(statement).all())
    return ApiResponse(
        message=f"Found {len(resources)} resource(s)",
        data=[ResourceRead.model_validate(resource) for resource in resources],
    )


@router.get(
    "/resources/{resource_id}",
    response_model=ApiResponse[ResourceRead],
    summary="Get one resource",
)
def get_resource(
    resource_id: int,
    db: Session = Depends(get_db),
) -> ApiResponse[ResourceRead]:
    resource = db.get(Resource, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail=f"Resource #{resource_id} not found")
    return ApiResponse(data=ResourceRead.model_validate(resource))


@router.post(
    "/resources/{resource_id}/restock",
    response_model=ApiResponse[ResourceRead],
    summary="Add stock to a resource (coordinator only)",
)
def restock_resource(
    resource_id: int,
    payload: ResourceRestock,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[ResourceRead]:
    resource = db.get(Resource, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail=f"Resource #{resource_id} not found")

    before_total = resource.quantity_total
    before_available = resource.quantity_available
    resource.quantity_total += payload.quantity
    resource.quantity_available += payload.quantity
    add_audit(
        db,
        action="resource_restocked",
        entity_type="resource",
        entity_id=resource.id,
        actor_type="coordinator",
        actor_name=coordinator.name,
        reason=payload.reason,
        details={
            "before": {
                "quantity_total": before_total,
                "quantity_available": before_available,
            },
            "after": {
                "quantity_total": resource.quantity_total,
                "quantity_available": resource.quantity_available,
            },
            "added_quantity": payload.quantity,
        },
    )
    db.commit()
    db.refresh(resource)
    return ApiResponse(
        message=f"Added {payload.quantity} unit(s) to resource #{resource.id}",
        data=ResourceRead.model_validate(resource),
    )


@router.post(
    "/routes",
    response_model=ApiResponse[RouteRead],
    status_code=status.HTTP_201_CREATED,
    summary="Create a route between areas (coordinator only)",
)
def create_route(
    payload: RouteCreate,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[RouteRead]:
    route = Route(
        origin=payload.origin,
        destination=payload.destination,
        travel_cost=payload.travel_cost,
        blocked=payload.blocked,
        blocked_reason="Created blocked" if payload.blocked else None,
    )
    db.add(route)
    db.flush()
    add_audit(
        db,
        action="route_created",
        entity_type="route",
        entity_id=route.id,
        actor_type="coordinator",
        actor_name=coordinator.name,
        details={
            "origin": route.origin,
            "destination": route.destination,
            "travel_cost": route.travel_cost,
            "blocked": route.blocked,
        },
    )
    db.commit()
    db.refresh(route)
    return ApiResponse(message="Route created", data=RouteRead.model_validate(route))


@router.get(
    "/routes",
    response_model=ApiResponse[list[RouteRead]],
    summary="List routes",
)
def list_routes(
    blocked: bool | None = None,
    db: Session = Depends(get_db),
) -> ApiResponse[list[RouteRead]]:
    statement = select(Route).order_by(Route.id.asc())
    if blocked is not None:
        statement = statement.where(Route.blocked.is_(blocked))
    routes = list(db.scalars(statement).all())
    return ApiResponse(
        message=f"Found {len(routes)} route(s)",
        data=[RouteRead.model_validate(route) for route in routes],
    )


@router.get(
    "/routes/{route_id}",
    response_model=ApiResponse[RouteRead],
    summary="Get one route",
)
def get_route(
    route_id: int,
    db: Session = Depends(get_db),
) -> ApiResponse[RouteRead]:
    route = get_route_or_404(db, route_id)
    return ApiResponse(data=RouteRead.model_validate(route))


@router.post(
    "/routes/{route_id}/block",
    response_model=ApiResponse[RouteRead],
    summary="Block a route and flag affected plans (coordinator only)",
)
def block_route_endpoint(
    route_id: int,
    payload: RouteBlockRequest,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[RouteRead]:
    route = block_route(db, route_id, coordinator, payload.reason)
    return ApiResponse(
        message="Route blocked; affected recommendations and assignments flagged for review",
        data=RouteRead.model_validate(route),
    )


@router.post(
    "/routes/{route_id}/unblock",
    response_model=ApiResponse[RouteRead],
    summary="Reopen a blocked route (coordinator only)",
)
def unblock_route_endpoint(
    route_id: int,
    payload: RouteUnblockRequest,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[RouteRead]:
    route = unblock_route(db, route_id, coordinator, payload.reason)
    return ApiResponse(
        message="Route reopened; existing review flags remain until a coordinator acts",
        data=RouteRead.model_validate(route),
    )
