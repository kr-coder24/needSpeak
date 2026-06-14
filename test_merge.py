#!/usr/bin/env python3
"""
Quick validation script for merge verification.
Tests critical fixes and dual-mode support.
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

def test_inventory_reservations():
    """Test that inventory reservation system supports both modes."""
    print("\n🔧 Testing Inventory Reservations...")
    
    from app.inventory.reservations import reserve_items, release_reservation, commit_reservation
    
    # Test mock mode
    items = [{"sku": "SKU-TEST-001", "qty": 2}]
    success, failed, res_id, metadata = reserve_items(
        session_id="test_session",
        items=items,
        mock_mode=True
    )
    
    assert success, "Mock reservation should succeed"
    assert res_id is not None, "Should return reservation ID"
    assert "reserved_items" in metadata, "Should return metadata dict"
    assert len(metadata["reserved_items"]) == 1, "Should have 1 reserved item"
    
    print("✅ Mock mode: Reserve items - PASS")
    
    # Test release
    released = release_reservation(res_id, items, mock_mode=True)
    assert released, "Should release successfully"
    print("✅ Mock mode: Release reservation - PASS")
    
    # Test commit
    success2, failed2, res_id2, metadata2 = reserve_items(
        session_id="test_session_2",
        items=items,
        mock_mode=True
    )
    committed = commit_reservation(res_id2, items, mock_mode=True)
    assert committed, "Should commit successfully"
    print("✅ Mock mode: Commit reservation - PASS")
    
    print("✅ Inventory Reservations: ALL TESTS PASSED\n")


def test_config():
    """Test configuration values."""
    print("\n⚙️ Testing Configuration...")
    
    from app.config import GEMINI_MODEL_ID, DYNAMODB_TABLE_SHOPPER_PROFILES
    
    assert GEMINI_MODEL_ID == "gemini-flash-latest", f"Expected gemini-flash-latest, got {GEMINI_MODEL_ID}"
    print(f"✅ GEMINI_MODEL_ID = {GEMINI_MODEL_ID} (1500 req/day)")
    
    assert DYNAMODB_TABLE_SHOPPER_PROFILES == "NeedSpeakShopperProfiles", "Shopper profiles table should be configured"
    print(f"✅ DYNAMODB_TABLE_SHOPPER_PROFILES = {DYNAMODB_TABLE_SHOPPER_PROFILES}")
    
    print("✅ Configuration: ALL TESTS PASSED\n")


def test_hybrid_retrieval():
    """Test that hybrid retrieval module loads correctly."""
    print("\n🔍 Testing Hybrid Retrieval...")
    
    try:
        from app.search.hybrid_retrieval import retrieve_candidates, SYNONYM_MAP
        
        assert len(SYNONYM_MAP) > 50, f"Should have 50+ synonyms, got {len(SYNONYM_MAP)}"
        print(f"✅ Synonym map loaded: {len(SYNONYM_MAP)} terms")
        
        # Test a few key Hindi/Hinglish synonyms
        assert "chawal" in SYNONYM_MAP.get("rice", []), "Rice should have 'chawal' synonym"
        assert "thanda" in SYNONYM_MAP.get("cold drink", []), "Cold drink should have 'thanda' synonym"
        assert "pyaaz" in SYNONYM_MAP.get("onion", []), "Onion should have 'pyaaz' synonym"
        
        print("✅ Hindi/Hinglish synonyms verified")
        print("✅ Hybrid Retrieval: ALL TESTS PASSED\n")
        
    except ImportError as e:
        print(f"❌ Failed to import hybrid_retrieval: {e}")
        sys.exit(1)


def test_ranker_v2():
    """Test ranking V2 with dynamic weights."""
    print("\n📊 Testing Ranking V2...")
    
    from app.search.ranker import _get_weights
    
    # Test value mode
    value_weights = _get_weights("value")
    assert value_weights["price_fit"] == 0.25, "Value mode should boost price_fit"
    print("✅ Value mode weights validated")
    
    # Test premium mode
    premium_weights = _get_weights("premium")
    assert premium_weights["rating_quality"] == 0.25, "Premium mode should boost rating_quality"
    assert premium_weights["brand_preference"] == 0.20, "Premium mode should boost brand_preference"
    print("✅ Premium mode weights validated")
    
    # Test balanced mode
    balanced_weights = _get_weights("balanced")
    assert "popularity" in balanced_weights, "Should have popularity signal"
    assert "category_preference" in balanced_weights, "Should have category_preference signal"
    print("✅ Balanced mode weights validated")
    
    print("✅ Ranking V2: ALL TESTS PASSED\n")


def test_preference_engine():
    """Test enhanced preference engine."""
    print("\n🎯 Testing Preference Engine...")
    
    from app.intelligence.preference_engine import UserPreferences
    
    # Test new fields
    prefs = UserPreferences(
        dietary=["veg"],
        preferred_brands=["Amul"],
        avoided_brands=["Brand-X"],
        preferred_categories=["dairy"],
        avoided_categories=["alcohol"],
        quality_preference="quality",
        pack_size_preference="bulk",
    )
    
    assert prefs.quality_preference == "quality", "Should support quality_preference"
    assert prefs.pack_size_preference == "bulk", "Should support pack_size_preference"
    assert "dairy" in prefs.preferred_categories, "Should support preferred_categories"
    assert "alcohol" in prefs.avoided_categories, "Should support avoided_categories"
    
    print("✅ New preference fields validated")
    print("✅ Preference Engine: ALL TESTS PASSED\n")


def test_shopper_profiles():
    """Test shopper profile storage."""
    print("\n👤 Testing Shopper Profiles...")
    
    from app.db.dynamo import save_shopper_profile, get_shopper_profile
    
    # Test mock mode
    profile_data = {
        "budget_dna": {"avg_cart_value": 1500},
        "category_affinity": {"dairy": 0.8, "snacks": 0.6},
    }
    
    save_shopper_profile("test_user_123", profile_data, mock_mode=True)
    retrieved = get_shopper_profile("test_user_123", mock_mode=True)
    
    assert retrieved is not None, "Should retrieve saved profile"
    assert retrieved["budget_dna"]["avg_cart_value"] == 1500, "Data should match"
    
    print("✅ Shopper profile save/retrieve - PASS")
    print("✅ Shopper Profiles: ALL TESTS PASSED\n")


def test_cleanup_scheduler():
    """Test cleanup scheduler integration."""
    print("\n🧹 Testing Cleanup Scheduler...")
    
    from app.inventory.cleanup import cleanup_expired_reservations
    
    # Should not crash
    try:
        cleanup_expired_reservations()
        print("✅ Cleanup function executes without error")
    except Exception as e:
        print(f"❌ Cleanup failed: {e}")
        sys.exit(1)
    
    print("✅ Cleanup Scheduler: ALL TESTS PASSED\n")


def main():
    """Run all validation tests."""
    print("=" * 60)
    print("🚀 MERGE VALIDATION TEST SUITE")
    print("=" * 60)
    print("\nTesting critical fixes and dual-mode support...")
    
    try:
        test_config()
        test_inventory_reservations()
        test_hybrid_retrieval()
        test_ranker_v2()
        test_preference_engine()
        test_shopper_profiles()
        test_cleanup_scheduler()
        
        print("=" * 60)
        print("🎉 ALL VALIDATION TESTS PASSED!")
        print("=" * 60)
        print("\n✅ Merge is ready for:")
        print("   1. Full integration testing")
        print("   2. Manual QA with checklist")
        print("   3. Performance testing")
        print("   4. Staging deployment")
        print("\nSee MERGE_EXECUTION_SUMMARY.md for details.\n")
        
        return 0
        
    except AssertionError as e:
        print(f"\n❌ VALIDATION FAILED: {e}\n")
        return 1
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}\n")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
