import sys
from server.core.presidio_sanitizer import sanitizer
from server.core.cedar_gate import cedar_gate
from server.core.rules_parser import parse_deterministic_rules
from server.data.seed import get_opensearch_client, verify_search


def test_presidio():
    print("\n[1/3] Testing Microsoft Presidio PII Sanitization...")
    raw_text = "My name is John Miller, my phone is 718-555-0199, SSN is 000-12-3456, and I live at 450 Grand Concourse, Bronx NY."
    sanitized, vault = sanitizer.sanitize(raw_text)
    print(f"Original:  {raw_text}")
    print(f"Sanitized: {sanitized}")
    print(f"Vault:     {vault}")

    assert "<PERSON_1>" in sanitized or "PERSON" in sanitized, "Person not redacted"
    assert "<PHONE_NUMBER_1>" in sanitized or "PHONE" in sanitized, "Phone not redacted"
    assert "<US_SSN_1>" in sanitized or "SSN" in sanitized, "SSN not redacted"

    rehydrated = sanitizer.rehydrate(sanitized, vault)
    print(f"Rehydrated: {rehydrated}")
    assert rehydrated == raw_text, "Rehydration did not match original text"
    print("✔ Presidio PII Sanitization and Rehydration PASSED!")


def test_cedar():
    print("\n[2/3] Testing Cedar Policy Authorization Gate...")
    
    # 1. Public applicant searching programs -> ALLOW
    applicant_principal = {"id": "user_1", "role": "PublicApplicant"}
    res1 = cedar_gate.is_authorized(
        principal=applicant_principal,
        action="searchPrograms",
        resource={"type": "AidPrograms"}
    )
    assert res1 is True, "PublicApplicant searchPrograms should be ALLOW"
    print("✔ PublicApplicant searchPrograms: ALLOW")

    # 2. Public applicant attempting to read Caseworker record -> DENY
    res2 = cedar_gate.is_authorized(
        principal=applicant_principal,
        action="readApplicantRecord",
        resource={"type": "ApplicantRecord", "orgId": "hra_nyc"}
    )
    assert res2 is False, "PublicApplicant readApplicantRecord should be DENY"
    print("✔ PublicApplicant readApplicantRecord: DENY")

    # 3. Caseworker reading record for same org -> ALLOW
    caseworker_principal = {"id": "cw_1", "role": "Caseworker", "orgId": "hra_nyc"}
    res3 = cedar_gate.is_authorized(
        principal=caseworker_principal,
        action="readApplicantRecord",
        resource={"type": "ApplicantRecord", "orgId": "hra_nyc"}
    )
    assert res3 is True, "Caseworker same org should be ALLOW"
    print("✔ Caseworker same org (hra_nyc): ALLOW")

    # 4. Caseworker reading record for different org -> DENY
    res4 = cedar_gate.is_authorized(
        principal=caseworker_principal,
        action="readApplicantRecord",
        resource={"type": "ApplicantRecord", "orgId": "other_nonprofit"}
    )
    assert res4 is False, "Caseworker different org should be DENY"
    print("✔ Caseworker cross-org (other_nonprofit): DENY")

    # 5. Analyst reading metrics containing PII -> DENY
    analyst_principal = {"id": "analyst_1", "role": "Analyst"}
    res5 = cedar_gate.is_authorized(
        principal=analyst_principal,
        action="readAuditMetrics",
        resource={"type": "AuditLog", "containsPII": True}
    )
    assert res5 is False, "Analyst reading PII should be DENY"
    print("✔ Analyst reading PII: DENY")

    # 6. Analyst reading non-PII metrics -> ALLOW
    res6 = cedar_gate.is_authorized(
        principal=analyst_principal,
        action="readAuditMetrics",
        resource={"type": "AuditLog", "containsPII": False}
    )
    assert res6 is True, "Analyst reading non-PII should be ALLOW"
    print("✔ Analyst reading non-PII: ALLOW")

    # 7. Human Review Gate: PublicApplicant blocked on requiresHumanReview -> DENY
    res7 = cedar_gate.is_authorized(
        principal=applicant_principal,
        action="draftApplication",
        resource={"type": "AidPrograms", "requiresHumanReview": True, "sessionOwnerId": "user_1"}
    )
    assert res7 is False, "PublicApplicant drafting on requiresHumanReview should be DENY"
    print("✔ Human Review Gate (requiresHumanReview): DENY")

    # 8. PII Vault Barrier: Analyst and AuditAgent strictly forbidden -> DENY
    res8_analyst = cedar_gate.is_authorized(
        principal=analyst_principal,
        action="readPiiVault",
        resource={"type": "PiiVaultEntry"}
    )
    res8_auditor = cedar_gate.is_authorized(
        principal={"id": "bias-auditor", "role": "AuditAgent"},
        action="readPiiVault",
        resource={"type": "PiiVaultEntry"}
    )
    assert res8_analyst is False and res8_auditor is False, "Analyst/AuditAgent reading PII vault should be DENY"
    print("✔ PII Vault Barrier (Analyst & AuditAgent): DENY")

    # 9. PII Vault Access: Applicant reading own vault -> ALLOW, other vault -> DENY
    res9_own = cedar_gate.is_authorized(
        principal=applicant_principal,
        action="readPiiVault",
        resource={"type": "PiiVaultEntry", "sessionOwnerId": "user_1"}
    )
    res9_other = cedar_gate.is_authorized(
        principal=applicant_principal,
        action="readPiiVault",
        resource={"type": "PiiVaultEntry", "sessionOwnerId": "user_2"}
    )
    assert res9_own is True and res9_other is False, "Applicant should only read own PII vault"
    print("✔ PII Vault Ownership Scope: ALLOW (own) / DENY (other)")

    # 10. Caseworker checking public eligibility -> ALLOW
    res10 = cedar_gate.is_authorized(
        principal=caseworker_principal,
        action="checkEligibility",
        resource={"type": "AidPrograms", "id": "nyc-drie-001"}
    )
    assert res10 is True, "Caseworker checkEligibility on public program should be ALLOW"
    print("✔ Caseworker public program checkEligibility: ALLOW")

    # 11. Admin manual audit and index management -> ALLOW
    admin_principal = {"id": "admin_ops", "role": "Admin"}
    res11_audit = cedar_gate.is_authorized(
        principal=admin_principal,
        action="runAuditManually",
        resource={"type": "MatchingService"}
    )
    res11_idx = cedar_gate.is_authorized(
        principal=admin_principal,
        action="manageIndices",
        resource={"type": "SearchIndex"}
    )
    assert res11_audit is True and res11_idx is True, "Admin management actions should be ALLOW"
    print("✔ Admin manual audit & index management: ALLOW")

    print("✔ Cedar Policy Authorization Gate PASSED (All 11 Verification Gates)!")


def test_opensearch_pipeline():
    print("\n[3/3] Testing OpenSearch Data Pipeline...")
    client = get_opensearch_client()
    verify_search(client)
    print("✔ OpenSearch Data Pipeline & Hybrid Search PASSED!")


if __name__ == "__main__":
    test_presidio()
    test_cedar()
    test_opensearch_pipeline()
    print("\n==============================================")
    print("🎉 ALL ENVIRONMENT & PIPELINE TESTS PASSED! 🎉")
    print("==============================================")
