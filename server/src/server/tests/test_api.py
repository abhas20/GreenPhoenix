import jwt
import secrets
from fastapi.testclient import TestClient

from server.main import app
from server.config import settings
from server.core.auth import create_access_token
from server.agents.orchestrator import orchestrator, SessionState
from server.agents.intake_agent import ApplicantProfile
from server.core.rate_limit import get_redis_client
from server.core.user_store import ensure_user_table

client = TestClient(app)


def test_health_check():
    print("\n--- 1. Testing /health Probe ---")
    response = client.get("/health")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    print("Health response:", data)
    assert data["status"] == "healthy"
    assert data["opensearch"] in ["green", "yellow", "connected"]
    assert data["redis"] == "connected"
    print("✔ Healthcheck PASSED!")


def test_session_cookie_middleware_and_ownership_isolation():
    print("\n--- 2. Testing Session Cookie Middleware & Strict Cedar Ownership ---")
    # 2.1 Middleware attaches HttpOnly session cookie on non-chat endpoint
    res_search = client.get("/api/v1/programs/search?query=rent&limit=1")
    assert res_search.status_code == 200
    assert settings.SESSION_COOKIE_NAME in res_search.cookies, "Expected session cookie automatically attached by middleware"
    auto_cookie = res_search.cookies[settings.SESSION_COOKIE_NAME]
    assert len(auto_cookie) >= 32, f"Expected strong session ID, got: {auto_cookie}"
    print(f"✔ Middleware auto-minted aid_session cookie: {auto_cookie[:16]}...")

    # 2.2 Setup two distinct user sessions in orchestrator store
    sess_alice = secrets.token_urlsafe(32)
    sess_bob = secrets.token_urlsafe(32)

    orchestrator.store.save(SessionState(
        session_id=sess_alice,
        applicant_profile=ApplicantProfile(borough="manhattan", annual_income=25000.0, primary_needs=["housing"])
    ))
    orchestrator.store.save(SessionState(
        session_id=sess_bob,
        applicant_profile=ApplicantProfile(borough="bronx", annual_income=15000.0, primary_needs=["food"])
    ))

    # 2.3 Alice reads her own session via /chat/session -> ALLOW (200)
    res_alice_self = client.get("/api/v1/chat/session", cookies={settings.SESSION_COOKIE_NAME: sess_alice})
    assert res_alice_self.status_code == 200
    assert res_alice_self.json()["applicant_profile"]["borough"] == "manhattan"
    print("✔ Alice reads own session implicitly: ALLOW (200)")

    # 2.4 Alice reads her own session via explicit path /chat/session/{sess_alice} -> ALLOW (200)
    res_alice_path = client.get(f"/api/v1/chat/session/{sess_alice}", cookies={settings.SESSION_COOKIE_NAME: sess_alice})
    assert res_alice_path.status_code == 200
    assert res_alice_path.json()["applicant_profile"]["borough"] == "manhattan"
    print("✔ Alice reads own session explicitly by ID: ALLOW (200)")

    # 2.5 Alice attempts to read Bob's session via /chat/session/{sess_bob} -> DENY (403 Forbidden via Cedar)
    res_alice_reads_bob = client.get(f"/api/v1/chat/session/{sess_bob}", cookies={settings.SESSION_COOKIE_NAME: sess_alice})
    assert res_alice_reads_bob.status_code == 403, f"Expected 403, got {res_alice_reads_bob.status_code}: {res_alice_reads_bob.text}"
    print("✔ Alice attempts cross-session read of Bob's session: DENY (403 Forbidden via Cedar Gate)")

    # 2.6 Alice attempts to delete Bob's session via /chat/session/{sess_bob} -> DENY (403 Forbidden via Cedar)
    res_alice_deletes_bob = client.delete(f"/api/v1/chat/session/{sess_bob}", cookies={settings.SESSION_COOKIE_NAME: sess_alice})
    assert res_alice_deletes_bob.status_code == 403, f"Expected 403, got {res_alice_deletes_bob.status_code}"
    print("✔ Alice attempts cross-session delete of Bob's session: DENY (403 Forbidden via Cedar Gate)")

    # 2.7 Clean up Alice's own session via DELETE /chat/session
    res_del_alice = client.delete("/api/v1/chat/session", cookies={settings.SESSION_COOKIE_NAME: sess_alice})
    assert res_del_alice.status_code == 200
    print("✔ Alice purges her own session & expires cookie: PASSED")


