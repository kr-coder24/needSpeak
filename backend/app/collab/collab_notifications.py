"""Email and SMS notification service for collaborative carts."""

import logging
import os
from typing import Literal

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from twilio.rest import Client as TwilioClient

logger = logging.getLogger(__name__)


def send_email_invite(
    recipient_email: str,
    session_name: str,
    share_url: str,
    host_name: str,
) -> bool:
    """Send collaboration invite via SendGrid."""
    api_key = os.getenv("SENDGRID_API_KEY")
    from_email = os.getenv("SENDGRID_FROM_EMAIL")
    from_name = os.getenv("SENDGRID_FROM_NAME", "NeedSpeak")

    if not api_key or not from_email:
        logger.warning("SendGrid not configured, skipping email")
        return False

    try:
        message = Mail(
            from_email=(from_email, from_name),
            to_emails=recipient_email,
            subject=f"{host_name} invited you to join '{session_name}'",
            html_content=f"""
            <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #6366f1;">🛒 You're Invited to a SplitCart!</h2>
                <p><strong>{host_name}</strong> invited you to collaborate on <strong>{session_name}</strong>.</p>
                <p>Add your demand naturally, and NeedSpeak will resolve, merge, and split the cart automatically.</p>
                <a href="{share_url}" 
                   style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0;">
                    Join Live Cart →
                </a>
                <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                    Or copy this link: <a href="{share_url}">{share_url}</a>
                </p>
            </div>
            """,
        )

        client = SendGridAPIClient(api_key)
        response = client.send(message)
        logger.info(f"Email sent to {recipient_email}: status {response.status_code}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {recipient_email}: {e}")
        return False


def send_sms_invite(
    recipient_phone: str,
    session_name: str,
    share_url: str,
    host_name: str,
) -> bool:
    """Send collaboration invite via Twilio SMS."""
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_phone = os.getenv("TWILIO_FROM_PHONE")

    if not account_sid or not auth_token or not from_phone:
        logger.warning("Twilio not configured, skipping SMS")
        return False

    try:
        client = TwilioClient(account_sid, auth_token)
        message = client.messages.create(
            body=f"{host_name} invited you to '{session_name}' on NeedSpeak. Join here: {share_url}",
            from_=from_phone,
            to=recipient_phone,
        )

        logger.info(f"SMS sent to {recipient_phone}: sid {message.sid}")
        return True

    except Exception as e:
        logger.error(f"Failed to send SMS to {recipient_phone}: {e}")
        return False
