import json
import urllib.error
import urllib.request

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend


class ResendEmailBackend(BaseEmailBackend):
    """Envia e-mails pela API HTTPS do Resend.
    """

    api_url = "https://api.resend.com/emails"

    def send_messages(self, email_messages):
        api_key = getattr(settings, "RESEND_API_KEY", "")
        if not api_key:
            if self.fail_silently:
                return 0
            raise ValueError("RESEND_API_KEY não configurada.")

        sent = 0
        for message in email_messages:
            payload = {
                "from": message.from_email,
                "to": list(message.to),
                "subject": message.subject,
                "text": message.body,
            }
            if message.reply_to:
                payload["reply_to"] = list(message.reply_to)

            request = urllib.request.Request(
                self.api_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "User-Agent": "portfolio-django/1.0",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(
                    request, timeout=getattr(settings, "EMAIL_TIMEOUT", 15)
                ) as response:
                    if 200 <= response.status < 300:
                        sent += 1
            except urllib.error.URLError:
                if not self.fail_silently:
                    raise
        return sent