"""SQLAlchemy models.

Import new models here so they are registered with ``Base.metadata`` and their
tables are created by ``init_db``.
"""

from app.models.assignment import Assignment
from app.models.audit import AuditLog
from app.models.coordinator import Coordinator
from app.models.recommendation import Recommendation
from app.models.report import Report, ReportReview
from app.models.resource import Resource
from app.models.route import Route
from app.models.shortage import Shortage
from app.models.supplier import Supplier
from app.models.volunteer import Volunteer

__all__ = [
    "Assignment",
    "AuditLog",
    "Coordinator",
    "Recommendation",
    "Report",
    "ReportReview",
    "Resource",
    "Route",
    "Shortage",
    "Supplier",
    "Volunteer",
]
