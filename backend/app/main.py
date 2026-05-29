from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import SessionLocal
from app.features.accounts.routes import router as accounts_router
from app.features.async_operations.routes import router as operations_router
from app.features.async_operations.service import recover_orphan_operations
from app.features.duplicates.routes import router as duplicates_router
from app.features.files_visibility.routes import router as files_visibility_router
from app.features.keywords.routes import router as keywords_router
from app.features.large_stale.routes import router as large_stale_router
from app.features.security.routes import router as security_router
from app.logging_config import setup_logging
from app.shared.api_envelope import DataEnvelope, EnvelopeMeta
from app.shared.encryption import EncryptionConfigError, validate_encryption_config
from app.shared.exceptions import (
    AdapterError,
    FileNotFoundError,
    RateLimitError,
    ScopeInsufficientError,
    ServiceError,
    TokenInvalidError,
)

setup_logging()
logger = logging.getLogger(__name__)

settings = get_settings()
REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST_DIR = REPO_ROOT / "frontend" / "dist"
FRONTEND_ASSETS_DIR = FRONTEND_DIST_DIR / "assets"
FRONTEND_INDEX = FRONTEND_DIST_DIR / "index.html"

app = FastAPI(
    title="Multicloud Curator API",
    version="0.1.0",
    description="Panel kontrol multi-cloud storage (Google Drive + Dropbox).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts_router)
app.include_router(operations_router)
app.include_router(files_visibility_router)
app.include_router(duplicates_router)
app.include_router(large_stale_router)
app.include_router(security_router)
app.include_router(keywords_router)


def _error_response(
    *,
    status_code: int,
    code: str,
    message: str,
    details: dict | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": details}},
    )


@app.exception_handler(RequestValidationError)
async def request_validation_handler(_request, exc: RequestValidationError) -> JSONResponse:
    return _error_response(
        status_code=400,
        code="validation_error",
        message="Input tidak valid",
        details={"errors": exc.errors()},
    )


@app.exception_handler(ServiceError)
async def service_error_handler(_request, exc: ServiceError) -> JSONResponse:
    return _error_response(
        status_code=exc.http_status,
        code=exc.code,
        message=exc.message,
        details=exc.details or None,
    )


@app.exception_handler(TokenInvalidError)
async def token_invalid_handler(_request, exc: TokenInvalidError) -> JSONResponse:
    return _error_response(
        status_code=401,
        code="account_token_invalid",
        message="Token akun telah expired. Silakan otorisasi ulang.",
        details={"account_id": exc.account_id, "provider": exc.provider},
    )


@app.exception_handler(ScopeInsufficientError)
async def scope_insufficient_handler(_request, exc: ScopeInsufficientError) -> JSONResponse:
    return _error_response(
        status_code=403,
        code="scope_insufficient",
        message="Akun tidak memiliki izin untuk operasi ini.",
        details={
            "account_id": exc.account_id,
            "provider": exc.provider,
            "required_scope": exc.required_scope,
            "operation": exc.operation,
        },
    )


@app.exception_handler(FileNotFoundError)
async def file_not_found_handler(_request, exc: FileNotFoundError) -> JSONResponse:
    return _error_response(
        status_code=404,
        code="not_found",
        message="Resource tidak ditemukan",
        details={"file_id": exc.file_id, "account_id": exc.account_id},
    )


@app.exception_handler(RateLimitError)
async def rate_limit_handler(_request, exc: RateLimitError) -> JSONResponse:
    return _error_response(
        status_code=429,
        code="rate_limit_exceeded",
        message="Terlalu banyak permintaan. Coba lagi nanti.",
        details={"retry_after_seconds": exc.retry_after_seconds, "provider": exc.provider},
    )


@app.exception_handler(AdapterError)
async def adapter_error_handler(_request, exc: AdapterError) -> JSONResponse:
    status_code = 503 if exc.__class__.__name__ == "ProviderUnavailableError" else 502
    return _error_response(
        status_code=status_code,
        code="provider_unavailable",
        message="Layanan provider sedang tidak tersedia. Coba lagi nanti.",
        details={"provider": exc.provider, "operation": exc.operation, "account_id": exc.account_id},
    )


@app.on_event("startup")
async def on_startup() -> None:
    try:
        validate_encryption_config()
    except EncryptionConfigError:
        logger.exception("Invalid TOKEN_ENCRYPTION_KEY configuration")
        raise
    db = SessionLocal()
    try:
        recover_orphan_operations(db)
    finally:
        db.close()
    logger.info(
        "Backend startup | env_db=%s | port=%s",
        settings.database_url,
        settings.backend_port,
    )


@app.get("/api/health", tags=["meta"])
async def health_check() -> DataEnvelope[dict[str, str]]:
    return DataEnvelope(
        data={"status": "ok"},
        meta=EnvelopeMeta(snapshot_at=datetime.now(timezone.utc).isoformat()),
    )


def _frontend_not_built_response() -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={
            "error": {
                "code": "frontend_dist_missing",
                "message": "Frontend build belum tersedia. Jalankan npm run build dari folder frontend.",
                "details": None,
            }
        },
    )


if FRONTEND_ASSETS_DIR.is_dir():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_ASSETS_DIR)),
        name="frontend-assets",
    )
else:
    logger.warning("Frontend assets directory not found | path=%s", FRONTEND_ASSETS_DIR)


@app.get("/", response_model=None, include_in_schema=False)
async def serve_frontend_root():
    if FRONTEND_INDEX.is_file():
        return FileResponse(FRONTEND_INDEX)
    return _frontend_not_built_response()


@app.get("/{full_path:path}", response_model=None, include_in_schema=False)
async def serve_frontend_spa(full_path: str):
    if full_path.startswith("api/"):
        return _error_response(
            status_code=404,
            code="not_found",
            message="Resource tidak ditemukan",
        )
    if FRONTEND_INDEX.is_file():
        return FileResponse(FRONTEND_INDEX)
    return _frontend_not_built_response()
