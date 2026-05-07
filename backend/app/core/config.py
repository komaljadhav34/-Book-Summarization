from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    # Required — must be set in .env
    database_url: str
    secret_key: str
    groq_api_key: str               # Groq API key (free tier — groq.com)

    # JWT
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Limits
    max_file_size_mb: int = 200
    max_paste_words: int = 10_000

    # Extractive pipeline (kept for topic extraction only)
    extractive_ratio: float = 0.6

    model_config = ConfigDict(env_file=".env")


settings = Settings()
