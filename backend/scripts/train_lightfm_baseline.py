#!/usr/bin/env python3
"""
LightFM Baseline Training Script (Phase 8)
Demonstrates how to build an interaction matrix from exported events
and train a hybrid collaborative filtering model using LightFM.
"""
import os
import csv
import logging
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from lightfm import LightFM
    from lightfm.data import Dataset
    from lightfm.evaluation import precision_at_k
    LIGHTFM_AVAILABLE = True
except ImportError:
    LIGHTFM_AVAILABLE = False
    logger.warning("lightfm is not installed. Run `pip install lightfm` to use this script.")

def load_events(filepath: str) -> list[dict]:
    events = []
    if not os.path.exists(filepath):
        logger.error(f"Event file not found: {filepath}. Run export_events.py first.")
        return events
        
    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            events.append(row)
    return events

def train_baseline(events: list[dict]):
    if not LIGHTFM_AVAILABLE:
        logger.info("Mocking LightFM training execution...")
        logger.info(f"Loaded {len(events)} events.")
        logger.info("Mock training complete.")
        return

    # Filter interactions: we only want positive signals (purchases, add_to_cart)
    positive_events = [e for e in events if e["event_type"] in ("purchase", "add_to_cart")]
    
    if not positive_events:
        logger.warning("No positive events found. Cannot train model.")
        return

    dataset = Dataset()
    
    # Fit dataset
    users = set(e["user_id"] for e in positive_events)
    items = set(e["sku"] for e in positive_events)
    dataset.fit(users, items)
    
    logger.info(f"Dataset fit with {len(users)} users and {len(items)} items")
    
    # Build interaction matrix
    (interactions, weights) = dataset.build_interactions(
        ((e["user_id"], e["sku"]) for e in positive_events)
    )
    
    # Initialize and train model
    model = LightFM(loss='warp', no_components=30)
    logger.info("Training LightFM WARP model...")
    model.fit(interactions, epochs=10, num_threads=2)
    
    # Evaluate
    train_precision = precision_at_k(model, interactions, k=5).mean()
    logger.info(f"Training Precision@5: {train_precision:.4f}")
    
    # TODO: Save the model using pickle or joblib
    logger.info("Model training complete.")

if __name__ == "__main__":
    event_file = os.path.join(os.path.dirname(__file__), "..", "data", "exported_events.csv")
    events = load_events(event_file)
    if events:
        train_baseline(events)
