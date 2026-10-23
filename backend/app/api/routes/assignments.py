"""Delivery assignment endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.enums import AssignmentStatus
from app.core.security import get_current_volunteer
from app.db.session import get_db
from app.models.volunteer import Volunteer
from app.schemas.assignment import AssignmentRead, AssignmentStatusUpdate
from app.schemas.common import ApiResponse
from app.services import deliveries as delivery_service
from app.services.presenters import assignment_view

router = APIRouter(prefix="/assignments", tags=["5. Deliver"])


@router.get(
    "",
    response_model=ApiResponse[list[AssignmentRead]],
    summary="List approved delivery assignments",
)
def list_assignments(
    assignment_status: AssignmentStatus | None = Query(default=None, alias="status"),
    report_id: int | None = None,
    db: Session = Depends(get_db),
) -> ApiResponse[list[AssignmentRead]]:
    assignments = delivery_service.list_assignments(
        db,
        assignment_status=assignment_status.value if assignment_status else None,
        report_id=report_id,
    )
    return ApiResponse(
        message=f"Found {len(assignments)} assignment(s)",
        data=[assignment_view(db, assignment) for assignment in assignments],
    )


@router.get(
    "/{assignment_id}",
    response_model=ApiResponse[AssignmentRead],
    summary="Get one assignment",
)
def get_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
) -> ApiResponse[AssignmentRead]:
    assignment = delivery_service.get_assignment(db, assignment_id)
    return ApiResponse(data=assignment_view(db, assignment))


@router.post(
    "/{assignment_id}/status",
    response_model=ApiResponse[AssignmentRead],
    summary="Advance or close an approved assignment (volunteer/provider only)",
)
def update_assignment_status(
    assignment_id: int,
    payload: AssignmentStatusUpdate,
    db: Session = Depends(get_db),
    volunteer: Volunteer = Depends(get_current_volunteer),
) -> ApiResponse[AssignmentRead]:
    assignment = delivery_service.update_assignment_status(
        db, assignment_id, payload, volunteer
    )
    return ApiResponse(
        message=f"Assignment #{assignment_id} updated to {assignment.status.value}",
        data=assignment,
    )
