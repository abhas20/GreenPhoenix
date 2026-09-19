import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # App Config
    APP_NAME: str = "Community Aid Navigator"
    ENVIRONMENT: str = "local"
    DEBUG: bool = True
    SECRET_KEY: str = os.getenv("SECRET_KEY", "greenphoenix-dev-secret-key-change-in-production-2026")
    SESSION_COOKIE_NAME: str = "aid_session"
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    RATE_LIMIT_TURNS_PER_MINUTE: int = 15
    RATE_LIMIT_CASEWORKER_PER_MINUTE: int = 60
    RATE_LIMIT_IP_PER_MINUTE: int = 80 
    
    # OpenSearch Config
    OPENSEARCH_HOST: str = os.getenv("OPENSEARCH_HOST", "http://localhost:9200")
    OPENSEARCH_INDEX_PROGRAMS: str = "aid-programs"
    OPENSEARCH_INDEX_AUDIT: str = "audit-log"
    
    # Gemini / Bedrock / AI Config
    MODEL_PROVIDER: str = os.getenv("MODEL_PROVIDER", "gemini")
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", None)
    BEDROCK_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    BEDROCK_MODEL_ID: str = os.getenv("BEDROCK_MODEL_ID", "google.gemma-3-27b-it")
    PRIMARY_LLM_MODEL: str = "gemini-2.5-flash"
    EMBEDDING_MODEL: str = "gemini-embedding-001"
    EMBEDDING_DIMENSION: int = 768
    
    # AWS Credentials & Translation
    AWS_ACCESS_KEY_ID: Optional[str] = os.getenv("AWS_ACCESS_KEY_ID", None)
    AWS_SECRET_ACCESS_KEY: Optional[str] = os.getenv("AWS_SECRET_ACCESS_KEY", None)
    AWS_REGION: str = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))
    TRANSLATE_PROVIDER: str = os.getenv("TRANSLATE_PROVIDER", "aws")
    
    # Storage & Cedar
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./local_state.db")
    REDIS_URL: Optional[str] = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CEDAR_POLICIES_PATH: str = "cedar/policies"
    DYNAMODB_ENDPOINT_URL: Optional[str] = os.getenv("DYNAMODB_ENDPOINT_URL", "http://localhost:8001")
    DYNAMODB_TABLE_USERS: str = os.getenv("DYNAMODB_TABLE_USERS", "greenphoenix-users")
    DYNAMODB_REGION: str = os.getenv("DYNAMODB_REGION", "us-east-1")

    # csv / dataset paths
    CSV_AID_PROGRAMS_PATH: str = os.getenv("CSV_AID_PROGRAMS_PATH", "data/aid_programs_populated.csv")
    AUDIT_SCENARIOS_PATH: str = os.getenv("AUDIT_SCENARIOS_PATH", "data/audit_scenarios.json")
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
