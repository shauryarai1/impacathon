"""Aggregated API router. Add new route modules here."""

from fastapi import APIRouter

from app.api.routes.assignments import router as assignments_router
from app.api.routes.audit import router as audit_router
from app.api.routes.health import router as health_router
from app.api.routes.logistics import router as logistics_router
from app.api.routes.matches import router as matches_router
from app.api.routes.operations import router as operations_router
from app.api.routes.reports import router as reports_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(reports_router)
api_router.include_router(logistics_router)
api_router.include_router(matches_router)
api_router.include_router(assignments_router)
api_router.include_router(operations_router)
api_router.include_router(audit_router)
