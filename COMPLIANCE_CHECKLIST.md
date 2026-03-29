# RespawnSignal Legal & Compliance Checklist

**Last Updated:** March 26, 2026  
**Status:** Implementation Guide for Launching RespawnSignal

---

## 📋 Overview

This checklist tracks your progress on legal, security, and compliance items needed to launch RespawnSignal as a production SaaS with paying customers.

**Priority Levels:**
- 🔴 **REQUIRED** — Must be done before accepting paying customers
- 🟡 **TODO** — Should be done soon after launch
- 🟢 **NICE TO HAVE** — Recommended for long-term growth

---

## ✅ SECTION 1: Legal Documents

### 1.1 Privacy Policy
- [x] Template created: `PRIVACY_POLICY.md`
- [ ] Customize email addresses (currently: legal@respawnmedia.co)
- [ ] Review data collection section for accuracy
- [ ] Review third-party services list (Stripe, Supabase, etc.)
- [ ] Host on website (e.g., /privacy-policy)
- [ ] Link in footer and at signup
- **Status:** 🔴 REQUIRED
- **Target Date:** Before launch
- **Notes:** Use Termly.io if you want auto-updates; our template is comprehensive

### 1.2 Terms of Service
- [x] Template created: `TERMS_OF_SERVICE.md`
- [ ] Review Acceptable Use Policy section
- [ ] Add checkbox at signup: "I agree to Terms of Service"
- [ ] Host on website (e.g., /terms-of-service)
- [ ] Link in footer
- [ ] Get legal review (~$300-500)
- **Status:** 🔴 REQUIRED
- **Target Date:** Before launch
- **Notes:** Covers AI accuracy disclaimers, platform compliance, liability limitations

### 1.3 Refund & Billing Policy
- [x] Template created: `REFUND_POLICY.md`
- [ ] Confirm 7-day refund window (or adjust)
- [ ] Confirm Stripe webhook integration is working
- [ ] Test failed payment retry logic (3 retries)
- [ ] Host on website (e.g., /refund-policy)
- [ ] Link in footer and Terms of Service
- [ ] Brief summary on pricing page
- **Status:** 🔴 REQUIRED
- **Target Date:** Before launch
- **Notes:** Stripe requires this for PCI compliance

### 1.4 Data Processing Agreement (DPA)
- [ ] Determine if you have EU-based customers
- [ ] If EU customers exist: Request DPA template from Iubenda or Termly
- [ ] Update Privacy Policy to reference DPA
- [ ] Make DPA available on request
- **Status:** 🟡 TODO (only if targeting EU)
- **Target Date:** Before marketing to EU
- **Notes:** Only required if you process data from EU users (GDPR)

### 1.5 Co-Founder Partnership Agreement
- [x] Template created: `COFOUNDER_PARTNERSHIP_AGREEMENT.md`
- [ ] **MUST** customize with:
  - Co-founder names
  - Equity split percentages
  - Roles and responsibilities
  - Time commitments
  - Vesting schedule (default: 4 years, 1-year cliff)
- [ ] Have attorney review (~$300-500)
- [ ] Both co-founders sign (print and original signatures, or digital)
- [ ] Store securely (encrypted backup)
- [ ] File with LLC if required by NY state
- **Status:** 🔴 REQUIRED
- **Target Date:** ASAP (before any money changes hands)
- **Notes:** Protects both founders; equity disputes are costly

---

## ✅ SECTION 2: Platform & API Compliance

### 2.1 TikTok Compliance
- [ ] Review TikTok Developer Terms of Service
- [ ] Verify your data access method (API vs. scraping)
  - Currently using: RapidAPI's tiktok-scraper7
  - Research: Does RapidAPI have TikTok permission?
