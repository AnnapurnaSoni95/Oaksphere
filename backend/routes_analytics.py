"""Analytics, reports, imports, duplicates, notifications, settings, templates, scorecard, leaderboard."""
from datetime import datetime, timezone, timedelta
from fastapi import Request, Depends, HTTPException
from fastapi.responses import PlainTextResponse

from common import (store, gen_id, now_iso, today_str, get_current_user, require_role,
                    normalize_phone, calculate_scorecard, match_jobs_for_lead, log_audit,
                    log_activity, NON_CONNECTED)

CI = "Connected \u2013 Interested"


def dt(iso):
    if not iso:
        return None
    try:
        return datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return None


def utcnow():
    return datetime.now(timezone.utc)


def _month():
    return today_str()[:7]


def _scope(user, leads=None, calls=None, ivs=None, fus=None, jns=None):
    L = leads if leads is not None else store.col("leads")
    C = calls if calls is not None else store.col("calls")
    I = ivs if ivs is not None else store.col("interviews")
    F = fus if fus is not None else store.col("followups")
    J = jns if jns is not None else store.col("joinings")
    if user["role"] == "recruiter":
        uid = user["id"]
        L = [l for l in L if l.get("assignedRecruiterId") == uid]
        C = [c for c in C if c["recruiterId"] == uid]
        I = [i for i in I if i["recruiterId"] == uid]
        F = [f for f in F if f["recruiterId"] == uid]
        J = [j for j in J if j["recruiterId"] == uid]
    elif user["role"] == "team_leader":
        tid = user.get("teamId")
        L = [l for l in L if l.get("teamId") == tid or l.get("assignedRecruiterId") == user["id"]]
        team_ids = [u["id"] for u in store.col("users") if u.get("teamId") == tid or u["id"] == user["id"]]
        C = [c for c in C if c["recruiterId"] in team_ids]
        I = [i for i in I if i["recruiterId"] in team_ids]
        F = [f for f in F if f["recruiterId"] in team_ids or f.get("teamId") == tid]
        J = [j for j in J if j["recruiterId"] in team_ids]
    return L, C, I, F, J


def _upd_lead(lead_id, updates):
    for l in store.col("leads"):
        if l["id"] == lead_id:
            l.update(updates)
            l["updatedAt"] = now_iso()
            return l
    return None


