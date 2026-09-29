import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

class Settings(BaseSettings):
    PROJECT_NAME: str = "MilkFlow"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-milkflow-key-change-in-production-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days for mobile retention
    
    # SQLite default, can be overridden by DATABASE_URL env var for PostgreSQL on Neon/Render
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./milkflow.db")
    
    # CORS allowed origins
    FRONTEND_URL: Optional[str] = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    # Business defaults
    DEFAULT_CURRENCY: str = "INR"
    DEFAULT_CURRENCY_SYMBOL: str = "₹"

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")

settings = Settings()
