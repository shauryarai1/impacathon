"""Match proposal generation and coordinator review endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.enums import RecommendationStatus
from app.core.security import get_current_coordinator
from app.db.session import get_db
from app.models.coordinator import Coordinator
from app.models.recommendation import Recommendation
from app.schemas.common import ApiResponse
from app.schemas.match import (
    ApprovalRequest,
    ApprovalResult,
    MatchGenerateRequest,
    MatchGenerationResult,
    ModifyRecommendationRequest,
    RecommendationRead,
    RejectRecommendationRequest,
)
from app.services import matching as matching_service
from app.services.approvals import (
    approve_recommendation,
    get_recommendation,
    modify_recommendation,
    reject_recommendation,
)
from app.services.presenters import recommendation_view

router = APIRouter(prefix="/matches", tags=["3. Match", "4. Human Review"])


@router.post(
    "",
    response_model=ApiResponse[MatchGenerationResult],
    summary="Generate deterministic match proposals for verified needs (coordinator only)",
)
def generate_matches(
    payload: MatchGenerateRequest,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[MatchGenerationResult]:
    result = matching_service.generate_matches(
        db,
        coordinator,
        report_id=payload.report_id,
        replace_proposed=payload.replace_proposed,
    )
    message = (
        f"Generated {result.generated_count} proposal(s) for human review; "
        f"no stock was reserved and no assignment was created"
    )
    return ApiResponse(message=message, data=result)


@router.get(
    "",
    response_model=ApiResponse[list[RecommendationRead]],
    summary="List match proposals and their review status",
)
def list_matches(
    recommendation_status: RecommendationStatus | None = Query(
        default=None, alias="status"
    ),
    report_id: int | None = None,
    db: Session = Depends(get_db),
) -> ApiResponse[list[RecommendationRead]]:
    recommendations = matching_service.list_recommendations(
        db,
        recommendation_status=recommendation_status.value if recommendation_status else None,
        report_id=report_id,
    )
    return ApiResponse(
        message=f"Found {len(recommendations)} recommendation(s)",
        data=matching_service.present_recommendations(db, recommendations),
    )


@router.get(
    "/{recommendation_id}",
    response_model=ApiResponse[RecommendationRead],
    summary="Get one match recommendation",
)
def get_match(
    recommendation_id: int,
    db: Session = Depends(get_db),
) -> ApiResponse[RecommendationRead]:
    recommendation = get_recommendation(db, recommendation_id)
    return ApiResponse(
        data=matching_service.present_recommendations(db, [recommendation])[0]
    )


@router.post(
    "/{recommendation_id}/approve",
    response_model=ApiResponse[ApprovalResult],
    summary="Approve a recommendation, reserve stock, and create an assignment",
)
def approve_match(
    recommendation_id: int,
    payload: ApprovalRequest,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[ApprovalResult]:
    result = approve_recommendation(db, recommendation_id, coordinator, payload.reason)
    return ApiResponse(
        message=(
            f"Approved by {coordinator.name}; assignment #{result.assignment.id} created "
            f"and {result.assignment.quantity} unit(s) reserved"
        ),
        data=result,
    )


@router.post(
    "/{recommendation_id}/modify",
    response_model=ApiResponse[RecommendationRead],
    summary="Modify a pending recommendation (remains pending until approval)",
)
def modify_match(
    recommendation_id: int,
    payload: ModifyRecommendationRequest,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[RecommendationRead]:
    result = modify_recommendation(db, recommendation_id, coordinator, payload)
    return ApiResponse(
        message="Recommendation modified; it still requires explicit coordinator approval",
        data=result,
    )


@router.post(
    "/{recommendation_id}/reject",
    response_model=ApiResponse[RecommendationRead],
    summary="Reject a pending recommendation without creating an assignment",
)
def reject_match(
    recommendation_id: int,
    payload: RejectRecommendationRequest,
    db: Session = Depends(get_db),
    coordinator: Coordinator = Depends(get_current_coordinator),
) -> ApiResponse[RecommendationRead]:
    result = reject_recommendation(db, recommendation_id, coordinator, payload.reason)
    return ApiResponse(message="Recommendation rejected; no assignment was created", data=result)
