"""Shared core: config, Mongo-backed in-memory store, auth, and domain helpers."""
import os
import re
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Any

import jwt
import bcrypt
from fastapi import Header, Query, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_EXPIRY_DAYS = int(os.environ.get("JWT_EXPIRY_DAYS", "7"))
JWT_ALG = "HS256"

_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]

LIST_COLLECTIONS = [
    "users", "leads", "activities", "calls", "followups", "interviews",
    "joinings", "clients", "jobs", "templates", "notifications", "auditLogs",
    "callBridgeDevices", "callBridgeCalls",
]
SINGLETONS = ["settings", "callBridgeSettings"]

NON_CONNECTED = ["No Answer", "Busy", "Switched Off", "Unreachable", "Invalid Number"]


# ---------------------------------------------------------------------------
# Time / id helpers
# ---------------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + \
        f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z"


def gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# Password / JWT
# ---------------------------------------------------------------------------
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def default_permissions(role: str) -> dict:
    if role == "admin":
        return {"canExportData": True, "canDeleteLeads": True, "canViewAllLeads": True,
                "canViewCandidatePhone": True, "canBulkReassign": True, "canManageTemplates": True}
    if role == "team_leader":
        return {"canExportData": True, "canDeleteLeads": False, "canViewAllLeads": False,
                "canViewCandidatePhone": True, "canBulkReassign": True, "canManageTemplates": True}
    return {"canExportData": False, "canDeleteLeads": False, "canViewAllLeads": False,
            "canViewCandidatePhone": False, "canBulkReassign": False, "canManageTemplates": False}


def generate_token(user: dict) -> str:
    payload = {
        "id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"],
        "teamId": user.get("teamId"), "teamName": user.get("teamName"),
        "permissions": user.get("permissions") or default_permissions(user["role"]),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        return None


# ---------------------------------------------------------------------------
# In-memory store with write-through persistence to MongoDB
# ---------------------------------------------------------------------------
class Store:
    def __init__(self):
        self.state: dict[str, Any] = {}
        self.loaded = False

    async def load(self):
        for coll in LIST_COLLECTIONS:
            docs = await db[coll].find({}).to_list(length=None)
            for d in docs:
                d.pop("_id", None)
            self.state[coll] = docs
        for s in SINGLETONS:
            doc = await db["singletons"].find_one({"_key": s})
            self.state[s] = (doc or {}).get("value") if doc else None

        if not self.state.get("users"):
            from seed_data import build_seed
            seed = build_seed(hash_password)
            self.state = seed
            for coll in LIST_COLLECTIONS:
                await self.flush(coll)
            for s in SINGLETONS:
                await self.flush(s)
        self.loaded = True

    async def flush(self, coll: str):
        if coll in SINGLETONS:
            await db["singletons"].replace_one(
                {"_key": coll}, {"_key": coll, "value": self.state.get(coll)}, upsert=True)
            return
        await db[coll].delete_many({})
        rows = self.state.get(coll) or []
        if rows:
            await db[coll].insert_many([dict(r) for r in rows])

    def flush_bg(self, *colls: str):
        async def _run():
            for c in colls:
                await self.flush(c)
        try:
            asyncio.get_event_loop().create_task(_run())
        except RuntimeError:
            pass

    # convenience accessors ------------------------------------------------
    def col(self, name: str) -> list:
        return self.state.setdefault(name, [])

    def find(self, coll: str, **match):
        for r in self.col(coll):
            if all(r.get(k) == v for k, v in match.items()):
                return r
        return None


store = Store()


# ---------------------------------------------------------------------------
# Auth dependencies
# ---------------------------------------------------------------------------
def _extract_token(authorization: Optional[str], token_q: Optional[str], x_access: Optional[str]) -> Optional[str]:
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    if token_q:
        return token_q
    if x_access:
        return x_access
    return None


async def get_current_user(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
    x_access_token: Optional[str] = Header(None),
) -> dict:
    raw = _extract_token(authorization, token, x_access_token)
    if not raw:
        raise HTTPException(status_code=401, detail="Authentication required. No token provided.")
    payload = decode_token(raw)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token.")
    user = store.find("users", id=payload.get("id"))
    if not user or not user.get("isActive"):
        raise HTTPException(status_code=403, detail="User account is inactive or no longer exists.")
    # Always trust the server-side role/permissions, not the token contents.
    payload["role"] = user["role"]
    payload["permissions"] = user.get("permissions") or default_permissions(user["role"])
    payload["teamId"] = user.get("teamId")
    payload["teamName"] = user.get("teamName")
    return payload


