"""Report submission, duplicate triage, and coordinator verification."""

from difflib import SequenceMatcher

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.enums import ReportStatus, ReportType, ReviewDecision
from app.core.utils import utcnow
from app.models.coordinator import Coordinator
from app.models.report import Report, ReportReview
from app.schemas.report import ReportCreate
from app.services.audit import add_audit
from app.services.text import normalize_area, normalize_description

REVIEW_TO_STATUS = {
    ReviewDecision.VERIFIED: ReportStatus.VERIFIED,
    ReviewDecision.REJECTED: ReportStatus.REJECTED,
    ReviewDecision.CLARIFICATION_REQUESTED: ReportStatus.CLARIFICATION_REQUESTED,
}


def _triage_flags(report_data: ReportCreate, db: Session) -> tuple[list[str], Report | None, float | None]:
    flags: list[str] = []
    normalized_location = normalize_area(report_data.location)
    normalized_description = normalize_description(report_data.description)

    candidates = db.scalars(
        select(Report)
        .where(
            Report.category == report_data.category,
            Report.type == report_data.type,
            Report.status != ReportStatus.REJECTED.value,
        )
        .order_by(Report.created_at.desc())
        .limit(200)
    ).all()

    best_match: Report | None = None
    best_score = 0.0
    for candidate in candidates:
        if normalize_area(candidate.location) != normalized_location:
            continue
        score = SequenceMatcher(
            None,
            normalized_description,
            normalize_description(candidate.description),
        ).ratio()
        if score >= 0.55 and score > best_score:
            best_match = candidate
            best_score = score

    if best_match is not None:
        flags.append(
            f"Potential duplicate of report #{best_match.id} "
            f"(description similarity {best_score:.0%}); coordinator review required."
        )

    if len(report_data.description.split()) < 6:
        flags.append("Description is brief; request clarification before verifying.")

    uncertain_words = {"maybe", "possibly", "unclear", "unknown", "not sure", "approx"}
    words = set(normalize_description(report_data.description).split())
    if words & uncertain_words:
        flags.append("Report contains uncertain language; confirm details with the reporter.")

    if report_data.category.value == "other":
        flags.append("Category 'other' requires manual classification by a coordinator.")

    if report_data.quantity >= 10_000:
        flags.append("Unusually large quantity; confirm the figure with the reporter.")

    if report_data.reporter_name.casefold() in {"unknown", "anonymous", "n/a", "na"}:
        flags.append("Reporter identity is not specific; verify the source.")

    return flags, best_match, (round(best_score, 3) if best_match else None)


def create_report(db: Session, report_data: ReportCreate) -> Report:
    """Persist a pending report. Automated triage never verifies anything."""
    flags, duplicate, duplicate_score = _triage_flags(report_data, db)

    report = Report(
        reporter_name=report_data.reporter_name,
        category=report_data.category.value,
        type=report_data.type.value,
        location=report_data.location,
        description=report_data.description,
        quantity=report_data.quantity,
        urgency=report_data.urgency.value,
        status=ReportStatus.PENDING.value,
        duplicate_of_report_id=duplicate.id if duplicate else None,
        duplicate_score=duplicate_score,
        review_flags=flags,
        needs_review=bool(flags),
    )
    db.add(report)
    db.flush()

    add_audit(
        db,
        action="report_submitted",
        entity_type="report",
        entity_id=report.id,
        actor_type="system",
        actor_name=report.reporter_name,
        details={
            "category": report.category,
            "type": report.type,
            "location": report.location,
            "auto_flags": flags,
        },
    )
    db.commit()
    db.refresh(report)
    return report


def list_reports(
    db: Session,
    *,
    report_status: str | None = None,
    category: str | None = None,
    report_type: str | None = None,
    location: str | None = None,
    limit: int = 100,
) -> list[Report]:
    statement = select(Report)
    if report_status:
        statement = statement.where(Report.status == report_status)
    if category:
        statement = statement.where(Report.category == category)
    if report_type:
        statement = statement.where(Report.type == report_type)
    if location:
        statement = statement.where(Report.location == location)
    statement = statement.order_by(Report.created_at.desc(), Report.id.desc()).limit(limit)
    return list(db.scalars(statement).all())


def list_pending_reports(db: Session) -> list[Report]:
    """Reports a coordinator still has to resolve, oldest first."""
    return list(
        db.scalars(
            select(Report)
            .where(
                Report.status.in_(
                    [
                        ReportStatus.PENDING.value,
                        ReportStatus.CLARIFICATION_REQUESTED.value,
                    ]
                )
            )
            .order_by(Report.created_at.asc(), Report.id.asc())
        ).all()
    )


def get_report(db: Session, report_id: int) -> Report:
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report #{report_id} not found",
        )
    return report


def review_report(
    db: Session,
    report_id: int,
    decision: ReviewDecision,
    coordinator: Coordinator,
    reason: str,
) -> Report:
    """Record a human verification decision. Only pending/clarification reports move."""
    report = get_report(db, report_id)
    allowed = {
        ReportStatus.PENDING.value,
        ReportStatus.CLARIFICATION_REQUESTED.value,
    }
    if report.status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Report #{report_id} has already been reviewed (status={report.status})",
        )

    new_status = REVIEW_TO_STATUS[decision].value
    result = db.execute(
        update(Report)
        .where(Report.id == report_id, Report.status.in_(allowed))
        .values(
            status=new_status,
            verified_by_id=coordinator.id,
            verified_at=utcnow(),
            verification_reason=reason,
            needs_review=(decision == ReviewDecision.CLARIFICATION_REQUESTED),
        )
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Report was already reviewed by another coordinator",
        )

    db.add(
        ReportReview(
            report_id=report_id,
            coordinator_id=coordinator.id,
            decision=decision.value,
            reason=reason,
        )
    )
    add_audit(
        db,
        action=f"report_{decision.value}",
        entity_type="report",
        entity_id=report_id,
        actor_type="coordinator",
        actor_name=coordinator.name,
        reason=reason,
        details={"new_status": new_status},
    )
    db.commit()
    db.refresh(report)
    return report


def list_report_reviews(db: Session, report_id: int) -> list[ReportReview]:
    get_report(db, report_id)
    return list(
        db.scalars(
            select(ReportReview)
            .where(ReportReview.report_id == report_id)
            .order_by(ReportReview.created_at.asc(), ReportReview.id.asc())
        ).all()
    )
