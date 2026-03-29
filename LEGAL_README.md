# RespawnSignal Legal Documents

**Last Updated:** March 26, 2026

This folder contains all legal, compliance, and operational documents for RespawnSignal LLC, a TikTok brand deal scanner SaaS.

---

## 📁 File Structure

```
respawn-legal-docs/
├── LEGAL_README.md                        ← You are here
├── PRIVACY_POLICY.md                      ← Website: /privacy-policy
├── TERMS_OF_SERVICE.md                    ← Website: /terms-of-service
├── REFUND_POLICY.md                       ← Website: /refund-policy
├── COFOUNDER_PARTNERSHIP_AGREEMENT.md     ← For co-founders to sign
├── FOOTER_HTML.html                       ← Copy to website footer
├── COMPLIANCE_CHECKLIST.md                ← Track launch progress
└── LEGAL_NOTES.md                         ← Internal reference (optional)
```

---

## 🚀 Quick Start (Before Launch)

### Step 1: Review & Customize Documents (30 mins)

1. **Privacy Policy** (`PRIVACY_POLICY.md`)
   - ✅ Already customized for RespawnSignal
   - [ ] Review data collection section
   - [ ] Verify third-party services list is accurate
   - No changes needed if you use: Stripe, Supabase, RapidAPI, Transcript24, Perplexity

2. **Terms of Service** (`TERMS_OF_SERVICE.md`)
   - ✅ Already customized
   - [ ] Review Acceptable Use Policy section
   - [ ] Review AI Accuracy Disclaimer
   - No changes needed (comprehensive coverage)

3. **Refund Policy** (`REFUND_POLICY.md`)
   - ✅ Already customized
   - [ ] Confirm 7-day refund window (or edit if different)
   - [ ] Confirm subscription details match your pricing

4. **Co-Founder Partnership Agreement** (`COFOUNDER_PARTNERSHIP_AGREEMENT.md`)
   - **MUST CUSTOMIZE:**
     - [ ] Fill in Founder 1 name, title, equity %
     - [ ] Fill in Founder 2 name, title, equity %
     - [ ] Define roles and responsibilities
     - [ ] Specify time commitments
     - [ ] Choose dispute resolution approach (mediation or 50/50 authority)
   - **MUST SIGN:**
     - [ ] Both founders print and sign (or use HelloSign/DocuSign)
     - [ ] Keep original/scanned copy securely

### Step 2: Add to Website (30 mins)

1. **Create pages:**
   - Create `/privacy-policy` page
   - Create `/terms-of-service` page
   - Create `/refund-policy` page

2. **Copy content:**
   - Copy markdown content from each `.md` file
   - Paste into your website CMS or HTML templates
   - Format as needed (headers, lists, spacing)

3. **Update footer:**
   - Copy `FOOTER_HTML.html` to your website footer
   - Update links to match your domain
   - Test all links work

4. **Add signup checkbox:**
   - At account creation, add checkbox: "I agree to Terms of Service"
   - Link to /terms-of-service
   - Make it required before signup

### Step 3: Finalize & Sign (1 day)

1. **Co-Founder Agreement:**
   - Print and sign (both founders)
   - OR use HelloSign/DocuSign for digital signatures
   - Store securely (encrypted backup)

2. **Legal Contact Email:**
   - Set up: legal@respawnmedia.co
   - Forward to appropriate person(s)

3. **Support Email:**
   - Set up: support@respawnmedia.co
   - Forward to support team

### Step 4: Launch! 🎉

You're ready to accept paying customers.

---

## 📋 Important Customizations (Do NOT Skip)

### Co-Founder Partnership Agreement

**Find & Replace:**
- `[Founder 1 Name]` → Your actual name
- `[Founder 2 Name]` → Co-founder's actual name
- `[Equity %]` → Your equity percentage
- `[Title/Role]` → Your role (e.g., "CEO", "CTO", "VP Product")
- `[Business Location]` → New York, USA (already done)

**Key Decisions to Make:**
1. **Equity Split:** How are you splitting ownership?
   - Example: 60% / 40%? 50% / 50%? 70% / 30%?
2. **Vesting:** Default is 4 years with 1-year cliff (standard for startups)
   - This protects both founders — if someone leaves day 1, they don't keep equity
3. **Dispute Resolution:** Who has final say if founders disagree?
   - Option A: Mediation only (more collaborative)
   - Option B: Founder 1 has tiebreaker vote (more decisive)

### Legal Emails

- **legal@respawnmedia.co** — For legal/compliance inquiries
- **support@respawnmedia.co** — For customer support

Make sure these are routed to the right people in your organization.

---

## ✅ Pre-Launch Security Checklist

Before accepting your first paying customer:

- [ ] HTTPS/SSL enabled on respawnmedia.co
- [ ] Passwords hashed with bcrypt (not plaintext)
- [ ] Session tokens expire after 24 hours
- [ ] Google OAuth redirect URIs whitelisted (production only)
- [ ] Stripe webhook verification working
- [ ] API keys in environment variables (not hardcoded)
- [ ] Input validation to prevent SQL injection
- [ ] Privacy Policy linked in footer
- [ ] Terms of Service linked in footer + checkbox at signup
- [ ] Refund Policy linked in footer

---

## 🔒 Protecting Your Data

### Backup Your Legal Documents

Store copies in multiple places:
1. **Git Repository** (this folder — encrypted if private)
2. **Cloud Storage** (Google Drive, Dropbox — encrypted)
3. **Printed Backup** (Co-founder agreement — locked safe)

### Access Control

- Only authorized people should edit legal documents
- Changes should be tracked (use Git history)
- Never modify documents after they're "live" without notifying users

---

## 📞 When to Call a Lawyer

