import os
import sys

# Ensure server module is in python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from server.agents.orchestrator import orchestrator, MAX_CLARIFICATION_ATTEMPTS
from server.agents.intake_agent import _heuristic_extract
from server.agents.matching_agent import _deterministic_match_programs
from server.agents.intake_agent import ApplicantProfile


def test_heuristic_extraction():
    print("\n--- Test 1: Enhanced Heuristic Extraction ---")
    
    # 1. Income without dollar sign
    p1 = _heuristic_extract("I live in Brooklyn and my annual income is 24000")
    assert p1.borough == "brooklyn", f"Expected brooklyn, got {p1.borough}"
    assert p1.annual_income == 24000.0, f"Expected 24000, got {p1.annual_income}"
    print("✓ Income without dollar sign parsed correctly: $24,000 in Brooklyn")

    # 2. Rent without dollar sign
    p2 = _heuristic_extract("My rent is 1400 and I receive SSI")
    assert p2.monthly_rent == 1400.0, f"Expected 1400, got {p2.monthly_rent}"
    assert p2.has_disability_benefits is True, f"Expected True, got {p2.has_disability_benefits}"
    assert "SSI" in (p2.disability_benefit_types or []), f"Expected SSI in types, got {p2.disability_benefit_types}"
    print("✓ Rent and SSI disability parsed correctly: $1,400 rent, SSI=True")

    # 3. Negative disability statement
    p3 = _heuristic_extract("I have no disability and my age is 35")
    assert p3.has_disability_benefits is False, f"Expected False, got {p3.has_disability_benefits}"
    assert p3.age == 35, f"Expected 35, got {p3.age}"
    print("✓ Negative disability parsed correctly: disability=False, age=35")


def test_matching_confidence_tiers():
    print("\n--- Test 2: Confidence Tiering (No 40% Floor) ---")
    
    # Unverified candidate (income and borough match, disability missing)
    profile_unverified = ApplicantProfile(
        borough="brooklyn",
        annual_income=24000.0,
        monthly_rent=1400.0,
        primary_needs=["housing"],
        summary="Need rent relief"
    )
    res_unverified = _deterministic_match_programs(profile_unverified)
    for m in res_unverified.ranked_programs:
        if m.is_deterministically_eligible is None:
            assert 0.35 <= m.match_confidence <= 0.80, f"Unverified candidate score out of range: {m.match_confidence}"
            print(f"✓ Unverified candidate '{m.name}': score={m.match_confidence:.2f}, eligible=None (correctly unconfirmed)")
            break

    # Confirmed eligible candidate (all rules satisfied)
    profile_confirmed = ApplicantProfile(
        borough="brooklyn",
        annual_income=24000.0,
        monthly_rent=1400.0,
        has_disability_benefits=True,
        disability_benefit_types=["SSI"],
        primary_needs=["housing"],
        summary="Disabled renter on SSI"
    )
    res_confirmed = _deterministic_match_programs(profile_confirmed)
    confirmed_matches = [m for m in res_confirmed.ranked_programs if m.is_deterministically_eligible is True]
    assert len(confirmed_matches) > 0, "Expected at least one confirmed match"
    for m in confirmed_matches:
        assert m.match_confidence >= 0.60, f"Confirmed match score too low: {m.match_confidence}"
        print(f"✓ Confirmed candidate '{m.name}': score={m.match_confidence:.2f}, eligible=True, passed={m.passed_criteria}")


