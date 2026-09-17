import sys
from server.agents.intake_agent import extract_profile
from server.agents.matching_agent import match_programs
from server.agents.document_agent import generate_application_pack
from server.agents.audit_agent import run_bias_audit
from server.agents.orchestrator import orchestrator


def test_agentic_orchestration():
    print("\n========================================================")
    print("🤖 TESTING STRANDS AGENTIC ORCHESTRATION LAYER 🤖")
    print("========================================================")

    # 1. Test Intake Clarification Loop (Turn 1: Missing borough and income)
    partial_prompt = "Hello, I am in crisis and facing eviction. What emergency rent help can I get?"

    print("\n[Turn 1] Testing Intake Clarification Loop...")
    turn1_resp = orchestrator.process_user_turn(partial_prompt, session_id="test_session_001")
    print(f"💬 Turn 1 Agent Reply: {turn1_resp.reply_message}")
    print(f"   Clarification Needed: {turn1_resp.clarification_needed}")
    print(f"   Missing Fields: {turn1_resp.applicant_profile.missing_critical_fields}")
    assert turn1_resp.clarification_needed is True, "Turn 1 should trigger clarification when location/income missing"

    # 2. Test Full Pipeline Execution (Turn 2: Complete Profile with household size)
    complete_prompt = (
        "Hi, my name is John Doe, living in Brooklyn alone (household size 1) with SSI disability benefits. "
        "My annual income is $24,000 and my monthly rent is $1,400. "
        "I need help with emergency rent freeze and housing assistance."
    )

    print("\n[Turn 2] Running Full Matching & Document Generation...")
    turn2_resp = orchestrator.process_user_turn(complete_prompt, session_id="test_session_001")

    print(f"\n💬 Turn 2 Agent Reply:")
    print(f"   {turn2_resp.reply_message}")
    print(f"\n📋 Extracted Applicant Profile:")
    print(f"   Borough: {turn2_resp.applicant_profile.borough}")
    print(f"   Household Size: {turn2_resp.applicant_profile.household_size}")
    print(f"   Income: ${turn2_resp.applicant_profile.annual_income:,.0f}")
    print(f"   Has Disability: {turn2_resp.applicant_profile.has_disability_benefits}")
    print(f"   Primary Needs: {turn2_resp.applicant_profile.primary_needs}")

    assert turn2_resp.matching_result is not None, "Matching result should not be None"
    matches = turn2_resp.matching_result.ranked_programs
    print(f"\n🎯 Evaluated {len(matches)} Programs via OpenSearch Hybrid Search & Rule Engine:")
    eligible_count = 0
    for m in matches:
        status_icon = "✔ ELIGIBLE" if m.is_deterministically_eligible else "✖ NOT ELIGIBLE"
        print(f"   [{status_icon}] {m.name} ({m.program_id}) - Confidence: {m.match_confidence:.2f}")
        print(f"      Reason: {m.plain_language_reason}")
        if m.is_deterministically_eligible:
            eligible_count += 1

    assert eligible_count > 0, "Should have at least 1 eligible match (e.g. DRIE)"

    # Check Document Checklist
    assert turn2_resp.application_draft is not None, "Application draft should not be None"
    print(f"\n📑 Generated Document Checklist ({len(turn2_resp.application_draft.consolidated_checklist)} items):")
    for doc in turn2_resp.application_draft.consolidated_checklist:
        print(f"   • {doc.document_name}: {doc.tips_for_applicant}")

    # 3. Test Interactive Follow-Up / Eligibility Detail QA (Turn 3)
    follow_up_prompt = "Can you explain why I did not qualify for SCRIE, and what makes DRIE a better fit for me?"
    print("\n[Turn 3] Testing Interactive User Follow-up Question on Eligibility...")
    turn3_resp = orchestrator.process_user_turn(follow_up_prompt, session_id="test_session_001")
    print(f"\n💬 Turn 3 Agent Reply:")
    print(f"   {turn3_resp.reply_message}")

    assert turn3_resp.reply_message is not None and len(turn3_resp.reply_message) > 50, "Turn 3 should provide a comprehensive answer"
    assert "scrie" in turn3_resp.reply_message.lower() or "drie" in turn3_resp.reply_message.lower() or "age" in turn3_resp.reply_message.lower(), "Should explain SCRIE age criteria or DRIE disability fit"
    assert turn3_resp.matching_result is not None, "Prior matching results should be retained in the session"

    # 4. Test Out-of-band Bias-Audit Agent
    print("\n[Step 4] Testing Bias-Audit Agent (Synthetic Multilingual Replays)...")
    audit_report = run_bias_audit(batch_size=4) # use mode="agentic" for full agentic orchestration audit
    print(f"   Audit Run ID: {audit_report.run_id}")
    print(f"   Status: {audit_report.fairness_status}")
    print(f"   Disparate Impact Ratio (DIR): {audit_report.disparate_impact_ratio:.2f}")
    print(f"   Summary: {audit_report.disparity_summary}")

    assert audit_report.disparate_impact_ratio >= 0.80, f"Fairness disparity detected: DIR={audit_report.disparate_impact_ratio}"

    print("\n========================================================")
    print("🎉 STRANDS AGENTIC ORCHESTRATION TESTS PASSED 100%! 🎉")
    print("========================================================\n")


if __name__ == "__main__":
    test_agentic_orchestration()
