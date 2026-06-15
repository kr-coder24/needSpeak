from __future__ import annotations

import logging
import os

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from app.watchlist.models import WatchEvent, WatchedItem

logger = logging.getLogger(__name__)


def send_watch_alert_email(item: WatchedItem, event: WatchEvent) -> bool:
    if not item.email:
        return False

    api_key = os.getenv("SENDGRID_API_KEY")
    from_email = os.getenv("SENDGRID_FROM_EMAIL")
    from_name = os.getenv("SENDGRID_FROM_NAME", "NeedSpeak Price Guardian")
    if not api_key or not from_email:
        logger.info("SendGrid not configured; simulated watch email to %s: %s", item.email, event.message)
        return True

    try:
        message = Mail(
            from_email=(from_email, from_name),
            to_emails=item.email,
            subject=f"Price Guardian alert: {item.name}",
            html_content=f"""
            <div style="font-family:Arial,sans-serif;line-height:1.5">
              <h2>Price Guardian found a match</h2>
              <p>{event.message}</p>
              <p>Savings signal: Rs {event.savings_inr:.0f}</p>
            </div>
            """,
        )
        response = SendGridAPIClient(api_key).send(message)
        return 200 <= response.status_code < 300
    except Exception as exc:
        logger.error("Failed to send watch alert email to %s: %s", item.email, exc)
        return False
