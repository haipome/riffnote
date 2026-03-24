from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://haipoyang@localhost:5432/riffnote"
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""
    gemini_api_key: str = ""
    upload_dir: str = "uploads"
    cors_origins: str = "http://localhost:5173"  # comma-separated for multiple origins

    model_config = {"env_file": ".env"}

    @property
    def clerk_jwks_url(self) -> str:
        """Derive JWKS URL from the secret key's instance ID."""
        # Secret key format: sk_test_<base64> or sk_live_<base64>
        # JWKS endpoint is always at the Clerk Frontend API
        return "https://api.clerk.com/v1/jwks"


settings = Settings()
