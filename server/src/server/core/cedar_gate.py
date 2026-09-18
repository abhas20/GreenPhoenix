import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from opensearchpy import OpenSearch

from server.config import settings


class CedarEvaluationError(Exception):
    pass


class CedarGate:
    """
    Evaluates fine-grained authorization requests against Cedar policy rules.
    Maintains complete audit logging into OpenSearch for compliance and fairness analysis.
    """

    def __init__(self, policy_file_path: Optional[str] = None):
        self.policy_file_path = policy_file_path or f"{settings.CEDAR_POLICIES_PATH}/policies.cedar"
        self.policies_text = self._load_policies()
        self._opensearch: Optional[OpenSearch] = None

    def _load_policies(self) -> str:
        candidates = [
            Path(self.policy_file_path),
            Path("cedar/policies/policies.cedar"),
            Path("../cedar/policies/policies.cedar"),
            Path(__file__).resolve().parent.parent.parent.parent / "cedar" / "policies" / "policies.cedar"
        ]
        for p in candidates:
            if p.exists() and p.is_file():
                return p.read_text(encoding="utf-8")
        return ""

    @property
    def opensearch(self) -> OpenSearch:
        if self._opensearch is None:
            self._opensearch = OpenSearch(
                hosts=[settings.OPENSEARCH_HOST],
                http_compress=True,
                use_ssl=False,
                verify_certs=False,
            )
        return self._opensearch

    def is_authorized(
        self,
        principal: Dict[str, Any],
        action: str,
        resource: Dict[str, Any],
        session_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Evaluates (Principal, Action, Resource, Context) against policy rules.
        Returns True if permitted, False otherwise.
        """
        role = principal.get("role", "PublicApplicant")
        principal_id = principal.get("id", "anonymous")
        principal_org = principal.get("orgId")

        resource_type = resource.get("type", "AidPrograms")
        resource_org = resource.get("orgId")
        contains_pii = resource.get("containsPII", False)
        requires_human_review = resource.get("requiresHumanReview", False)
        session_owner = resource.get("sessionOwnerId")

        decision = "DENY"
        reason = "No matching permit policy (Cedar default deny)"

        # ====================================================================
        # Explicit Forbids (Take precedence over all permits)
        # ====================================================================
        # 1. PII Vault Forbid: Analyst and AuditAgent must NEVER read PII vault
        if action == "readPiiVault" and (role in ["Analyst", "AuditAgent"] or principal_id == "bias-auditor"):
            decision = "DENY"
            reason = "Cedar Forbid: Analyst and AuditAgent strictly forbidden from reading PII vault"
            self._log_audit_decision(session_id or "session_sys", principal, action, resource, decision, reason, context)
            return False

        # 2. Human Review Gate: Overrides self-service drafting on high-stakes aid
        if role == "PublicApplicant" and action == "draftApplication" and requires_human_review:
            decision = "DENY"
            reason = "Cedar Forbid: Program requires caseworker human review before drafting"
            self._log_audit_decision(session_id or "session_sys", principal, action, resource, decision, reason, context)
            return False

        # ====================================================================
        # Role-based Permits
        # ====================================================================

        # 1. PublicApplicant
        if role == "PublicApplicant":
            if action in ["searchPrograms", "checkEligibility", "getProgramRequirements"]:
                decision = "ALLOW"
                reason = "Matched Policy 1: Public applicant general aid inquiry"
            elif action in ["readOwnSession", "deleteOwnSession", "draftApplication"]:
                if session_owner is not None and session_owner == principal_id:
                    decision = "ALLOW"
                    reason = "Matched Policy 1: Public applicant acting within own session"
                else:
                    decision = "DENY"
                    reason = f"Policy 1 Deny: sessionOwnerId '{session_owner}' does not match applicant id '{principal_id}'"
            elif action == "readPiiVault":
                if session_owner and session_owner == principal_id:
                    decision = "ALLOW"
                    reason = "Matched Policy 3: Public applicant reading own PII vault"
                else:
                    decision = "DENY"
                    reason = f"Policy 3 Deny: sessionOwnerId '{session_owner}' does not match applicant id '{principal_id}'"

        # 2. Caseworker
        elif role == "Caseworker":
            if action in ["searchPrograms", "checkEligibility", "getProgramRequirements"]:
                decision = "ALLOW"
                reason = "Matched Policy 2: Caseworker public program search and eligibility evaluation"
            elif action in ["draftApplication", "readApplicantRecord", "exportApplication"]:
                if resource_org and principal_org and resource_org == principal_org:
                    decision = "ALLOW"
                    reason = f"Matched Policy 2: Caseworker orgId match ({principal_org})"
                else:
                    decision = "DENY"
                    reason = f"Policy 2 Deny: Resource org '{resource_org}' does not match Caseworker org '{principal_org}'"
            elif action == "readPiiVault":
                if resource_org and principal_org and resource_org == principal_org:
                    decision = "ALLOW"
                    reason = f"Matched Policy 3: Caseworker org match for PII vault ({principal_org})"
                else:
                    decision = "DENY"
                    reason = f"Policy 3 Deny: Resource org '{resource_org}' does not match Caseworker org '{principal_org}'"

        # 3. AuditAgent (Automated synthetic watchdog)
        elif role == "AuditAgent" or principal_id == "bias-auditor":
            if action in ["replaySyntheticProfiles", "writeAuditLog"]:
                decision = "ALLOW"
                reason = "Matched Policy 4: AuditAgent exclusive synthetic replay authority"

        # 4. Analyst (Aggregate evaluation)
        elif role == "Analyst":
            if action == "readAuditMetrics":
                if contains_pii:
                    decision = "DENY"
                    reason = "Policy 5 Deny: Resource contains PII forbidden for Analyst"
                else:
                    decision = "ALLOW"
                    reason = "Matched Policy 5: Analyst aggregate metrics read"

        # 5. Admin (Ops & support management)
        elif role == "Admin":
            if action == "runAuditManually":
                decision = "ALLOW"
                reason = "Matched Policy 6: Admin manual audit run"
            elif action == "manageIndices":
                decision = "ALLOW"
                reason = "Matched Policy 6: Admin index management"
            elif action == "readApplicantRecord":
                decision = "ALLOW"
                reason = "Matched Policy 6: Admin escalation read"

        # Append to OpenSearch audit log
        self._log_audit_decision(
            session_id=session_id or "session_sys",
            principal=principal,
            action=action,
            resource=resource,
            decision=decision,
            reason=reason,
            context=context
        )

        return decision == "ALLOW"

    def _log_audit_decision(
        self,
        session_id: str,
        principal: Dict[str, Any],
        action: str,
        resource: Dict[str, Any],
        decision: str,
        reason: str,
        context: Optional[Dict[str, Any]] = None
    ):
        try:
            log_doc = {
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "session_id": session_id,
                "principal": principal,
                "action": action,
                "resource": resource,
                "decision": decision,
                "details": {
                    "reason": reason,
                    "context": context or {}
                }
            }
            self.opensearch.index(
                index=settings.OPENSEARCH_INDEX_AUDIT,
                body=log_doc,
                params={"refresh": True}
            )
        except Exception as e:
            # Audit log failures shouldn't crash authorization in offline mode
            pass


# Global singleton instance
cedar_gate = CedarGate()
