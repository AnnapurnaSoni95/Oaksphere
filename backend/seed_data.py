"""Seed dataset for OAKsphere Connect. Ported from the original server/db.ts demo data.
All ad-integration secrets are intentionally blank (configured via env in production)."""
import os
from datetime import datetime, timezone, timedelta

UTCNOW = datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def h_ago(h): return _iso(UTCNOW - timedelta(hours=h))
def h_ahead(h): return _iso(UTCNOW + timedelta(hours=h))
def d_ago(d): return _iso(UTCNOW - timedelta(days=d))
def d_ahead(d): return _iso(UTCNOW + timedelta(days=d))
def date_ago(d): return (UTCNOW - timedelta(days=d)).strftime("%Y-%m-%d")
def date_ahead(d): return (UTCNOW + timedelta(days=d)).strftime("%Y-%m-%d")


TODAY = UTCNOW.strftime("%Y-%m-%d")
TOMORROW = (UTCNOW + timedelta(days=1)).strftime("%Y-%m-%d")


def _perms(role):
    if role == "admin":
        return {"canExportData": True, "canDeleteLeads": True, "canViewAllLeads": True,
                "canViewCandidatePhone": True, "canBulkReassign": True, "canManageTemplates": True}
    if role == "team_leader":
        return {"canExportData": True, "canDeleteLeads": False, "canViewAllLeads": False,
                "canViewCandidatePhone": True, "canBulkReassign": True, "canManageTemplates": True}
    return {"canExportData": False, "canDeleteLeads": False, "canViewAllLeads": False,
            "canViewCandidatePhone": False, "canBulkReassign": False, "canManageTemplates": False}