def register(api):

    @api.get("/analytics/dashboard")
    @api.get("/dashboard/stats")
    async def dashboard_stats(user=Depends(get_current_user)):
        leads, calls, ivs, fus, jns = _scope(user)
        now, today, mp = utcnow(), today_str(), _month()
        tc = [c for c in calls if c["createdAt"].startswith(today)]
        tconn = [c for c in tc if c["disposition"] not in NON_CONNECTED]
        tint = [c for c in tc if c["disposition"] == CI]
        tfd = len([f for f in fus if f["scheduledAt"].startswith(today) and f["status"] == "PENDING"])
        tfo = len([f for f in fus if dt(f["scheduledAt"]) and dt(f["scheduledAt"]) < now and f["status"] == "PENDING"])
        tiv = [i for i in ivs if i["date"] == today]
        tatt = len([i for i in tiv if i["stage"] in ("Attended", "Selected", "Rejected")])
        tsel = len([l for l in leads if (l["leadStatus"] == "Selected" or l.get("interviewStatus") == "Selected") and l["updatedAt"].startswith(today)])
        tjoin = len([l for l in leads if l["leadStatus"] == "Joined" and l.get("actualJoiningDate") == today])
        mc = [c for c in calls if c["createdAt"].startswith(mp)]
        mconn = len([c for c in mc if c["disposition"] not in NON_CONNECTED])
        mint = len([c for c in mc if c["disposition"] == CI])
        miv = len([i for i in ivs if i["date"].startswith(mp)])
        matt = len([i for i in ivs if i["date"].startswith(mp) and i["stage"] in ("Attended", "Selected", "Rejected")])
        msel = len([l for l in leads if (l["leadStatus"] == "Selected" or l.get("interviewStatus") == "Selected") and l["updatedAt"].startswith(mp)])
        mjoin = len([l for l in leads if l["leadStatus"] == "Joined" and l.get("actualJoiningDate") and l["actualJoiningDate"].startswith(mp)])
        recs = [u for u in store.col("users") if u["role"] == "recruiter"]
        rstats = []
        for r in recs:
            rc = [c for c in store.col("calls") if c["recruiterId"] == r["id"] and c["createdAt"].startswith(today)]
            rconn = len([c for c in rc if c["disposition"] not in NON_CONNECTED])
            rl = len([i for i in store.col("interviews") if i["recruiterId"] == r["id"] and i["createdAt"].startswith(today)])
            rj = len([l for l in store.col("leads") if l.get("assignedRecruiterId") == r["id"] and l["leadStatus"] == "Joined" and l.get("actualJoiningDate") and l["actualJoiningDate"].startswith(mp)])
            rstats.append({"id": r["id"], "name": r["name"], "teamName": r.get("teamName"),
                           "actualDailyCalls": len(rc), "dailyCallTarget": r.get("dailyCallTarget", 60),
                           "actualDailyConnected": rconn, "dailyConnectedTarget": r.get("dailyConnectedTarget", 30),
                           "actualDailyLineups": rl, "dailyLineupTarget": r.get("dailyLineupTarget", 5),
                           "actualMonthlyJoinings": rj, "monthlyJoiningTarget": r.get("monthlyJoiningTarget", 8)})
        u = store.find("users", id=user["id"]) or {}
        return {
            "today": {"calls": len(tc), "connected": len(tconn), "interested": len(tint), "followupsDue": tfd,
                      "followupsOverdue": tfo, "interviews": len(tiv), "attendance": tatt, "selected": tsel, "joined": tjoin},
            "monthly": {"leads": len(leads), "called": len([l for l in leads if l["callAttempts"] > 0]),
                        "connected": mconn, "interested": mint, "interviews": miv, "attendance": matt, "selected": msel, "joined": mjoin},
            "recruiters": rstats,
            "userTargets": {"dailyCallTarget": u.get("dailyCallTarget", 60), "dailyConnectedTarget": u.get("dailyConnectedTarget", 30),
                            "dailyLineupTarget": u.get("dailyLineupTarget", 5), "monthlyJoiningTarget": u.get("monthlyJoiningTarget", 8)},
            "exceptions": {"overdueFollowups": tfo,
                           "neverCalledLeads": len([l for l in leads if l["callAttempts"] == 0 and l["leadStatus"] not in ("Joined", "Lost")]),
                           "selectedWithoutJoiningDate": len([l for l in leads if l["leadStatus"] == "Selected" and not l.get("expectedJoiningDate")]),
                           "unassignedLeads": len([l for l in leads if not l.get("assignedRecruiterId") or l.get("assignedRecruiterName") == "Unassigned"])},
        }

    @api.get("/analytics/funnel")
    async def analytics_funnel(request: Request, user=Depends(get_current_user)):
        leads, calls, _, _, _ = _scope(user)
        q = request.query_params
        if q.get("recruiterId"):
            leads = [l for l in leads if l.get("assignedRecruiterId") == q.get("recruiterId")]
        if q.get("clientId"):
            leads = [l for l in leads if l.get("clientId") == q.get("clientId")]
        if q.get("jobId"):
            leads = [l for l in leads if l.get("jobId") == q.get("jobId")]
        if q.get("source"):
            leads = [l for l in leads if l.get("leadSource") == q.get("source")]
        total = len(leads)
        called = len([l for l in leads if l["callAttempts"] > 0])
        connected = len([l for l in leads if l.get("lastCallOutcome") and l["lastCallOutcome"] not in NON_CONNECTED])
        interested = len([l for l in leads if l["leadStatus"] in ("Interested", "Interview Scheduled", "Interview Attended", "Selected", "Joining Scheduled", "Joined")])
        interview = len([l for l in leads if l.get("interviewStatus") or l["leadStatus"] in ("Interview Scheduled", "Interview Attended", "Selected", "Joining Scheduled", "Joined")])
        attended = len([l for l in leads if l.get("interviewStatus") in ("Attended", "Selected", "Rejected") or l["leadStatus"] in ("Interview Attended", "Selected", "Joining Scheduled", "Joined")])
        selected = len([l for l in leads if l.get("interviewStatus") == "Selected" or l["leadStatus"] in ("Selected", "Joining Scheduled", "Joined")])
        joined = len([l for l in leads if l["leadStatus"] == "Joined" or l.get("joiningStatus") == "Joined"])
        def pct(n): return round(n / total * 100) if total else 0
        return {"funnel": [{"stage": "Leads", "count": total, "percentage": 100},
                           {"stage": "Called", "count": called, "percentage": pct(called)},
                           {"stage": "Connected", "count": connected, "percentage": pct(connected)},
                           {"stage": "Interested", "count": interested, "percentage": pct(interested)},
                           {"stage": "Interview", "count": interview, "percentage": pct(interview)},
                           {"stage": "Attended", "count": attended, "percentage": pct(attended)},
                           {"stage": "Selected", "count": selected, "percentage": pct(selected)},
                           {"stage": "Joined", "count": joined, "percentage": pct(joined)}]}

    @api.get("/analytics/recruiter-performance")
    async def recruiter_performance(user=Depends(require_role("admin", "team_leader"))):
        recs = [u for u in store.col("users") if u["role"] == "recruiter"]
        if user["role"] == "team_leader":
            recs = [u for u in recs if u.get("teamId") == user.get("teamId")]
        calls, leads, ivs = store.col("calls"), store.col("leads"), store.col("interviews")
        today, mp = today_str(), _month()
        perf = []
        for r in recs:
            tc = [c for c in calls if c["recruiterId"] == r["id"] and c["createdAt"].startswith(today)]
            tconn = len([c for c in tc if c["disposition"] not in NON_CONNECTED])
            tl = len([i for i in ivs if i["recruiterId"] == r["id"] and i["createdAt"].startswith(today)])
            mj = len([l for l in leads if l.get("assignedRecruiterId") == r["id"] and l["leadStatus"] == "Joined" and l.get("actualJoiningDate") and l["actualJoiningDate"].startswith(mp)])
            def p(a, t): return min(100, round(a / (t or 1) * 100))
            perf.append({"id": r["id"], "name": r["name"], "email": r["email"], "teamName": r.get("teamName"), "isActive": r.get("isActive"),
                         "todayCalls": {"actual": len(tc), "target": r.get("dailyCallTarget"), "progress": p(len(tc), r.get("dailyCallTarget"))},
                         "todayConnected": {"actual": tconn, "target": r.get("dailyConnectedTarget"), "progress": p(tconn, r.get("dailyConnectedTarget"))},
                         "todayLineups": {"actual": tl, "target": r.get("dailyLineupTarget"), "progress": p(tl, r.get("dailyLineupTarget"))},
                         "monthJoinings": {"actual": mj, "target": r.get("monthlyJoiningTarget"), "progress": p(mj, r.get("monthlyJoiningTarget"))}})
        return {"performance": perf}

    def _action_required(user):
        leads, calls, ivs, fus, jns = _scope(user)
        now = utcnow()
        tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        overdue = []
        for f in fus:
            if dt(f["scheduledAt"]) and dt(f["scheduledAt"]) < now and f["status"] == "PENDING":
                dh = int((now - dt(f["scheduledAt"])).total_seconds() // 3600)
                lbl = f"{dh // 24}d overdue" if dh >= 24 else f"{max(1, dh)}h overdue"
                overdue.append({**f, "delayLabel": lbl, "overdueLabel": lbl})
        never = [l for l in leads if l["callAttempts"] == 0 and l["leadStatus"] not in ("Joined", "Lost")]
        unconf = [i for i in ivs if i["date"] == tomorrow and i.get("confirmationStatus") != "Confirmed"]
        sel_missing = [l for l in leads if (l["leadStatus"] == "Selected" or l.get("interviewStatus") == "Selected") and not l.get("expectedJoiningDate") and l["leadStatus"] != "Joined"]
        unassigned = [l for l in leads if not l.get("assignedRecruiterId") or l.get("assignedRecruiterName") == "Unassigned"]
        stale = [l for l in leads if l["leadStatus"] not in ("Joined", "Lost", "Invalid Number") and dt(l["updatedAt"]) and (now - dt(l["updatedAt"])).days >= 7]
        return leads, calls, overdue, never, unconf, sel_missing, unassigned, stale

    @api.get("/analytics/action-required")
    async def analytics_action(user=Depends(get_current_user)):
        _, _, overdue, never, unconf, sel_missing, unassigned, stale = _action_required(user)
        return {"summary": {"overdueFollowupsCount": len(overdue), "neverCalledCount": len(never),
                            "unconfirmedInterviewsCount": len(unconf), "selectedMissingJoiningDateCount": len(sel_missing),
                            "unassignedLeadsCount": len(unassigned), "staleLeadsCount": len(stale)},
                "overdueFollowups": overdue, "neverCalledLeads": never, "unconfirmedTomorrowInterviews": unconf,
                "selectedMissingJoiningDate": sel_missing, "unassignedLeads": unassigned, "staleLeads": stale,
                "staleUntouchedLeads": stale, "underperformingRecruiters": []}

    @api.get("/action-required")
    async def action_required(user=Depends(get_current_user)):
        leads, calls, overdue, never, unconf, sel_missing, unassigned, stale = _action_required(user)
        recs = [u for u in store.col("users") if u["role"] == "recruiter" and u.get("isActive")]
        today = today_str()
        under = []
        for r in recs:
            ac = len([c for c in store.col("calls") if c["recruiterId"] == r["id"] and c["createdAt"].startswith(today)])
            tgt = r.get("dailyCallTarget") or 60
            if ac < tgt * 0.5:
                under.append({"id": r["id"], "name": r["name"], "teamName": r.get("teamName"), "actualCalls": ac, "targetCalls": tgt})
        return {"summary": {"overdueFollowupsCount": len(overdue), "neverCalledCount": len(never),
                            "unconfirmedInterviewsCount": len(unconf), "selectedMissingJoiningDateCount": len(sel_missing),
                            "unassignedLeadsCount": len(unassigned), "staleLeadsCount": len(stale)},
                "overdueFollowups": overdue, "neverCalledLeads": never, "unconfirmedTomorrowInterviews": unconf,
                "selectedWithoutJoiningDate": sel_missing, "unassignedLeads": unassigned, "staleUntouchedLeads": stale,
                "staleLeads": stale, "underperformingRecruiters": under}

    @api.get("/my-day")
    async def my_day(user=Depends(get_current_user)):
        _, _, ivs, fus, jns = _scope(user)
        now, today = utcnow(), today_str()
        tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        overdue = []
        for f in fus:
            if dt(f["scheduledAt"]) and dt(f["scheduledAt"]) < now and f["status"] == "PENDING":
                dh = int((now - dt(f["scheduledAt"])).total_seconds() // 3600)
                overdue.append({**f, "overdueLabel": f"OVERDUE BY {dh // 24}d" if dh >= 24 else f"OVERDUE BY {max(1, dh)}h"})
        today_fu = [f for f in fus if f["scheduledAt"].startswith(today) and dt(f["scheduledAt"]) and dt(f["scheduledAt"]) >= now and f["status"] == "PENDING"]
        need_conf = [i for i in ivs if i["date"] in (today, tomorrow) and i.get("confirmationStatus") != "Confirmed"]
        pending_att = [i for i in ivs if i["date"] == today and i["stage"] not in ("Attended", "Not Attended", "Selected", "Rejected")]
        upcoming = [j for j in jns if j.get("expectedJoiningDate") and j["expectedJoiningDate"] >= today and j["status"] != "Joined"]
        total = len(overdue) + len(today_fu) + len(need_conf) + len(upcoming)
        completed = len([f for f in fus if f["status"] == "COMPLETED" and f.get("completedAt") and f["completedAt"].startswith(today)])
        pct = round(completed / (total + completed) * 100) if (total + completed) else 100
        return {"overdueFollowups": overdue, "todayFollowups": today_fu, "interviewsNeedingConfirmation": need_conf,
                "pendingAttendance": pending_att, "upcomingJoinings": upcoming,
                "progress": {"total": total + completed, "completed": completed, "percentage": pct}}

    @api.get("/reports/funnel")
    async def reports_funnel(user=Depends(get_current_user)):
        leads, calls, ivs, fus, _ = _scope(user)
        now = utcnow()
        total = len(leads)
        called = len([l for l in leads if l["callAttempts"] > 0])
        connected = len([c for c in calls if c["disposition"] not in NON_CONNECTED])
        interested = len([l for l in leads if l["leadStatus"] in ("Interested", "Interview Scheduled", "Interview Attended", "Selected", "Joining Scheduled", "Joined")])
        attended = len([i for i in ivs if i["stage"] in ("Attended", "Selected", "Rejected")])
        selected = len([l for l in leads if l["leadStatus"] == "Selected" or l.get("interviewStatus") == "Selected" or l["leadStatus"] == "Joined"])
        joined = len([l for l in leads if l["leadStatus"] == "Joined" or l.get("joiningStatus") == "Joined"])
        u1 = d13 = d47 = d15 = 0
        for l in leads:
            dd = (now - dt(l["createdAt"])).days if dt(l.get("createdAt")) else 0
            if dd < 1: u1 += 1
            elif dd <= 3: d13 += 1
            elif dd <= 7: d47 += 1
            else: d15 += 1
        missed = []
        for f in fus:
            if dt(f["scheduledAt"]) and dt(f["scheduledAt"]) < now and f["status"] == "PENDING":
                dh = int((now - dt(f["scheduledAt"])).total_seconds() // 3600)
                missed.append({"id": f["id"], "recruiter": f["recruiterName"], "candidate": f["candidateName"],
                               "phone": f["candidatePhone"], "scheduledAt": f["scheduledAt"],
                               "delay": f"{dh // 24}d delay" if dh >= 24 else f"{max(1, dh)}h delay",
                               "priority": f["priority"], "reason": f["reason"]})
        today, mp = today_str(), _month()
        rstats = []
        for r in [u for u in store.col("users") if u["role"] == "recruiter"]:
            rc = [c for c in store.col("calls") if c["recruiterId"] == r["id"] and c["createdAt"].startswith(today)]
            rconn = len([c for c in rc if c["disposition"] not in NON_CONNECTED])
            rl = len([i for i in store.col("interviews") if i["recruiterId"] == r["id"] and i["createdAt"].startswith(today)])
            rj = len([l for l in store.col("leads") if l.get("assignedRecruiterId") == r["id"] and l["leadStatus"] == "Joined" and l.get("actualJoiningDate") and l["actualJoiningDate"].startswith(mp)])
            rstats.append({"id": r["id"], "name": r["name"], "actualDailyCalls": len(rc), "dailyCallTarget": r.get("dailyCallTarget", 60),
                           "actualDailyConnected": rconn, "dailyConnectedTarget": r.get("dailyConnectedTarget", 30),
                           "actualDailyLineups": rl, "actualMonthlyJoinings": rj})
        return {"funnel": {"totalLeads": total, "called": called, "connected": connected, "interested": interested,
                           "interviews": len(ivs), "attended": attended, "selected": selected, "joined": joined},
                "aging": {"under1Day": u1, "days1to3": d13, "days4to7": d47, "days15Plus": d15},
                "missedFollowups": missed, "recruiters": rstats}

    def _dup_groups():
        pm = {}
        for l in store.col("leads"):
            if l.get("normalizedPhone"):
                pm.setdefault(l["normalizedPhone"], []).append(l)
        return {p: ls for p, ls in pm.items() if len(ls) > 1}

    @api.get("/duplicates")
    async def duplicates(user=Depends(require_role("admin"))):
        return {"duplicateSets": [{"normalizedPhone": p, "leads": ls} for p, ls in _dup_groups().items()]}

    @api.get("/duplicates/candidates")
    async def duplicate_candidates(user=Depends(require_role("admin"))):
        groups = [{"phone": p, "count": len(ls), "leads": ls} for p, ls in _dup_groups().items()]
        return {"totalDuplicateGroups": len(groups), "groups": groups}

    @api.post("/duplicates/merge")
    async def merge_duplicates(request: Request, user=Depends(require_role("admin"))):
        b = await request.json()
        mid, did, mf = b.get("masterLeadId"), b.get("duplicateLeadId"), b.get("masterFields") or {}
        if not mid or not did:
            raise HTTPException(400, "masterLeadId and duplicateLeadId are required.")
        master = store.find("leads", id=mid)
        dup = store.find("leads", id=did)
        if not master or not dup:
            raise HTTPException(404, "One or both leads not found.")
        for a in store.col("activities"):
            if a["leadId"] == did:
                a["leadId"] = mid
                a["description"] = f"[From Merged Lead {did}]: {a['description']}"
        for coll in ("calls", "followups", "interviews", "joinings"):
            for r in store.col(coll):
                if r.get("leadId") == did:
                    r["leadId"] = mid
        combined = (master.get("assignmentHistory") or []) + [{**h, "reason": f"[Merged from {did}] {h.get('reason') or ''}"} for h in (dup.get("assignmentHistory") or [])]
        _upd_lead(mid, {"candidateName": mf.get("candidateName") or master["candidateName"],
                        "primaryPhone": mf.get("primaryPhone") or master["primaryPhone"],
                        "alternatePhone": mf.get("alternatePhone") or master.get("alternatePhone") or dup.get("alternatePhone"),
                        "email": mf.get("email") or master.get("email") or dup.get("email"),
                        "city": mf.get("city") or master["city"],
                        "notesSummary": f"{master.get('notesSummary') or ''}\n[Merged Record Notes]: {dup.get('notesSummary') or ''}".strip(),
                        "callAttempts": (master.get("callAttempts") or 0) + (dup.get("callAttempts") or 0),
                        "assignmentHistory": combined, "updatedById": user["id"], "updatedByName": user["name"]})
        _upd_lead(did, {"leadStatus": "Lost", "lostReason": f"Merged into Master Lead {mid} by Admin {user['name']}",
                        "priority": "Cold", "notesSummary": f"MERGED DUPLICATE. Master Lead is {mid}.",
                        "updatedById": user["id"], "updatedByName": user["name"]})
        log_activity(mid, "merge", "Duplicate Record Merged", f"Merged with candidate record '{dup['candidateName']}' (ID: {did}).", user)
        log_audit(user, "MERGE_DUPLICATES", "Lead", mid, f"Admin merged duplicate lead '{dup['candidateName']}' ({did}) into '{master['candidateName']}' ({mid}).", new={"masterId": mid, "mergedId": did})
        await store.flush("leads", "activities", "calls", "followups", "interviews", "joinings")
        return {"message": "Duplicate candidate successfully merged. All activities and history preserved.", "masterLead": store.find("leads", id=mid)}

    # ---- import ----
    def _import_validate(b):
        rows, mapping = b.get("rows"), b.get("mapping") or {}
        if not isinstance(rows, list) or not rows:
            raise HTTPException(400, "No rows provided")
        valid, dups, invalid, seen = [], [], [], set()
        for idx, r in enumerate(rows):
            name = (r.get(mapping.get("candidateName")) or "").strip()
            raw = r.get(mapping.get("primaryPhone")) or ""
            city = r.get(mapping.get("city")) or "Pune"
            src = r.get(mapping.get("leadSource")) or "Bulk Upload"
            if not name:
                invalid.append({"rowIndex": idx + 1, "data": r, "error": "Candidate name is required"})
                continue
            n = normalize_phone(raw)
            if not n["isValid"] or n["status"] == "INVALID":
                invalid.append({"rowIndex": idx + 1, "data": {**r, "candidateName": name, "primaryPhone": raw, "city": city, "leadSource": src}, "error": f"Invalid phone number '{raw}'"})
                continue
            if n["normalized"] in seen:
                dups.append({"rowIndex": idx + 1, "data": {"candidateName": name, "primaryPhone": raw, "city": city, "leadSource": src}, "duplicateReason": "Duplicate phone within the same import file"})
                continue
            seen.add(n["normalized"])
            existing = next((l for l in store.col("leads") if l.get("normalizedPhone") == n["normalized"]), None)
            if existing:
                dups.append({"rowIndex": idx + 1, "data": {"candidateName": name, "primaryPhone": raw, "city": city, "leadSource": src}, "duplicateReason": f"Matches existing candidate '{existing['candidateName']}' in CRM"})
                continue
            valid.append({"rowIndex": idx + 1, "data": {"candidateName": name, "primaryPhone": raw, "normalizedPhone": n["normalized"],
                          "phoneStatus": n["status"], "email": r.get(mapping.get("email")), "city": city,
                          "experience": r.get(mapping.get("experience")), "leadSource": src,
                          "priority": r.get(mapping.get("priority")) or "Medium"}})
        return {"validRows": valid, "duplicateRows": dups, "invalidRows": invalid}

    async def _import_commit(b, user):
        rows, mapping = b.get("rows"), b.get("mapping") or {}
        skip = b.get("skipDuplicates")
        if not isinstance(rows, list):
            raise HTTPException(400, "Rows array required")
        imported = skipped = invalid = 0
        seen = set()
        for r in rows:
            name = (r.get(mapping.get("candidateName")) or "").strip()
            raw = (r.get(mapping.get("primaryPhone")) or "").strip()
            city = r.get(mapping.get("city")) or "Pune"
            if not name or not raw:
                invalid += 1
                continue
            n = normalize_phone(raw)
            if not n["isValid"]:
                invalid += 1
                continue
            is_dup = n["normalized"] in seen or any(l.get("normalizedPhone") == n["normalized"] for l in store.col("leads"))
            if is_dup and skip:
                skipped += 1
                continue
            seen.add(n["normalized"])
            is_rec = user["role"] == "recruiter"
            store.col("leads").append({
                "id": gen_id("lead"), "candidateName": name, "primaryPhone": raw, "normalizedPhone": n["normalized"],
                "phoneStatus": n["status"], "email": r.get(mapping.get("email")), "city": city,
                "experience": r.get(mapping.get("experience")),
                "leadSource": r.get(mapping.get("leadSource")) or "Bulk Upload",
                "assignedRecruiterId": user["id"] if is_rec else "", "assignedRecruiterName": user["name"] if is_rec else "Unassigned",
                "originalRecruiterId": user["id"] if is_rec else "", "originalRecruiterName": user["name"] if is_rec else "Unassigned",
                "priority": r.get(mapping.get("priority")) or "Medium", "leadStatus": "New", "callAttempts": 0,
                "notesSummary": "Imported via CSV Wizard", "assignmentHistory": [],
                "createdAt": now_iso(), "updatedAt": now_iso(), "updatedById": user["id"], "updatedByName": user["name"]})
            imported += 1
        log_audit(user, "BULK_IMPORT", "Lead", "multiple", f"Imported {imported} candidates via CSV Import Wizard.", new={"importedCount": imported, "skippedDuplicates": skipped, "invalidCount": invalid})
        await store.flush("leads")
        return {"totalRows": len(rows), "importedCount": imported, "skippedDuplicates": skipped, "invalidCount": invalid}

    @api.post("/leads/import/validate")
    async def leads_import_validate(request: Request, user=Depends(get_current_user)):
        return _import_validate(await request.json())

    @api.post("/import/validate")
    async def import_validate(request: Request, user=Depends(require_role("admin", "team_leader"))):
        return _import_validate(await request.json())

    @api.post("/leads/import/commit")
    async def leads_import_commit(request: Request, user=Depends(get_current_user)):
        return await _import_commit(await request.json(), user)

    @api.post("/import/commit")
    async def import_commit(request: Request, user=Depends(require_role("admin", "team_leader"))):
        return await _import_commit(await request.json(), user)

    # ---- export ----
    def _csv(headers, rows):
        def esc(v):
            if v is None: return ""
            return '"' + str(v).replace('"', '""') + '"'
        return "\n".join([",".join(headers)] + [",".join(esc(c) for c in r) for r in rows])

    def _export_leads(request, user):
        if user["role"] == "recruiter" and (user.get("permissions") or {}).get("canExportData") is False:
            raise HTTPException(403, "Access Denied: Candidate data export is restricted by your administrator.")
        leads, _, _, _, _ = _scope(user)
        q = request.query_params
        for k in ("priority", "leadStatus", "clientId", "jobId"):
            if q.get(k):
                leads = [l for l in leads if l.get(k) == q.get(k)]
        headers = ["ID", "Candidate Name", "Primary Phone", "Alternate Phone", "Email", "City", "Experience",
                   "Current Salary", "Expected Salary", "Lead Source", "Priority", "Lead Status", "Assigned Recruiter",
                   "Client", "Job", "Call Attempts", "Last Call Date", "Last Call Outcome", "Next Follow-up", "Created Date"]
        rows = [[l["id"], l["candidateName"], l["primaryPhone"], l.get("alternatePhone", ""), l.get("email", ""), l["city"],
                 l.get("experience", ""), l.get("currentSalary", ""), l.get("expectedSalary", ""), l["leadSource"],
                 l["priority"], l["leadStatus"], l.get("assignedRecruiterName"), l.get("clientName", ""), l.get("jobTitle", ""),
                 l["callAttempts"], l.get("lastCallAt", ""), l.get("lastCallOutcome", ""), l.get("nextFollowupAt", ""), l["createdAt"]] for l in leads]
        return PlainTextResponse(_csv(headers, rows), media_type="text/csv",
                                 headers={"Content-Disposition": f'attachment; filename="oaksphere_leads_{today_str()}.csv"'})

    @api.get("/leads/export")
    async def leads_export(request: Request, user=Depends(get_current_user)):
        return _export_leads(request, user)

    @api.get("/export/leads")
    async def export_leads(request: Request, user=Depends(get_current_user)):
        return _export_leads(request, user)

    # ---- notifications ----
    @api.get("/notifications")
    async def notifications(user=Depends(get_current_user)):
        ns = [n for n in store.col("notifications") if n["userId"] == user["id"] or user["role"] == "admin"]
        return {"notifications": ns, "unreadCount": len([n for n in ns if not n["isRead"]])}

    @api.patch("/notifications/{nid}/read")
    async def notif_read(nid: str, user=Depends(get_current_user)):
        n = store.find("notifications", id=nid)
        ok = False
        if n and (n["userId"] == user["id"] or user["role"] == "admin"):
            n["isRead"] = True
            ok = True
            await store.flush("notifications")
        return {"success": ok}

    async def _mark_all(user):
        c = 0
        for n in store.col("notifications"):
            if (n["userId"] == user["id"] or user["role"] == "admin") and not n["isRead"]:
                n["isRead"] = True
                c += 1
        if c:
            await store.flush("notifications")
        return {"markedRead": c}

    @api.post("/notifications/read-all")
    async def notif_read_all(user=Depends(get_current_user)):
        return await _mark_all(user)

    @api.post("/notifications/mark-all-read")
    async def notif_mark_all(user=Depends(get_current_user)):
        return await _mark_all(user)

    # ---- audit ----
    @api.get("/audit-logs")
    async def audit_logs(user=Depends(require_role("admin"))):
        return {"auditLogs": store.col("auditLogs")}

    # ---- settings ----
    @api.get("/settings")
    async def get_settings(user=Depends(get_current_user)):
        return {"settings": store.state.get("settings")}

    async def _update_settings(b, user):
        cur = store.state.get("settings") or {}
        merged = {**cur, **b,
                  "agencyCMS": {**cur.get("agencyCMS", {}), **(b.get("agencyCMS") or {})},
                  "metaIntegration": {**cur.get("metaIntegration", {}), **(b.get("metaIntegration") or {})},
                  "googleAdsIntegration": {**cur.get("googleAdsIntegration", {}), **(b.get("googleAdsIntegration") or {})}}
        store.state["settings"] = merged
        log_audit(user, "UPDATE_SETTINGS", "Settings", "crm_settings", "Admin updated CRM configuration.", new=merged)
        await store.flush("settings")
        return {"settings": merged}

    @api.put("/settings")
    async def put_settings(request: Request, user=Depends(require_role("admin"))):
        return await _update_settings(await request.json(), user)

    @api.patch("/settings")
    async def patch_settings(request: Request, user=Depends(require_role("admin"))):
        return await _update_settings(await request.json(), user)

    # ---- templates ----
    @api.get("/templates")
    async def get_templates(user=Depends(get_current_user)):
        return {"templates": store.col("templates")}

    @api.post("/templates")
    async def create_template(request: Request, user=Depends(get_current_user)):
        b = await request.json()
        if not b.get("title") or not b.get("body"):
            raise HTTPException(400, "Title and body are required")
        t = {"id": gen_id("tmpl"), "title": b["title"], "category": b.get("category") or "custom",
             "channel": b.get("channel") or "whatsapp", "body": b["body"],
             "variables": b.get("variables") or ["candidate_name", "recruiter_name", "recruiter_phone"],
             "isSystem": False, "createdAt": now_iso(), "updatedAt": now_iso()}
        store.col("templates").append(t)
        log_audit(user, "CREATE_TEMPLATE", "Template", t["id"], f'Created custom message template: "{t["title"]}"')
        await store.flush("templates")
        return {"template": t}

    @api.put("/templates/{tid}")
    async def update_template(tid: str, request: Request, user=Depends(get_current_user)):
        t = store.find("templates", id=tid)
        if not t:
            raise HTTPException(404, "Template not found")
        b = await request.json()
        b.pop("id", None)
        t.update(b)
        t["updatedAt"] = now_iso()
        await store.flush("templates")
        return {"template": t}

    @api.delete("/templates/{tid}")
    async def delete_template(tid: str, user=Depends(get_current_user)):
        t = store.find("templates", id=tid)
        if not t:
            raise HTTPException(404, "Template not found")
        if t.get("isSystem"):
            raise HTTPException(400, "System templates cannot be deleted.")
        store.state["templates"] = [x for x in store.col("templates") if x["id"] != tid]
        await store.flush("templates")
        return {"success": True}

    @api.post("/templates/preview")
    async def preview_template(request: Request, user=Depends(get_current_user)):
        b = await request.json()
        t = store.find("templates", id=b.get("templateId"))
        if not t:
            raise HTTPException(404, "Template not found")
        lead = store.find("leads", id=b.get("leadId")) if b.get("leadId") else None
        client = store.find("clients", id=lead.get("clientId")) if (lead and lead.get("clientId")) else None
        job = store.find("jobs", id=lead.get("jobId")) if (lead and lead.get("jobId")) else None
        interview = next((i for i in store.col("interviews") if lead and i["leadId"] == lead["id"]), None)
        u = store.find("users", id=user["id"]) or {}
        import urllib.parse
        loc = (client or {}).get("location")
        vars = {"candidate_name": (lead or {}).get("candidateName") or "Candidate", "recruiter_name": user["name"] or "Recruiter",
                "recruiter_phone": u.get("phone") or "9820011223", "job_title": (job or {}).get("positionTitle") or (lead or {}).get("jobTitle") or "Customer Support Associate",
                "client_name": (client or {}).get("companyName") or (lead or {}).get("clientName") or "Partner Client",
                "salary_range": (job or {}).get("salaryRange") or "INR 20,000 - 28,000 / month",
                "interview_date": (interview or {}).get("date") or today_str(), "interview_time": (interview or {}).get("time") or "11:00 AM",
                "interview_venue": (interview or {}).get("location") or loc or "Pune", "google_maps_link": f"https://maps.google.com/?q={urllib.parse.quote(loc)}" if loc else "https://maps.google.com/?q=Pune",
                "contact_person": (interview or {}).get("contactPerson") or (client or {}).get("contactPerson") or "HR Desk"}
        vars.update(b.get("customVars") or {})
        text = t["body"]
        for k, v in vars.items():
            text = text.replace("{{" + k + "}}", str(v))
        phone = (lead or {}).get("primaryPhone") or ""
        clean = "".join(ch for ch in phone if ch.isdigit())
        final = ("91" + clean) if len(clean) == 10 else clean
        wa = f"https://api.whatsapp.com/send?phone={final}&text={urllib.parse.quote(text)}"
        return {"template": t, "interpolatedText": text, "whatsAppUrl": wa, "variables": vars}

    # ---- scorecard / matching / stage ----
    @api.post("/leads/{lid}/scorecard")
    async def scorecard(lid: str, request: Request, user=Depends(get_current_user)):
        lead = store.find("leads", id=lid)
        if not lead:
            raise HTTPException(404, "Lead not found")
        b = await request.json()
        if not b.get("communicationLevel") or not b.get("shiftAvailability") or not b.get("commuteDistance"):
            raise HTTPException(400, "Communication, Shift, and Commute Distance are required for screening.")
        job = store.find("jobs", id=lead.get("jobId")) if lead.get("jobId") else None
        res = calculate_scorecard({"communicationLevel": b["communicationLevel"], "shiftAvailability": b["shiftAvailability"],
                                   "commuteDistance": b["commuteDistance"], "typingSpeedWpm": int(b.get("typingSpeedWpm") or 0),
                                   "skills": b.get("skills") if isinstance(b.get("skills"), list) else [],
                                   "noticePeriodDays": int(b.get("noticePeriodDays") or 0),
                                   "expectedCtcMonthly": int(b["expectedCtcMonthly"]) if b.get("expectedCtcMonthly") else lead.get("expectedSalary"),
                                   "offeredCtcMonthly": int(b["offeredCtcMonthly"]) if b.get("offeredCtcMonthly") else (24000 if job else None),
                                   "jobRequiredShift": job["positionTitle"] if job else None})
        sc = {"communicationLevel": b["communicationLevel"], "shiftAvailability": b["shiftAvailability"],
              "commuteDistance": b["commuteDistance"], "typingSpeedWpm": int(b.get("typingSpeedWpm") or 0),
              "skills": b.get("skills") if isinstance(b.get("skills"), list) else [], "noticePeriodDays": int(b.get("noticePeriodDays") or 0),
              "expectedCtcMonthly": int(b["expectedCtcMonthly"]) if b.get("expectedCtcMonthly") else lead.get("expectedSalary"),
              "currentCtcMonthly": int(b["currentCtcMonthly"]) if b.get("currentCtcMonthly") else lead.get("currentSalary"),
              "evaluatedAt": now_iso(), "evaluatedByRecruiterId": user["id"], "evaluatedByRecruiterName": user["name"],
              "fitScore": res["fitScore"], "dealbreakers": res["dealbreakers"], "overallVerdict": res["overallVerdict"],
              "recruiterRemarks": b.get("recruiterRemarks") or ""}
        updated = _upd_lead(lid, {"scorecard": sc, "preferredShift": b["shiftAvailability"],
                                  "skills": b.get("skills") if isinstance(b.get("skills"), list) else lead.get("skills"),
                                  "updatedById": user["id"], "updatedByName": user["name"]})
        log_activity(lid, "status_change", f"Screening Scorecard Evaluated: {res['fitScore']}%",
                     f"Fit: {res['overallVerdict']}. " + ("Dealbreakers: " + "; ".join(res["dealbreakers"]) if res["dealbreakers"] else "No dealbreakers found."), user, metadata=sc)
        await store.flush("leads")
        return {"lead": updated, "scorecard": sc}

    @api.get("/leads/{lid}/matching-jobs")
    async def matching_jobs(lid: str, user=Depends(get_current_user)):
        lead = store.find("leads", id=lid)
        if not lead:
            raise HTTPException(404, "Lead not found")
        return {"matches": match_jobs_for_lead(lead, store.col("jobs")), "lead": lead}

    @api.patch("/leads/{lid}/stage")
    async def lead_stage(lid: str, request: Request, user=Depends(get_current_user)):
        lead = store.find("leads", id=lid)
        if not lead:
            raise HTTPException(404, "Lead not found")
        b = await request.json()
        stage = b.get("newStage")
        valid = ["New", "Calling", "Follow-up", "Interested", "Interview Scheduled", "Interview Attended",
                 "Selected", "Joining Scheduled", "Joined", "Not Interested", "Lost"]
        if stage not in valid:
            raise HTTPException(400, f"Invalid stage: {stage}")
        old = lead["leadStatus"]
        upd = {"leadStatus": stage, "updatedById": user["id"], "updatedByName": user["name"]}
        if stage == "Selected":
            upd["interviewStatus"] = "Selected"; upd["joiningStatus"] = "Selected"
        elif stage == "Joining Scheduled":
            upd["joiningStatus"] = "Offer Released"
        elif stage == "Joined":
            upd["joiningStatus"] = "Joined"; upd["actualJoiningDate"] = today_str()
        elif stage == "Interview Scheduled":
            upd["interviewStatus"] = "Scheduled"
        elif stage == "Interview Attended":
            upd["interviewStatus"] = "Attended"
        updated = _upd_lead(lid, upd)
        log_activity(lid, "status_change", f"Stage Changed to {stage}", f'Pipeline stage moved from "{old}" to "{stage}". ' + (f"Note: {b.get('notes')}" if b.get("notes") else ""), user)
        await store.flush("leads")
        return {"lead": updated}

    @api.get("/analytics/leaderboard")
    async def leaderboard(user=Depends(get_current_user)):
        users = [u for u in store.col("users") if u.get("isActive") and u["role"] in ("recruiter", "team_leader")]
        calls, ivs, jns = store.col("calls"), store.col("interviews"), store.col("joinings")
        today, mp = today_str(), _month()
        board = []
        for u in users:
            uid = u["id"]
            ct = [c for c in calls if c["recruiterId"] == uid and c["createdAt"].startswith(today)]
            connt = [c for c in ct if c["disposition"].startswith("Connected") or c["disposition"] == "Interview Scheduled"]
            cm = [c for c in calls if c["recruiterId"] == uid and c["createdAt"].startswith(mp)]
            connm = [c for c in cm if c["disposition"].startswith("Connected") or c["disposition"] == "Interview Scheduled"]
            ivm = [i for i in ivs if i["recruiterId"] == uid and i.get("scheduledAt", "").startswith(mp)]
            attm = [i for i in ivm if i["stage"] in ("Attended", "Selected")]
            selm = [i for i in ivm if i["stage"] == "Selected"]
            jm = [j for j in jns if j["recruiterId"] == uid and ((j.get("actualJoiningDate") or "").startswith(mp) or j["selectionDate"].startswith(mp)) and j["status"] == "Joined"]
            joined = len(jm)
            call_pct = min(100, round(len(ct) / u["dailyCallTarget"] * 100)) if u.get("dailyCallTarget") else 100
            join_pct = min(100, round(joined / u["monthlyJoiningTarget"] * 100)) if u.get("monthlyJoiningTarget") else 100
            conn_rate = round(len(connm) / len(cm) * 100) if cm else 0
            turnout = round(len(attm) / len(ivm) * 100) if ivm else 0
            base = 4000
            mult = 1.4 if joined >= 8 else (1.2 if joined >= 5 else 1.0)
            earned = round(joined * base * mult)
            nxt = round((joined + 1) * base * (1.2 if joined + 1 >= 5 else 1.0))
            board.append({"userId": uid, "name": u["name"], "email": u["email"], "role": u["role"],
                          "teamName": u.get("teamName") or "Recruitment Operations", "phone": u.get("phone") or "9820011223",
                          "today": {"calls": len(ct), "connected": len(connt), "targetCalls": u.get("dailyCallTarget"), "targetAchievedPct": call_pct},
                          "month": {"calls": len(cm), "connected": len(connm), "interviews": len(ivm), "attended": len(attm),
                                    "selected": len(selm), "joined": joined, "joiningTarget": u.get("monthlyJoiningTarget"), "joiningTargetPct": join_pct},
                          "rates": {"connectionRatePct": conn_rate, "turnoutRatePct": turnout},
                          "incentive": {"baseRate": base, "multiplier": mult, "earnedTotal": earned, "nextTierGain": nxt - earned},
                          "streakDays": max(1, joined * 2 + len(ct) // 15)})
        board.sort(key=lambda x: (-x["month"]["joined"], -x["month"]["interviews"], -x["month"]["calls"]))
        for i, item in enumerate(board):
            item["rank"] = i + 1
        return {"leaderboard": board}