def test_multi_turn_feedback_loop():
    print("\n--- Test 3: Multi-Turn Orchestration Clarification Loop ---")
    session_id = "test_loop_verify_001"
    orchestrator.store.reset(session_id)

    # Turn 1: Incomplete profile -> Clarification required
    resp1 = orchestrator.process_user_turn(
        "I need help with rent", 
        session_id=session_id,
        principal_id=session_id,
        principal_role="PublicApplicant",
        org_id=None
    )
    print(f"Turn 1 -> clarification_needed: {resp1.clarification_needed}")
    print(f"Turn 1 Reply: {resp1.reply_message}")
    assert resp1.clarification_needed is True, "Turn 1 must request clarification for borough/income"

    # Turn 2: Borough & income provided -> Candidate matching finds unverified programs (needs disability/age)
    resp2 = orchestrator.process_user_turn(
        "I live in Brooklyn and my annual income is 24000", 
        session_id=session_id,
        principal_id=session_id,
        principal_role="PublicApplicant",
        org_id=None
    )
    print(f"\nTurn 2 -> clarification_needed: {resp2.clarification_needed}")
    print(f"Turn 2 Reply: {resp2.reply_message}")
    # Either unverified clarification or match status
    assert "Brooklyn" in (resp2.applicant_profile.borough or "").title(), "Borough should be Brooklyn"

    # Turn 3: Disability and rent provided -> DRIE confirmed, clarification loop exits!
    resp3 = orchestrator.process_user_turn(
        "I have SSI disability benefits and my rent is 1400", 
        session_id=session_id,
        principal_id=session_id,
        principal_role="PublicApplicant",
        org_id=None
    )
    print(f"\nTurn 3 -> clarification_needed: {resp3.clarification_needed}")
    print(f"Turn 3 Reply: {resp3.reply_message}")
    assert resp3.clarification_needed is False, "Turn 3 must exit clarification loop (clarification_needed=False)"
    assert resp3.application_draft is not None, "Turn 3 must generate application pack for confirmed programs"
    print(f"Turn 3 Draft Programs: {resp3.application_draft.selected_programs}")
    print(f"Turn 3 Document Checklist: {[d.document_name for d in resp3.application_draft.consolidated_checklist]}")

    # Turn 4: User asks a question -> Informational response without looping
    resp4 = orchestrator.process_user_turn(
        "What documents do I need for this?", 
        session_id=session_id,
        principal_id=session_id,
        principal_role="PublicApplicant",
        org_id=None
    )
    print(f"\nTurn 4 -> clarification_needed: {resp4.clarification_needed}")
    print(f"Turn 4 Reply: {resp4.reply_message[:150]}...")
    assert resp4.clarification_needed is False, "Turn 4 question should not trigger clarification loop"


def test_loop_bound_safeguard():
    print("\n--- Test 4: Clarification Loop Upper-Bound (MAX_CLARIFICATION_ATTEMPTS) ---")
    session_id = "test_loop_bound_002"
    orchestrator.store.reset(session_id)

    # Turn 1: Clarification attempt 1
    resp1 = orchestrator.process_user_turn(
        "hello I need some money", 
        session_id=session_id,
        principal_id=session_id,
        principal_role="PublicApplicant",
        org_id=None
    )
    assert resp1.clarification_needed is True
    print(f"Turn 1 clarification_needed: {resp1.clarification_needed}")

    # Turn 2: Clarification attempt 2
    resp2 = orchestrator.process_user_turn(
        "I don't know my borough or income", 
        session_id=session_id,
        principal_id=session_id,
        principal_role="PublicApplicant",
        org_id=None
    )
    print(f"Turn 2 clarification_needed: {resp2.clarification_needed}")

    # Turn 3: Exceeded MAX_CLARIFICATION_ATTEMPTS -> Must NOT loop infinitely, must exit!
    resp3 = orchestrator.process_user_turn(
        "still not sure", 
        session_id=session_id,
        principal_id=session_id,
        principal_role="PublicApplicant",
        org_id=None
    )
    print(f"Turn 3 clarification_needed: {resp3.clarification_needed}")
    print(f"Turn 3 Reply: {resp3.reply_message[:150]}...")
    assert resp3.clarification_needed is False, "Loop must terminate after MAX_CLARIFICATION_ATTEMPTS"
    print("✓ Loop safety bound successfully exited without infinite cycle!")


if __name__ == "__main__":
    test_heuristic_extraction()
    test_matching_confidence_tiers()
    test_multi_turn_feedback_loop()
    test_loop_bound_safeguard()
    print("\n========================================================")
    print("ALL 4 CLARIFICATION & MATCHING TESTS PASSED PERFECTLY!")
    print("========================================================")