**Worth the investment ($300-500):**
- ✅ Review your Terms of Service before launch
- ✅ Review your Co-Founder Agreement before signing
- ✅ Review your Privacy Policy for GDPR/CCPA compliance (if EU/CA customers)

**Probably overkill (you can DIY):**
- ❌ Copyediting the refund policy
- ❌ Adjusting footer links
- ❌ Updating email addresses

---

## 🚨 Compliance Notes for RespawnSignal

### Platform Compliance

RespawnSignal accesses data from TikTok, YouTube, and Instagram. Each platform has strict terms:

**TikTok:**
- Currently using: RapidAPI's tiktok-scraper7
- **Action:** Verify RapidAPI has TikTok's permission (not directly scraping)
- **Risk:** TikTok has sued scraping companies in the past
- **Protection:** Include in ToS: "Users must comply with TikTok's ToS when using results"

**YouTube:**
- Currently using: Transcript24 API
- **Action:** Confirm Transcript24 is authorized by YouTube
- **Risk:** Low (using official API partner)
- **Protection:** Included in Privacy Policy

**Instagram:**
- **Action:** Research how you're accessing Instagram data
- **Risk:** HIGH (Meta aggressively enforces ToS against scrapers)
- **Protection:** Ensure you're only using official Meta APIs

### AI Accuracy Disclaimer

Your Terms of Service includes: *"RespawnSignal's brand deal detection is powered by AI and is not 100% accurate."*

This protects you from liability if results are wrong. Make sure this disclaimer is:
- [ ] Displayed in your app (not hidden in fine print)
- [ ] On the results page
- [ ] In your Terms of Service

### User Responsibility

Make it clear in your Terms that **users are responsible** for how they use your results:
- Don't use results to harass creators
- Comply with platform ToS
- Verify results independently

---

## 🔄 Document Maintenance

### When to Update

Update your documents when:
- ✅ You add a new third-party service (add to Privacy Policy)
- ✅ You change your refund policy (notify users 30 days in advance)
- ✅ You change your pricing (notify users 30 days in advance)
- ✅ GDPR/CCPA regulations change (annual review)

**Never update without:**
- [ ] Notifying users (email preferred)
- [ ] Updating the "Last Updated" date
- [ ] Keeping old versions for reference

### Annual Review

Every 12 months:
1. Review all legal documents for accuracy
2. Check if any regulations changed
3. Update if needed
4. Notify users of material changes

---

## 📊 Compliance Status

| Document | Status | Live | Notes |
|----------|--------|------|-------|
| Privacy Policy | ✅ Ready | [ ] | Comprehensive; no changes needed |
| Terms of Service | ✅ Ready | [ ] | Covers AI accuracy, liability, ToS violations |
| Refund Policy | ✅ Ready | [ ] | 7-day guarantee; clear refund process |
| Co-Founder Agreement | ⏳ Needs Signatures | [ ] | Customize equity & roles first |
| Footer HTML | ✅ Ready | [ ] | Copy to website; customize links |
| Privacy Policy | ✅ Live | [x] | Add to website |
| Terms of Service | ✅ Live | [x] | Add to website + signup checkbox |
| Refund Policy | ✅ Live | [x] | Add to website |

---

## 🎓 Learning Resources

### Legal Fundamentals
- **Stripe's Legal Playbook:** stripe.com/guides/startup-legal-framework
- **Y Combinator's Startup School:** startupschool.org
- **Startup.com's Legal Templates:** startup.com/articles/templates

### Compliance
- **GDPR Basics:** gdpr.eu/
- **CCPA Basics:** oag.ca.gov/privacy/ccpa
- **SaaS Compliance Checklist:** builtin.com/startup/saas-compliance

### Security
- **OWASP Top 10:** owasp.org/Top10/
- **Stripe's Security Docs:** stripe.com/docs/security
- **SaaS Security Best Practices:** sans.org/white-papers/

---

## 🆘 Troubleshooting

### "I don't understand what goes in [X section]"

→ Email **legal@respawnmedia.co** or review the original checklist: `COMPLIANCE_CHECKLIST.md`

### "We changed our pricing, do I need to update the documents?"

→ Yes. Update the Terms of Service `TERMS_OF_SERVICE.md` and notify users 30 days in advance.

### "A customer asked for their data — what do I do?"

→ Your Privacy Policy Section 7.1 covers this. Send them an email with all data we have.

### "We want to expand to the EU — are we GDPR compliant?"

→ Request a DPA (Data Processing Agreement) from Termly.io or Iubenda.com. Link it from your Privacy Policy.

---

## 📝 Document Versions

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | March 26, 2026 | Initial creation | Legal Team |
| —— | ———— | —— | —— |

---

## 🎯 Next Steps

1. ✅ **Read** this file completely
2. ✅ **Customize** Co-Founder Partnership Agreement
3. ✅ **Sign** Co-Founder Partnership Agreement (both founders)
4. ✅ **Add** Privacy Policy to website (/privacy-policy)
5. ✅ **Add** Terms of Service to website (/terms-of-service)
6. ✅ **Add** Refund Policy to website (/refund-policy)
7. ✅ **Add** Footer HTML to website footer
8. ✅ **Test** all links work
9. ✅ **Launch** and accept your first customer!

---

## Contact

**Legal Questions:** legal@respawnmedia.co  
**Support Questions:** support@respawnmedia.co  
**Location:** New York, USA

---

**© 2026 RespawnSignal LLC. All rights reserved.**

---

## Disclaimer

These documents are provided as templates for educational and informational purposes. They are not a substitute for professional legal advice. Before launching your business, have an attorney review all documents customized to your specific situation.

**Recommended:** Schedule a 1-hour legal consultation ($300-500) with a startup attorney to review these documents before accepting paying customers.