def build_seed(hash_fn):
    admin_email = os.environ.get("ADMIN_EMAIL", "contact@oaksphereconnect.com")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "Onkar@Oaksphere2026")
    admin_name = os.environ.get("ADMIN_NAME", "Onkar Khillare")

    def user(uid, name, email, pw, role, **kw):
        return {"id": uid, "name": name, "email": email, "passwordHash": hash_fn(pw),
                "role": role, "isActive": kw.get("isActive", True),
                "teamId": kw.get("teamId"), "teamName": kw.get("teamName"), "phone": kw.get("phone"),
                "dailyCallTarget": kw.get("dct", 60), "dailyConnectedTarget": kw.get("dcon", 30),
                "dailyLineupTarget": kw.get("dl", 5), "monthlyJoiningTarget": kw.get("mj", 8),
                "permissions": _perms(role), "createdAt": d_ago(60), "updatedAt": d_ago(60)}

    users = [
        user("usr_onkar", admin_name, admin_email, admin_pw, "admin", phone="9820000000",
             dct=40, dcon=20, dl=4, mj=10),
        user("usr_admin", "Ashwin Verma", "admin@oaksphere.com", "admin123", "admin",
             phone="9820011223", dct=40, dcon=20, dl=4, mj=10),
        user("usr_tl_1", "Rahul Sharma", "tl.rahul@oaksphere.com", "tl123", "team_leader",
             teamId="team_tech_bpo", teamName="Tech & BPO", phone="9820022334", dct=50, dcon=25, dl=5, mj=12),
        user("usr_rec_1", "Priya Nair", "recruiter.priya@oaksphere.com", "recruiter123", "recruiter",
             teamId="team_tech_bpo", teamName="Tech & BPO", phone="9820033445", dct=60, dcon=30, dl=6, mj=8),
        user("usr_rec_2", "Amit Patel", "recruiter.amit@oaksphere.com", "recruiter123", "recruiter",
             teamId="team_tech_bpo", teamName="Tech & BPO", phone="9820044556", dct=60, dcon=30, dl=5, mj=8),
        user("usr_rec_3", "Sneha Rao", "recruiter.sneha@oaksphere.com", "recruiter123", "recruiter",
             teamId="team_sales_banking", teamName="Sales & Banking", phone="9820055667", dct=65, dcon=35, dl=6, mj=9),
        user("usr_rec_4", "Vikram Joshi", "recruiter.vikram@oaksphere.com", "recruiter123", "recruiter",
             teamId="team_sales_banking", teamName="Sales & Banking", phone="9820066778", isActive=False,
             dct=50, dcon=25, dl=4, mj=6),
    ]

    def client(cid, name, cp, phone, email, loc):
        return {"id": cid, "companyName": name, "contactPerson": cp, "phone": phone, "email": email,
                "location": loc, "paymentTerms": "30 days", "replacementTerms": "90 days free replacement",
                "isActive": True, "createdAt": d_ago(40), "updatedAt": d_ago(40)}

    clients = [
        client("cli_techm", "Tech Mahindra BPO", "Karan Mehra (HR Head)", "9892012345", "karan.m@techmahindra.example.com", "Pune - Hinjewadi Phase 3"),
        client("cli_hdfc", "HDFC Bank Retail Assets", "Sunita Deshmukh", "9819098765", "sunita.d@hdfcbank.example.com", "Mumbai - Kanjurmarg West"),
        client("cli_tp", "Teleperformance Global", "Rohan Ahuja", "9871023456", "rohan.ahuja@teleperformance.example.com", "Gurgaon - Cyber City"),
        client("cli_sqyards", "Square Yards Real Estate", "Megha Kapoor", "9880011223", "megha.k@squareyards.example.com", "Bangalore - Indiranagar"),
        client("cli_bajaj", "Bajaj Finserv Consumer Lending", "Vikas Kulkarni", "9822033445", "vikas.k@bajajfinserv.example.com", "Pune - Viman Nagar"),
    ]

    def job(jid, cid, cname, title, loc, sal, exp, openings, req):
        return {"id": jid, "clientId": cid, "clientName": cname, "positionTitle": title, "location": loc,
                "salaryRange": sal, "experienceRequired": exp, "numberOfOpenings": openings,
                "requirements": req, "status": "Active", "createdAt": d_ago(38), "updatedAt": d_ago(38)}

    jobs = [
        job("job_bpo_exec", "cli_techm", "Tech Mahindra BPO", "Customer Care Executive (Voice - UK Shift)", "Pune", "22000 - 28000 / month + Incentives", "0 - 2 Years", 50, "Fluent English, rotational night shifts, cab facility."),
        job("job_hdfc_sales", "cli_hdfc", "HDFC Bank Retail Assets", "Personal Loan Sales Officer", "Mumbai", "25000 - 35000 / month + High Incentives", "1 - 3 Years", 30, "Field sales, DSA/open market lead conversion, graduate preferred."),
        job("job_tp_chat", "cli_tp", "Teleperformance Global", "International Blended Chat Specialist", "Gurgaon", "30000 - 38000 / month", "1 - 4 Years", 40, "Typing 35+ WPM, superior grammar, e-commerce support."),
        job("job_sq_sales", "cli_sqyards", "Square Yards Real Estate", "Associate Relationship Manager - Real Estate", "Bangalore", "35000 - 50000 / month + Commissions", "2 - 5 Years", 20, "High energy, site visits, bike/car mandatory."),
        job("job_bajaj_coll", "cli_bajaj", "Bajaj Finserv Consumer Lending", "Tele-Collections Representative", "Pune", "20000 - 26000 / month + Recovery bonus", "0 - 2 Years", 25, "Hindi/Marathi speaking, persuasion, early bucket collections."),
    ]

    def lead(lid, name, phone, city, rec_id, rec_name, team, status, priority, attempts, **kw):
        return {
            "id": lid, "candidateName": name, "primaryPhone": phone,
            "normalizedPhone": kw.get("norm", phone), "phoneStatus": kw.get("phoneStatus", "VERIFIED"),
            "email": kw.get("email"), "city": city, "age": kw.get("age"), "gender": kw.get("gender"),
            "qualification": kw.get("qual"), "experience": kw.get("exp"),
            "currentSalary": kw.get("cur"), "expectedSalary": kw.get("expc"), "offeredSalary": kw.get("off"),
            "noticePeriod": kw.get("notice"), "leadSource": kw.get("src", "Naukri Bulk"),
            "assignedRecruiterId": rec_id, "assignedRecruiterName": rec_name,
            "originalRecruiterId": rec_id, "originalRecruiterName": rec_name, "teamId": team,
            "clientId": kw.get("clientId"), "clientName": kw.get("clientName"),
            "jobId": kw.get("jobId"), "jobTitle": kw.get("jobTitle"),
            "priority": priority, "leadStatus": status,
            "interviewStatus": kw.get("interviewStatus"), "joiningStatus": kw.get("joiningStatus"),
            "callAttempts": attempts, "lastCallAt": kw.get("lastCallAt"), "lastCallOutcome": kw.get("lastOutcome"),
            "nextFollowupAt": kw.get("nextFollowupAt"), "nextFollowupReason": kw.get("nextFollowupReason"),
            "notesSummary": kw.get("notes", ""), "expectedJoiningDate": kw.get("ejd"),
            "actualJoiningDate": kw.get("ajd"), "lostReason": kw.get("lostReason"),
            "assignmentHistory": kw.get("history", []),
            "createdAt": kw.get("createdAt", d_ago(3)), "updatedAt": kw.get("updatedAt", d_ago(3)),
            "updatedById": rec_id, "updatedByName": rec_name,
        }

    leads = [
        lead("lead_101", "Rohan K. Joshi", "9820199001", "Pune", "usr_rec_1", "Priya Nair", "team_tech_bpo",
             "Follow-up", "Hot", 2, email="rohan.joshi@example.com", age=24, gender="Male", qual="B.Com",
             exp="1.5 Years in BPO Voice", cur=22000, expc=28000, notice="Immediate",
             clientId="cli_techm", clientName="Tech Mahindra BPO", jobId="job_bpo_exec",
             jobTitle="Customer Care Executive (Voice - UK Shift)", lastCallAt=h_ago(6), lastOutcome="Callback",
             nextFollowupAt=h_ago(3), nextFollowupReason="Confirm interview slot",
             notes="Good English, willing for night shift.", createdAt=d_ago(2), updatedAt=h_ago(6)),
        lead("lead_102", "Pooja Bhatt", "9819922002", "Pune", "usr_rec_1", "Priya Nair", "team_tech_bpo",
             "Follow-up", "High", 3, email="pooja.bhatt@example.com", age=23, gender="Female", exp="Fresher",
             expc=22000, notice="Immediate", src="Indeed", clientId="cli_techm", clientName="Tech Mahindra BPO",
             jobId="job_bpo_exec", jobTitle="Customer Care Executive (Voice - UK Shift)",
             lastCallAt=d_ago(3), lastOutcome="Callback", nextFollowupAt=d_ago(2),
             nextFollowupReason="Collect graduation marksheets", notes="Strong spoken English.",
             createdAt=d_ago(4), updatedAt=d_ago(3)),
        lead("lead_103", "Vikas Sundaram", "9820033003", "Pune", "usr_rec_2", "Amit Patel", "team_tech_bpo",
             "Interview Scheduled", "Hot", 2, email="vikas.s@example.com", age=26, exp="2 Years Teleperformance",
             expc=28000, notice="15 Days", src="LinkedIn", clientId="cli_techm", clientName="Tech Mahindra BPO",
             jobId="job_bpo_exec", jobTitle="Customer Care Executive (Voice - UK Shift)",
             interviewStatus="Tomorrow", lastCallAt=d_ago(1), lastOutcome="Interview Scheduled",
             notes="Lineup booked tomorrow 11:30 AM.", createdAt=d_ago(3), updatedAt=d_ago(1)),
        lead("lead_104", "Neha Deshmukh", "9833044004", "Mumbai", "usr_rec_1", "Priya Nair", "team_tech_bpo",
             "Interview Scheduled", "High", 3, email="neha.deshmukh@example.com", exp="3 Years Sales",
             expc=38000, src="Walk-in", clientId="cli_hdfc", clientName="HDFC Bank Retail Assets",
             jobId="job_hdfc_sales", jobTitle="Personal Loan Sales Officer", interviewStatus="Today",
             lastCallAt=h_ago(18), lastOutcome="Interview Scheduled",
             notes="F2F at HDFC Kanjurmarg 2 PM today.", createdAt=d_ago(5), updatedAt=h_ago(18)),
        lead("lead_105", "Sanjay Rawat", "9811055005", "Gurgaon", "usr_rec_2", "Amit Patel", "team_tech_bpo",
             "Selected", "Hot", 4, email="sanjay.rawat@example.com", exp="3 Years Chat Support", expc=36000,
             off=35000, notice="30 Days", clientId="cli_tp", clientName="Teleperformance Global",
             jobId="job_tp_chat", jobTitle="International Blended Chat Specialist",
             interviewStatus="Selected", joiningStatus="Offer Pending", lastCallAt=d_ago(1),
             lastOutcome="Connected – Interested", notes="Cleared Round 2. Awaiting joining date.",
             createdAt=d_ago(8), updatedAt=d_ago(1)),
        lead("lead_106", "Aditya Sen", "9845066006", "Bangalore", "usr_rec_3", "Sneha Rao", "team_sales_banking",
             "Joining Scheduled", "Hot", 5, email="aditya.sen@example.com", exp="4 Years Property Sales",
             expc=48000, off=45000, notice="Immediate", src="Referral", clientId="cli_sqyards",
             clientName="Square Yards Real Estate", jobId="job_sq_sales",
             jobTitle="Associate Relationship Manager - Real Estate", interviewStatus="Selected",
             joiningStatus="Joining Confirmed", ejd=date_ahead(2), lastCallAt=h_ago(10),
             lastOutcome="Connected – Interested", notes="Offer signed. Reporting Monday.",
             createdAt=d_ago(12), updatedAt=h_ago(10)),
        lead("lead_107", "Deepak Choudhary", "9820077007", "Pune", "usr_rec_1", "Priya Nair", "team_tech_bpo",
             "Joined", "High", 6, email="deepak.c@example.com", exp="1 Year BPO", expc=26000, off=26000,
             notice="Immediate", clientId="cli_techm", clientName="Tech Mahindra BPO", jobId="job_bpo_exec",
             jobTitle="Customer Care Executive (Voice - UK Shift)", interviewStatus="Selected",
             joiningStatus="Joined", ejd=date_ago(3), ajd=date_ago(3), lastCallAt=d_ago(3),
             lastOutcome="Connected – Interested", notes="Joined successfully.",
             createdAt=d_ago(18), updatedAt=d_ago(3)),
        lead("lead_108", "Anita Menon", "9833088008", "Pune", "usr_rec_2", "Amit Patel", "team_tech_bpo",
             "New", "High", 0, email="anita.menon@example.com", exp="Fresher", expc=24000, src="Facebook Ads",
             clientId="cli_techm", clientName="Tech Mahindra BPO", jobId="job_bpo_exec",
             jobTitle="Customer Care Executive (Voice - UK Shift)", notes="FB campaign lead, not yet dialed.",
             createdAt=d_ago(8), updatedAt=d_ago(8)),
        lead("lead_109", "Rajesh Gokhale", "9892099009", "Pune", "", "Unassigned", None, "New", "Hot", 0,
             email="rajesh.g@example.com", exp="2 Years Collections", expc=25000, notice="Immediate",
             notes="Imported, pending assignment.", createdAt=d_ago(1), updatedAt=d_ago(1)),
        lead("lead_110", "Sameer K. Nair", "9820012399", "Mumbai", "usr_rec_1", "Priya Nair", "team_tech_bpo",
             "Calling", "High", 1, email="sameer.nair@example.com", exp="2 Years Sales", expc=34000,
             notice="15 Days", clientId="cli_hdfc", clientName="HDFC Bank Retail Assets", jobId="job_hdfc_sales",
             jobTitle="Personal Loan Sales Officer", lastCallAt=d_ago(4), lastOutcome="Busy",
             notes="Applied via Naukri.", createdAt=d_ago(4), updatedAt=d_ago(4)),
        lead("lead_111", "Samir Nair", "+91 98200 12399", "Navi Mumbai", "usr_rec_3", "Sneha Rao",
             "team_sales_banking", "New", "Medium", 0, norm="9820012399", email="samir.sales@example.com",
             exp="2.5 Years Loan DSA", expc=35000, notice="Immediate", src="Referral",
             notes="Referred by branch manager.", createdAt=d_ago(1), updatedAt=d_ago(1)),
        lead("lead_112", "Manoj Tiwari", "9820023456", "Pune", "usr_rec_1", "Priya Nair", "team_tech_bpo",
             "Calling", "Medium", 2, email="manoj.tiwari@example.com", exp="6 Months Telecalling", expc=20000,
             notice="Immediate", src="Facebook Ads", clientId="cli_bajaj",
             clientName="Bajaj Finserv Consumer Lending", jobId="job_bajaj_coll",
             jobTitle="Tele-Collections Representative", lastCallAt=h_ago(2), lastOutcome="Switched Off",
             notes="Phone switched off, reattempt afternoon.", createdAt=d_ago(2), updatedAt=h_ago(2)),
        lead("lead_113", "Divya Iyer", "9880034567", "Bangalore", "usr_rec_3", "Sneha Rao", "team_sales_banking",
             "Interested", "Hot", 1, email="divya.iyer@example.com", exp="2 Years Real Estate Telesales",
             expc=35000, notice="7 Days", src="LinkedIn", clientId="cli_sqyards",
             clientName="Square Yards Real Estate", jobId="job_sq_sales",
             jobTitle="Associate Relationship Manager - Real Estate", lastCallAt=h_ago(4),
             lastOutcome="Connected – Interested", notes="Impressive profile.", createdAt=d_ago(3), updatedAt=h_ago(4)),
        lead("lead_114", "Harish Verma", "123456", "Pune", "usr_rec_1", "Priya Nair", "team_tech_bpo",
             "Invalid Number", "Low", 1, norm="123456", phoneStatus="INVALID", email="harish.v@example.com",
             exp="Fresher", src="Walk-in", lastCallAt=d_ago(5), lastOutcome="Invalid Number",
             notes="6-digit incomplete number.", createdAt=d_ago(5), updatedAt=d_ago(5)),
        lead("lead_115", "Kunal Saxena", "9820098711", "Pune", "usr_rec_2", "Amit Patel", "team_tech_bpo",
             "New", "Cold", 0, email="kunal.s@example.com", exp="3 Years Sales",
             notes="Uploaded 18 days ago, untouched.", createdAt=d_ago(18), updatedAt=d_ago(18)),
    ]

    followups = [
        {"id": "flw_1", "leadId": "lead_101", "candidateName": "Rohan K. Joshi", "candidatePhone": "9820199001",
         "recruiterId": "usr_rec_1", "recruiterName": "Priya Nair", "teamId": "team_tech_bpo",
         "scheduledAt": h_ago(3), "reason": "Confirm interview slot", "priority": "Hot",
         "status": "PENDING", "createdAt": h_ago(6)},
        {"id": "flw_2", "leadId": "lead_102", "candidateName": "Pooja Bhatt", "candidatePhone": "9819922002",
         "recruiterId": "usr_rec_1", "recruiterName": "Priya Nair", "teamId": "team_tech_bpo",
         "scheduledAt": d_ago(2), "reason": "Collect graduation marksheets", "priority": "High",
         "status": "PENDING", "createdAt": d_ago(4)},
    ]

    interviews = [
        {"id": "int_1", "leadId": "lead_103", "candidateName": "Vikas Sundaram", "candidatePhone": "9820033003",
         "recruiterId": "usr_rec_2", "recruiterName": "Amit Patel", "clientId": "cli_techm",
         "clientName": "Tech Mahindra BPO", "jobId": "job_bpo_exec",
         "jobTitle": "Customer Care Executive (Voice - UK Shift)", "date": TOMORROW, "time": "11:30",
         "scheduledAt": f"{TOMORROW}T11:30:00.000Z", "location": "Hinjewadi Campus",
         "interviewType": "Face-to-face", "stage": "Tomorrow", "confirmationStatus": "Pending",
         "notes": "", "createdAt": d_ago(1), "updatedAt": d_ago(1)},
        {"id": "int_2", "leadId": "lead_104", "candidateName": "Neha Deshmukh", "candidatePhone": "9833044004",
         "recruiterId": "usr_rec_1", "recruiterName": "Priya Nair", "clientId": "cli_hdfc",
         "clientName": "HDFC Bank Retail Assets", "jobId": "job_hdfc_sales",
         "jobTitle": "Personal Loan Sales Officer", "date": TODAY, "time": "14:00",
         "scheduledAt": f"{TODAY}T14:00:00.000Z", "location": "HDFC Kanjurmarg",
         "interviewType": "Face-to-face", "stage": "Today", "confirmationStatus": "Confirmed",
         "notes": "", "createdAt": d_ago(2), "updatedAt": h_ago(18)},
    ]

    joinings = [
        {"id": "join_1", "leadId": "lead_106", "candidateName": "Aditya Sen", "candidatePhone": "9845066006",
         "recruiterId": "usr_rec_3", "recruiterName": "Sneha Rao", "clientId": "cli_sqyards",
         "clientName": "Square Yards Real Estate", "jobId": "job_sq_sales",
         "jobTitle": "Associate Relationship Manager - Real Estate", "status": "Joining Confirmed",
         "selectionDate": date_ago(5), "expectedJoiningDate": date_ahead(2), "offeredSalary": 45000,
         "confirmationStatus": "Confirmed", "remarks": "Offer signed.", "createdAt": d_ago(5), "updatedAt": h_ago(10)},
        {"id": "join_2", "leadId": "lead_107", "candidateName": "Deepak Choudhary", "candidatePhone": "9820077007",
         "recruiterId": "usr_rec_1", "recruiterName": "Priya Nair", "clientId": "cli_techm",
         "clientName": "Tech Mahindra BPO", "jobId": "job_bpo_exec",
         "jobTitle": "Customer Care Executive (Voice - UK Shift)", "status": "Joined",
         "selectionDate": date_ago(10), "expectedJoiningDate": date_ago(3), "actualJoiningDate": date_ago(3),
         "offeredSalary": 26000, "confirmationStatus": "Confirmed", "remarks": "Joined.",
         "createdAt": d_ago(10), "updatedAt": d_ago(3)},
    ]

    activities = [
        {"id": "act_1", "leadId": "lead_101", "type": "call", "title": "Callback Requested",
         "description": "Connected with Rohan. Asked to call back at 2 PM.",
         "performedBy": {"id": "usr_rec_1", "name": "Priya Nair", "role": "recruiter"}, "createdAt": h_ago(6)},
        {"id": "act_2", "leadId": "lead_105", "type": "status_change", "title": "Status Updated: Selected",
         "description": "Selected for Chat Specialist. Awaiting joining date.",
         "performedBy": {"id": "usr_rec_2", "name": "Amit Patel", "role": "recruiter"}, "createdAt": d_ago(1)},
    ]

    def tmpl(tid, title, cat, variables, body):
        return {"id": tid, "title": title, "category": cat, "channel": "whatsapp", "isSystem": True,
                "variables": variables, "body": body, "createdAt": _iso(UTCNOW), "updatedAt": _iso(UTCNOW)}

    templates = [
        tmpl("tmpl_screening", "1. Screening & Initial Job Pitch", "screening",
             ["candidate_name", "job_title", "client_name", "salary_range", "recruiter_name", "recruiter_phone"],
             "Hi {{candidate_name}}, this is {{recruiter_name}} from OAKsphere Connect regarding the *{{job_title}}* role at *{{client_name}}* (Salary: {{salary_range}}). Are you available for a quick discussion today?"),
        tmpl("tmpl_interview_call", "2. Interview Call Letter & Venue", "interview",
             ["candidate_name", "job_title", "client_name", "interview_date", "interview_time", "interview_venue", "google_maps_link", "contact_person", "recruiter_name", "recruiter_phone"],
             "Dear {{candidate_name}}, your interview for *{{job_title}}* at *{{client_name}}* is confirmed.\nDate: {{interview_date}}\nTime: {{interview_time}}\nVenue: {{interview_venue}}\nMaps: {{google_maps_link}}\nContact: {{contact_person}}\n\nCarry 2 resume copies. Dress formal.\n{{recruiter_name}} | {{recruiter_phone}}"),
        tmpl("tmpl_morning_confirm", "3. Morning-of-Interview Confirmation", "reminder",
             ["candidate_name", "job_title", "client_name", "interview_time", "recruiter_phone"],
             "Good morning {{candidate_name}}! Reminder for your interview today for *{{job_title}}* at *{{client_name}}* at {{interview_time}}. Reply CONFIRMED. Call {{recruiter_phone}} for delays."),
        tmpl("tmpl_post_interview", "4. Post-Interview Follow-up", "status",
             ["candidate_name", "job_title", "client_name", "recruiter_phone"],
             "Hi {{candidate_name}}, how was your interview with {{client_name}} for {{job_title}}? Please share feedback or call {{recruiter_phone}}."),
        tmpl("tmpl_doc_checklist", "5. Document Checklist for Joining", "documents",
             ["candidate_name", "job_title", "client_name", "recruiter_name"],
             "Congratulations {{candidate_name}} on clearing *{{job_title}}* at *{{client_name}}*! Please share: Aadhaar, PAN, Degree, 3 months salary slips, Relieving letter, Bank passbook."),
        tmpl("tmpl_joining_welcome", "6. Day 1 Joining Welcome", "joining",
             ["candidate_name", "job_title", "client_name", "interview_time", "interview_venue", "contact_person", "recruiter_name"],
             "Congratulations {{candidate_name}} on joining {{client_name}} as {{job_title}}!\nReporting: {{interview_time}}\nLocation: {{interview_venue}}\nContact: {{contact_person}}\n{{recruiter_name}} | OAKsphere Connect"),
    ]

    settings = {
        "leadSources": ["Naukri Bulk", "Indeed", "LinkedIn", "Referral", "Walk-in", "Facebook Ads", "Campus", "Consultant"],
        "priorities": ["Hot", "High", "Medium", "Low", "Cold"],
        "callDispositions": ["Connected – Interested", "Not Interested", "Callback", "Interview Scheduled",
                             "Already Working", "Salary Issue", "Location Issue", "Job Mismatch", "No Answer",
                             "Busy", "Switched Off", "Unreachable", "Invalid Number", "WhatsApp Only", "Call Back Later"],
        "interviewStages": ["Pending", "Scheduled", "Tomorrow", "Today", "Attended", "Not Attended",
                            "Rescheduled", "Selected", "Rejected", "Dropped"],
        "joiningStatuses": ["Selected", "Documents Pending", "Offer Pending", "Offer Released",
                            "Joining Confirmed", "Joined", "Delayed", "No Show", "Dropped", "Client Rejected"],
        "shiftTypes": ["24/7 Rotational", "Day Shift Only", "US Night Shift", "UK Shift", "Rotational Day/Night"],
        "jobCategories": ["BPO & Customer Operations", "Banking & Financial Services", "Field & Telesales",
                          "IT Support & Technical", "Retail & Back Office"],
        "overdueEscalationHoursTL": 4, "overdueEscalationHoursAdmin": 24,
        "defaultDailyCallTarget": 60, "defaultDailyConnectedTarget": 30,
        "defaultDailyLineupTarget": 5, "defaultMonthlyJoiningTarget": 8,
        "agencyCMS": {
            "agencyName": "OAKsphere Connect Recruitment Solutions",
            "tagline": "Enterprise Bulk Staffing & Recruitment Operations Engine",
            "registrationNumber": "", "officialEmail": admin_email, "officialPhone": "",
            "headquartersAddress": "Pune, Maharashtra", "websiteUrl": "https://oaksphereconnect.com",
            "defaultCurrency": "INR", "timezone": "Asia/Kolkata (IST)",
            "careersPortalTitle": "OAKsphere Careers Portal", "careersHeroHeadline": "Land Your Next Career Role",
            "careersHeroSubheadline": "Verified openings across top enterprises.",
            "allowDirectApplication": True, "requireResumeUpload": False, "autoSendWhatsAppAck": True,
            "autoRecycleStaleHours": 48, "enableAutoRecycle": True, "assignmentStrategy": "round_robin",
        },
        "metaIntegration": {
            "isEnabled": False, "appId": "", "appSecret": "", "pageAccessToken": "", "adAccountId": "",
            "verifyToken": "", "webhookUrl": "/api/webhooks/meta-leads",
            "formMapping": {"nameField": "full_name", "phoneField": "phone_number", "emailField": "email",
                            "cityField": "city", "expField": "years_of_experience", "shiftField": "preferred_shift"},
            "campaigns": [],
        },
        "googleAdsIntegration": {
            "isEnabled": False, "customerId": "", "webhookSecretKey": "", "webhookUrl": "/api/webhooks/google-leads",
            "lineupConversionActionId": "", "joiningConversionActionId": "", "enableOfflineConversions": False,
            "campaigns": [],
        },
    }

    devices = [
        {"id": "dev_oneplus_12", "userId": "usr_admin", "deviceName": "OnePlus 12 5G (Recruiter Desk)",
         "platform": "android", "sim1Carrier": "Jio 5G (Work SIM)", "sim1Number": "+91 98201 12345",
         "sim2Carrier": "Airtel (Alternate SIM)", "sim2Number": "+91 98201 54321", "defaultSim": "SIM_1",
         "batteryLevel": 92, "networkSignal": "strong", "status": "connected", "pairCode": "849-215",
         "lastSeenAt": _iso(UTCNOW), "createdAt": d_ago(5)},
        {"id": "dev_galaxy_s24", "userId": "usr_rec_1", "deviceName": "Samsung Galaxy S24 (Priya)",
         "platform": "android", "sim1Carrier": "Airtel 5G (Work)", "sim1Number": "+91 98765 43210",
         "sim2Carrier": "Jio 4G", "defaultSim": "SIM_1", "batteryLevel": 84, "networkSignal": "strong",
         "status": "connected", "pairCode": "612-904", "lastSeenAt": _iso(UTCNOW), "createdAt": d_ago(3)},
        {"id": "dev_iphone_15", "userId": "usr_rec_2", "deviceName": "iPhone 15 Pro (Amit)",
         "platform": "ios", "sim1Carrier": "Jio True 5G", "sim1Number": "+91 98980 11223",
         "defaultSim": "SIM_1", "batteryLevel": 78, "networkSignal": "strong", "status": "connected",
         "pairCode": "391-744", "lastSeenAt": _iso(UTCNOW), "createdAt": d_ago(2)},
    ]

    bridge_calls = _gen_bridge_calls()

    return {
        "users": users, "leads": leads, "activities": activities, "calls": [],
        "followups": followups, "interviews": interviews, "joinings": joinings,
        "clients": clients, "jobs": jobs, "templates": templates, "notifications": [],
        "auditLogs": [], "callBridgeDevices": devices, "callBridgeCalls": bridge_calls,
        "settings": settings, "callBridgeSettings": {"usr_admin": _default_bridge_settings()},
    }


