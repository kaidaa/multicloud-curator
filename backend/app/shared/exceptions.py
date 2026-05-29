from __future__ import annotations

from datetime import datetime
from typing import Any


class AdapterError(Exception):
    def __init__(
        self,
        message: str,
        *,
        provider: str,
        account_id: str | None,
        operation: str,
        original_error: BaseException | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.account_id = account_id
        self.operation = operation
        self.original_error = original_error


class AuthError(AdapterError):
    pass


class TokenInvalidError(AuthError):
    pass


class ScopeInsufficientError(AuthError):
    def __init__(
        self,
        message: str,
        *,
        provider: str,
        account_id: str | None,
        operation: str,
        required_scope: str | list[str],
        original_error: BaseException | None = None,
    ) -> None:
        super().__init__(
            message,
            provider=provider,
            account_id=account_id,
            operation=operation,
            original_error=original_error,
        )
        self.required_scope = required_scope


class ResourceError(AdapterError):
    pass


class FileNotFoundError(ResourceError):
    def __init__(
        self,
        message: str,
        *,
        provider: str,
        account_id: str | None,
        operation: str,
        file_id: str,
        original_error: BaseException | None = None,
    ) -> None:
        super().__init__(
            message,
            provider=provider,
            account_id=account_id,
            operation=operation,
            original_error=original_error,
        )
        self.file_id = file_id


class RateLimitError(AdapterError):
    def __init__(
        self,
        message: str,
        *,
        provider: str,
        account_id: str | None,
        operation: str,
        retry_after_seconds: float | None = None,
        original_error: BaseException | None = None,
    ) -> None:
        super().__init__(
            message,
            provider=provider,
            account_id=account_id,
            operation=operation,
            original_error=original_error,
        )
        self.retry_after_seconds = retry_after_seconds


class ProviderError(AdapterError):
    pass


class ProviderUnavailableError(ProviderError):
    pass


class NetworkError(AdapterError):
    pass


class ServiceError(Exception):
    code: str = "internal_error"
    http_status: int = 500

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(ServiceError):
    code = "not_found"
    http_status = 404


class ValidationError(ServiceError):
    code = "validation_error"
    http_status = 400


class OperationInProgressError(ServiceError):
    code = "operation_in_progress"
    http_status = 409

    def __init__(
        self,
        message: str = "Operation already in progress",
        *,
        operation_type: str,
        operation_id: str,
        started_at: datetime,
        details: dict[str, Any] | None = None,
    ) -> None:
        merged = {
            "operation_type": operation_type,
            "operation_id": operation_id,
            "started_at": started_at.isoformat(),
        }
        if details:
            merged.update(details)
        super().__init__(message, details=merged)
        self.operation_type = operation_type
        self.operation_id = operation_id
        self.started_at = started_at


class ServiceUnavailableError(ServiceError):
    code = "service_unavailable"
    http_status = 503
