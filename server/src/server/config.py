import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App Config
    APP_NAME: str = "Community Aid Navigator"
    ENVIRONMENT: str = "local"
    DEBUG: bool = True
    
    
    # OpenSearch Config
    OPENSEARCH_HOST: str = os.getenv("OPENSEARCH_HOST", "http://localhost:9200")
    OPENSEARCH_INDEX_PROGRAMS: str = "aid-programs"
    OPENSEARCH_INDEX_AUDIT: str = "audit-log"
    
    # Gemini / Bedrock / AI Config
    MODEL_PROVIDER: str = os.getenv("MODEL_PROVIDER", "gemini")
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", None)
    BEDROCK_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    BEDROCK_MODEL_ID: str = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0")
    PRIMARY_LLM_MODEL: str = "gemini-2.5-flash"
    EMBEDDING_MODEL: str = "gemini-embedding-001"
    EMBEDDING_DIMENSION: int = 768
    
    # Storage & Cedar
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./local_state.db")
    CEDAR_POLICIES_PATH: str = "cedar/policies"

    # csv / dataset paths
    CSV_AID_PROGRAMS_PATH: str = os.getenv("CSV_AID_PROGRAMS_PATH", "data/aid_programs_populated.csv")
    AUDIT_SCENARIOS_PATH: str = os.getenv("AUDIT_SCENARIOS_PATH", "data/audit_scenarios.json")
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
