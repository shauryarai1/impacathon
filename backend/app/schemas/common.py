"""Shared response envelope and schema base classes."""

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Consistent envelope used by every Lifeline endpoint."""

    success: bool = True
    message: str = "OK"
    data: T | None = None


class RequestModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MessageData(BaseModel):
    message: str