def test_malformed_jwt_security():
    print("\n--- 3. Testing Strict JWT Claim Validation & Rejections ---")
    # 3.1 Token missing 'sub'
    token_missing_sub = jwt.encode({"role": "Analyst"}, settings.SECRET_KEY, algorithm="HS256")
    res1 = client.get("/api/v1/audit/metrics", headers={"Authorization": f"Bearer {token_missing_sub}"})
    assert res1.status_code == 401, f"Expected 401 for missing 'sub', got {res1.status_code}"
    assert "missing required 'sub'" in res1.json()["detail"]
    print("✔ Token missing 'sub' claim: REJECTED (401)")

    # 3.2 Token missing 'role'
    token_missing_role = jwt.encode({"sub": "analyst_01"}, settings.SECRET_KEY, algorithm="HS256")
    res2 = client.get("/api/v1/audit/metrics", headers={"Authorization": f"Bearer {token_missing_role}"})
    assert res2.status_code == 401, f"Expected 401 for missing 'role', got {res2.status_code}"
    assert "missing or invalid 'role'" in res2.json()["detail"]
    print("✔ Token missing 'role' claim: REJECTED (401)")

    # 3.3 Token with invalid / unknown role
    token_bad_role = jwt.encode({"sub": "user_01", "role": "HackerAdmin"}, settings.SECRET_KEY, algorithm="HS256")
    res3 = client.get("/api/v1/audit/metrics", headers={"Authorization": f"Bearer {token_bad_role}"})
    assert res3.status_code == 401, f"Expected 401 for invalid role, got {res3.status_code}"
    print("✔ Token with invalid role claim: REJECTED (401)")

    # 3.4 Caseworker token missing 'orgId'
    token_cw_no_org = jwt.encode({"sub": "cw_01", "role": "Caseworker"}, settings.SECRET_KEY, algorithm="HS256")
    res4 = client.get("/api/v1/caseworker/cases", headers={"Authorization": f"Bearer {token_cw_no_org}"})
    assert res4.status_code == 401, f"Expected 401 for Caseworker without orgId, got {res4.status_code}"
    assert "orgId" in res4.json()["detail"]
    print("✔ Caseworker token missing 'orgId' claim: REJECTED (401)")

    # 3.5 Tampered / forged signature
    tampered_token = create_access_token(sub="admin_01", role="Admin") + "tampered"
    res5 = client.get("/api/v1/audit/metrics", headers={"Authorization": f"Bearer {tampered_token}"})
    assert res5.status_code == 401, f"Expected 401 for forged token, got {res5.status_code}"
    print("✔ Tampered JWT token signature: REJECTED (401)")


def test_public_chat_cookie_flow():
    print("\n--- 4. Testing Public Chat Turn & Multi-Turn Conversation ---")
    # Turn 1: Send initial crisis message with missing borough/income
    turn1_payload = {"message": "Hello, I am facing eviction. What emergency rent help can I get?"}
    res1 = client.post("/api/v1/chat/turn", json=turn1_payload)
    assert res1.status_code == 200, f"Expected 200, got {res1.status_code}: {res1.text}"

    # Verify HttpOnly Cookie was set
    assert settings.SESSION_COOKIE_NAME in res1.cookies, "Expected aid_session cookie in response"
    session_id = res1.cookies[settings.SESSION_COOKIE_NAME]
    print(f"✔ Received session cookie: {session_id[:16]}...")

    data1 = res1.json()
    assert data1["clarification_needed"] is True, "Turn 1 should need clarification"
    assert "income" in data1["applicant_profile"]["missing_critical_fields"] or "borough" in data1["applicant_profile"]["missing_critical_fields"]
    print(f"✔ Turn 1 Clarification Reply: {data1['reply_message'][:60]}...")

    # Turn 2: Provide complete details using the cookie
    turn2_payload = {
        "message": "I live in Brooklyn alone with SSI disability. Income is $24,000 and rent is $1,400. Need rent freeze."
    }
    res2 = client.post("/api/v1/chat/turn", json=turn2_payload, cookies={settings.SESSION_COOKIE_NAME: session_id})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["applicant_profile"]["borough"] == "brooklyn"
    assert data2["applicant_profile"]["annual_income"] == 24000.0
    assert data2["matching_result"] is not None
    print(f"✔ Turn 2 Evaluated {len(data2['matching_result']['ranked_programs'])} programs")

    # Read Session
    res_sess = client.get("/api/v1/chat/session", cookies={settings.SESSION_COOKIE_NAME: session_id})
    assert res_sess.status_code == 200
    sess_data = res_sess.json()
    assert sess_data["applicant_profile"]["borough"] == "brooklyn"
    print("✔ Read session state from Redis: PASSED")

    # Delete Session
    res_del = client.delete("/api/v1/chat/session", cookies={settings.SESSION_COOKIE_NAME: session_id})
    assert res_del.status_code == 200
    print("✔ Delete session & expire cookie: PASSED")


