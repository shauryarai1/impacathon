"""Idempotent fictional demo seed for Lifeline.

Usage:
    python -m app.seed

This script is ADDITIVE ONLY. It never drops tables, deletes rows, or overwrites
existing records. Every record it creates is fictional and is clearly identified
as simulation data. Re-running the script only inserts missing demo records.

The scenario intentionally includes:
- an insufficient-stock case (120 medical units requested, 100 supplied), and
- a blocked-road case (Riverside <-> Eastbridge).
"""

from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.orm import Session

import app.models  # noqa: F401  # registers all tables
from app.core.enums import (
    ReportCategory,
    ReportStatus,
    ReportType,
    ReviewDecision,
    SupplierVerification,
    Urgency,
)
from app.db.init_db import init_db
from app.db.session import SessionLocal
from app.models.assignment import Assignment
from app.models.audit import AuditLog
from app.models.coordinator import Coordinator
from app.models.recommendation import Recommendation
from app.models.report import Report
from app.models.resource import Resource
from app.models.route import Route
from app.models.shortage import Shortage
from app.models.supplier import Supplier
from app.models.volunteer import Volunteer
from app.schemas.report import ReportCreate
from app.services.audit import add_audit
from app.services.matching import generate_matches
from app.services.reports import create_report, review_report

DEMO_COORDINATOR = "Demo Coordinator"
DEMO_VOLUNTEER = "Demo Volunteer"
DEMO_VOLUNTEER_2 = "Maya Rivera"


def _get_or_create(
    db: Session,
    model,
    *,
    find: dict,
    create: dict,
) -> tuple[object, bool]:
    """Return an existing row matching ``find`` or create one. Never updates."""
    existing = db.scalar(select(model).filter_by(**find))
    if existing is not None:
        return existing, False
    record = model(**find, **create)
    db.add(record)
    db.flush()
    return record, True


