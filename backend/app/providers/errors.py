class CatalogProviderError(Exception):
    """Base error for catalog provider failures."""


class CatalogProviderRateLimitError(CatalogProviderError):
    """Provider rejected the request because of its usage limit."""


class CatalogProviderUnavailableError(CatalogProviderError):
    """Provider is temporarily unavailable or returned an invalid response."""
