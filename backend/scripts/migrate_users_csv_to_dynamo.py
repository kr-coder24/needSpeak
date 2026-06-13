#!/usr/bin/env python3
"""
Migrate users from CSV to DynamoDB.
Run from the backend directory:
  python3 scripts/migrate_users_csv_to_dynamo.py
"""

import sys
import os
import logging
from pathlib import Path

# Add backend dir to python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.auth.csv_store import _read_all
from app.config import AWS_REGION, DYNAMODB_TABLE_USERS, DYNAMODB_TABLE_EMAIL_LOCKS, MOCK_AWS

import boto3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    if MOCK_AWS:
        logger.warning("MOCK_AWS is set to True. Real DynamoDB migration will not occur.")
        return

    users = _read_all()
    if not users:
        logger.info("No users found in CSV to migrate.")
        return

    logger.info(f"Found {len(users)} users in CSV. Migrating to DynamoDB (Region: {AWS_REGION})...")
    
    try:
        client = boto3.client("dynamodb", region_name=AWS_REGION)
    except Exception as e:
        logger.error(f"Failed to create DynamoDB client: {e}")
        return

    success_count = 0
    for user in users:
        try:
            # Prepare TransactWriteItems to keep consistency with dynamo_store
            email_norm = user["email"].lower().strip()
            user_id = user["id"]
            now = user.get("created_at") or "2026-06-13T00:00:00Z"
            
            client.transact_write_items(
                TransactItems=[
                    {
                        "Put": {
                            "TableName": DYNAMODB_TABLE_EMAIL_LOCKS,
                            "Item": {
                                "email_norm": {"S": email_norm},
                                "user_id": {"S": user_id},
                                "created_at": {"S": now}
                            },
                            "ConditionExpression": "attribute_not_exists(email_norm)"
                        }
                    },
                    {
                        "Put": {
                            "TableName": DYNAMODB_TABLE_USERS,
                            "Item": {
                                "user_id": {"S": user_id},
                                "email": {"S": email_norm},
                                "name": {"S": user["name"]},
                                "password_hash": {"S": user["password_hash"]},
                                "provider": {"S": user["provider"]},
                                "avatar_url": {"S": user.get("avatar_url", "")},
                                "created_at": {"S": now},
                                "updated_at": {"S": now},
                                "status": {"S": "active"}
                            },
                            "ConditionExpression": "attribute_not_exists(user_id)"
                        }
                    }
                ]
            )
            success_count += 1
            logger.info(f"Migrated user: {email_norm}")
        except client.exceptions.TransactionCanceledException as e:
            logger.warning(f"Skipped {user['email']} (already exists or conflict).")
        except Exception as e:
            logger.error(f"Error migrating {user['email']}: {e}")

    logger.info(f"Migration complete! Successfully migrated {success_count} out of {len(users)} users.")

if __name__ == "__main__":
    main()
