from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


class CatalogImageCredit(BaseModel):
    creator: str
    license: str
    source_url: HttpUrl
    license_url: HttpUrl | None = None


class CatalogItem(BaseModel):
    provider: Literal["wikidata", "itunes"]
    provider_id: str
    item_type: Literal["movie", "artist", "track"]
    title: str
    subtitle: str | None = None
    detail: str | None = None
    release_year: int | None = None
    image_url: HttpUrl | None = None
    image_credit: CatalogImageCredit | None = None
    external_url: HttpUrl | None = None


class CatalogAttribution(BaseModel):
    provider: Literal["wikidata", "itunes"]
    label: str
    notice: str
    url: HttpUrl


class CatalogSearchResponse(BaseModel):
    items: list[CatalogItem]
    page: int = Field(ge=1)
    has_more: bool
    attribution: CatalogAttribution
