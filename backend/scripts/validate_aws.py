import os
import sys
import uuid
import datetime
import logging
from decimal import Decimal

# Ensure backend root is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load env safely
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Force MOCK_MODE = 0 and MOCK_AWS = False for this test
os.environ["MOCK_MODE"] = "0"
os.environ["MOCK_AWS"] = "0"

from app.db.dynamo import (
    get_all_products,
    save_user_preferences,
    get_user_preferences,
    save_event,
    get_user_events,
    save_session,
    get_session,
    check_dynamodb_health
)
from app.auth.dynamo_store import create_user, find_user_by_email, store_auth_session, get_auth_session_user_id

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_tests():
    print("====================================")
    print(" AWS DynamoDB Validation Test ")
    print("====================================")
    
    # 1. Health check
    print("\n1. Checking DynamoDB Health...")
    health = check_dynamodb_health()
    if health is True:
        print("✅ Health Check PASS")
    else:
        print(f"❌ Health Check FAIL: {health}")
        return

    # 2. ProductCatalog
    print("\n2. Checking ProductCatalog...")
    try:
        products = get_all_products(mock_mode=False)
        print(f"✅ ProductCatalog PASS - Found {len(products)} products")
    except Exception as e:
        print(f"❌ ProductCatalog FAIL: {e}")

    test_user_id = f"test-user-{uuid.uuid4()}"
    test_email = f"test-{uuid.uuid4()}@example.com"
    test_session_id = f"test-session-{uuid.uuid4()}"
    test_token = f"test-token-{uuid.uuid4()}"

    # 3. Users and EmailLocks
    print("\n3. Checking NeedSpeakUsers & NeedSpeakEmailLocks...")
    try:
        # Create user (uses TransactWriteItems)
        user = create_user(test_email, "Test User", "password123", "email")
        if user and user.get("user_id"):
            print("✅ Create User PASS")
            # Verify read
            found = find_user_by_email(test_email)
            if found and found.get("user_id") == user.get("user_id"):
                print("✅ Read User PASS")
            else:
                print("❌ Read User FAIL - Could not find created user")
        else:
            print("❌ Create User FAIL - User object invalid")
    except Exception as e:
        print(f"❌ Users/EmailLocks FAIL: {e}")

    # 4. AuthSessions
    print("\n4. Checking NeedSpeakAuthSessions...")
    try:
        store_auth_session(test_token, test_user_id, 3600)
        user_id = get_auth_session_user_id(test_token)
        if user_id == test_user_id:
            print("✅ AuthSessions PASS")
        else:
            print(f"❌ AuthSessions FAIL - Expected {test_user_id}, got {user_id}")
    except Exception as e:
        print(f"❌ AuthSessions FAIL: {e}")

    # 5. UserPreferences
    print("\n5. Checking NeedSpeakUserPreferences...")
    try:
        prefs = {"budget_mode": "value", "dietary": ["veg"]}
        save_user_preferences(test_user_id, prefs)
        loaded_prefs = get_user_preferences(test_user_id)
        if loaded_prefs and loaded_prefs.get("budget_mode") == "value":
            print("✅ UserPreferences PASS")
        else:
            print("❌ UserPreferences FAIL - Data mismatch")
    except Exception as e:
        print(f"❌ UserPreferences FAIL: {e}")

    # 6. UserEvents
    print("\n6. Checking NeedSpeakUserEvents...")
    try:
        event = {
            "user_id": test_user_id,
            "event_ts_event_id": f"{datetime.datetime.now(datetime.timezone.utc).isoformat()}_{uuid.uuid4()}",
            "event_type": "impression",
            "sku": "test-sku",
            "session_id": test_session_id
        }
        save_event(event)
        events = get_user_events(test_user_id, "impression", limit=10)
        if len(events) > 0 and events[0].get("sku") == "test-sku":
            print("✅ UserEvents PASS")
        else:
            print("❌ UserEvents FAIL - Could not retrieve event")
    except Exception as e:
        print(f"❌ UserEvents FAIL: {e}")

    # 7. CartSessions
    print("\n7. Checking CartSessions...")
    try:
        session_data = {
            "session_id": test_session_id,
            "cart": {"items": []},
            "budget_inr": Decimal("100")
        }
        save_session(session_data)
        loaded_session = get_session(test_session_id)
        if loaded_session and loaded_session.get("session_id") == test_session_id:
            print("✅ CartSessions PASS")
        else:
            print("❌ CartSessions FAIL - Data mismatch")
    except Exception as e:
        print(f"❌ CartSessions FAIL: {e}")

    print("\n====================================")
    print(" Cleanup (Manual deletion recommended for production, skipping here for safety)")
    print("====================================")

if __name__ == "__main__":
    run_tests()