def test_programs_endpoints():
    print("\n--- 5. Testing Aid Programs Endpoints ---")
    # Search
    search_res = client.get("/api/v1/programs/search?query=rent+disability+freeze+brooklyn&limit=3")
    assert search_res.status_code == 200, f"Search failed: {search_res.text}"
    programs = search_res.json()
    assert len(programs) > 0, "Expected at least 1 matching program"
    first_pid = programs[0]["program_id"]
    print(f"✔ Search returned {len(programs)} programs (Top: {first_pid})")

    # Details
    det_res = client.get(f"/api/v1/programs/{first_pid}")
    assert det_res.status_code == 200
    print(f"✔ Program metadata retrieved for {first_pid}")

    # Eligibility Check
    elig_payload = {
        "annual_income": 24000.0,
        "household_size": 1,
        "region": "brooklyn",
        "has_disability_benefits": True,
        "disability_benefit_types": ["SSI"],
        "monthly_rent": 1400.0
    }
    elig_res = client.post(f"/api/v1/programs/{first_pid}/check-eligibility", json=elig_payload)
    assert elig_res.status_code == 200
    elig_data = elig_res.json()
    print(f"✔ Direct deterministic check result for {first_pid}: eligible={elig_data.get('eligible')}")


def test_caseworker_org_scoping_and_pii_reveal():
    print("\n--- 6. Testing Caseworker Cedar Org Scoping & PII Reveal ---")
    hra_token = create_access_token(sub="cw_hra_01", role="Caseworker", org_id="hra_nyc", name="HRA Worker")
    queens_token = create_access_token(sub="cw_queens_01", role="Caseworker", org_id="queens_cbo", name="Queens Worker")
    analyst_token = create_access_token(sub="analyst_01", role="Analyst", name="Policy Analyst")

    # 1. HRA Caseworker creates a case
    case_payload = {
        "client_name": "Maria Hernandez",
        "client_phone": "212-555-0188",
        "summary": "Elderly resident in Brooklyn needing eviction prevention and rent freeze.",
        "borough": "brooklyn",
        "annual_income": 18000.0,
        "monthly_rent": 1100.0,
        "has_disability_benefits": True,
        "primary_needs": ["housing", "rent"]
    }
    res_create = client.post(
        "/api/v1/caseworker/cases",
        json=case_payload,
        headers={"Authorization": f"Bearer {hra_token}"}
    )
    assert res_create.status_code == 200, f"Failed to create case: {res_create.text}"
    case_data = res_create.json()
    case_id = case_data["case_id"]
    assert "client_name_real" not in case_data, "Expected client_name_real to be redacted from create response"
    assert "client_name_masked" in case_data, "Expected client_name_masked to be present in create response"
    print(f"✔ Created case {case_id} under org 'hra_nyc' (PII redacted)")

    # 2. Same-org caseworker reads the case -> ALLOW (200, PII-redacted)
    res_same = client.get(
        f"/api/v1/caseworker/cases/{case_id}",
        headers={"Authorization": f"Bearer {hra_token}"}
    )
    assert res_same.status_code == 200
    assert "client_name_real" not in res_same.json(), "Expected client_name_real to be redacted from get case response"
    assert "client_name_masked" in res_same.json(), "Expected client_name_masked to be present"
    print("✔ Same-org Caseworker access (hra_nyc): ALLOW (200, PII-redacted)")

    # 3. Different-org caseworker reads the case -> DENY (403 Forbidden via Cedar)
    res_diff = client.get(
        f"/api/v1/caseworker/cases/{case_id}",
        headers={"Authorization": f"Bearer {queens_token}"}
    )
    assert res_diff.status_code == 403, f"Expected 403, got {res_diff.status_code}"
    print("✔ Cross-org Caseworker access (queens_cbo): DENY (403 Forbidden)")

    # 4. Analyst attempts to read case record -> DENY (403 Forbidden via Cedar)
    res_analyst = client.get(
        f"/api/v1/caseworker/cases/{case_id}",
        headers={"Authorization": f"Bearer {analyst_token}"}
    )
    assert res_analyst.status_code == 403
    print("✔ Analyst reading case record: DENY (403 Forbidden)")

    # 5. HRA Caseworker reveals PII on-demand -> ALLOW (200) + Cedar Policy 3 audit log
    res_reveal = client.post(
        f"/api/v1/caseworker/cases/{case_id}/reveal-pii",
        headers={"Authorization": f"Bearer {hra_token}"}
    )
    assert res_reveal.status_code == 200
    reveal_data = res_reveal.json()
    assert reveal_data["client_name"] == "Maria Hernandez"
    assert reveal_data["client_phone"] == "212-555-0188"
    assert reveal_data["audit_logged"] is True
    print("✔ Caseworker on-demand PII unmasking: ALLOW (200, rehydrated)")

    # 6. Cross-org caseworker attempts PII reveal -> DENY (403 Forbidden)
    res_reveal_diff = client.post(
        f"/api/v1/caseworker/cases/{case_id}/reveal-pii",
        headers={"Authorization": f"Bearer {queens_token}"}
    )
    assert res_reveal_diff.status_code == 403
    print("✔ Cross-org PII reveal barrier: DENY (403 Forbidden)")

    # 7. Same-org caseworker exports full case dossier -> ALLOW (200, unredacted)
    res_export = client.get(
        f"/api/v1/caseworker/cases/{case_id}/export",
        headers={"Authorization": f"Bearer {hra_token}"}
    )
    assert res_export.status_code == 200
    export_data = res_export.json()
    assert export_data["case_data"]["client_name_real"] == "Maria Hernandez"
    print("✔ Same-org Caseworker export dossier: ALLOW (200, dual Cedar permit)")

    # 8. Cross-org caseworker attempts export -> DENY (403 Forbidden)
    res_export_diff = client.get(
        f"/api/v1/caseworker/cases/{case_id}/export",
        headers={"Authorization": f"Bearer {queens_token}"}
    )
    assert res_export_diff.status_code == 403
    print("✔ Cross-org export barrier: DENY (403 Forbidden)")


