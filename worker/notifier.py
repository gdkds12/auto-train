# worker/notifier.py
import os
import requests

def send_push(title, message):
    """Sends a push notification via ntfy."""
    ntfy_url = os.getenv("NTFY_URL")
    if not ntfy_url:
        print("NTFY: NTFY_URL not set. Skipping push notification.")
        return

    try:
        response = requests.post(
            ntfy_url,
            data=message.encode('utf-8'),
            headers={
                "Title": title.encode('utf-8'),
                "Priority": "high",
                "Tags": "tada"
            }
        )
        response.raise_for_status()
        print(f"NTFY: Successfully sent push notification - Title: '{title}', Message: '{message}'")
    except requests.exceptions.RequestException as e:
        print(f"NTFY: Failed to send push notification - {e}")