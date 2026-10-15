"""All settings come from environment variables, so you can change them on your
hosting dashboard without touching code."""
import os


def _int(name, default):
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


class Settings:
    site_name = os.environ.get("SITE_NAME", "Pagecraft")
    # Your public address, e.g. https://pagecraft.in (used for sitemap and search engines)
    site_url = os.environ.get("SITE_URL", "").rstrip("/")
    contact_email = os.environ.get("CONTACT_EMAIL", "contact@example.com")
    max_upload_mb = _int("MAX_UPLOAD_MB", 50)
    max_pages = _int("MAX_PAGES", 200)
    # How many server conversions may run at the same time (1 for small 512 MB servers)
    max_concurrent = _int("MAX_CONCURRENT", 2)
    # Visitors waiting beyond this get a "busy, try again" message instead of a long hang
    max_queue = _int("MAX_QUEUE", 8)
    timeout = _int("CONVERT_TIMEOUT", 180)
    # Server conversions allowed per visitor (IP address) in 10 minutes
    rate_limit = _int("RATE_LIMIT", 30)


settings = Settings()
