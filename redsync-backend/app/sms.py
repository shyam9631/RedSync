"""Sends the OTP text message.

Pick a provider with SMS_PROVIDER in .env:

    console   prints the OTP in the backend terminal (development only, the default)
    fast2sms  Fast2SMS "OTP" route
    msg91     MSG91 Send OTP API (needs a DLT-approved template)
    twilio    Twilio Programmable SMS

Only the Python standard library is used, so there is nothing new to install.
A provider that is down, rejects the request or is misconfigured raises SmsError.
The caller turns that into a clear message for the user instead of a crash.
"""

import base64
import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from app.config import settings

log = logging.getLogger("redsync.sms")

TIMEOUT_SECONDS = 10


class SmsError(Exception):
    """The OTP could not be delivered."""


def _post(url: str, *, data=None, headers=None, as_json=False) -> dict:
    """One HTTP call that returns the JSON body, or raises SmsError."""
    headers = dict(headers or {})
    if data is None:
        body = None
    elif as_json:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    else:
        body = urllib.parse.urlencode(data).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=body, headers=headers, method="POST" if body is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as res:
            raw = res.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", "replace")[:300]
        raise SmsError(f"provider returned HTTP {err.code}: {detail}") from err
    except (urllib.error.URLError, TimeoutError, OSError) as err:
        raise SmsError(f"could not reach the SMS provider: {err}") from err
    try:
        return json.loads(raw) if raw.strip() else {}
    except ValueError as err:
        raise SmsError(f"provider sent an unreadable reply: {raw[:200]}") from err


def _need(*names: str) -> None:
    missing = [n.upper() for n in names if not getattr(settings, n)]
    if missing:
        raise SmsError("missing settings in .env: " + ", ".join(missing))


def _console(phone: str, otp: str) -> None:
    print(f"[DEV OTP] {phone}: {otp}  (SMS_PROVIDER=console, nothing was sent)")


def _fast2sms(phone: str, otp: str) -> None:
    _need("fast2sms_api_key")
    query = urllib.parse.urlencode(
        {"route": "otp", "variables_values": otp, "numbers": phone, "flash": 0}
    )
    reply = _post(
        f"{settings.fast2sms_url}?{query}",
        headers={"authorization": settings.fast2sms_api_key, "cache-control": "no-cache"},
    )
    if reply.get("return") is not True:
        raise SmsError(f"Fast2SMS refused the message: {reply.get('message') or reply}")


def _msg91(phone: str, otp: str) -> None:
    _need("msg91_auth_key", "msg91_template_id")
    query = urllib.parse.urlencode(
        {
            "template_id": settings.msg91_template_id,
            "mobile": f"91{phone}",
            "authkey": settings.msg91_auth_key,
            "otp": otp,
            "otp_expiry": settings.otp_minutes,
        }
    )
    reply = _post(f"{settings.msg91_url}?{query}", data={}, as_json=True)
    if str(reply.get("type", "")).lower() != "success":
        raise SmsError(f"MSG91 refused the message: {reply.get('message') or reply}")


def _twilio(phone: str, otp: str) -> None:
    _need("twilio_account_sid", "twilio_auth_token")
    if not (settings.twilio_from or settings.twilio_messaging_service_sid):
        raise SmsError("missing settings in .env: TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID")
    form = {
        "To": f"+91{phone}",
        "Body": f"{otp} is your RedSync verification code. It is valid for {settings.otp_minutes} minutes. Do not share it with anyone.",
    }
    if settings.twilio_messaging_service_sid:
        form["MessagingServiceSid"] = settings.twilio_messaging_service_sid
    else:
        form["From"] = settings.twilio_from
    token = base64.b64encode(f"{settings.twilio_account_sid}:{settings.twilio_auth_token}".encode()).decode()
    reply = _post(
        f"{settings.twilio_url}/Accounts/{settings.twilio_account_sid}/Messages.json",
        data=form,
        headers={"Authorization": f"Basic {token}"},
    )
    if not reply.get("sid"):
        raise SmsError(f"Twilio refused the message: {reply}")


PROVIDERS = {
    "console": _console,
    "fast2sms": _fast2sms,
    "msg91": _msg91,
    "twilio": _twilio,
}


def shows_otp_in_response() -> bool:
    """True only for the console provider with DEV_MODE on. A real SMS never leaks the code to the browser."""
    return settings.dev_mode and settings.sms_provider.lower() == "console"


def send_otp_sms(phone: str, otp: str) -> None:
    """Delivers the OTP to a 10-digit Indian mobile number or raises SmsError."""
    name = settings.sms_provider.lower().strip()
    send = PROVIDERS.get(name)
    if send is None:
        raise SmsError(f"unknown SMS_PROVIDER '{settings.sms_provider}' (use one of: {', '.join(PROVIDERS)})")
    if name == "console" and not settings.dev_mode:
        # The console provider sends nobody anything, so it must never run in production.
        raise SmsError("SMS_PROVIDER is 'console' but DEV_MODE is off. Set a real provider in .env.")
    send(phone, otp)