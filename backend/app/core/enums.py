"""Shared domain enums.

Values are stored as plain strings in SQLite so the schema stays simple and
readable. Pydantic validates API input and output against these enums.
"""

from enum import Enum


class ReportCategory(str, Enum):
    WATER = "water"
    FOOD = "food"
    SHELTER = "shelter"
    MEDICAL = "medical"
    ROAD_BLOCKAGE = "road_blockage"
    OTHER = "other"


class ReportType(str, Enum):
    NEED = "need"
    HAZARD = "hazard"


class Urgency(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ReportStatus(str, Enum):
    PENDING = "pending_verification"
    VERIFIED = "verified"
    REJECTED = "rejected"
    CLARIFICATION_REQUESTED = "clarification_requested"


class ReviewDecision(str, Enum):
    VERIFIED = "verified"
    REJECTED = "rejected"
    CLARIFICATION_REQUESTED = "clarification_requested"


class SupplierVerification(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class RecommendationStatus(str, Enum):
    PROPOSED = "proposed"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUPERSEDED = "superseded"


class AssignmentStatus(str, Enum):
    APPROVED = "approved"
    DISPATCHED = "dispatched"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ShortageStatus(str, Enum):
    OPEN = "open"
    RESOLVED = "resolved"


class ActorType(str, Enum):
    COORDINATOR = "coordinator"
    VOLUNTEER = "volunteer"
    SYSTEM = "system"


# An assignment in any of these states is a committed claim on demand and stock.
COMMITTED_ASSIGNMENT_STATUSES = (
    AssignmentStatus.APPROVED.value,
    AssignmentStatus.DISPATCHED.value,
    AssignmentStatus.IN_TRANSIT.value,
    AssignmentStatus.DELIVERED.value,
)

# These states still reserve inventory and may be flagged for coordinator review.
ACTIVE_ASSIGNMENT_STATUSES = (
    AssignmentStatus.APPROVED.value,
    AssignmentStatus.DISPATCHED.value,
    AssignmentStatus.IN_TRANSIT.value,
)

URGENCY_RANK = {
    Urgency.CRITICAL.value: 0,
    Urgency.HIGH.value: 1,
    Urgency.MEDIUM.value: 2,
    Urgency.LOW.value: 3,
}

class WarehouseStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    INACCESSIBLE = "inaccessible"


class InventoryMovementType(str, Enum):
    ADDED = "stock_added"
    RESTOCKED = "restocked"
    RESERVED = "reserved"
    RELEASED = "released"
    CONSUMED = "consumed"