def _default_bridge_settings():
    return {"defaultSim": "SIM_1", "sim1Carrier": "Jio 5G (Work SIM)", "sim1Number": "+91 98201 12345",
            "sim2Carrier": "Airtel 4G (Alternate SIM)", "sim2Number": "+91 98201 54321",
            "gatewayMode": "companion_relay", "autoLogDisposition": True, "soundAlerts": True,
            "autoStartTimer": True}


def _gen_bridge_calls():
    now = UTCNOW
    calls = []
    disp = ["Connected – Interested", "Interview Scheduled", "Callback", "Busy", "No Answer",
            "Switched Off", "Not Interested", "Connected – Interested"]
    recs = ["usr_rec_1", "usr_rec_2", "usr_rec_3", "usr_tl_1"]
    names = ["Rahul Sen", "Anita Kadam", "Meera Nair", "Suresh Raina", "Kavita Pillai",
             "Alok Verma", "Pooja Hegde", "Mohit Sharma", "Varun Dhawan", "Kiara Advani"]

    def mk(cid, uid, name, phone, sim, carrier, status, dur, dispo, initiated, connected=None, ended=None, lead_id=None):
        return {"id": cid, "userId": uid, "leadId": lead_id, "candidateName": name, "phoneNumber": phone,
                "simUsed": sim, "carrierName": carrier, "status": status, "durationSeconds": dur,
                "disposition": dispo, "notes": f"Telephony record: {dispo}",
                "initiatedAt": _iso(initiated),
                "connectedAt": _iso(connected) if connected else None,
                "endedAt": _iso(ended) if ended else None}

    # one live active call
    calls.append(mk("call_live_1", "usr_rec_1", "Pooja Bhatt", "9819922002", "SIM_1", "Jio 5G",
                    "connected", 78, None, now - timedelta(seconds=78), now - timedelta(seconds=65), lead_id="lead_102"))
    # today completed
    today_seed = [
        ("call_brg_101", "usr_rec_1", "Rohan Sharma", "9820011001", "SIM_1", "Jio 5G", 148, "Connected – Interested", 45),
        ("call_brg_102", "usr_rec_2", "Vikas Sundaram", "9820033003", "SIM_1", "Jio 5G", 215, "Interview Scheduled", 80),
        ("call_brg_103", "usr_rec_3", "Sanjay Rawat", "9820066006", "SIM_2", "Airtel 4G", 165, "Connected – Interested", 110),
        ("call_brg_104", "usr_rec_1", "Neha Deshmukh", "9833044004", "SIM_1", "Jio 5G", 195, "Interview Scheduled", 140),
        ("call_brg_105", "usr_rec_2", "Kunal Deshmukh", "9820088112", "SIM_2", "Airtel 4G", 38, "Callback", 170),
        ("call_brg_106", "usr_rec_1", "Akash Gupta", "9819933441", "SIM_1", "Jio 5G", 0, "Busy", 200),
        ("call_brg_110", "usr_admin", "Deepak Patil", "9820055443", "SIM_1", "Jio 5G", 52, "Not Interested", 320),
    ]
    for cid, uid, name, phone, sim, carrier, dur, dispo, mins in today_seed:
        it = now - timedelta(minutes=mins)
        conn = it + timedelta(seconds=12) if dur > 0 else None
        calls.append(mk(cid, uid, name, phone, sim, carrier, "completed", dur, dispo, it, conn,
                        it + timedelta(seconds=dur + 15)))
    # ~22 yesterday
    for i in range(22):
        d = disp[i % len(disp)]
        conn = ("Connected" in d) or ("Interview" in d) or ("Callback" in d)
        dur = (45 + (i * 23) % 180) if conn else 0
        t = now - timedelta(hours=24) - timedelta(minutes=i * 25)
        calls.append(mk(f"call_yst_{i+1}", recs[i % len(recs)], names[i % len(names)] + " (Yest)",
                        "98200" + str(10000 + i), "SIM_1" if i % 2 == 0 else "SIM_2",
                        "Jio 5G" if i % 2 == 0 else "Airtel 4G", "completed", dur, d, t,
                        t + timedelta(seconds=10) if conn else None, t + timedelta(seconds=dur + 12)))
    # earlier this week
    for day in range(2, 6):
        for c in range(10):
            d = disp[(day + c) % len(disp)]
            conn = ("Connected" in d) or ("Interview" in d) or ("Callback" in d)
            dur = (55 + (c * 27) % 200) if conn else 0
            t = now - timedelta(days=day) - timedelta(minutes=c * 35)
            calls.append(mk(f"call_wk_{day}_{c+1}", recs[(c + day) % len(recs)],
                            names[(c + day) % len(names)] + f" (D-{day})", "98300" + str(20000 + day * 100 + c),
                            "SIM_1" if c % 2 == 0 else "SIM_2", "Jio 5G" if c % 2 == 0 else "Airtel 4G",
                            "completed", dur, d, t, t + timedelta(seconds=11) if conn else None,
                            t + timedelta(seconds=dur + 14)))
    return calls
