from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import uuid

def _resp(code: str, message: str, trace_id: str, status: int):
    return JSONResponse(status_code=status, content={"error":{"code":code,"message":message,"traceId":trace_id}})

async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    trace=request.headers.get("X-Request-Id") or str(uuid.uuid4())
    # map some common statuses to stable codes
    code_map={401:"UNAUTHENTICATED",403:"FORBIDDEN",404:"NOT_FOUND",409:"CONFLICT",429:"RATE_LIMIT"}
    code=code_map.get(exc.status_code,"HTTP_ERROR")
    return _resp(code, str(exc.detail), trace, exc.status_code)

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    trace=request.headers.get("X-Request-Id") or str(uuid.uuid4())
    return _resp("VALIDATION_ERROR","Invalid request payload",trace,422)

async def unhandled_exception_handler(request: Request, exc: Exception):
    trace=request.headers.get("X-Request-Id") or str(uuid.uuid4())
    return _resp("INTERNAL_ERROR","Unexpected error",trace,500)