- [ ] Add rate limiting to scanner (prevent abuse detection)
- [ ] Include in ToS: Users must comply with TikTok ToS
- **Status:** 🔴 REQUIRED
- **Target Date:** Before launch
- **Risk Level:** HIGH (TikTok has sued scrapers)
- **Action Items:**
  1. Verify RapidAPI's tiktok-scraper7 complies with TikTok ToS
  2. Document data access method in Privacy Policy
  3. Add rate limiting: max X requests/minute

### 2.2 YouTube Compliance
- [ ] Review YouTube API Terms of Service
- [ ] Verify Transcript24 API has YouTube permission
- [ ] Add rate limiting for video transcript requests
- [ ] Include in ToS: Users must comply with YouTube ToS
- **Status:** 🔴 REQUIRED
- **Target Date:** Before launch
- **Risk Level:** MEDIUM
- **Action Items:**
  1. Confirm Transcript24 is authorized by YouTube
  2. Document in Privacy Policy
  3. Add rate limiting to transcript requests

### 2.3 Instagram Compliance
- [ ] Review Meta/Instagram Platform Policy
- [ ] Determine if you're directly accessing Instagram or only storing public data
- [ ] Add clear warnings in UI about Instagram ToS
- **Status:** 🔴 REQUIRED
- **Target Date:** Before launch
- **Risk Level:** HIGH (Meta aggressively enforces ToS)
- **Notes:** If directly scraping, highly risky; consider removing or using official API only

### 2.4 AI Accuracy & Transparency
- [ ] Add in-app disclaimer: "Brand deal detection may not be 100% accurate"
- [ ] Display it on results page (prominent, not hidden)
- [ ] Update Privacy Policy: Explain AI training data usage
- [ ] Add opt-out option: "Don't use my scans to improve AI"
- **Status:** 🔴 REQUIRED
- **Target Date:** Before launch
- **Notes:** Protects you from liability for inaccurate results

---

## ✅ SECTION 3: Security Essentials

### 3.1 Authentication & Encryption
- [ ] Verify HTTPS/SSL on all pages
  - Test: https://respawnmedia.co (should be green lock)
- [ ] Verify password hashing (bcrypt or argon2)
  - Check source code: `/src/routes/auth.js`
- [ ] Verify session tokens expire after 24 hours inactivity
- [ ] Test Google OAuth redirect URIs (whitelist only production URLs)
- [ ] Add Multi-Factor Authentication (MFA) option
  - **Status:** 🟡 TODO (recommended for Agency tier)
- **Status:** 🟢 Mostly done (MFA is nice-to-have)
- **Target Date:** Now + 2 weeks for MFA

### 3.2 Data & Payment Security
- [ ] Verify API keys are NOT in frontend code
  - Check: `/src/` for any exposed keys
- [ ] Verify Stripe webhook signature verification
  - Check: `/src/routes/billing.js`
- [ ] Test input validation (prevent SQL injection, XSS)
  - Security checklist: https://owasp.org/Top10/
- [ ] Implement encryption at rest for user data
  - **Status:** 🟡 TODO (nice-to-have now, required for enterprise)
- [ ] Create Data Breach Response Plan (see below)
- **Status:** 🟡 TODO (mid-priority)
- **Target Date:** Within 30 days of launch

### 3.3 Infrastructure
- [ ] Set up automated database backups (Supabase does this)
  - Verify: Check Supabase dashboard for backup schedule
- [ ] Add dependency vulnerability scanning
  - **Easy:** GitHub Dependabot (free, auto-enabled)
  - **Advanced:** Snyk.io (free tier available)
- [ ] Verify prod/staging/dev environments are separate
  - Prod: respawnmedia.co (production DB)
  - Staging: staging.respawnmedia.co (staging DB)
  - Dev: localhost:3000 (local DB)
- **Status:** 🟡 TODO
- **Target Date:** Within 30 days of launch

---

## ✅ SECTION 4: Business & Financial

### 4.1 Business Formation
- [ ] LLC formation status
  - [ ] State: New York ✓
  - [ ] Name: RespawnSignal LLC ✓
  - [ ] EIN obtained? (apply at IRS.gov)
  - [ ] Operating Agreement signed?