def _seed(db: Session) -> Counter:
    # Safe on a fresh SQLite file: create missing tables, never drop or alter
    # existing ones.
    init_db()
    created: Counter = Counter()

    coordinator, was_created = _get_or_create(
        db,
        Coordinator,
        find={"name": DEMO_COORDINATOR},
        create={"active": True},
    )
    created["coordinators"] += int(was_created)

    volunteer, was_created = _get_or_create(
        db,
        Volunteer,
        find={"name": DEMO_VOLUNTEER},
        create={"organization": "Riverside Volunteer Network", "active": True},
    )
    created["volunteers"] += int(was_created)

    _, was_created = _get_or_create(
        db,
        Volunteer,
        find={"name": DEMO_VOLUNTEER_2},
        create={"organization": "Hilltop Relief Team", "active": True},
    )
    created["volunteers"] += int(was_created)

    supplier_specs = {
        "bluewater": {
            "name": "Bluewater Relief Depot (demo)",
            "location": "Riverside",
            "contact_name": "Nora Blake",
            "verification_status": SupplierVerification.VERIFIED.value,
            "active": True,
        },
        "northside_water": {
            "name": "Northside Water Co-op (demo)",
            "location": "Northside",
            "contact_name": "Eli Chen",
            "verification_status": SupplierVerification.VERIFIED.value,
            "active": True,
        },
        "hilltop_food": {
            "name": "Hilltop Food Bank (demo)",
            "location": "Hilltop",
            "contact_name": "Priya Nair",
            "verification_status": SupplierVerification.VERIFIED.value,
            "active": True,
        },
        "medsupply": {
            "name": "MedSupply Hub (demo)",
            "location": "Hilltop",
            "contact_name": "Dr. Omar Haddad",
            "verification_status": SupplierVerification.VERIFIED.value,
            "active": True,
        },
        "eastbridge_shelter": {
            "name": "Eastbridge Shelter Works (demo)",
            "location": "Eastbridge",
            "contact_name": "Tess Morgan",
            "verification_status": SupplierVerification.VERIFIED.value,
            "active": True,
        },
        "suspended": {
            "name": "Suspended Aid Co. (demo)",
            "location": "Riverside",
            "contact_name": None,
            "verification_status": SupplierVerification.REJECTED.value,
            "active": False,
        },
    }

    suppliers: dict[str, Supplier] = {}
    for key, spec in supplier_specs.items():
        supplier, was_created = _get_or_create(
            db,
            Supplier,
            find={"name": spec["name"], "location": spec["location"]},
            create={
                "contact_name": spec["contact_name"],
                "verification_status": spec["verification_status"],
                "active": spec["active"],
            },
        )
        suppliers[key] = supplier
        created["suppliers"] += int(was_created)

    resource_specs = [
        ("bluewater", "Sealed drinking-water cases", ReportCategory.WATER, 300),
        ("northside_water", "Bottled water pallets", ReportCategory.WATER, 250),
        ("hilltop_food", "Family food boxes", ReportCategory.FOOD, 200),
        ("northside_water", "Emergency ration packs", ReportCategory.FOOD, 80),
        ("medsupply", "Insulin and trauma kits", ReportCategory.MEDICAL, 100),
        ("eastbridge_shelter", "Blankets and folding cots", ReportCategory.SHELTER, 150),
        ("suspended", "Unverified shelter kits", ReportCategory.SHELTER, 60),
    ]
    for supplier_key, name, category, quantity in resource_specs:
        supplier = suppliers[supplier_key]
        _, was_created = _get_or_create(
            db,
            Resource,
            find={
                "supplier_id": supplier.id,
                "name": name,
                "category": category.value,
            },
            create={
                "quantity_total": quantity,
                "quantity_available": quantity,
                "quantity_reserved": 0,
            },
        )
        created["resources"] += int(was_created)

    route_specs = [
        ("Riverside", "Northside", 2.0, False, None),
        ("Northside", "Riverside", 2.0, False, None),
        ("Riverside", "Hilltop", 4.5, False, None),
        ("Hilltop", "Riverside", 4.5, False, None),
        ("Hilltop", "Eastbridge", 3.5, False, None),
        ("Eastbridge", "Hilltop", 3.5, False, None),
        (
            "Riverside",
            "Eastbridge",
            6.0,
            True,
            "Main bridge is flooded and unsafe for trucks (fictional demo).",
        ),
        (
            "Eastbridge",
            "Riverside",
            6.0,
            True,
            "Main bridge is flooded and unsafe for trucks (fictional demo).",
        ),
    ]
    for origin, destination, cost, blocked, reason in route_specs:
        _, was_created = _get_or_create(
            db,
            Route,
            find={"origin": origin, "destination": destination},
            create={
                "travel_cost": cost,
                "blocked": blocked,
                "blocked_reason": reason,
            },
        )
        created["routes"] += int(was_created)

    db.commit()

    report_specs = [
        (
            "water_primary",
            ReportCreate(
                reporter_name="Aarav Singh",
                category=ReportCategory.WATER,
                type=ReportType.NEED,
                location="Riverside",
                description=(
                    "Drinking water is running out at the Riverside community "
                    "shelter. Families need safe water urgently."
                ),
                quantity=500,
                urgency=Urgency.CRITICAL,
            ),
        ),
        (
            "water_duplicate",
            ReportCreate(
                reporter_name="Leila Hossain",
                category=ReportCategory.WATER,
                type=ReportType.NEED,
                location="Riverside",
                description=(
                    "Drinking water is running out at Riverside community "
                    "shelter. Families urgently need safe drinking water."
                ),
                quantity=400,
                urgency=Urgency.HIGH,
            ),
        ),
        (
            "food",
            ReportCreate(
                reporter_name="Mateo Alvarez",
                category=ReportCategory.FOOD,
                type=ReportType.NEED,
                location="Hilltop",
                description=(
                    "The Hilltop food bank has no supplies left for displaced "
                    "families. We need ready-to-eat food boxes."
                ),
                quantity=300,
                urgency=Urgency.HIGH,
            ),
        ),
        (
            "medical",
            ReportCreate(
                reporter_name="Nurse Amara Okafor",
                category=ReportCategory.MEDICAL,
                type=ReportType.NEED,
                location="Hilltop",
                description=(
                    "The Hilltop clinic needs insulin and trauma supplies for "
                    "flood victims with chronic conditions."
                ),
                quantity=120,
                urgency=Urgency.CRITICAL,
            ),
        ),
        (
            "shelter",
            ReportCreate(
                reporter_name="Jonas Weber",
                category=ReportCategory.SHELTER,
                type=ReportType.NEED,
                location="Eastbridge",
                description=(
                    "Eastbridge school gym is sheltering families but needs "
                    "blankets and folding cots before nightfall."
                ),
                quantity=200,
                urgency=Urgency.MEDIUM,
            ),
        ),
        (
            "road_hazard",
            ReportCreate(
                reporter_name="Priya Menon",
                category=ReportCategory.ROAD_BLOCKAGE,
                type=ReportType.HAZARD,
                location="Eastbridge",
                description=(
                    "The main bridge on Eastbridge road is flooded and unsafe "
                    "for trucks. Drivers should use the Hilltop bypass."
                ),
                quantity=1,
                urgency=Urgency.HIGH,
            ),
        ),
        (
            "uncertain",
            ReportCreate(
                reporter_name="Anonymous",
                category=ReportCategory.OTHER,
                type=ReportType.NEED,
                location="Riverside",
                description="Maybe we need help charging phones and radios at the shelter.",
                quantity=10,
                urgency=Urgency.LOW,
            ),
        ),
    ]

    reports: dict[str, Report] = {}
    for key, payload in report_specs:
        existing = db.scalar(
            select(Report).where(
                Report.reporter_name == payload.reporter_name,
                Report.category == payload.category.value,
                Report.type == payload.type.value,
                Report.location == payload.location,
                Report.description == payload.description,
                Report.quantity == payload.quantity,
            )
        )
        if existing is not None:
            reports[key] = existing
            continue
        reports[key] = create_report(db, payload)
        created["reports"] += 1

    # Only verify the demo medical report if no human has already decided it.
    medical = reports["medical"]
    db.refresh(medical)
    verified_now = False
    if medical.status in {
        ReportStatus.PENDING.value,
        ReportStatus.CLARIFICATION_REQUESTED.value,
    }:
        review_report(
            db,
            medical.id,
            ReviewDecision.VERIFIED,
            coordinator,
            "Clinic identity and medical need confirmed by phone (fictional demo).",
        )
        db.refresh(medical)
        verified_now = True

    # Preserve human decisions: only generate seed proposals when none exist.
    generated = 0
    if medical.status == ReportStatus.VERIFIED.value:
        existing_recommendations = db.scalar(
            select(func.count(Recommendation.id)).where(
                Recommendation.report_id == medical.id
            )
        )
        if not existing_recommendations:
            matching_result = generate_matches(
                db,
                coordinator,
                report_id=medical.id,
                replace_proposed=False,
            )
            generated = matching_result.generated_count

    if any(created.values()) or verified_now or generated:
        add_audit(
            db,
            action="demo_seed_loaded",
            entity_type="system",
            entity_id=None,
            actor_type="system",
            actor_name="demo_seed",
            reason="Additive fictional flood scenario loaded (no existing data overwritten)",
            details={
                "simulation_data": True,
                "created": dict(created),
                "generated_recommendations": generated,
            },
        )
        db.commit()

    print("SIMULATION DATA ONLY - names, locations, suppliers and incidents are fictional.")
    print("Additive seed complete; existing rows were left untouched.")
    print(f"Created this run: {dict(created)}")
    print(f"Coordinators: {db.scalar(select(func.count(Coordinator.id)))}")
    print(f"Volunteers: {db.scalar(select(func.count(Volunteer.id)))}")
    print(f"Reports: {db.scalar(select(func.count(Report.id)))}")
    print(
        "  pending verification: "
        f"{db.scalar(select(func.count(Report.id)).where(Report.status == ReportStatus.PENDING.value))}"
    )
    print(
        "  verified: "
        f"{db.scalar(select(func.count(Report.id)).where(Report.status == ReportStatus.VERIFIED.value))}"
    )
    print(f"Suppliers: {db.scalar(select(func.count(Supplier.id)))}")
    print(f"Resources: {db.scalar(select(func.count(Resource.id)))}")
    print(
        f"Routes: {db.scalar(select(func.count(Route.id)))} "
        f"(blocked: {db.scalar(select(func.count(Route.id)).where(Route.blocked.is_(True)))})"
    )
    print(
        f"Recommendations: {db.scalar(select(func.count(Recommendation.id)))} "
        f"(generated this run: {generated})"
    )
    print(
        "Open shortages: "
        f"{db.scalar(select(func.count(Shortage.id)).where(Shortage.status == 'open'))}"
    )
    print(f"Assignments: {db.scalar(select(func.count(Assignment.id)))}")
    print(f"Audit entries: {db.scalar(select(func.count(AuditLog.id)))}")
    print()
    print("Demo credentials are read from backend/.env; they are never printed here.")
    print("Use X-Coordinator-Key/X-Coordinator-Name and")
    print("X-Volunteer-Key/X-Volunteer-Name from that file.")

    return created


def main() -> None:
    with SessionLocal() as db:
        _seed(db)


if __name__ == "__main__":
    main()
