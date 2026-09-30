"""OAKsphere Connect - comprehensive backend API tests."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://7137fa1f-f3d4-4cdb-abae-d666ca8cd21e.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "contact@oaksphereconnect.com"
ADMIN_PASS = "Onkar@Oaksphere2026"
TL_EMAIL = "tl.rahul@oaksphere.com"
TL_PASS = "tl123"
REC_EMAIL = "recruiter.priya@oaksphere.com"
REC_PASS = "recruiter123"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    d = r.json()
    return d["token"], d["user"]


@pytest.fixture(scope="session")
def admin_token():
    tok, _ = _login(ADMIN_EMAIL, ADMIN_PASS)
    return tok


@pytest.fixture(scope="session")
def tl_token():
    tok, _ = _login(TL_EMAIL, TL_PASS)
    return tok


@pytest.fixture(scope="session")
def rec_token():
    tok, u = _login(REC_EMAIL, REC_PASS)
    return tok, u


def H(t):
    return {"Authorization": f"Bearer {t}"}


# ---- AUTH ----
class TestAuth:
    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] == "admin"
        assert d["user"]["email"] == ADMIN_EMAIL
        assert isinstance(d["token"], str) and len(d["token"]) > 20

    def test_invalid_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_token(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=H(admin_token))
        assert r.status_code == 200
        assert r.json()["user"]["email"] == ADMIN_EMAIL

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---- RBAC ----
class TestRBAC:
    def test_recruiter_cannot_create_user(self, rec_token):
        tok, _ = rec_token
        r = requests.post(f"{API}/users", json={"name": "x", "email": "x@x.com", "password": "y", "role": "recruiter"}, headers=H(tok))
        assert r.status_code == 403

    def test_recruiter_cannot_create_client(self, rec_token):
        tok, _ = rec_token
        r = requests.post(f"{API}/clients", json={"companyName": "X", "contactPerson": "Y"}, headers=H(tok))
        assert r.status_code == 403

    def test_recruiter_cannot_create_job(self, rec_token):
        tok, _ = rec_token
        r = requests.post(f"{API}/jobs", json={"clientId": "x", "positionTitle": "y"}, headers=H(tok))
        assert r.status_code == 403

    def test_recruiter_cannot_view_audit_logs(self, rec_token):
        tok, _ = rec_token
        r = requests.get(f"{API}/audit-logs", headers=H(tok))
        assert r.status_code == 403

    def test_recruiter_cannot_view_duplicates(self, rec_token):
        tok, _ = rec_token
        r = requests.get(f"{API}/duplicates", headers=H(tok))
        assert r.status_code == 403

    def test_recruiter_cannot_bulk_assign(self, rec_token):
        tok, _ = rec_token
        r = requests.post(f"{API}/leads/bulk-assign", json={"leadIds": ["x"], "targetRecruiterId": "y"}, headers=H(tok))
        assert r.status_code == 403

    def test_tl_can_bulk_assign(self, tl_token):
        # Might get 400/404 due to invalid ids, but NOT 403
        r = requests.post(f"{API}/leads/bulk-assign", json={"leadIds": [], "targetRecruiterId": "x"}, headers=H(tl_token))
        assert r.status_code != 403


# ---- LEADS ----
class TestLeads:
    def test_admin_sees_all(self, admin_token):
        r = requests.get(f"{API}/leads", headers=H(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert "leads" in d
        assert d["total"] >= 1
        TestLeads.total_admin = d["total"]

    def test_recruiter_sees_own_only(self, rec_token, admin_token):
        tok, u = rec_token
        r = requests.get(f"{API}/leads", headers=H(tok))
        assert r.status_code == 200
        recs = r.json()["leads"]
        for l in recs:
            assert l["assignedRecruiterId"] == u["id"]
        # phone masked
        if recs:
            assert recs[0].get("isPhoneMasked") is True
            assert "\u2022" in recs[0]["primaryPhone"]

    def test_create_lead_missing_fields(self, admin_token):
        r = requests.post(f"{API}/leads", json={"candidateName": "TEST_x"}, headers=H(admin_token))
        assert r.status_code == 400

    def test_create_and_duplicate(self, admin_token):
        phone = "9876500011"
        payload = {"candidateName": "TEST_John", "primaryPhone": phone, "city": "Pune"}
        r = requests.post(f"{API}/leads", json=payload, headers=H(admin_token))
        assert r.status_code == 200, r.text
        lead = r.json()["lead"]
        lid = lead["id"]
        assert lead["candidateName"] == "TEST_John"

        # GET verify persistence
        r2 = requests.get(f"{API}/leads/{lid}", headers=H(admin_token))
        assert r2.status_code == 200
        assert r2.json()["lead"]["primaryPhone"] == phone

        # Duplicate
        r3 = requests.post(f"{API}/leads", json=payload, headers=H(admin_token))
        assert r3.status_code == 409

        # PATCH
        r4 = requests.patch(f"{API}/leads/{lid}", json={"city": "Mumbai", "priority": "Hot"}, headers=H(admin_token))
        assert r4.status_code == 200
        assert r4.json()["lead"]["city"] == "Mumbai"
        TestLeads.created_lead_id = lid


# ---- CALLS conditional validation ----
class TestCalls:
    def _get_lead_for_recruiter(self, rec_tok):
        r = requests.get(f"{API}/leads", headers=H(rec_tok))
        leads = r.json()["leads"]
        return leads[0] if leads else None

    def test_callback_requires_followup(self, rec_token):
        tok, _ = rec_token
        lead = self._get_lead_for_recruiter(tok)
        if not lead:
            pytest.skip("no lead for recruiter")
        r = requests.post(f"{API}/calls", json={"leadId": lead["id"], "disposition": "Callback"}, headers=H(tok))
        assert r.status_code == 400

    def test_callback_with_followup_ok(self, rec_token):
        tok, _ = rec_token
        lead = self._get_lead_for_recruiter(tok)
        if not lead:
            pytest.skip("no lead")
        payload = {"leadId": lead["id"], "disposition": "Callback",
                   "followupDate": "2026-12-30", "followupTime": "10:00", "followupReason": "Candidate busy"}
        r = requests.post(f"{API}/calls", json=payload, headers=H(tok))
        assert r.status_code == 200, r.text
        assert r.json()["lead"]["leadStatus"] == "Follow-up"

    def test_interview_scheduled_requires_fields(self, rec_token):
        tok, _ = rec_token
        lead = self._get_lead_for_recruiter(tok)
        if not lead:
            pytest.skip("no lead")
        r = requests.post(f"{API}/calls", json={"leadId": lead["id"], "disposition": "Interview Scheduled"}, headers=H(tok))
        assert r.status_code == 400

    def test_connected_interested_sets_hot(self, rec_token):
        tok, _ = rec_token
        lead = self._get_lead_for_recruiter(tok)
        if not lead:
            pytest.skip("no lead")
        r = requests.post(f"{API}/calls",
                          json={"leadId": lead["id"], "disposition": "Connected \u2013 Interested", "notes": "Good"},
                          headers=H(tok))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["lead"]["priority"] == "Hot"
        assert d["lead"]["leadStatus"] == "Interested"


# ---- Call Bridge ----
class TestCallBridge:
    def test_status(self, admin_token):
        r = requests.get(f"{API}/call-bridge/status", headers=H(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "settings" in d
        assert "stats" in d

    def test_dial_and_simulate(self, admin_token):
        # need a lead
        r = requests.get(f"{API}/leads", headers=H(admin_token))
        lead = r.json()["leads"][0]
        r = requests.post(f"{API}/call-bridge/dial",
                          json={"phoneNumber": lead["primaryPhone"], "leadId": lead["id"], "candidateName": lead["candidateName"]},
                          headers=H(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True
        call = d.get("call") or {}
        assert call.get("status") == "ringing"
        call_id = call["id"]

        r2 = requests.post(f"{API}/call-bridge/simulate-phone-event",
                           json={"callId": call_id, "simulatedAction": "hangup_interested"},
                           headers=H(admin_token))
        assert r2.status_code == 200, r2.text

        r3 = requests.get(f"{API}/call-bridge/logs", headers=H(admin_token))
        assert r3.status_code == 200


# ---- Telephony ----
class TestTelephony:
    def test_dashboard_admin(self, admin_token):
        r = requests.get(f"{API}/telephony/dashboard?period=today", headers=H(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["kpis", "gapAnalysis", "callSummary", "activeCalls", "recruiterPresence", "recruiterPerformance", "callLogs"]:
            assert k in d, f"missing {k}"

    def test_dashboard_recruiter_masks_phone(self, rec_token):
        tok, _ = rec_token
        r = requests.get(f"{API}/telephony/dashboard?period=today", headers=H(tok))
        assert r.status_code == 200
        logs = r.json().get("callLogs", [])
        # if there are logs, must be masked
        for cl in logs:
            phone = cl.get("phone") or cl.get("candidatePhone") or ""
            if phone:
                assert "\u2022" in phone


# ---- Interviews & Joinings pipeline ----
class TestPipeline:
    def test_interview_selected_cascade(self, admin_token):
        # Create interview via /interviews using an existing lead
        r = requests.get(f"{API}/leads", headers=H(admin_token))
        leads = r.json()["leads"]
        rc = requests.get(f"{API}/clients", headers=H(admin_token))
        clients = rc.json()["clients"]
        rj = requests.get(f"{API}/jobs", headers=H(admin_token))
        jobs = rj.json()["jobs"]
        if not (leads and clients and jobs):
            pytest.skip("missing seed")
        lead = leads[0]
        r = requests.post(f"{API}/interviews",
                          json={"leadId": lead["id"], "clientId": clients[0]["id"], "jobId": jobs[0]["id"],
                                "date": "2026-12-31", "time": "11:00"},
                          headers=H(admin_token))
        assert r.status_code == 200, r.text
        iv = r.json()["interview"]

        r2 = requests.patch(f"{API}/interviews/{iv['id']}/stage",
                            json={"stage": "Selected", "expectedJoiningDate": "2027-01-15"},
                            headers=H(admin_token))
        assert r2.status_code == 200

        # lead should be Selected
        r3 = requests.get(f"{API}/leads/{lead['id']}", headers=H(admin_token))
        assert r3.json()["lead"]["leadStatus"] == "Selected"

        # joining created
        r4 = requests.get(f"{API}/joinings", headers=H(admin_token))
        joinings = r4.json()["joinings"]
        matched = [j for j in joinings if j["leadId"] == lead["id"]]
        assert matched, "joining should exist"
        jid = matched[0]["id"]

        # mark Joined
        r5 = requests.patch(f"{API}/joinings/{jid}",
                            json={"status": "Joined", "actualJoiningDate": "2027-01-15"},
                            headers=H(admin_token))
        assert r5.status_code == 200
        r6 = requests.get(f"{API}/leads/{lead['id']}", headers=H(admin_token))
        assert r6.json()["lead"]["leadStatus"] == "Joined"


# ---- Admin user CRUD ----
class TestAdminUsers:
    def test_create_patch_delete_user(self, admin_token):
        payload = {"name": "TEST_Rec", "email": "test_rec_temp@x.com", "password": "pass123", "role": "recruiter"}
        r = requests.post(f"{API}/users", json=payload, headers=H(admin_token))
        assert r.status_code == 200, r.text
        uid = r.json()["user"]["id"]

        r2 = requests.get(f"{API}/users", headers=H(admin_token))
        assert any(u["id"] == uid for u in r2.json()["users"])

        r3 = requests.patch(f"{API}/users/{uid}", json={"name": "TEST_Rec2"}, headers=H(admin_token))
        assert r3.status_code == 200
        assert r3.json()["user"]["name"] == "TEST_Rec2"

        r4 = requests.delete(f"{API}/users/{uid}", headers=H(admin_token), json={})
        assert r4.status_code == 200

    def test_cannot_delete_self(self, admin_token):
        me = requests.get(f"{API}/auth/me", headers=H(admin_token)).json()["user"]
        r = requests.delete(f"{API}/users/{me['id']}", headers=H(admin_token), json={})
        assert r.status_code == 400