- [ ] Separate business bank account
  - [ ] Bank: \_\_\_\_\_\_\_\_\_\_\_
  - [ ] Account established: \_\_\_\_\_\_\_\_\_\_\_
  - [ ] Never mix personal $ with business $
- [ ] Co-Founder Partnership Agreement
  - [ ] Both founders signed
  - [ ] Stored securely
  - [ ] Reviewed by attorney
- **Status:** 🔴 REQUIRED
- **Target Date:** Before accepting first customer payment

### 4.2 Payments & Tax
- [ ] Stripe account configured
  - [ ] Test: Can you create a subscription?
  - [ ] Test: Does webhook receive events?
  - [ ] Verify: Pro ($29) and Max ($79) are set up
- [ ] Invoice generation working
  - [ ] Test: Does customer get invoice after payment?
- [ ] Sales tax research (if applicable)
  - Note: NY SaaS may not have sales tax, but check for other states
  - Consider: TaxJar.com for multi-state compliance
- **Status:** 🟡 TODO
- **Target Date:** Before launch (Stripe) + within 30 days (tax research)

### 4.3 Website Footer
- [x] Footer HTML template created: `FOOTER_HTML.html`
- [ ] Customize and add to your website
- [ ] Add links to:
  - [ ] Privacy Policy: /privacy-policy
  - [ ] Terms of Service: /terms-of-service
  - [ ] Refund Policy: /refund-policy
  - [ ] Legal Email: legal@respawnmedia.co
  - [ ] Support Email: support@respawnmedia.co
- [ ] Add copyright notice: "© 2026 RespawnSignal LLC"
- [ ] Add business location: "Based in New York, USA"
- [ ] Test: All links work from footer
- **Status:** 🔴 REQUIRED
- **Target Date:** Before launch

---

## ✅ SECTION 5: Data Breach & Incident Response

### 5.1 Breach Response Plan
- [ ] Create a documented plan (see template below)
- [ ] Designate responsible person(s)
- [ ] Know notification timeline (GDPR: 72 hours)
- **Status:** 🟡 TODO (critical for compliance)
- **Target Date:** Within 2 weeks of launch

### 5.2 Incident Response Template

**Step 1: Discover (Immediate)**
- Who discovered the breach?
- When was it discovered?
- What data was compromised?

**Step 2: Assess (Within 24 hours)**
- Scope: How much data was affected?
- Users affected: How many?
- Severity: Is it a major breach?

**Step 3: Notify (Within 72 hours for GDPR)**
- [ ] Internal notification (leadership)
- [ ] Affected users (email + in-app)
- [ ] Relevant authorities (if required)
- [ ] Payment processor (Stripe, if payment data involved)

**Step 4: Remediate (Ongoing)**
- [ ] Patch the vulnerability
- [ ] Secure the compromised data
- [ ] Force password reset (if passwords compromised)
- [ ] Monitor for ongoing threats

**Step 5: Document & Learn**
- [ ] Post-incident review
- [ ] Update security procedures
- [ ] Communicate findings to team

---

## ✅ SECTION 6: Launch Checklist

### Pre-Launch (Must-Haves)
- [ ] Privacy Policy live on website
- [ ] Terms of Service live on website
- [ ] Refund Policy live on website
- [ ] Footer with legal links
- [ ] Stripe billing configured & tested
- [ ] HTTPS/SSL working
- [ ] Password hashing verified
- [ ] Co-founder agreement signed
- [ ] LLC formation complete
- [ ] Legal contact email set up: legal@respawnmedia.co
- [ ] Support email set up: support@respawnmedia.co

### Post-Launch (Next 30 Days)
- [ ] MFA option added
- [ ] Backup strategy implemented
- [ ] Dependency scanning enabled (GitHub Dependabot)
- [ ] Data breach response plan documented
- [ ] Security audit performed (or scheduled)
- [ ] Tax compliance research completed

