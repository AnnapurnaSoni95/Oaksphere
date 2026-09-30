"""OAKsphere Connect CRM - FastAPI backend (ported from Express/tsx, MongoDB-backed)."""
import os
import asyncio
import json
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, Request, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse

from common import (
    store, db, gen_id, now_iso, today_str, generate_token, decode_token,
    hash_password, verify_password, default_permissions, get_current_user, require_role,
    can_access_lead, normalize_phone, calculate_scorecard, match_jobs_for_lead,
    log_audit, log_activity, add_notification, public_user, NON_CONNECTED,
)

CONNECTED_INTERESTED = "Connected \u2013 Interested"

app = FastAPI(title="OAKsphere Connect API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=(os.environ.get("CORS_ORIGINS", "*").split(",")),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
api = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# utils
# ---------------------------------------------------------------------------
def dt(iso):
    if not iso:
        return None
    try:
        return datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return None


def utcnow():
    return datetime.now(timezone.utc)


def mask_lead(lead, user):
    if user["role"] == "recruiter" and (user.get("permissions") or {}).get("canViewCandidatePhone") is False:
        l = dict(lead)
        p = l.get("primaryPhone") or ""
        l["primaryPhone"] = (p[:4] + " \u2022\u2022\u2022\u2022\u2022\u2022") if p else ""
        ap = l.get("alternatePhone")
        if ap:
            l["alternatePhone"] = ap[:4] + " \u2022\u2022\u2022\u2022\u2022\u2022"
        l["isPhoneMasked"] = True
        return l
    return lead


async def flush(*colls):
    for c in colls:
        await store.flush(c)


def upd_lead(lead_id, updates):
    for l in store.col("leads"):
        if l["id"] == lead_id:
            l.update(updates)
            l["updatedAt"] = now_iso()
            return l
    return None


# ---------------------------------------------------------------------------
# lifespan
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    await store.load()
    await ensure_admin()
    await write_test_credentials()


async def ensure_admin():
    email = os.environ.get("ADMIN_EMAIL", "contact@oaksphereconnect.com").lower()
    pw = os.environ.get("ADMIN_PASSWORD", "Onkar@Oaksphere2026")
    name = os.environ.get("ADMIN_NAME", "Onkar Khillare")
    existing = next((u for u in store.col("users") if u["email"].lower() == email), None)
    if not existing:
        store.col("users").insert(0, {
            "id": "usr_onkar", "name": name, "email": email, "passwordHash": hash_password(pw),
            "role": "admin", "isActive": True, "phone": "9820000000",
            "dailyCallTarget": 40, "dailyConnectedTarget": 20, "dailyLineupTarget": 4,
            "monthlyJoiningTarget": 10, "permissions": default_permissions("admin"),
            "createdAt": now_iso(), "updatedAt": now_iso(),
        })
        await flush("users")
    else:
        changed = False
        if not verify_password(pw, existing.get("passwordHash", "")):
            existing["passwordHash"] = hash_password(pw)
            changed = True
        if existing["role"] != "admin":
            existing["role"] = "admin"
            existing["permissions"] = default_permissions("admin")
            changed = True
        if changed:
            await flush("users")


async def write_test_credentials():
    try:
        os.makedirs("/app/memory", exist_ok=True)
        with open("/app/memory/test_credentials.md", "w") as f:
            f.write(
                "# OAKsphere Connect - Test Credentials\n\n"
                "All logins via POST /api/auth/login with JSON {email, password}. Bearer token in Authorization header.\n\n"
                "## Admin (Owner)\n"
                f"- Email: {os.environ.get('ADMIN_EMAIL')}\n- Password: {os.environ.get('ADMIN_PASSWORD')}\n- Role: admin\n\n"
                "## Other admin\n- admin@oaksphere.com / admin123 (role admin)\n\n"
                "## Team Leader\n- tl.rahul@oaksphere.com / tl123\n\n"
                "## Recruiters\n- recruiter.priya@oaksphere.com / recruiter123\n"
                "- recruiter.amit@oaksphere.com / recruiter123\n"
                "- recruiter.sneha@oaksphere.com / recruiter123\n\n"
                "Auth endpoints: /api/auth/login, /api/auth/me\n"
            )
    except OSError:
        pass


@app.get("/api/health")
async def health():
    return {"status": "ok", "name": "OAKsphere Connect API", "timestamp": now_iso()}


# ---------------------------------------------------------------------------
# AUTH
# ---------------------------------------------------------------------------
@api.post("/auth/login")
async def login(request: Request):
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    if not email or not password:
        raise HTTPException(400, "Email and password are required.")
    user = next((u for u in store.col("users") if u["email"].lower() == email), None)
    if not user or not verify_password(password, user.get("passwordHash", "")):
        raise HTTPException(401, "Invalid email or password.")
    if not user.get("isActive"):
        raise HTTPException(403, "Your account is deactivated. Contact an administrator.")
    return {"token": generate_token(user), "user": _auth_user(user)}


def _auth_user(u):
    return {k: u.get(k) for k in ["id", "name", "email", "role", "teamId", "teamName", "phone",
            "dailyCallTarget", "dailyConnectedTarget", "dailyLineupTarget", "monthlyJoiningTarget", "permissions"]}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    u = store.find("users", id=user["id"])
    if not u:
        raise HTTPException(404, "User not found.")
    return {"user": public_user(u)}


# ---------------------------------------------------------------------------
# USERS
# ---------------------------------------------------------------------------
@api.get("/users")
async def get_users(user=Depends(get_current_user)):
    users = [public_user(u) for u in store.col("users")]
    if user["role"] == "team_leader":
        return {"users": [u for u in users if u.get("teamId") == user.get("teamId") or u["id"] == user["id"]]}
    if user["role"] == "recruiter":
        return {"users": [u for u in users if u["id"] == user["id"] or (u.get("teamId") == user.get("teamId") and u["role"] == "team_leader")]}
    return {"users": users}


@api.post("/users")
async def create_user(request: Request, user=Depends(require_role("admin"))):
    b = await request.json()
    if not all(b.get(k) for k in ["name", "email", "password", "role"]):
        raise HTTPException(400, "Name, email, password, and role are required.")
    email = b["email"].strip().lower()
    if any(u["email"].lower() == email for u in store.col("users")):
        raise HTTPException(400, "A user with this email address already exists.")
    nu = {
        "id": gen_id("usr"), "name": b["name"], "email": email,
        "passwordHash": hash_password(b["password"]), "role": b["role"],
        "teamId": b.get("teamId"), "teamName": b.get("teamName"), "phone": b.get("phone"),
        "isActive": True, "dailyCallTarget": int(b.get("dailyCallTarget") or 60),
        "dailyConnectedTarget": int(b.get("dailyConnectedTarget") or 30),
        "dailyLineupTarget": int(b.get("dailyLineupTarget") or 5),
        "monthlyJoiningTarget": int(b.get("monthlyJoiningTarget") or 8),
        "permissions": b.get("permissions") or default_permissions(b["role"]),
        "createdAt": now_iso(), "updatedAt": now_iso(),
    }
    store.col("users").append(nu)
    log_audit(user, "CREATE_USER", "User", nu["id"],
              f"Admin created user '{nu['name']}' with role '{nu['role']}'.", new={"name": nu["name"], "email": email, "role": nu["role"]})
    await flush("users")
    return {"user": public_user(nu)}


@api.patch("/users/{uid}")
async def update_user(uid: str, request: Request, user=Depends(require_role("admin"))):
    existing = store.find("users", id=uid)
    if not existing:
        raise HTTPException(404, "User not found.")
    b = await request.json()
    b.pop("id", None)
    if b.get("password"):
        b["passwordHash"] = hash_password(b.pop("password"))
    else:
        b.pop("password", None)
    b.pop("passwordHash", None) if "passwordHash" in b and not b.get("passwordHash") else None
    prev = dict(existing)
    existing.update(b)
    existing["updatedAt"] = now_iso()
    log_audit(user, "UPDATE_USER", "User", uid, f"Admin updated user '{existing['name']}'.", previous=public_user(prev), new=public_user(existing))
    await flush("users")
    return {"user": public_user(existing)}


@api.delete("/users/{uid}")
async def delete_user(uid: str, request: Request, user=Depends(require_role("admin"))):
    existing = store.find("users", id=uid)
    if not existing:
        raise HTTPException(404, "User not found.")
    if uid == user["id"]:
        raise HTTPException(400, "You cannot delete your own active administrator account.")
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    reassign_to = body.get("reassignToUserId")
    target_name = "Unassigned"
    count = 0
    if reassign_to:
        target = store.find("users", id=reassign_to)
        if target:
            target_name = target["name"]
            for l in store.col("leads"):
                if l.get("assignedRecruiterId") == uid:
                    l["assignedRecruiterId"] = target["id"]
                    l["assignedRecruiterName"] = target["name"]
                    l["teamId"] = target.get("teamId") or l.get("teamId")
                    l["updatedAt"] = now_iso()
                    count += 1
    else:
        for l in store.col("leads"):
            if l.get("assignedRecruiterId") == uid:
                l["assignedRecruiterId"] = ""
                l["assignedRecruiterName"] = "Unassigned"
                l["updatedAt"] = now_iso()
                count += 1
    store.state["users"] = [u for u in store.col("users") if u["id"] != uid]
    log_audit(user, "DELETE_USER", "User", uid,
              f"Admin deleted user '{existing['name']}' ({existing['email']}). {count} leads transferred to {target_name}.", previous=public_user(existing))
    await flush("users", "leads")
    return {"success": True, "message": f"Recruiter '{existing['name']}' was permanently deleted. {count} candidate leads were reassigned to {target_name}.", "reassignedLeadsCount": count}


# ---------------------------------------------------------------------------
# LEADS
# ---------------------------------------------------------------------------
def _visible_leads(user):
    leads = store.col("leads")
    can_all = user["role"] == "admin" or (user.get("permissions") or {}).get("canViewAllLeads") is True
    if can_all:
        return list(leads)
    if user["role"] == "recruiter":
        return [l for l in leads if l.get("assignedRecruiterId") == user["id"]]
    if user["role"] == "team_leader":
        return [l for l in leads if l.get("teamId") == user.get("teamId") or l.get("assignedRecruiterId") == user["id"]]
    return []


@api.get("/leads")
async def list_leads(request: Request, user=Depends(get_current_user)):
    leads = _visible_leads(user)
    q = request.query_params
    search = q.get("search")
    if search:
        s = search.lower().strip()
        leads = [l for l in leads if s in (l.get("candidateName") or "").lower()
                 or s in (l.get("primaryPhone") or "")
                 or (l.get("email") and s in l["email"].lower())
                 or s in (l.get("city") or "").lower()
                 or (l.get("clientName") and s in l["clientName"].lower())
                 or (l.get("jobTitle") and s in l["jobTitle"].lower())]
    for key, field in [("priority", "priority"), ("leadStatus", "leadStatus"),
                       ("interviewStatus", "interviewStatus"), ("joiningStatus", "joiningStatus"),
                       ("assignedRecruiterId", "assignedRecruiterId"), ("clientId", "clientId"), ("jobId", "jobId")]:
        if q.get(key):
            leads = [l for l in leads if l.get(field) == q.get(key)]
    now = utcnow()
    today = today_str()
    view = q.get("view")
    if view == "today_followups":
        leads = [l for l in leads if l.get("nextFollowupAt") and l["nextFollowupAt"].startswith(today)]
    elif view == "overdue_followups":
        leads = [l for l in leads if l.get("nextFollowupAt") and dt(l["nextFollowupAt"]) < now and l["leadStatus"] not in ("Joined", "Lost")]
    elif view == "hot_leads":
        leads = [l for l in leads if l.get("priority") == "Hot"]
    elif view == "never_called":
        leads = [l for l in leads if l.get("callAttempts") == 0]
    elif view == "unassigned":
        leads = [l for l in leads if not l.get("assignedRecruiterId") or l.get("assignedRecruiterName") == "Unassigned"]
    elif view == "action_required":
        leads = [l for l in leads if (not l.get("assignedRecruiterId")) or l.get("callAttempts") == 0
                 or (l.get("nextFollowupAt") and dt(l["nextFollowupAt"]) < now)
                 or (l.get("leadStatus") == "Selected" and not l.get("expectedJoiningDate"))]
    elif view == "calling_queue":
        leads = [l for l in leads if l["leadStatus"] not in ("Joined", "Lost", "Invalid Number")]
        pw = {"Hot": 5, "High": 4, "Medium": 3, "Low": 2, "Cold": 1}

        def sk(l):
            overdue = 1 if (l.get("nextFollowupAt") and dt(l["nextFollowupAt"]) < now) else 0
            today_fu = 1 if (l.get("nextFollowupAt") and l["nextFollowupAt"].startswith(today)) else 0
            return (-overdue, -pw.get(l.get("priority"), 1), -today_fu, -(dt(l["updatedAt"]).timestamp() if dt(l.get("updatedAt")) else 0))
        leads = sorted(leads, key=sk)
    returned = [mask_lead(l, user) for l in leads]
    return {"total": len(returned), "leads": returned}


@api.get("/calling-queue")
async def calling_queue(request: Request, user=Depends(get_current_user)):
    leads = _visible_leads(user)
    now = utcnow()
    today = today_str()
    leads = [l for l in leads if l["leadStatus"] not in ("Joined", "Lost", "Invalid Number")]
    pw = {"Hot": 5, "High": 4, "Medium": 3, "Low": 2, "Cold": 1}

    def sk(l):
        overdue = 1 if (l.get("nextFollowupAt") and dt(l["nextFollowupAt"]) < now) else 0
        today_fu = 1 if (l.get("nextFollowupAt") and l["nextFollowupAt"].startswith(today)) else 0
        return (-overdue, -pw.get(l.get("priority"), 1), -today_fu, -(dt(l["updatedAt"]).timestamp() if dt(l.get("updatedAt")) else 0))
    leads = sorted(leads, key=sk)
    return {"leads": [mask_lead(l, user) for l in leads]}


@api.get("/leads/{lead_id}")
async def get_lead(lead_id: str, user=Depends(get_current_user)):
    lead = store.find("leads", id=lead_id)
    if not lead:
        raise HTTPException(404, "Candidate lead not found.")
    if not can_access_lead(user, lead):
        raise HTTPException(403, "Forbidden: You do not have permission to view this lead.")
    ml = mask_lead(lead, user)
    return {
        "lead": ml,
        "activities": [a for a in store.col("activities") if a["leadId"] == lead_id],
        "calls": [c for c in store.col("calls") if c["leadId"] == lead_id],
        "interviews": [i for i in store.col("interviews") if i["leadId"] == lead_id],
        "followups": [f for f in store.col("followups") if f["leadId"] == lead_id],
        "joinings": [j for j in store.col("joinings") if j["leadId"] == lead_id],
    }


@api.post("/leads")
async def create_lead(request: Request, user=Depends(get_current_user)):
    b = await request.json()
    if not b.get("candidateName") or not b.get("primaryPhone") or not b.get("city"):
        raise HTTPException(400, "Candidate Name, Primary Phone, and City are required fields.")
    norm = normalize_phone(b["primaryPhone"])
    if not norm["isValid"] and norm["status"] == "INVALID":
        raise HTTPException(400, f"Invalid primary phone number '{b['primaryPhone']}'. Please enter a valid 10-digit mobile number.")
    existing = next((l for l in store.col("leads") if l.get("normalizedPhone") == norm["normalized"] or l.get("normalizedAltPhone") == norm["normalized"]), None)
    if existing and not b.get("allowDuplicate"):
        raise HTTPException(409, detail={
            "error": f"Duplicate phone number detected! Existing candidate: '{existing['candidateName']}' (ID: {existing['id']}) is already assigned to recruiter '{existing.get('assignedRecruiterName')}'.",
            "existingLead": existing, "canForceDuplicate": True})
    target_id = user["id"] if user["role"] == "recruiter" else b.get("assignedRecruiterId")
    rec_name, orig_id, orig_name, team = "Unassigned", "", "Unassigned", None
    if target_id:
        r = store.find("users", id=target_id)
        if r:
            rec_name, orig_id, orig_name, team = r["name"], r["id"], r["name"], r.get("teamId")
    client = store.find("clients", id=b.get("clientId")) if b.get("clientId") else None
    job = store.find("jobs", id=b.get("jobId")) if b.get("jobId") else None
    alt = normalize_phone(b["alternatePhone"]) if b.get("alternatePhone") else None
    lead = {
        "id": gen_id("lead"), "candidateName": b["candidateName"], "primaryPhone": b["primaryPhone"],
        "normalizedPhone": norm["normalized"], "alternatePhone": b.get("alternatePhone"),
        "normalizedAltPhone": alt["normalized"] if alt else None, "phoneStatus": norm["status"],
        "email": b.get("email"), "city": b["city"], "age": int(b["age"]) if b.get("age") else None,
        "gender": b.get("gender"), "qualification": b.get("qualification"), "experience": b.get("experience"),
        "currentSalary": int(b["currentSalary"]) if b.get("currentSalary") else None,
        "expectedSalary": int(b["expectedSalary"]) if b.get("expectedSalary") else None,
        "noticePeriod": b.get("noticePeriod"), "leadSource": b.get("leadSource") or "Manual Entry",
        "assignedRecruiterId": target_id or "", "assignedRecruiterName": rec_name,
        "originalRecruiterId": orig_id, "originalRecruiterName": orig_name, "teamId": team,
        "clientId": b.get("clientId"), "clientName": client["companyName"] if client else None,
        "jobId": b.get("jobId"), "jobTitle": job["positionTitle"] if job else None,
        "priority": b.get("priority") or "Medium", "leadStatus": "New", "callAttempts": 0,
        "notesSummary": b.get("notes") or "",
        "assignmentHistory": ([{"id": gen_id("asg"), "assignedToId": target_id, "assignedToName": rec_name,
                                "assignedById": user["id"], "assignedByName": user["name"],
                                "assignedAt": now_iso(), "reason": "Initial assignment upon lead creation"}] if target_id else []),
        "createdAt": now_iso(), "updatedAt": now_iso(), "updatedById": user["id"], "updatedByName": user["name"],
    }
    store.col("leads").append(lead)
    log_activity(lead["id"], "status_change", "Lead Created", f"Candidate lead created from source '{lead['leadSource']}'.", user)
    log_audit(user, "CREATE_LEAD", "Lead", lead["id"], f"Created new candidate lead '{lead['candidateName']}'.",
              new={"name": lead["candidateName"], "phone": lead["primaryPhone"], "assigned": rec_name})
    await flush("leads")
    return {"lead": lead}


@api.patch("/leads/{lead_id}")
async def patch_lead(lead_id: str, request: Request, user=Depends(get_current_user)):
    lead = store.find("leads", id=lead_id)
    if not lead:
        raise HTTPException(404, "Candidate lead not found.")
    if not can_access_lead(user, lead):
        raise HTTPException(403, "Forbidden: You do not have permission to update this lead.")
    b = await request.json()
    updates = {"updatedById": user["id"], "updatedByName": user["name"]}
    for f in ["candidateName", "email", "city", "gender", "qualification", "experience", "noticePeriod",
              "leadSource", "priority", "leadStatus", "notesSummary", "expectedJoiningDate",
              "actualJoiningDate", "lostReason"]:
        if b.get(f) is not None:
            updates[f] = b[f]
    if b.get("primaryPhone") is not None:
        n = normalize_phone(b["primaryPhone"])
        updates.update({"primaryPhone": b["primaryPhone"], "normalizedPhone": n["normalized"], "phoneStatus": n["status"]})
    if b.get("alternatePhone") is not None:
        updates["alternatePhone"] = b["alternatePhone"]
        updates["normalizedAltPhone"] = normalize_phone(b["alternatePhone"])["normalized"]
    for numf in ["age", "currentSalary", "expectedSalary"]:
        if b.get(numf) is not None:
            updates[numf] = int(b[numf])
    if b.get("clientId") is not None:
        updates["clientId"] = b["clientId"]
        c = store.find("clients", id=b["clientId"])
        updates["clientName"] = c["companyName"] if c else None
    if b.get("jobId") is not None:
        updates["jobId"] = b["jobId"]
        j = store.find("jobs", id=b["jobId"])
        updates["jobTitle"] = j["positionTitle"] if j else None
    prev_status, prev_priority = lead["leadStatus"], lead["priority"]
    updated = upd_lead(lead_id, updates)
    if b.get("leadStatus") and b["leadStatus"] != prev_status:
        log_activity(lead_id, "status_change", f"Lead Status Changed: {b['leadStatus']}", f"Status changed from '{prev_status}' to '{b['leadStatus']}'.", user)
    if b.get("priority") and b["priority"] != prev_priority:
        log_activity(lead_id, "status_change", f"Priority Updated: {b['priority']}", f"Priority shifted from '{prev_priority}' to '{b['priority']}'.", user)
    log_audit(user, "UPDATE_LEAD", "Lead", lead_id, f"Updated details for candidate '{lead['candidateName']}'.")
    await flush("leads")
    return {"lead": updated}


@api.post("/leads/bulk-assign")
async def bulk_assign(request: Request, user=Depends(require_role("admin", "team_leader"))):
    b = await request.json()
    lead_ids, target_id, reason = b.get("leadIds"), b.get("targetRecruiterId"), b.get("reason")
    if not isinstance(lead_ids, list) or not lead_ids or not target_id:
        raise HTTPException(400, "leadIds array and targetRecruiterId are required.")
    target = store.find("users", id=target_id)
    if not target:
        raise HTTPException(404, "Target recruiter not found.")
    if not target.get("isActive"):
        raise HTTPException(400, "Cannot assign leads to an inactive recruiter.")
    if user["role"] == "team_leader" and target.get("teamId") != user.get("teamId"):
        raise HTTPException(403, "Team Leaders can only assign leads to recruiters within their own team.")
    count = 0
    for lid in lead_ids:
        lead = store.find("leads", id=lid)
        if not lead:
            continue
        if user["role"] == "team_leader" and lead.get("teamId") and lead.get("teamId") != user.get("teamId"):
            continue
        prev = lead.get("assignedRecruiterName")
        hist = {"id": gen_id("asg"), "assignedToId": target["id"], "assignedToName": target["name"],
                "assignedById": user["id"], "assignedByName": user["name"], "assignedAt": now_iso(),
                "reason": reason or "Bulk assignment via CRM"}
        upd_lead(lid, {"assignedRecruiterId": target["id"], "assignedRecruiterName": target["name"],
                       "teamId": target.get("teamId"), "assignmentHistory": [hist] + (lead.get("assignmentHistory") or []),
                       "updatedById": user["id"], "updatedByName": user["name"]})
        log_activity(lid, "assignment", "Lead Reassigned", f"Reassigned from '{prev}' to '{target['name']}' by {user['name']}.", user)
        count += 1
    add_notification(target["id"], "New Leads Assigned", f"{count} leads have been assigned to you by {user['name']}.", "lead_assigned", "/leads")
    log_audit(user, "BULK_ASSIGN_LEADS", "Lead", "multiple", f"Assigned {count} leads to {target['name']}.", new={"count": count, "assignedTo": target["name"]})
    await flush("leads")
    return {"message": f"Successfully assigned {count} leads to {target['name']}.", "assignedCount": count}


@api.post("/leads/auto-distribute")
async def auto_distribute(request: Request, user=Depends(require_role("admin", "team_leader"))):
    b = await request.json()
    lead_ids = b.get("leadIds")
    if not isinstance(lead_ids, list) or not lead_ids:
        raise HTTPException(400, "leadIds array is required.")
    recruiters = [u for u in store.col("users") if u["role"] == "recruiter" and u.get("isActive")]
    if user["role"] == "team_leader":
        recruiters = [u for u in recruiters if u.get("teamId") == user.get("teamId")]
    if not recruiters:
        raise HTTPException(400, "No active recruiters available for auto-distribution.")
    load = {r["id"]: 0 for r in recruiters}
    for l in store.col("leads"):
        if l.get("assignedRecruiterId") in load and l["leadStatus"] not in ("Joined", "Lost"):
            load[l["assignedRecruiterId"]] += 1
    pw = {"Hot": 5, "High": 4, "Medium": 3, "Low": 2, "Cold": 1}
    to_assign = sorted([store.find("leads", id=i) for i in lead_ids if store.find("leads", id=i)],
                       key=lambda l: -pw.get(l.get("priority"), 1))
    count = 0
    summary = {r["name"]: 0 for r in recruiters}
    for lead in to_assign:
        lowest = min(recruiters, key=lambda r: load[r["id"]])
        prev = lead.get("assignedRecruiterName")
        hist = {"id": gen_id("asg"), "assignedToId": lowest["id"], "assignedToName": lowest["name"],
                "assignedById": user["id"], "assignedByName": user["name"], "assignedAt": now_iso(),
                "reason": "Intelligent Workload Auto-Distribution"}
        upd_lead(lead["id"], {"assignedRecruiterId": lowest["id"], "assignedRecruiterName": lowest["name"],
                              "teamId": lowest.get("teamId"), "assignmentHistory": [hist] + (lead.get("assignmentHistory") or []),
                              "updatedById": user["id"], "updatedByName": user["name"]})
        log_activity(lead["id"], "assignment", "Auto Distributed", f"Workload-balanced from '{prev}' to '{lowest['name']}'.", user)
        load[lowest["id"]] += 1
        summary[lowest["name"]] += 1
        count += 1
    for r in recruiters:
        if summary[r["name"]] > 0:
            add_notification(r["id"], "Auto-Distributed Leads", f"{summary[r['name']]} leads have been allocated to you via automated workload balancing.", "lead_assigned", "/leads")
    log_audit(user, "AUTO_DISTRIBUTE_LEADS", "Lead", "multiple", f"Auto-distributed {count} leads across {len(recruiters)} active recruiters.", new=summary)
    await flush("leads")
    return {"message": f"Successfully auto-distributed {count} leads.", "distribution": summary}


@api.post("/leads/bulk-status")
async def bulk_status(request: Request, user=Depends(get_current_user)):
    b = await request.json()
    lead_ids, status, lost_reason = b.get("leadIds"), b.get("leadStatus"), b.get("lostReason")
    if not isinstance(lead_ids, list) or not lead_ids or not status:
        raise HTTPException(400, "leadIds array and leadStatus are required.")
    count = 0
    for lid in lead_ids:
        lead = store.find("leads", id=lid)
        if not lead or not can_access_lead(user, lead):
            continue
        prev = lead["leadStatus"]
        upds = {"leadStatus": status, "updatedById": user["id"], "updatedByName": user["name"]}
        upds["lostReason"] = lost_reason if (status == "Lost" and lost_reason) else (None if status != "Lost" else lead.get("lostReason"))
        upd_lead(lid, upds)
        if prev != status:
            log_activity(lid, "status_change", f"Bulk Status Changed: {status}", f"Status changed from '{prev}' to '{status}' by {user['name']}.", user)
        count += 1
    log_audit(user, "BULK_STATUS_UPDATE", "Lead", "multiple", f"Bulk updated status of {count} leads to '{status}'.", new={"status": status, "count": count})
    await flush("leads")
    return {"message": f"Successfully updated status for {count} leads to '{status}'.", "updatedCount": count}


# ---------------------------------------------------------------------------
# CALLS
# ---------------------------------------------------------------------------
@api.post("/calls")
async def create_call(request: Request, user=Depends(get_current_user)):
    b = await request.json()
    lead_id, disp = b.get("leadId"), b.get("disposition")
    if not lead_id or not disp:
        raise HTTPException(400, "leadId and disposition are required.")
    lead = store.find("leads", id=lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found.")
    if not can_access_lead(user, lead):
        raise HTTPException(403, "Forbidden: You do not have access to call this lead.")
    fdate, ftime, freason = b.get("followupDate"), b.get("followupTime"), b.get("followupReason")
    if disp in ("Callback", "Call Back Later") and not (fdate and ftime and freason):
        raise HTTPException(400, f"Conditional Validation Error: Disposition '{disp}' requires Follow-up Date, Follow-up Time, and Follow-up Reason.")
    idate, itime = b.get("interviewDate"), b.get("interviewTime")
    if disp == "Interview Scheduled" and not (idate and itime and b.get("clientId") and b.get("jobId")):
        raise HTTPException(400, "Conditional Validation Error: Disposition 'Interview Scheduled' requires Interview Date, Time, Client, and Job.")
    if disp in ("Not Interested", "Salary Issue", "Location Issue", "Job Mismatch") and not (b.get("lostReason") or b.get("notes")):
        raise HTTPException(400, f"Conditional Validation Error: Disposition '{disp}' requires a specific Reason/Remarks to prevent candidate drop-off.")
    now = utcnow()
    notes = b.get("notes")
    call_log = {
        "id": gen_id("call"), "leadId": lead_id, "recruiterId": user["id"], "recruiterName": user["name"],
        "candidateName": lead["candidateName"], "phone": lead["primaryPhone"], "disposition": disp,
        "durationSeconds": int(b.get("durationSeconds") or 0), "notes": notes or "",
        "followupDate": fdate, "followupTime": ftime, "followupReason": freason,
        "interviewDate": idate, "interviewTime": itime, "clientId": b.get("clientId"), "jobId": b.get("jobId"),
        "interviewType": b.get("interviewType"), "expectedJoiningDate": b.get("expectedJoiningDate"),
        "lostReason": b.get("lostReason") or notes, "createdAt": now_iso(),
    }
    store.col("calls").insert(0, call_log)
    new_status, new_priority = lead["leadStatus"], lead["priority"]
    next_fu, next_reason = lead.get("nextFollowupAt"), lead.get("nextFollowupReason")
    if disp == CONNECTED_INTERESTED:
        new_status, new_priority = "Interested", "Hot"
    elif disp in ("Callback", "Call Back Later"):
        new_status = "Follow-up"
        next_fu = f"{fdate}T{ftime}:00.000Z"
        next_reason = freason
        store.col("followups").append({
            "id": gen_id("flw"), "leadId": lead_id, "candidateName": lead["candidateName"],
            "candidatePhone": lead["primaryPhone"], "recruiterId": user["id"], "recruiterName": user["name"],
            "teamId": user.get("teamId"), "scheduledAt": next_fu, "reason": freason,
            "priority": lead["priority"], "status": "PENDING", "createdAt": now_iso()})
    elif disp == "Interview Scheduled":
        new_status, new_priority = "Interview Scheduled", "Hot"
        client = store.find("clients", id=b.get("clientId"))
        job = store.find("jobs", id=b.get("jobId"))
        sched_dt = f"{idate}T{itime}:00.000Z"
        tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        stage = "Today" if idate == today_str() else ("Tomorrow" if idate == tomorrow else "Scheduled")
        store.col("interviews").append({
            "id": gen_id("int"), "leadId": lead_id, "candidateName": lead["candidateName"],
            "candidatePhone": lead["primaryPhone"], "recruiterId": user["id"], "recruiterName": user["name"],
            "clientId": b.get("clientId") or lead.get("clientId") or "",
            "clientName": client["companyName"] if client else (lead.get("clientName") or "Direct Client"),
            "jobId": b.get("jobId") or lead.get("jobId") or "",
            "jobTitle": job["positionTitle"] if job else (lead.get("jobTitle") or "Role"),
            "date": idate, "time": itime, "scheduledAt": sched_dt,
            "location": b.get("interviewLocation") or (client.get("location") if client else None) or "Office / Virtual Link",
            "interviewType": b.get("interviewType") or "Face-to-face", "stage": stage,
            "confirmationStatus": "Pending", "notes": notes or "",
            "createdAt": now_iso(), "updatedAt": now_iso()})
        add_notification(user["id"], "Interview Scheduled",
                         f"Interview scheduled for {lead['candidateName']} with {client['companyName'] if client else 'Client'} on {idate} at {itime}.",
                         "interview_tomorrow", "/interviews")
    elif disp in ("Not Interested", "Salary Issue", "Location Issue", "Job Mismatch", "Already Working"):
        new_status, new_priority = "Lost", "Cold"
    elif disp == "Invalid Number":
        new_status, new_priority = "Invalid Number", "Cold"
    elif disp in ("No Answer", "Busy", "Switched Off", "Unreachable"):
        new_status = "Calling"
    updated = upd_lead(lead_id, {
        "callAttempts": (lead.get("callAttempts") or 0) + 1, "lastCallAt": now_iso(),
        "lastCallOutcome": disp, "leadStatus": new_status, "priority": new_priority,
        "nextFollowupAt": next_fu, "nextFollowupReason": next_reason,
        "notesSummary": f"{notes} (Call: {disp})" if notes else lead.get("notesSummary"),
        "lostReason": b.get("lostReason") or (disp if new_status == "Lost" else None),
        "updatedById": user["id"], "updatedByName": user["name"]})
    log_activity(lead_id, "call", f"Call Disposition: {disp}",
                 f"{disp} - Notes: {notes}" if notes else f"Call recorded with outcome: {disp}", user,
                 metadata={"disposition": disp, "durationSeconds": b.get("durationSeconds"), "callLogId": call_log["id"]})
    log_audit(user, "LOG_CALL", "CallLog", call_log["id"], f"Recruiter logged call with {lead['candidateName']} ({disp}).", new={"lead": lead["candidateName"], "disposition": disp})
    await flush("calls", "leads", "followups", "interviews")
    return {"callLog": call_log, "lead": updated}


@api.get("/calls")
async def list_calls(user=Depends(get_current_user)):
    calls = store.col("calls")
    if user["role"] == "recruiter":
        calls = [c for c in calls if c["recruiterId"] == user["id"]]
    return {"calls": calls}


# ---------------------------------------------------------------------------
# FOLLOWUPS
# ---------------------------------------------------------------------------
@api.get("/followups")
async def list_followups(user=Depends(get_current_user)):
    fus = store.col("followups")
    if user["role"] == "recruiter":
        fus = [f for f in fus if f["recruiterId"] == user["id"]]
    elif user["role"] == "team_leader":
        fus = [f for f in fus if f.get("teamId") == user.get("teamId") or f["recruiterId"] == user["id"]]
    now = utcnow()
    today = today_str()
    out = []
    for f in fus:
        sched = dt(f["scheduledAt"])
        diff = (now - sched).total_seconds() if sched else 0
        overdue = diff > 0 and f["status"] == "PENDING"
        label = ""
        if overdue:
            hours = int(diff // 3600)
            days = hours // 24
            label = f"OVERDUE BY {days}d" if days >= 1 else f"OVERDUE BY {max(1, hours)}h"
        out.append({**f, "isOverdue": overdue, "overdueLabel": label, "isToday": f["scheduledAt"].startswith(today)})
    return {"followups": out}


@api.patch("/followups/{fid}/complete")
async def complete_followup(fid: str, request: Request, user=Depends(get_current_user)):
    f = store.find("followups", id=fid)
    if not f:
        raise HTTPException(404, "Follow-up not found.")
    b = await request.json()
    f.update({"status": "COMPLETED", "completedAt": now_iso(), "notes": b.get("notes") or "Follow-up marked completed."})
    log_activity(f["leadId"], "followup", "Follow-up Completed", f"Follow-up completed by {user['name']}. Notes: {b.get('notes') or 'Completed'}", user)
    await flush("followups")
    return {"followup": f}


@api.patch("/followups/{fid}/reschedule")
async def reschedule_followup(fid: str, request: Request, user=Depends(get_current_user)):
    f = store.find("followups", id=fid)
    if not f:
        raise HTTPException(404, "Follow-up not found.")
    b = await request.json()
    if not b.get("newDate") or not b.get("newTime"):
        raise HTTPException(400, "New follow-up date and time are required.")
    ndt = f"{b['newDate']}T{b['newTime']}:00.000Z"
    f.update({"scheduledAt": ndt, "reason": b.get("reason") or f["reason"], "status": "PENDING"})
    upd_lead(f["leadId"], {"nextFollowupAt": ndt, "nextFollowupReason": b.get("reason") or f["reason"],
                           "updatedById": user["id"], "updatedByName": user["name"]})
    log_activity(f["leadId"], "followup", "Follow-up Rescheduled", f"Rescheduled to {b['newDate']} at {b['newTime']}. Reason: {b.get('reason') or 'Recruiter follow-up call'}.", user)
    await flush("followups", "leads")
    return {"followup": f}


# ---------------------------------------------------------------------------
# INTERVIEWS
# ---------------------------------------------------------------------------
@api.get("/interviews")
async def list_interviews(user=Depends(get_current_user)):
    ivs = store.col("interviews")
    if user["role"] == "recruiter":
        ivs = [i for i in ivs if i["recruiterId"] == user["id"]]
    today = today_str()
    tomorrow = (utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
    out = []
    for i in ivs:
        stage = i["stage"]
        if stage in ("Scheduled", "Today", "Tomorrow"):
            if i["date"] == today:
                stage = "Today"
            elif i["date"] == tomorrow:
                stage = "Tomorrow"
        out.append({**i, "stage": stage})
    return {"interviews": out}


@api.post("/interviews")
async def create_interview(request: Request, user=Depends(get_current_user)):
    b = await request.json()
    if not all(b.get(k) for k in ["leadId", "clientId", "jobId", "date", "time"]):
        raise HTTPException(400, "leadId, clientId, jobId, date, and time are required.")
    lead = store.find("leads", id=b["leadId"])
    if not lead:
        raise HTTPException(404, "Candidate lead not found.")
    client = store.find("clients", id=b["clientId"])
    job = store.find("jobs", id=b["jobId"])
    sched = f"{b['date']}T{b['time']}:00.000Z"
    today = today_str()
    tomorrow = (utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
    stage = "Today" if b["date"] == today else ("Tomorrow" if b["date"] == tomorrow else "Scheduled")
    iv = {
        "id": gen_id("int"), "leadId": lead["id"], "candidateName": lead["candidateName"],
        "candidatePhone": lead["primaryPhone"], "recruiterId": user["id"], "recruiterName": user["name"],
        "clientId": b["clientId"], "clientName": client["companyName"] if client else (lead.get("clientName") or "Client"),
        "jobId": b["jobId"], "jobTitle": job["positionTitle"] if job else (lead.get("jobTitle") or "Position"),
        "date": b["date"], "time": b["time"], "scheduledAt": sched,
        "location": b.get("location") or (client.get("location") if client else None) or "Office / Virtual",
        "interviewType": b.get("interviewType") or "Face-to-face", "stage": stage,
        "confirmationStatus": "Pending", "contactPerson": b.get("contactPerson") or (client.get("contactPerson") if client else None),
        "notes": b.get("notes") or "", "createdAt": now_iso(), "updatedAt": now_iso(),
    }
    store.col("interviews").append(iv)
    upd_lead(lead["id"], {"leadStatus": "Interview Scheduled", "interviewStatus": stage, "priority": "Hot",
                          "clientId": b["clientId"], "clientName": client["companyName"] if client else None,
                          "jobId": b["jobId"], "jobTitle": job["positionTitle"] if job else None,
                          "updatedById": user["id"], "updatedByName": user["name"]})
    log_activity(lead["id"], "interview", "Interview Scheduled", f"Interview booked with {client['companyName'] if client else 'client'} on {b['date']} at {b['time']}.", user)
    await flush("interviews", "leads")
    return {"interview": iv}


@api.patch("/interviews/{iid}/stage")
async def interview_stage(iid: str, request: Request, user=Depends(get_current_user)):
    iv = store.find("interviews", id=iid)
    if not iv:
        raise HTTPException(404, "Interview record not found.")
    b = await request.json()
    stage = b.get("stage")
    if not stage:
        raise HTTPException(400, "New interview stage is required.")
    iv.update({"stage": stage, "resultNotes": b.get("resultNotes") or iv.get("resultNotes"), "attendanceMarkedAt": now_iso(), "updatedAt": now_iso()})
    lead_upd = {"interviewStatus": stage, "updatedById": user["id"], "updatedByName": user["name"]}
    if stage == "Attended":
        lead_upd["leadStatus"] = "Interview Attended"
    elif stage == "Selected":
        lead_upd["leadStatus"] = "Selected"
        lead_upd["joiningStatus"] = "Offer Pending"
        if b.get("expectedJoiningDate"):
            lead_upd["expectedJoiningDate"] = b["expectedJoiningDate"]
        if b.get("offeredSalary"):
            lead_upd["offeredSalary"] = int(b["offeredSalary"])
        if not any(j["leadId"] == iv["leadId"] for j in store.col("joinings")):
            store.col("joinings").append({
                "id": gen_id("join"), "leadId": iv["leadId"], "candidateName": iv["candidateName"],
                "candidatePhone": iv["candidatePhone"], "recruiterId": iv["recruiterId"], "recruiterName": iv["recruiterName"],
                "clientId": iv["clientId"], "clientName": iv["clientName"], "jobId": iv["jobId"], "jobTitle": iv["jobTitle"],
                "status": "Selected", "selectionDate": today_str(), "expectedJoiningDate": b.get("expectedJoiningDate"),
                "offeredSalary": int(b["offeredSalary"]) if b.get("offeredSalary") else None,
                "confirmationStatus": "Pending", "remarks": b.get("resultNotes") or "Candidate cleared client interview rounds.",
                "createdAt": now_iso(), "updatedAt": now_iso()})
    elif stage == "Rejected":
        lead_upd["leadStatus"] = "Lost"
        lead_upd["lostReason"] = f"Rejected in interview: {b.get('resultNotes') or 'Client feedback'}"
    elif stage == "Not Attended":
        lead_upd["leadStatus"] = "Calling"
    upd_lead(iv["leadId"], lead_upd)
    log_activity(iv["leadId"], "interview", f"Interview Result: {stage}", f"Interview status marked as '{stage}'. Remarks: {b.get('resultNotes') or 'Updated by recruiter'}.", user)
    await flush("interviews", "leads", "joinings")
    return {"interview": iv}


@api.patch("/interviews/{iid}/confirmation")
async def interview_confirmation(iid: str, request: Request, user=Depends(get_current_user)):
    iv = store.find("interviews", id=iid)
    if not iv:
        raise HTTPException(404, "Interview not found.")
    b = await request.json()
    iv["confirmationStatus"] = b.get("confirmationStatus")
    iv["updatedAt"] = now_iso()
    log_activity(iv["leadId"], "interview", f"Interview Attendance Confirmation: {b.get('confirmationStatus')}", f"Candidate interview attendance confirmation marked as '{b.get('confirmationStatus')}'.", user)
    await flush("interviews")
    return {"interview": iv}


# ---------------------------------------------------------------------------
# JOININGS
# ---------------------------------------------------------------------------
@api.get("/joinings")
async def list_joinings(user=Depends(get_current_user)):
    js = store.col("joinings")
    if user["role"] == "recruiter":
        js = [j for j in js if j["recruiterId"] == user["id"]]
    return {"joinings": js}


@api.patch("/joinings/{jid}")
async def patch_joining(jid: str, request: Request, user=Depends(get_current_user)):
    j = store.find("joinings", id=jid)
    if not j:
        raise HTTPException(404, "Joining record not found.")
    b = await request.json()
    j.update({
        "status": b.get("status") or j["status"],
        "expectedJoiningDate": b["expectedJoiningDate"] if b.get("expectedJoiningDate") is not None else j.get("expectedJoiningDate"),
        "actualJoiningDate": b["actualJoiningDate"] if b.get("actualJoiningDate") is not None else j.get("actualJoiningDate"),
        "offeredSalary": int(b["offeredSalary"]) if b.get("offeredSalary") else j.get("offeredSalary"),
        "confirmationStatus": b.get("confirmationStatus") or j.get("confirmationStatus"),
        "remarks": b.get("remarks") or j.get("remarks"), "updatedAt": now_iso(),
    })
    lead_upd = {"joiningStatus": j["status"], "expectedJoiningDate": j.get("expectedJoiningDate"),
                "actualJoiningDate": j.get("actualJoiningDate"), "updatedById": user["id"], "updatedByName": user["name"]}
    if j["status"] == "Joined":
        lead_upd["leadStatus"] = "Joined"
        lead_upd["actualJoiningDate"] = j.get("actualJoiningDate") or today_str()
    elif j["status"] == "Joining Confirmed":
        lead_upd["leadStatus"] = "Joining Scheduled"
    elif j["status"] in ("No Show", "Dropped", "Client Rejected"):
        lead_upd["leadStatus"] = "Lost"
        lead_upd["lostReason"] = f"Joining drop: {j['status']} - {b.get('remarks') or ''}"
    upd_lead(j["leadId"], lead_upd)
    log_activity(j["leadId"], "joining", f"Joining Status: {j['status']}", f"Joining tracker updated to '{j['status']}'. Expected Joining: {j.get('expectedJoiningDate') or 'Not set'}.", user)
    log_audit(user, "UPDATE_JOINING", "Joining", jid, f"Updated joining status for candidate '{j['candidateName']}' to '{j['status']}'.", new=j)
    await flush("joinings", "leads")
    return {"joining": j}


# ---------------------------------------------------------------------------
# CLIENTS & JOBS
# ---------------------------------------------------------------------------
@api.get("/clients")
async def list_clients(user=Depends(get_current_user)):
    leads = store.col("leads")
    jobs = store.col("jobs")
    out = []
    for c in store.col("clients"):
        cl = [l for l in leads if l.get("clientId") == c["id"]]
        out.append({**c, "stats": {
            "candidatesSubmitted": len(cl),
            "interviews": len([l for l in cl if l.get("interviewStatus") and l["interviewStatus"] != "Pending"]),
            "attended": len([l for l in cl if l.get("interviewStatus") in ("Attended", "Selected", "Rejected")]),
            "selected": len([l for l in cl if l.get("interviewStatus") == "Selected" or l["leadStatus"] in ("Selected", "Joined")]),
            "joined": len([l for l in cl if l["leadStatus"] == "Joined" or l.get("joiningStatus") == "Joined"]),
            "activeJobs": len([j for j in jobs if j["clientId"] == c["id"] and j["status"] == "Active"]),
        }})
    return {"clients": out}


@api.post("/clients")
async def create_client(request: Request, user=Depends(require_role("admin"))):
    b = await request.json()
    if not b.get("companyName") or not b.get("contactPerson"):
        raise HTTPException(400, "Company Name and Contact Person are required.")
    c = {"id": gen_id("cli"), "companyName": b["companyName"], "contactPerson": b["contactPerson"],
         "phone": b.get("phone") or "", "email": b.get("email") or "", "location": b.get("location") or "",
         "paymentTerms": b.get("paymentTerms") or "30 days", "replacementTerms": b.get("replacementTerms") or "90 days free replacement",
         "isActive": True, "createdAt": now_iso(), "updatedAt": now_iso()}
    store.col("clients").append(c)
    log_audit(user, "CREATE_CLIENT", "Client", c["id"], f"Added new corporate hiring client '{c['companyName']}'.", new=c)
    await flush("clients")
    return {"client": c}


@api.patch("/clients/{cid}")
async def update_client(cid: str, request: Request, user=Depends(require_role("admin"))):
    c = store.find("clients", id=cid)
    if not c:
        raise HTTPException(404, "Client not found.")
    b = await request.json()
    b.pop("id", None)
    c.update(b)
    c["updatedAt"] = now_iso()
    await flush("clients")
    return {"client": c}


@api.get("/jobs")
async def list_jobs(user=Depends(get_current_user)):
    leads = store.col("leads")
    out = []
    for job in store.col("jobs"):
        jl = [l for l in leads if l.get("jobId") == job["id"]]
        out.append({**job, "stats": {
            "totalLeads": len(jl),
            "interviewed": len([l for l in jl if l.get("interviewStatus") and l["interviewStatus"] != "Pending"]),
            "selected": len([l for l in jl if l.get("interviewStatus") == "Selected" or l["leadStatus"] in ("Selected", "Joined")]),
            "joined": len([l for l in jl if l["leadStatus"] == "Joined"]),
        }})
    return {"jobs": out}


@api.post("/jobs")
async def create_job(request: Request, user=Depends(require_role("admin"))):
    b = await request.json()
    if not b.get("clientId") or not b.get("positionTitle"):
        raise HTTPException(400, "Client and Position Title are required.")
    client = store.find("clients", id=b["clientId"])
    if not client:
        raise HTTPException(404, "Client not found.")
    job = {"id": gen_id("job"), "clientId": b["clientId"], "clientName": client["companyName"],
           "positionTitle": b["positionTitle"], "location": b.get("location") or client["location"],
           "salaryRange": b.get("salaryRange") or "Negotiable", "experienceRequired": b.get("experienceRequired") or "Any",
           "numberOfOpenings": int(b.get("numberOfOpenings") or 10), "requirements": b.get("requirements") or "",
           "status": "Active", "createdAt": now_iso(), "updatedAt": now_iso()}
    store.col("jobs").append(job)
    log_audit(user, "CREATE_JOB", "Job", job["id"], f"Created job opening '{job['positionTitle']}' for '{client['companyName']}'.", new=job)
    await flush("jobs")
    return {"job": job}


@api.patch("/jobs/{jid}")
async def update_job(jid: str, request: Request, user=Depends(require_role("admin"))):
    job = store.find("jobs", id=jid)
    if not job:
        raise HTTPException(404, "Job not found.")
    b = await request.json()
    b.pop("id", None)
    job.update(b)
    job["updatedAt"] = now_iso()
    await flush("jobs")
    return {"job": job}


# additional route modules
import routes_analytics  # noqa: E402
import routes_bridge  # noqa: E402
routes_analytics.register(api)
routes_bridge.register(api, CONNECTED_INTERESTED)
app.include_router(api)