def require_role(*roles: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: Access requires one of [{', '.join(roles)}] roles. Your role is '{user['role']}'.")
        return user
    return _dep


def can_access_lead(user: dict, lead: dict) -> bool:
    if user["role"] == "admin" or (user.get("permissions") or {}).get("canViewAllLeads"):
        return True
    if user["role"] == "team_leader":
        return (lead.get("teamId") and lead.get("teamId") == user.get("teamId")) or \
            lead.get("assignedRecruiterId") == user["id"]
    if user["role"] == "recruiter":
        return lead.get("assignedRecruiterId") == user["id"]
    return False


# ---------------------------------------------------------------------------
# Domain helpers (ported faithfully from server/db.ts)
# ---------------------------------------------------------------------------
def normalize_phone(phone: str) -> dict:
    if not phone:
        return {"normalized": "", "isValid": False, "status": "INVALID"}
    cleaned = re.sub(r"[^0-9+]", "", phone.strip())
    if cleaned.startswith("+91"):
        cleaned = cleaned[3:]
    elif cleaned.startswith("91") and len(cleaned) == 12:
        cleaned = cleaned[2:]
    elif cleaned.startswith("0") and len(cleaned) == 11:
        cleaned = cleaned[1:]
    digits = re.sub(r"\D", "", cleaned)
    if len(digits) == 10 and re.match(r"^[6-9]\d{9}$", digits):
        return {"normalized": digits, "isValid": True, "status": "VERIFIED"}
    if 8 <= len(digits) <= 15:
        return {"normalized": digits, "isValid": True, "status": "NEEDS_VERIFY"}
    return {"normalized": digits, "isValid": False, "status": "INVALID"}


def calculate_scorecard(data: dict) -> dict:
    score = 0
    dealbreakers: list[str] = []
    comm = data.get("communicationLevel")
    if comm == "Excellent":
        score += 25
    elif comm == "Good":
        score += 20
    elif comm == "Average":
        score += 14
    else:
        score += 6
        dealbreakers.append("Basic communication: may disqualify for voice/client processes")

    shift = data.get("shiftAvailability")
    if shift in ("24/7 Rotational", "US Shift"):
        score += 20
    elif shift == "Night Shift":
        score += 18
    else:
        jr = (data.get("jobRequiredShift") or "").lower()
        if "rotational" in jr:
            score += 5
            dealbreakers.append("Day-only constraint conflicts with 24/7 rotational requirement")
        else:
            score += 16

    commute = data.get("commuteDistance")
    if commute == "Within 10km":
        score += 20
    elif commute == "10-25km":
        score += 15
    elif commute == "Transport Needed":
        score += 12
    elif commute == "Relocation Ready":
        score += 14
    else:
        score += 8
        dealbreakers.append("Candidate located 25km+ away with no company transport")

    npd = data.get("noticePeriodDays") or 0
    if npd == 0:
        score += 15
    elif npd <= 7:
        score += 13
    elif npd <= 15:
        score += 10
    elif npd <= 30:
        score += 6
    else:
        score += 2
        dealbreakers.append("Notice period exceeds 30 days")

    exp_ctc = data.get("expectedCtcMonthly")
    off_ctc = data.get("offeredCtcMonthly")
    if exp_ctc and off_ctc:
        if exp_ctc <= off_ctc:
            score += 10
        elif exp_ctc <= off_ctc * 1.15:
            score += 6
        else:
            dealbreakers.append(
                f"Salary expectation (INR {exp_ctc:,}) exceeds budget (INR {off_ctc:,})")
            score += 2
    else:
        score += 8

    tw = data.get("typingSpeedWpm") or 0
    if tw >= 30:
        score += 5
    elif tw >= 20:
        score += 3
    skills = data.get("skills") or []
    if len(skills) >= 2:
        score += 5
    elif len(skills) == 1:
        score += 3

    fit = min(100, max(0, score))
    if dealbreakers or fit < 50:
        verdict = "Not Qualified" if (len(dealbreakers) > 1 or fit < 45) else "High Risk"
    elif fit < 70:
        verdict = "Borderline Fit"
    else:
        verdict = "Strong Fit"
    return {"fitScore": fit, "dealbreakers": dealbreakers, "overallVerdict": verdict}


def match_jobs_for_lead(lead: dict, jobs: list) -> list:
    results = []
    for job in [j for j in jobs if j.get("status") == "Active"]:
        score = 30
        reasons: list[str] = []
        dealbreakers: list[str] = []
        city = (lead.get("city") or "").lower()
        loc = (job.get("location") or "").lower()
        if city and loc:
            if loc in city or city in loc:
                score += 25
                reasons.append(f"Location matched: {job.get('location')}")
            else:
                dealbreakers.append(f"Location mismatch: candidate is in {lead.get('city')}, job is in {job.get('location')}")
        exp_sal = lead.get("expectedSalary")
        if exp_sal and job.get("salaryRange"):
            nums = [int(n) for n in re.sub(r"[^0-9-]", "", job["salaryRange"]).split("-") if n.strip().isdigit()]
            max_budget = max(nums) if len(nums) >= 2 else (nums[0] if nums else 0)
            if max_budget > 0:
                if exp_sal <= max_budget:
                    score += 25
                    reasons.append(f"Salary in budget: Expected INR {exp_sal:,} <= Max INR {max_budget:,}")
                elif exp_sal <= max_budget * 1.15:
                    score += 15
                    reasons.append(f"Salary close to budget: Expected INR {exp_sal:,}")
                else:
                    score -= 10
                    dealbreakers.append(f"Salary expected INR {exp_sal:,} exceeds max budget INR {max_budget:,}")
        else:
            score += 15
        if lead.get("experience"):
            score += 15
            reasons.append(f"Experience background: {lead.get('experience')}")
        sc = lead.get("scorecard")
        if sc:
            if sc.get("overallVerdict") == "Strong Fit":
                score += 10
                reasons.append(f"Screened strong fit ({sc.get('fitScore')}%)")
            elif sc.get("overallVerdict") in ("High Risk", "Not Qualified"):
                score -= 15
        match_score = max(10, min(99, score))
        results.append({
            "job": job, "matchScore": match_score, "reasons": reasons,
            "dealbreakers": dealbreakers,
            "isTopMatch": match_score >= 70 and len(dealbreakers) == 0,
        })
    results.sort(key=lambda x: x["matchScore"], reverse=True)
    return results


# ---------------------------------------------------------------------------
# Audit / activity / notification helpers
# ---------------------------------------------------------------------------
def log_audit(user: dict, action: str, entity: str, entity_id: str, details: str,
              previous=None, new=None):
    entry = {
        "id": gen_id("aud"), "userId": user["id"], "userName": user["name"],
        "userRole": user["role"], "action": action, "entity": entity, "entityId": entity_id,
        "previousValue": previous, "newValue": new, "details": details, "createdAt": now_iso(),
    }
    store.col("auditLogs").insert(0, entry)
    if len(store.col("auditLogs")) > 1000:
        store.state["auditLogs"] = store.col("auditLogs")[:1000]
    store.flush_bg("auditLogs")
    return entry


def log_activity(lead_id: str, atype: str, title: str, description: str, user: dict, metadata=None):
    act = {
        "id": gen_id("act"), "leadId": lead_id, "type": atype, "title": title,
        "description": description,
        "performedBy": {"id": user["id"], "name": user["name"], "role": user["role"]},
        "metadata": metadata, "createdAt": now_iso(),
    }
    store.col("activities").insert(0, act)
    store.flush_bg("activities")
    return act


def add_notification(user_id: str, title: str, message: str, ntype: str, link_to: str = None):
    n = {
        "id": gen_id("notif"), "userId": user_id, "title": title, "message": message,
        "type": ntype, "linkTo": link_to, "isRead": False, "createdAt": now_iso(),
    }
    store.col("notifications").insert(0, n)
    store.flush_bg("notifications")
    return n


def public_user(u: dict) -> dict:
    return {k: v for k, v in u.items() if k != "passwordHash"}
