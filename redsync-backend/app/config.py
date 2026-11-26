from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    secret_key: str = "dev-secret-change-me"
    database_url: str = "sqlite:///./redsync.db"
    access_token_minutes: int = 60 * 24  # login stays valid for 24 hours
    otp_minutes: int = 5  # OTP codes expire after 5 minutes
    dev_mode: bool = True  # when true with SMS_PROVIDER=console, the OTP is also returned by the API (testing only)

    # ---- OTP text messages (see app/sms.py) ----
    sms_provider: str = "console"  # console | fast2sms | msg91 | twilio

    fast2sms_api_key: str = ""
    fast2sms_url: str = "https://www.fast2sms.com/dev/bulkV2"

    msg91_auth_key: str = ""
    msg91_template_id: str = ""  # a DLT-approved OTP template that contains ##OTP##
    msg91_url: str = "https://control.msg91.com/api/v5/otp"

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from: str = ""  # a Twilio number, or use the messaging service below
    twilio_messaging_service_sid: str = ""
    twilio_url: str = "https://api.twilio.com/2010-04-01"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()

# A live site must never run with the public development key or with OTPs shown on the page
if not settings.dev_mode and (settings.secret_key == "dev-secret-change-me" or len(settings.secret_key) < 32):
    raise RuntimeError(
        "SECRET_KEY must be a long random string (32+ characters) when DEV_MODE is false. "
        'Make one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'
    )