---

## 📊 Summary Table

| Item | Required | Status | Target Date | Owner |
|------|----------|--------|-------------|-------|
| Privacy Policy | 🔴 YES | ✅ Done | Before launch | \_\_\_ |
| Terms of Service | 🔴 YES | ✅ Done | Before launch | \_\_\_ |
| Refund Policy | 🔴 YES | ✅ Done | Before launch | \_\_\_ |
| Co-Founder Agreement | 🔴 YES | ⏳ In Progress | ASAP | \_\_\_ |
| LLC Formation | 🔴 YES | ⏳ In Progress | Before 1st customer | \_\_\_ |
| EIN | 🔴 YES | ⏳ To Do | Within 30 days | \_\_\_ |
| Website Footer | 🔴 YES | ✅ Done | Before launch | \_\_\_ |
| HTTPS/SSL | 🔴 YES | ⏳ To Do | Before launch | \_\_\_ |
| Stripe Setup | 🔴 YES | ⏳ To Do | Before launch | \_\_\_ |
| TikTok Compliance | 🔴 YES | ⏳ To Do | Before launch | \_\_\_ |
| YouTube Compliance | 🔴 YES | ⏳ To Do | Before launch | \_\_\_ |
| Instagram Compliance | 🔴 YES | ⏳ To Do | Before launch | \_\_\_ |
| Password Hashing | 🔴 YES | ⏳ To Do | Before launch | \_\_\_ |
| MFA | 🟡 RECOMMENDED | ⏳ To Do | Within 30 days | \_\_\_ |
| Backups | 🟡 RECOMMENDED | ⏳ To Do | Within 30 days | \_\_\_ |
| Dependency Scanning | 🟡 RECOMMENDED | ⏳ To Do | Within 30 days | \_\_\_ |
| Breach Response Plan | 🟡 RECOMMENDED | ⏳ To Do | Within 30 days | \_\_\_ |
| Tax Compliance | 🟡 RECOMMENDED | ⏳ To Do | Within 60 days | \_\_\_ |

---

## 🎯 Next Steps (Priority Order)

### This Week
1. ✅ Review all documents created (you've got them!)
2. [ ] Sign Co-Founder Partnership Agreement (both founders)
3. [ ] Verify LLC formation in NY
4. [ ] Apply for EIN at IRS.gov (takes 5 minutes)

### Before Launch
5. [ ] Customize all legal docs with specific details
6. [ ] Add to website + footer links
7. [ ] Test Stripe integration
8. [ ] Verify TikTok/YouTube/Instagram compliance
9. [ ] Verify HTTPS/SSL and password hashing

### After Launch (First 30 Days)
10. [ ] Add MFA option
11. [ ] Set up backups
12. [ ] Enable GitHub Dependabot for security updates
13. [ ] Create written breach response plan
14. [ ] Research sales tax obligations

---

## 📞 Recommended Lawyers & Resources

| Service | Cost | Link |
|---------|------|------|
| **Legal Review** | $300-500 | Clerky.com or Stripe Atlas |
| **LLC Formation** | $100-300 | LegalZoom.com or Stripe Atlas |
| **Privacy Policy Template** | $150-200/yr | Termly.io or Iubenda.com |
| **DPA Template** | $50-150 | Iubenda.com |
| **Tax Compliance** | $500-2000/yr | Local CPA (recommend after launch) |
| **Business Insurance** | $1000-3000/yr | Stride Health or Hiscox |

---

## Notes

- [ ] Co-founder names: \_\_\_\_\_\_\_\_\_\_\_ and \_\_\_\_\_\_\_\_\_\_\_\_
- [ ] Equity split: \_\_\_\_\_%  /  \_\_\_\_\%
- [ ] Launch target date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- [ ] First paying customer target: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

**Created:** March 26, 2026  
**For:** RespawnSignal LLC  
**Status:** Ready for Implementation

**Questions? Email:** legal@respawnmedia.co
