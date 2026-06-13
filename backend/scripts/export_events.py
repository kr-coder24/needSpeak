#!/usr/bin/env python3
"""
Export Events Script (Phase 8)
Exports all NeedSpeakUserEvents from DynamoDB to a CSV file for offline ML training.
"""
import os
import csv
import logging
import boto3
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure script works with mock mode if no AWS creds
MOCK_AWS = os.getenv("MOCK_AWS", "0").strip().lower() in ("1", "true", "yes")

def export_events(output_file: str):
    if MOCK_AWS:
        logger.info("MOCK_AWS is enabled. Generating mock event data instead of querying DynamoDB.")
        with open(output_file, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["user_id", "event_ts_event_id", "event_type", "sku", "session_id", "rank_position"])
            writer.writerow(["demo_user", f"{datetime.now().isoformat()}_mock", "purchase", "SKU-GRN-001", "mock_session_1", 1])
        logger.info(f"Mock data written to {output_file}")
        return

    try:
        dynamodb = boto3.resource("dynamodb", region_name=os.getenv("AWS_REGION", "us-east-1"))
        table = dynamodb.Table(os.getenv("DYNAMODB_TABLE_EVENTS", "NeedSpeakUserEvents"))
        
        response = table.scan()
        items = response.get("Items", [])
        
        while "LastEvaluatedKey" in response:
            response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
            items.extend(response.get("Items", []))
            
        if not items:
            logger.info("No events found in table.")
            return
            
        fields = ["user_id", "event_ts_event_id", "event_type", "sku", "session_id", "intent_type", "query_text", "rank_position", "price_inr", "category", "context"]
        
        with open(output_file, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
            writer.writeheader()
            for item in items:
                writer.writerow(item)
                
        logger.info(f"Successfully exported {len(items)} events to {output_file}")
        
    except Exception as e:
        logger.error(f"Failed to export events: {e}")

if __name__ == "__main__":
    output_path = os.path.join(os.path.dirname(__file__), "..", "data", "exported_events.csv")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    export_events(output_path)