def test_audit_endpoints_and_cedar_guard():
    print("\n--- 7. Testing Audit Watchdog Endpoints & Role Guard ---")
    admin_token = create_access_token(sub="admin_01", role="Admin", name="Super Admin")
    analyst_token = create_access_token(sub="analyst_01", role="Analyst", name="Data Analyst")

    # Analyst reads metrics -> ALLOW
    res_metrics = client.get("/api/v1/audit/metrics", headers={"Authorization": f"Bearer {analyst_token}"})
    assert res_metrics.status_code == 200
    print("✔ Analyst reading aggregate audit metrics: ALLOW (200)")

    # Analyst triggers manual audit -> DENY (403 Forbidden, only Admin can trigger)
    res_audit_analyst = client.post(
        "/api/v1/audit/run",
        json={"batch_size": 4, "mode": "deterministic"},
        headers={"Authorization": f"Bearer {analyst_token}"}
    )
    assert res_audit_analyst.status_code == 403
    print("✔ Analyst triggering manual audit: DENY (403 Forbidden)")

    # Admin triggers manual audit -> ALLOW (200)
    res_audit_admin = client.post(
        "/api/v1/audit/run",
        json={"batch_size": 4, "mode": "deterministic"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_audit_admin.status_code == 200
    audit_data = res_audit_admin.json()
    assert audit_data["fairness_status"] in ["PASSED_FAIRNESS", "DISPARITY_ALERT"]
    print(f"✔ Admin triggering manual audit: ALLOW (200, status={audit_data['fairness_status']}, DIR={audit_data['disparate_impact_ratio']})")

    # Analyst reads detailed historical audit report -> ALLOW (200, PII & profiles stripped)
    run_id = audit_data["run_id"]
    res_report = client.get(
        f"/api/v1/audit/reports/{run_id}",
        headers={"Authorization": f"Bearer {analyst_token}"}
    )
    assert res_report.status_code == 200
    report_data = res_report.json()
    assert report_data["run_id"] == run_id
    assert "detailed_cases" in report_data
    for c in report_data["detailed_cases"]:
        assert "profile" not in c, "Expected applicant profile to be stripped from Analyst view"
        assert "narrative" not in c, "Expected raw narrative to be stripped"
        assert "scenario_name" in c
        assert "matched_program_ids" in c
    print("✔ Analyst reading historical report: ALLOW (200, PII & applicant profiles stripped)")


def test_sliding_window_rate_limiting_and_cookie_dropping_defense():
    print("\n--- 8. Testing True Sliding Window & Anti-Cookie-Dropping Defense ---")
    from unittest.mock import patch
    from server.agents.orchestrator import NavigatorResponse

    dummy_nav_res = NavigatorResponse(
        session_id="dummy_sess",
        reply_message="Mock rate limiter probe reply",
        clarification_needed=False,
        applicant_profile=ApplicantProfile(summary="Rate limit probe")
    )

    with patch.object(orchestrator, "process_user_turn", return_value=dummy_nav_res):
        # ------------------------------------------------------------------------
        # Part A: Session Rate Limit (15 turns / minute per session)
        # ------------------------------------------------------------------------
        ip_session = f"198.51.100.{secrets.randbelow(100) + 10}"
        test_session = secrets.token_urlsafe(32)

        # 1. Send 15 rapid requests with the SAME session
        for i in range(15):
            res = client.post(
                "/api/v1/chat/turn",
                json={"message": f"Session request {i}"},
                cookies={settings.SESSION_COOKIE_NAME: test_session},
                headers={"X-Forwarded-For": ip_session}
            )
            assert res.status_code == 200, f"Request {i+1} should succeed within limit, got {res.status_code}"

        print("✔ First 15 requests under session limit succeeded (200 OK)")

        # 2. 16th request with that same session -> BLOCKED (429 - session limit)
        res_sess_exceeded = client.post(
            "/api/v1/chat/turn",
            json={"message": "Exceeding session limit request"},
            cookies={settings.SESSION_COOKIE_NAME: test_session},
            headers={"X-Forwarded-For": ip_session}
        )
        assert res_sess_exceeded.status_code == 429, f"Expected 429 Too Many Requests, got {res_sess_exceeded.status_code}"
        assert "session" in res_sess_exceeded.json()["detail"].lower(), "Expected session rate limit message"
        assert "Retry-After" in res_sess_exceeded.headers, "Expected Retry-After header in 429 response"
        print(f"✔ 16th request blocked: 429 Session Limit Exceeded (Retry-After: {res_sess_exceeded.headers.get('Retry-After')}s)")

        # ------------------------------------------------------------------------
        # Part B: IP Network Rate Limit (80 requests / min) & Cookie-Dropping Defense
        # Attacker tries to bypass the 15-turn session limit by rotating sessions or
        # dropping cookies. The IP network limit (80) stops them.
        # ------------------------------------------------------------------------
        ip_network = f"203.0.113.{secrets.randbelow(200) + 10}"

        # Attacker sends 80 requests from ip_network, each with a DIFFERENT session
        for j in range(80):
            ephemeral_session = f"attacker_sess_{secrets.token_hex(8)}"
            res_attacker = client.post(
                "/api/v1/chat/turn",
                json={"message": f"Attacker probe {j}"},
                cookies={settings.SESSION_COOKIE_NAME: ephemeral_session},
                headers={"X-Forwarded-For": ip_network}
            )
            assert res_attacker.status_code == 200, f"Attacker probe {j+1} should succeed, got {res_attacker.status_code}"

        print("✔ 80 requests across rotating sessions from same IP succeeded (200 OK)")

        # 81st request from that same IP (even with NO cookie or a fresh session) -> BLOCKED (429 - network limit)
        res_ip_exceeded = client.post(
            "/api/v1/chat/turn",
            json={"message": "81st request from saturated IP"},
            headers={"X-Forwarded-For": ip_network}
        )
        assert res_ip_exceeded.status_code == 429, f"Expected 429 via IP rate limit, got {res_ip_exceeded.status_code}"
        assert "network" in res_ip_exceeded.json()["detail"].lower(), "Expected network rate limit message"
        assert "Retry-After" in res_ip_exceeded.headers, "Expected Retry-After header in 429 response"
        print(f"✔ 81st request blocked: 429 Network Limit Exceeded (Retry-After: {res_ip_exceeded.headers.get('Retry-After')}s)")
        print("✔ Cookie-dropping bypass blocked: IP rate limiting enforced 429 across fresh session mints!")


def test_auth_registration_and_login():
    print("\n--- 9. Testing DynamoDB Auth: Registration, Login & Role Scoping ---")
    ensure_user_table()
    unique_suffix = secrets.token_hex(4)
    cw_email = f"caseworker_{unique_suffix}@nycaid.org"
    analyst_email = f"analyst_{unique_suffix}@nycaid.org"
    password = "SuperSecretPassword123!"

    # 1. Invalid role rejection
    res_bad_role = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"bad_role_{unique_suffix}@nycaid.org",
            "password": password,
            "name": "Bad Role User",
            "role": "SuperHacker"
        }
    )
    assert res_bad_role.status_code == 400, f"Expected 400, got {res_bad_role.status_code}"
    print("✔ Invalid role rejection: 400 Bad Request")

    # 2. Caseworker without org_id rejection
    res_no_org = client.post(
        "/api/v1/auth/register",
        json={
            "email": cw_email,
            "password": password,
            "name": "Jane Caseworker",
            "role": "Caseworker"
        }
    )
    assert res_no_org.status_code == 400, f"Expected 400, got {res_no_org.status_code}"
    assert "org_id" in res_no_org.json()["detail"].lower()
    print("✔ Caseworker without org_id rejection: 400 Bad Request")

    # 3. Successful Caseworker Registration
    res_cw_reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": cw_email,
            "password": password,
            "name": "Jane Caseworker",
            "role": "Caseworker",
            "org_id": "hra_nyc"
        }
    )
    assert res_cw_reg.status_code == 201, f"Expected 201, got {res_cw_reg.status_code}: {res_cw_reg.text}"
    cw_data = res_cw_reg.json()
    assert cw_data["email"] == cw_email
    assert cw_data["role"] == "Caseworker"
    assert cw_data["org_id"] == "hra_nyc"
    assert "password" not in cw_data and "hashed_password" not in cw_data
    print(f"✔ Caseworker successfully registered: {cw_data['id']} ({cw_email})")

    # 4. Duplicate registration conflict (409)
    res_dup = client.post(
        "/api/v1/auth/register",
        json={
            "email": cw_email,
            "password": password,
            "name": "Jane Caseworker Clone",
            "role": "Caseworker",
            "org_id": "hra_nyc"
        }
    )
    assert res_dup.status_code == 409, f"Expected 409, got {res_dup.status_code}"
    print("✔ Duplicate email registration prevented: 409 Conflict")

    # 5. Login failures: wrong password and non-existent user
    res_wrong_pw = client.post(
        "/api/v1/auth/login",
        json={"email": cw_email, "password": "WrongPassword!"}
    )
    assert res_wrong_pw.status_code == 401
    print("✔ Invalid password login rejected: 401 Unauthorized")

    res_no_user = client.post(
        "/api/v1/auth/login",
        json={"email": f"nonexistent_{unique_suffix}@nycaid.org", "password": password}
    )
    assert res_no_user.status_code == 401
    print("✔ Non-existent user login rejected: 401 Unauthorized")

    # 6. Successful Login -> returns Bearer JWT
    res_login = client.post(
        "/api/v1/auth/login",
        json={"email": cw_email, "password": password}
    )
    assert res_login.status_code == 200, f"Login failed: {res_login.text}"
    login_data = res_login.json()
    token = login_data["access_token"]
    assert token and len(token) > 20
    assert login_data["user"]["email"] == cw_email
    print("✔ Successful login: received valid Bearer JWT")

    # 7. Access /auth/me with newly issued JWT
    res_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_me.status_code == 200
    me_data = res_me.json()
    assert me_data["role"] == "Caseworker"
    assert me_data["org_id"] == "hra_nyc"
    assert me_data["is_authenticated"] is True
    print("✔ /auth/me returns authenticated principal claims")

    # 8. Unauthenticated access to /auth/me -> 401
    res_me_unauth = client.get("/api/v1/auth/me")
    assert res_me_unauth.status_code == 401
    print("✔ Unauthenticated /auth/me: 401 Unauthorized")

    # 9. Register Analyst user and verify Cedar policy enforcement
    res_an_reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": analyst_email,
            "password": password,
            "name": "Alex Analyst",
            "role": "Analyst"
        }
    )
    assert res_an_reg.status_code == 201
    res_an_login = client.post(
        "/api/v1/auth/login",
        json={"email": analyst_email, "password": password}
    )
    assert res_an_login.status_code == 200
    analyst_token = res_an_login.json()["access_token"]

    # Analyst can access /audit/metrics
    res_an_metrics = client.get("/api/v1/audit/metrics", headers={"Authorization": f"Bearer {analyst_token}"})
    assert res_an_metrics.status_code == 200
    print("✔ Newly registered Analyst accesses /audit/metrics: ALLOW (200)")

    # Analyst cannot access /caseworker/cases (Cedar blocks)
    res_an_cw = client.get("/api/v1/caseworker/cases", headers={"Authorization": f"Bearer {analyst_token}"})
    assert res_an_cw.status_code == 403
    print("✔ Newly registered Analyst blocked from /caseworker/cases: DENY (403 via Cedar)")


