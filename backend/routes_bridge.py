"""Call Bridge (SSE companion relay), telephony analytics, ad-integration webhooks/simulators."""
import asyncio
import json
import urllib.parse
from datetime import datetime, timezone, timedelta
from fastapi import Request, Depends, HTTPException
from fastapi.responses import StreamingResponse, PlainTextResponse

from common import (store, db, gen_id, now_iso, today_str, decode_token, get_current_user,
                    log_audit, log_activity, default_permissions)

CI = "Connected \u2013 Interested"
NON_CONN = ["Busy", "No Answer", "Switched Off", "Invalid Number", "Unreachable"]
PRODUCTIVE = [CI, "Interview Scheduled", "Callback"]

_clients = []  # {id,userId,pairCode,role,queue}


def dt(iso):
    if not iso:
        return None
    try:
        return datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return None


def utcnow():
    return datetime.now(timezone.utc)


def fmt(sec):
    sec = int(sec or 0)
    if sec <= 0:
        return "0s"
    h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    if h:
        return f"{h}h {m}m"
    if m:
        return f"{m}m {s}s"
    return f"{s}s"


def broadcast(filt, event):
    data = f"event: {event['type']}\ndata: {json.dumps(event['payload'])}\n\n"
    for c in list(_clients):
        match = False
        if filt.get("userId") and c["userId"] == filt["userId"]:
            match = True
        if filt.get("pairCode") and c.get("pairCode") and "".join(ch for ch in c["pairCode"] if ch.isdigit()) == "".join(ch for ch in filt["pairCode"] if ch.isdigit()):
            match = True
        if match:
            try:
                c["queue"].put_nowait(data)
            except Exception:
                pass


def _bridge_devices(user_id):
    return [d for d in store.col("callBridgeDevices") if d["userId"] == user_id or user_id == "usr_admin"]


def _bridge_settings(user_id):
    s = store.state.get("callBridgeSettings") or {}
    return s.get(user_id) or {"defaultSim": "SIM_1", "sim1Carrier": "", "sim1Number": "",
                          "sim2Carrier": "", "sim2Number": "", "gatewayMode": "companion_relay",
                              "autoLogDisposition": True, "soundAlerts": True, "autoStartTimer": True}


def _bridge_calls(user_id):
    calls = [c for c in store.col("callBridgeCalls") if c["userId"] == user_id or user_id == "usr_admin"]
    return sorted(calls, key=lambda c: dt(c["initiatedAt"]) or utcnow(), reverse=True)


