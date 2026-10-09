from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.core.config import Settings, get_settings
from app.providers.errors import (
    CatalogProviderRateLimitError,
    CatalogProviderUnavailableError,
)
from app.providers.itunes import ItunesMusicProvider
from app.providers.wikidata import WikidataMovieProvider
from app.schemas.catalog import CatalogSearchResponse

router = APIRouter(prefix="/catalog", tags=["catalog"])


def get_wikidata_provider(
    settings: Annotated[Settings, Depends(get_settings)],
) -> WikidataMovieProvider:
    return WikidataMovieProvider(settings)


def get_itunes_provider(settings: Annotated[Settings, Depends(get_settings)]) -> ItunesMusicProvider:
    return ItunesMusicProvider(settings)


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
    )


@router.get("/movies/search", response_model=CatalogSearchResponse)
async def search_movies(
    query: Annotated[str, Query(min_length=2, max_length=100)],
    provider: Annotated[WikidataMovieProvider, Depends(get_wikidata_provider)],
    page: Annotated[int, Query(ge=1, le=1)] = 1,
) -> CatalogSearchResponse | JSONResponse:
    try:
        return await provider.search(query.strip(), page)
    except CatalogProviderRateLimitError:
        return error_response(429, "RATE_LIMITED", "영화 검색 요청이 많습니다. 잠시 후 다시 시도해 주세요.")
    except CatalogProviderUnavailableError:
        return error_response(
            503,
            "CATALOG_PROVIDER_UNAVAILABLE",
            "영화 검색을 잠시 사용할 수 없습니다.",
        )


@router.get("/music/search", response_model=CatalogSearchResponse)
async def search_music(
    query: Annotated[str, Query(min_length=2, max_length=100)],
    entity: Literal["artist", "track"],
    provider: Annotated[ItunesMusicProvider, Depends(get_itunes_provider)],
    limit: Annotated[int, Query(ge=1, le=25)] = 15,
) -> CatalogSearchResponse | JSONResponse:
    try:
        return await provider.search(query.strip(), entity, limit)
    except CatalogProviderRateLimitError:
        return error_response(429, "RATE_LIMITED", "음악 검색 요청이 많습니다. 잠시 후 다시 시도해 주세요.")
    except CatalogProviderUnavailableError:
        return error_response(
            503,
            "CATALOG_PROVIDER_UNAVAILABLE",
            "음악 검색을 잠시 사용할 수 없습니다.",
        )