def test_multilingual_chat_pipeline():
    print("\n--- 10. Testing Multilingual Pipeline (Indian & Global Languages) ---")
    from unittest.mock import patch
    from server.agents.orchestrator import NavigatorResponse

    dummy_res = NavigatorResponse(
        session_id="ml_test_sess",
        reply_message="You qualify for emergency food assistance in Brooklyn.",
        clarification_needed=False,
        applicant_profile=ApplicantProfile(borough="brooklyn", primary_needs=["food"])
    )

    with patch.object(orchestrator, "process_user_turn", return_value=dummy_res):
        # 1. Standard English turn
        res_en = client.post("/api/v1/chat/turn", json={"message": "Need food help in Brooklyn", "language": "en"})
        assert res_en.status_code == 200, f"Expected 200, got {res_en.status_code}"
        data_en = res_en.json()
        assert data_en["detected_language"] == "en"
        assert "food assistance" in data_en["reply_message"]
        print("✔ English ChatTurn: PASSED (passthrough, 0 translation overhead)")

        # 2. Multilingual Hindi turn
        with patch("server.api.routes_chat.translation_service.translate_to_english", return_value=("Need food help in Brooklyn", "hi")):
            with patch("server.api.routes_chat.translation_service.translate_from_english", return_value="आपको ब्रुकलिन में आपातकालीन खाद्य सहायता के लिए पात्रता है।"):
                res_hi = client.post("/api/v1/chat/turn", json={"message": "मुझे ब्रुकलिन में भोजन सहायता चाहिए", "language": "hi"})
                assert res_hi.status_code == 200
                data_hi = res_hi.json()
                assert data_hi["detected_language"] == "hi"
                assert data_hi["original_english_reply"] == "You qualify for emergency food assistance in Brooklyn."
                assert "ब्रुकलिन" in data_hi["reply_message"]
                print("✔ Hindi ChatTurn: PASSED (inbound translation -> orchestrator -> outbound translation)")

        # 3. Multilingual Spanish turn
        with patch("server.api.routes_chat.translation_service.translate_to_english", return_value=("Need food help in Brooklyn", "es")):
            with patch("server.api.routes_chat.translation_service.translate_from_english", return_value="Usted califica para asistencia alimentaria de emergencia en Brooklyn."):
                res_es = client.post("/api/v1/chat/turn", json={"message": "Necesito ayuda con comida en Brooklyn", "language": "es"})
                assert res_es.status_code == 200
                data_es = res_es.json()
                assert data_es["detected_language"] == "es"
                assert "asistencia alimentaria" in data_es["reply_message"]
                print("✔ Spanish ChatTurn: PASSED (global language support verified)")


if __name__ == "__main__":
    test_health_check()
    test_session_cookie_middleware_and_ownership_isolation()
    test_malformed_jwt_security()
    test_public_chat_cookie_flow()
    test_programs_endpoints()
    test_caseworker_org_scoping_and_pii_reveal()
    test_audit_endpoints_and_cedar_guard()
    test_sliding_window_rate_limiting_and_cookie_dropping_defense()
    test_auth_registration_and_login()
    test_multilingual_chat_pipeline()
    print("\n===================================================================")
    print("🎉 ALL 10 FASTAPI ROUTE, MULTILINGUAL, & SECURITY TESTS PASSED! 🎉")
    print("===================================================================\n")