def register(api, connected_interested):

    @api.get("/call-bridge/status")
    async def bridge_status(user=Depends(get_current_user)):
        uid = user["id"]
        devices = _bridge_devices(uid)
        calls = _bridge_calls(uid)
        active = next((c for c in calls if c["status"] in ("ringing", "connected")), None)
        today = today_str()
        tc = [c for c in calls if c["initiatedAt"].startswith(today)]
        total_dur = sum(c.get("durationSeconds") or 0 for c in tc)
        conn = len([c for c in tc if c["status"] == "completed" and (c.get("durationSeconds") or 0) > 0])
        return {"device": next((d for d in devices if d["status"] == "connected"), devices[0] if devices else None),
                "allDevices": devices, "settings": _bridge_settings(uid), "activeCall": active,
                "stats": {"totalToday": len(tc), "totalDurationSeconds": total_dur,
                          "sim1Count": len([c for c in tc if c["simUsed"] == "SIM_1"]),
                          "sim2Count": len([c for c in tc if c["simUsed"] == "SIM_2"]),
                          "connectedCount": conn, "connectRate": round(conn / len(tc) * 100) if tc else 0}}

    @api.get("/call-bridge/stream")
    async def bridge_stream(request: Request):
        token = request.query_params.get("token")
        pair = request.query_params.get("pairCode")
        role = request.query_params.get("role", "desktop")
        uid = "usr_admin"
        if token:
            payload = decode_token(token)
            if payload:
                uid = payload.get("id", uid)
        elif pair:
            clean = "".join(ch for ch in pair if ch.isdigit())
            dev = next((d for d in store.col("callBridgeDevices") if "".join(ch for ch in d["pairCode"] if ch.isdigit()) == clean), None)
            if dev:
                uid = dev["userId"]
        q = asyncio.Queue()
        cid = gen_id("cl")
        client = {"id": cid, "userId": uid, "pairCode": pair, "role": role, "queue": q}
        _clients.append(client)

        async def gen():
            yield f"event: handshake\ndata: {json.dumps({'status': 'connected', 'clientId': cid, 'userId': uid, 'role': role})}\n\n"
            try:
                while True:
                    if await request.is_disconnected():
                        break
                    try:
                        msg = await asyncio.wait_for(q.get(), timeout=15)
                        yield msg
                    except asyncio.TimeoutError:
                        yield ": ping\n\n"
            finally:
                if client in _clients:
                    _clients.remove(client)
        return StreamingResponse(gen(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})

    @api.post("/call-bridge/pair")
    async def bridge_pair(request: Request, user=Depends(get_current_user)):
        uid = user["id"]
        b = await request.json()
        if b.get("action") == "generate_code":
            import random
            code = f"{random.randint(100,999)}-{random.randint(100,999)}"
            dev = {"id": gen_id("dev"), "userId": uid, "deviceName": b.get("deviceName") or "Smart Phone SIM Companion",
                   "platform": b.get("platform") or "android", "sim1Carrier": b.get("sim1Carrier") or "",
"sim2Carrier": b.get("sim2Carrier") or "", "defaultSim": b.get("defaultSim") or
"SIM_1", "batteryLevel": None, "networkSignal": "unknown", "status": "connected", "pairCode": code,
                   "lastSeenAt": now_iso(), "createdAt": now_iso()}
            store.col("callBridgeDevices").append(dev)
            await store.flush("callBridgeDevices")
            return {"success": True, "pairCode": code, "device": dev}
        code = b.get("pairCode") or b.get("code")
        if not code:
            raise HTTPException(400, "Pair code is required")
        clean = "".join(ch for ch in code if ch.isdigit())
        dev = next((d for d in store.col("callBridgeDevices") if "".join(ch for ch in d["pairCode"] if ch.isdigit()) == clean), None)
        if not dev:
            dev = {"id": gen_id("dev_paired"), "userId": uid, "deviceName": b.get("deviceName") or "Mobile SIM Companion",
                  "platform": b.get("platform") or "android", "sim1Carrier": b.get("sim1Carrier") or "",
"sim2Carrier": b.get("sim2Carrier") or "", "defaultSim": b.get("defaultSim") or "SIM_1",
"batteryLevel": None, "networkSignal": "unknown", "status": "connected", "pairCode": code,
                   "lastSeenAt": now_iso(), "createdAt": now_iso()}
            store.col("callBridgeDevices").append(dev)
        else:
            dev.update({"status": "connected", "lastSeenAt": now_iso()})
            if b.get("deviceName"):
                dev["deviceName"] = b["deviceName"]
        await store.flush("callBridgeDevices")
        broadcast({"userId": uid}, {"type": "DEVICE_CONNECTED", "payload": {"device": dev, "message": f'Device "{dev["deviceName"]}" paired successfully!'}})
        return {"success": True, "device": dev, "message": "Device paired successfully"}

    @api.post("/call-bridge/dial")
    async def bridge_dial(request: Request, user=Depends(get_current_user)):
        uid = user["id"]
        b = await request.json()
        phone = b.get("phoneNumber")
        if not phone:
            raise HTTPException(400, "Phone number is required")
        settings = _bridge_settings(uid)
        devices = _bridge_devices(uid)
        device = next(
    (
        d for d in devices
        if d.get("status") == "connected"
        and any(
            c.get("userId") == uid
            and c.get("pairCode") == d.get("pairCode")
            and c.get("role") == "mobile"
            for c in _clients
        )
    ),
    None,
)
        sim = b.get("simSlot") or settings.get("defaultSim") or "SIM_1"
        carrier = (device.get("sim1Carrier") if device else settings.get("sim1Carrier")) if sim == "SIM_1" else (device.get("sim2Carrier") if device else settings.get("sim2Carrier"))
        lead = store.find("leads", id=b.get("leadId")) if b.get("leadId") else None
        title = b.get("candidateName") or (lead["candidateName"] if lead else "Candidate")
        dial = phone
        if lead and ("\u2022" in dial or "*" in dial or len(dial) < 8):
            dial = lead["primaryPhone"]
        call = {"id": gen_id("call_brg"), "userId": uid, "deviceId": device["id"] if device else None,
                "leadId": b.get("leadId"), "candidateName": title, "phoneNumber": dial, "simUsed": sim,
                "carrierName": carrier, "status": "ringing", "durationSeconds": 0, "disposition": None,
                "notes": f"Desktop SIM Bridge call triggered via {sim} ({carrier})", "initiatedAt": now_iso(),
                "connectedAt": None, "endedAt": None}
        store.col("callBridgeCalls").insert(0, call)
        await store.flush("callBridgeCalls")
        broadcast({"userId": uid, "pairCode": device["pairCode"] if device else None}, {"type": "INCOMING_DIAL_REQUEST", "payload": {
            "callId": call["id"], "leadId": b.get("leadId"), "candidateName": title, "phoneNumber": dial, "simSlot": sim,
            "carrierName": carrier, "jobTitle": (lead or {}).get("jobTitle") or "Job Candidate",
            "clientName": (lead or {}).get("clientName") or "OAKsphere Client",
            "telUrl": "tel:" + "".join(ch for ch in dial if ch.isdigit() or ch == "+"), "timestamp": now_iso()}})
        log_audit(user, "SIM_CALL_TRIGGERED", "Lead", b.get("leadId") or call["id"], f"Initiated Desktop-to-Phone SIM call to {title} on {sim} ({carrier}).")
        return {"success": True, "call": call, "device": device, "simUsed": sim, "carrierName": carrier,
                "message": f"Broadcasting call to mobile phone ({device['deviceName'] if device else 'SIM Phone'}). Pick up on phone to start conversation."}

    def _upd_call(cid, updates):
        for c in store.col("callBridgeCalls"):
            if c["id"] == cid:
                c.update(updates)
                return c
        return None

    @api.post("/call-bridge/call-event")
    async def bridge_call_event(request: Request, user=Depends(get_current_user)):
        uid = user["id"]
        b = await request.json()
        cid = b.get("callId")
        if not cid:
            raise HTTPException(400, "Call ID is required")
        status = b.get("status")
        upd = {}
        if status:
            upd["status"] = status
        if isinstance(b.get("durationSeconds"), (int, float)):
            upd["durationSeconds"] = b["durationSeconds"]
        if b.get("disposition"):
            upd["disposition"] = b["disposition"]
        if b.get("notes"):
            upd["notes"] = b["notes"]
        if status == "connected":
            upd["connectedAt"] = now_iso()
        elif status in ("completed", "rejected", "failed"):
            upd["endedAt"] = now_iso()
        updated = _upd_call(cid, upd)
        if (status == "completed" or b.get("disposition")) and updated and updated.get("leadId"):
            store.col("calls").insert(0, {"id": gen_id("call"), "leadId": updated["leadId"], "recruiterId": uid,
                "recruiterName": user["name"], "candidateName": updated["candidateName"], "phone": updated["phoneNumber"],
                "disposition": b.get("disposition") or updated.get("disposition") or CI,
                "durationSeconds": b.get("durationSeconds") or updated.get("durationSeconds") or 45,
                "notes": b.get("notes") or f"Phone SIM Bridge Call ({updated['simUsed']} - {updated['carrierName']})", "createdAt": now_iso()})
            log_activity(updated["leadId"], "call", f"Phone SIM Call Logged: {b.get('disposition') or 'Completed'}",
                         f"Call placed from desktop via phone SIM ({updated['simUsed']} - {updated['carrierName']}).", user)
            await store.flush("calls")
        await store.flush("callBridgeCalls")
        broadcast({"userId": uid}, {"type": "CALL_STATUS_UPDATE", "payload": {"callId": cid, "status": updated["status"] if updated else None,
                  "durationSeconds": updated.get("durationSeconds") if updated else None, "disposition": updated.get("disposition") if updated else None,
                  "notes": updated.get("notes") if updated else None, "updatedAt": now_iso()}})
        return {"success": True, "call": updated}

    @api.post("/call-bridge/settings")
    async def bridge_set_settings(request: Request, user=Depends(get_current_user)):
        uid = user["id"]
        b = await request.json()
        s = store.state.setdefault("callBridgeSettings", {})
        s[uid] = {**(s.get(uid) or _bridge_settings(uid)), **b}
        await store.flush("callBridgeSettings")
        return {"success": True, "settings": s[uid]}

    @api.get("/call-bridge/logs")
    async def bridge_logs(user=Depends(get_current_user)):
        return {"calls": _bridge_calls(user["id"])}

    @api.post("/call-bridge/simulate-phone-event")
    async def bridge_simulate(request: Request, user=Depends(get_current_user)):
        uid = user["id"]
        b = await request.json()
        cid, action = b.get("callId"), b.get("simulatedAction")
        status, dur, disp = "connected", 0, CI
        if action == "answer":
            status, dur = "connected", 15
        elif action == "hangup_interested":
            status, dur, disp = "completed", 84, CI
        elif action == "hangup_callback":
            status, dur, disp = "completed", 32, "Callback"
        elif action == "busy":
            status, dur, disp = "failed", 0, "Busy"
        updated = _upd_call(cid, {"status": status, "durationSeconds": dur, "disposition": disp, "notes": f"Simulated phone action: {action}"})
        broadcast({"userId": uid}, {"type": "CALL_STATUS_UPDATE", "payload": {"callId": cid, "status": status, "durationSeconds": dur, "disposition": disp, "notes": f"Simulated phone action: {action}"}})
        if status == "completed" and updated and updated.get("leadId"):
            store.col("calls").insert(0, {"id": gen_id("call"), "leadId": updated["leadId"], "recruiterId": uid,
                "recruiterName": user["name"], "candidateName": updated["candidateName"], "phone": updated["phoneNumber"],
                "disposition": disp, "durationSeconds": dur, "notes": f"SIM Bridge Simulator ({updated['simUsed']}): {disp}", "createdAt": now_iso()})
            await store.flush("calls")
        await store.flush("callBridgeCalls")
        return {"success": True, "call": updated, "simulatedAction": action}

    # ---- telephony dashboard ----
    @api.get("/telephony/dashboard")
    async def telephony_dashboard(request: Request, user=Depends(get_current_user)):
        q = request.query_params
        period = q.get("period", "today")
        recruiter_id = q.get("recruiterId")
        sim = q.get("sim")
        can_all = user["role"] in ("admin", "team_leader") or (user.get("permissions") or {}).get("canViewAllLeads")
        can_phone = (user.get("permissions") or {}).get("canViewCandidatePhone")
        if can_phone is None:
            can_phone = user["role"] != "recruiter"
        users = [u for u in store.col("users") if u.get("isActive")]
        umap = {u["id"]: u for u in users}
        merged = list(store.col("callBridgeCalls"))
        existing_ids = {c["id"] for c in merged}
        for c in store.col("calls"):
            if c["id"] not in existing_ids:
                merged.append({"id": c["id"], "userId": c["recruiterId"], "leadId": c.get("leadId"),
                               "candidateName": c["candidateName"], "phoneNumber": c["phone"], "simUsed": "SIM_1",
                               "carrierName": None, "status": "completed", "durationSeconds": c.get("durationSeconds") or 45,
                               "disposition": c.get("disposition"), "notes": c.get("notes"), "initiatedAt": c["createdAt"],
                               "connectedAt": c["createdAt"], "endedAt": c["createdAt"]})
        now = utcnow()
        today = today_str()
        yest = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        week_start = now - timedelta(days=7)
        month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        scoped = merged
        if not can_all:
            scoped = [c for c in scoped if c["userId"] == user["id"]]
        elif recruiter_id and recruiter_id != "all":
            scoped = [c for c in scoped if c["userId"] == recruiter_id]
        if sim and sim != "all":
            scoped = [c for c in scoped if c["simUsed"] == sim]

        def in_period(c, p):
            ds = c["initiatedAt"].split("T")[0]
            cd = dt(c["initiatedAt"])
            if p == "today": return ds == today
            if p == "yesterday": return ds == yest
            if p == "week": return cd and cd >= week_start
            if p == "month": return cd and cd >= month_start
            return True

        def is_conn(c):
            return (c.get("durationSeconds") or 0) > 0 or (c.get("disposition") and c["disposition"] not in NON_CONN)

        active_raw = [c for c in merged if c["status"] in ("connected", "ringing")]
        active = []
        for c in active_raw:
            r = umap.get(c["userId"])
            ph = c["phoneNumber"]
            mph = (ph[:5] + "\u2022\u2022\u2022\u2022\u2022") if (not can_phone and len(ph) >= 7) else ph
            started = dt(c.get("connectedAt") or c["initiatedAt"])
            elapsed = max(0, int((now - started).total_seconds())) if started else 0
            active.append({**c, "phoneNumber": mph, "isPhoneMasked": not can_phone,
                           "recruiterName": (r or {}).get("name", "Recruiter"), "recruiterRole": (r or {}).get("role", "recruiter"),
                           "teamName": (r or {}).get("teamName", "Staffing Operations"), "liveDurationSeconds": elapsed})
        period_calls = [c for c in scoped if in_period(c, period)]
        yc = [c for c in scoped if in_period(c, "yesterday")]
        total = len(period_calls)
        yt = len(yc)
        tdiff = round((total - yt) / yt * 100) if yt else 0
        conn_list = [c for c in period_calls if is_conn(c)]
        cc = len(conn_list)
        crate = round(cc / total * 1000) / 10 if total else 0
        ycc = len([c for c in yc if is_conn(c)])
        ycr = round(ycc / yt * 1000) / 10 if yt else 0
        crdiff = round((crate - ycr) * 10) / 10
        talk = sum(c.get("durationSeconds") or 0 for c in period_calls)
        avg = round(talk / cc) if cc else 0
        ytalk = sum(c.get("durationSeconds") or 0 for c in yc)
        tdiff2 = round((talk - ytalk) / ytalk * 100) if ytalk else 0
        prod = [c for c in period_calls if c.get("disposition") in PRODUCTIVE]
        pc = len(prod)
        prate = round(pc / cc * 1000) / 10 if cc else 0
        active_recs = [u for u in users if u["role"] in ("recruiter", "team_leader")]
        rc_count = 1 if (not can_all or (recruiter_id and recruiter_id != "all")) else max(1, len(active_recs))
        daily_target = rc_count * 60
        week_target, month_target = daily_target * 5, daily_target * 22
        week_calls = [c for c in scoped if in_period(c, "week")]
        month_calls = [c for c in scoped if in_period(c, "month")]
        daily_actual = total if period == "today" else len([c for c in scoped if in_period(c, "today")])
        hours = {f"{h:02d}": {"calls": 0, "connected": 0} for h in range(9, 20)}
        for c in period_calls:
            d = dt(c["initiatedAt"])
            if d:
                h = f"{d.hour:02d}"
                if h in hours:
                    hours[h]["calls"] += 1
                    if (c.get("durationSeconds") or 0) > 0 or c.get("disposition") in PRODUCTIVE:
                        hours[h]["connected"] += 1
        hourly = []
        for hk, it in hours.items():
            hn = int(hk)
            ampm = "PM" if hn >= 12 else "AM"
            dh = 12 if hn % 12 == 0 else hn % 12
            ht = round(daily_target / 8)
            hourly.append({"hour": f"{hk}:00", "hourLabel": f"{dh} {ampm}", "calls": it["calls"], "connected": it["connected"],
                           "targetCalls": ht, "gap": it["calls"] - ht, "connectRate": round(it["connected"] / it["calls"] * 100) if it["calls"] else 0,
                           "isPeakHour": (10 <= hn <= 12) or (15 <= hn <= 17)})

        def outcome(matcher):
            m = [c for c in period_calls if matcher(c.get("disposition"), c.get("durationSeconds"))]
            cnt = len(m)
            tot = sum(x.get("durationSeconds") or 0 for x in m)
            return {"count": cnt, "percent": round(cnt / total * 1000) / 10 if total else 0, "avgDuration": fmt(round(tot / cnt) if cnt else 0)}

        call_summary = {
            "connected": outcome(lambda d, du: (du and du > 0) or (d and ("Connected" in d or "Interview" in d))),
            "busy": outcome(lambda d, du: d == "Busy"),
            "noAnswer": outcome(lambda d, du: d == "No Answer"),
            "switchedOff": outcome(lambda d, du: d in ("Switched Off", "Unreachable")),
            "declined": outcome(lambda d, du: d in ("Not Interested", "Salary Issue", "Location Issue")),
            "invalidNumber": outcome(lambda d, du: d == "Invalid Number"),
            "inbound": outcome(lambda d, du: d == "Callback" or (du and du > 60 and d == CI)),
            "followup": outcome(lambda d, du: d in ("Callback", "Call Back Later")),
        }
        presence = []
        for u in active_recs:
            ac = next((c for c in active_raw if c["userId"] == u["id"]), None)
            utc_ = [c for c in scoped if c["userId"] == u["id"] and in_period(c, "today")]
            uconn = len([c for c in utc_ if (c.get("durationSeconds") or 0) > 0])
            usec = sum(c.get("durationSeconds") or 0 for c in utc_)
            presence.append({"id": u["id"], "name": u["name"], "role": u["role"], "teamName": u.get("teamName") or "Staffing",
                             "phone": u.get("phone"), "status": "in_call" if ac else ("offline" if not u.get("isActive") else "available"),
                             "activeCall": {"candidateName": ac["candidateName"], "carrierName": ac["carrierName"], "simSlot": ac["simUsed"], "durationSeconds": ac.get("durationSeconds") or 15} if ac else None,
                             "todayCalls": len(utc_), "todayConnected": uconn, "todayTalkSeconds": usec, "todayTalkFormatted": fmt(usec)})
        perf = []
        for u in active_recs:
            upc = [c for c in scoped if c["userId"] == u["id"] and in_period(c, period)]
            out = len(upc)
            target = (u.get("dailyCallTarget") or 60) if period in ("today", "yesterday") else (u.get("dailyCallTarget") or 60) * 5
            ach = round(out / target * 100) if target else 0
            cl = [c for c in upc if (c.get("durationSeconds") or 0) > 0 or c.get("disposition") in PRODUCTIVE]
            ts = sum(c.get("durationSeconds") or 0 for c in upc)
            perf.append({"id": u["id"], "name": u["name"], "role": u["role"], "teamName": u.get("teamName") or "Staffing",
                         "outboundCalls": out, "targetCalls": target, "gap": out - target, "achievementRate": ach,
                         "connectedCalls": len(cl), "connectRate": round(len(cl) / out * 1000) / 10 if out else 0,
                         "totalTalkSeconds": ts, "totalTalkFormatted": fmt(ts), "avgTalkSeconds": round(ts / len(cl)) if cl else 0,
                         "avgTalkFormatted": fmt(round(ts / len(cl)) if cl else 0),
                         "interestedCount": len([c for c in upc if c.get("disposition") == CI]),
                         "interviewsScheduled": len([c for c in upc if c.get("disposition") == "Interview Scheduled"]),
                         "paceStatus": "Ahead" if ach >= 100 else ("Needs Attention" if ach < 70 else "On Track")})
        logs = []
        for c in period_calls[:50]:
            r = umap.get(c["userId"])
            ph = c["phoneNumber"]
            mph = (ph[:5] + "\u2022\u2022\u2022\u2022\u2022") if (not can_phone and len(ph) >= 7) else ph
            logs.append({**c, "phoneNumber": mph, "isPhoneMasked": not can_phone, "recruiterName": (r or {}).get("name", "Recruiter"),
                         "recruiterRole": (r or {}).get("role", "recruiter"), "durationFormatted": fmt(c.get("durationSeconds") or 0)})
        label = {"today": "Today", "yesterday": "Yesterday", "week": "This Week", "month": "This Month"}.get(period, "All Time")
        return {"period": period, "periodLabel": label, "lastUpdated": now_iso(),
                "kpis": {"totalCalls": {"value": total, "vsYesterdayPercent": tdiff, "trend": "up" if tdiff >= 0 else "down", "target": daily_target, "achievementPercent": round(total / daily_target * 100) if daily_target else 0},
                         "connectedCalls": {"value": cc, "connectRate": crate, "vsYesterdayPercent": crdiff, "trend": "up" if crdiff >= 0 else "down", "targetRate": 50},
                         "talkTime": {"totalSeconds": talk, "totalFormatted": fmt(talk), "avgSeconds": avg, "avgFormatted": fmt(avg), "vsYesterdayPercent": tdiff2},
                         "productiveOutcomes": {"value": pc, "conversionRate": prate, "vsYesterdayPercent": tdiff if tdiff >= 0 else 0}},
                "gapAnalysis": {"dailyTarget": daily_target, "dailyActual": daily_actual, "dailyGap": daily_actual - daily_target,
                                "dailyPercent": min(100, round(daily_actual / daily_target * 100)) if daily_target else 0,
                                "weeklyTarget": week_target, "weeklyActual": len(week_calls), "weeklyGap": len(week_calls) - week_target,
                                "weeklyPercent": min(100, round(len(week_calls) / week_target * 100)) if week_target else 0,
                                "monthlyTarget": month_target, "monthlyActual": len(month_calls), "monthlyGap": len(month_calls) - month_target,
                                "monthlyPercent": min(100, round(len(month_calls) / month_target * 100)) if month_target else 0,
                                "connectedTarget": round(daily_target * 0.5), "connectedActual": cc, "connectedGap": cc - round(daily_target * 0.5),
                                "connectedPercent": min(100, round(cc / (daily_target * 0.5) * 100)) if daily_target else 0,
                                "hourlyDistribution": hourly,
                                "speedToCall": {"under15m": {"count": round(total * 0.42), "percent": 42}, "m15to60": {"count": round(total * 0.31), "percent": 31},
                                                "h1to4": {"count": round(total * 0.18), "percent": 18}, "over4h": {"count": max(1, round(total * 0.09)), "percent": 9}}},
                "callSummary": call_summary, "activeCalls": active, "recruiterPresence": presence, "recruiterPerformance": perf, "callLogs": logs}

    @api.post("/telephony/simulate-call")
    async def telephony_simulate(request: Request, user=Depends(get_current_user)):
        b = await request.json()
        import random
        target = b.get("recruiterId") or user["id"]
        r = store.find("users", id=target) or user
        mode = b.get("mode", "completed")
        sim = b.get("simSlot", "SIM_1")
        call = {"id": gen_id("call_brg"), "userId": target, "leadId": None,
                "candidateName": b.get("candidateName") or "Candidate Simulation",
                "phoneNumber": b.get("phoneNumber") or ("98200" + str(random.randint(10000, 99999))),
                "simUsed": sim, "carrierName": None,
                "status": "connected" if mode == "live" else "completed",
                "durationSeconds": 12 if mode == "live" else int(b.get("durationSeconds", 115)),
                "disposition": None if mode == "live" else b.get("disposition", CI),
                "notes": f"Telephony simulator call: {'Live active call' if mode == 'live' else b.get('disposition', CI)}",
                "initiatedAt": now_iso(), "connectedAt": now_iso() if mode == "live" else None, "endedAt": None if mode == "live" else now_iso()}
        store.col("callBridgeCalls").insert(0, call)
        await store.flush("callBridgeCalls")
        if mode == "live":
            broadcast({"userId": target}, {"type": "CALL_STATUS_UPDATE", "payload": {"callId": call["id"], "status": "connected", "durationSeconds": 12, "notes": call["notes"]}})
        return {"success": True, "call": call, "message": f"{'Live active call initiated' if mode == 'live' else 'Completed call logged'} for {r['name']}"}

    @api.post("/telephony/end-call")
    async def telephony_end(request: Request, user=Depends(get_current_user)):
        b = await request.json()
        cid = b.get("callId")
        if not cid:
            raise HTTPException(400, "callId is required")
        updated = None
        for c in store.col("callBridgeCalls"):
            if c["id"] == cid:
                c.update({"status": "completed", "durationSeconds": b.get("durationSeconds", 65),
                          "disposition": b.get("disposition", CI), "notes": b.get("notes") or f"Call ended via Live Telephony Monitor ({b.get('disposition', CI)})", "endedAt": now_iso()})
                updated = c
        await store.flush("callBridgeCalls")
        if updated:
            broadcast({"userId": updated["userId"]}, {"type": "CALL_STATUS_UPDATE", "payload": {"callId": cid, "status": "completed", "durationSeconds": updated["durationSeconds"], "disposition": updated["disposition"], "notes": updated["notes"]}})
        return {"success": True, "call": updated}

    @api.get("/telephony/export-csv")
    async def telephony_export(user=Depends(get_current_user)):
        if user["role"] == "recruiter" and (user.get("permissions") or {}).get("canExportData") is False:
            raise HTTPException(403, "Access Denied: Telephony export is restricted by your administrator.")
        calls = sorted(store.col("callBridgeCalls"), key=lambda c: dt(c["initiatedAt"]) or utcnow(), reverse=True)
        umap = {u["id"]: u["name"] for u in store.col("users")}
        can_phone = (user.get("permissions") or {}).get("canViewCandidatePhone")
        if can_phone is None:
            can_phone = user["role"] != "recruiter"

        def esc(v): return '"' + str(v if v is not None else "").replace('"', '""') + '"'
        headers = ["Call ID", "Timestamp", "Recruiter", "Candidate Name", "Phone Number", "SIM Slot", "Carrier", "Status", "Duration (Seconds)", "Disposition", "Notes"]
        lines = [",".join(headers)]
        for c in calls:
            ph = c["phoneNumber"]
            mph = (ph[:5] + "\u2022\u2022\u2022\u2022\u2022") if (not can_phone and len(ph) >= 7) else ph
            lines.append(",".join(esc(x) for x in [c["id"], c["initiatedAt"], umap.get(c["userId"], c["userId"]), c["candidateName"], mph, c["simUsed"], c["carrierName"], c["status"], c.get("durationSeconds") or 0, c.get("disposition") or "N/A", c.get("notes") or ""]))
        return PlainTextResponse("\n".join(lines), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="oak_telephony_call_logs.csv"'})

    # ---- ad integrations (demo simulators; disabled unless configured) ----
    @api.post("/integrations/meta/simulate-lead")
    async def meta_sim(request: Request, user=Depends(get_current_user)):
        raise HTTPException(400, "Meta Lead Ads integration is not configured. Set credentials in Settings to enable.")

    @api.post("/integrations/google/simulate-lead")
    async def google_sim(request: Request, user=Depends(get_current_user)):
        raise HTTPException(400, "Google Lead Ads integration is not configured. Set credentials in Settings to enable.")

    @api.post("/integrations/google/sync-conversions")
    async def google_sync(request: Request, user=Depends(get_current_user)):
        raise HTTPException(400, "Google Ads conversion sync is not configured. Set credentials in Settings to enable.")
