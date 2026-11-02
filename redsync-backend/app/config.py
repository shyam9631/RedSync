from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    secret_key: str = "dev-secret-change-me"
    database_url: str = "sqlite:///./redsync.db"
    access_token_minutes: int = 60 * 24  # login stays valid for 24 hours
    otp_minutes: int = 5  # OTP codes expire after 5 minutes
    dev_mode: bool = True  # when true, the OTP is also returned by the API (testing only)

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()