// ============================================================================
// Community Aid Navigator -- Production Cedar Policy Set
// ============================================================================

// ----------------------------------------------------------------------------
// 1. PublicApplicant: Public inquiries & self-service session scope
// ----------------------------------------------------------------------------
permit (
  principal in Role::"PublicApplicant",
  action in [
    Action::"searchPrograms",
    Action::"checkEligibility",
    Action::"getProgramRequirements"
  ],
  resource
);

permit (
  principal in Role::"PublicApplicant",
  action in [Action::"readOwnSession", Action::"deleteOwnSession", Action::"draftApplication"],
  resource
) when {
  resource.sessionOwnerId == principal.id
};

// ----------------------------------------------------------------------------
// 2. Caseworker: Public inquiries + Org-scoped case management
// ----------------------------------------------------------------------------
permit (
  principal in Role::"Caseworker",
  action in [
    Action::"searchPrograms",
    Action::"checkEligibility",
    Action::"getProgramRequirements"
  ],
  resource
);

permit (
  principal in Role::"Caseworker",
  action in [
    Action::"draftApplication",
    Action::"readApplicantRecord",
    Action::"exportApplication"
  ],
  resource
) when {
  resource.orgId == principal.orgId
};

// ----------------------------------------------------------------------------
// 3. PII Vault: Rehydration access & absolute barrier
// ----------------------------------------------------------------------------
permit (
  principal in Role::"PublicApplicant",
  action == Action::"readPiiVault",
  resource
) when {
  resource.sessionOwnerId == principal.id
};

permit (
  principal in Role::"Caseworker",
  action == Action::"readPiiVault",
  resource
) when {
  resource.orgId == principal.orgId
};

forbid (
  principal,
  action == Action::"readPiiVault",
  resource
) when {
  principal in Role::"Analyst" || principal is AuditAgent
};

// ----------------------------------------------------------------------------
// 4. AuditAgent: Exclusive synthetic replay permissions
// ----------------------------------------------------------------------------
permit (
  principal == AuditAgent::"bias-auditor",
  action == Action::"replaySyntheticProfiles",
  resource == Resource::"MatchingService"
);

// ----------------------------------------------------------------------------
// 5. Analyst: Aggregate metrics without PII
// ----------------------------------------------------------------------------
permit (
  principal in Role::"Analyst",
  action == Action::"readAuditMetrics",
  resource
) unless {
  resource.containsPII == true
};

// ----------------------------------------------------------------------------
// 6. Admin: Management & escalation (least privilege)
// ----------------------------------------------------------------------------
permit (
  principal in Role::"Admin",
  action == Action::"runAuditManually",
  resource == Resource::"MatchingService"
);

permit (
  principal in Role::"Admin",
  action == Action::"manageIndices",
  resource == Resource::"SearchIndex"
);

permit (
  principal in Role::"Admin",
  action == Action::"readApplicantRecord",
  resource
);

permit (
  principal in Role::"Analyst",
  action == Action::"readAuditMetrics",
  resource
) unless {
  resource.containsPII == true
};


// ----------------------------------------------------------------------------
// 7. Human Review Gate: Overrides self-service drafting on high-stakes aid
// ----------------------------------------------------------------------------
forbid (
  principal in Role::"PublicApplicant",
  action == Action::"draftApplication",
  resource
) when {
  resource.requiresHumanReview == true
};
