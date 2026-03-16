# DataForge — Product & Technical Documentation

> Last updated: March 16, 2026

---

## Table of Contents

**Phase 1 — Product Brief**
1. [Product Overview](#1-product-overview)
2. [Key Users](#2-key-users)
3. [Core Workflow](#3-core-workflow)
4. [Data Model](#4-data-model)
5. [Deduplication System](#5-deduplication-system)
6. [Data Quality Score](#6-data-quality-score)

**Phase 2 — System Architecture & Data Pipeline**

7. [System Architecture (5 Components)](#7-system-architecture-5-components)

**Phase 3 — Automated Scraping Jobs & Lead Generation Pipeline**

8. [Automated Scraping Jobs](#8-automated-scraping-jobs-phase-3)

**General**

9. [Tech Stack](#9-tech-stack)
10. [Phase Completion Criteria](#10-phase-completion-criteria)

---

## `Phase 1` — Product Brief

## 1. Product Overview

**DataForge** is a lead extraction platform designed to collect publicly available business contact information from the internet and convert it into structured lead lists that can be imported into **GoHighLevel (GHL)**.

The system automates business discovery, extracts contact information from websites, processes and cleans the data, and generates exportable lead lists for CRM import.

The primary goal of DataForge is to support outbound sales operations by producing **call-ready prospect lists**.

### Primary Objective

The platform automates the creation of business leads used for:

- Outbound calling
- Sales prospecting
- Email outreach
- CRM pipeline building

The system eliminates manual research and creates a scalable lead generation workflow.

---

## 2. Key Users

### Sales Manager

Oversees lead management and ensures extracted data is properly prepared and transferred into GoHighLevel for outreach campaigns.

**Responsibilities:**
- Review extracted leads for accuracy and completeness
- Export lead lists from DataForge
- Import leads into GoHighLevel (GHL) CRM
- Manage and organize lead sources
- Ensure leads are properly formatted before CRM upload
- Coordinate with call agents regarding campaign targets

### Data Miner Specialist

Manages the data extraction process and ensures high-quality lead generation.

**Responsibilities:**
- Run scraping jobs based on industry and location targets
- Monitor scraping processes and job status
- Check and remove duplicate leads
- Review extracted data for accuracy
- Validate phone numbers and emails
- Flag broken or invalid websites
- Maintain scraping sources and discovery targets

### Outbound Appointment Setter

Operates inside GoHighLevel after leads have been imported from DataForge.

**Responsibilities:**
- Contact leads through outbound calling
- Update lead status in the CRM
- Add notes and follow-up reminders
- Identify qualified prospects

---

## 3. Core Workflow

The DataForge system follows a structured lead extraction pipeline:

```
[Discovery Engine] → [Scraping Engine] → [Data Processing] → [Lead Database] → [Export Module]
```

### Step 1 — Business Discovery
- Search parameters: Industry + Location
- Example: "Roofing companies in Texas"
- Sources: Google Maps, Yelp, public directories, chamber of commerce, industry-specific listing sites
- Output: Business Name, Address, Website, Phone, Source Platform

### Step 2 — Website Crawling
- Visits each discovered business website
- Scans: homepage, contact page, about page, footer
- Follows internal links: `/contact`, `/about`, `/team`, `/staff`
- Extracts: phone numbers, email addresses, contact person names, social links (optional)
- Uses rendered HTML (post-JS execution) via headless browser
- Handles: pagination, "Show More" / "Load More" buttons, infinite scroll

### Step 3 — Data Processing
- Deduplication check
- Phone number normalization
- Email validation
- URL cleanup and standardization
- Data completeness check (Business Name + Phone are minimum required)

### Step 4 — Lead Database Storage
- Clean leads stored with full metadata
- Duplicate records flagged, not inserted
- Existing records updated when re-encountered (new industry tag, score update)

### Step 5 — Lead Export for GHL
- Filter-based export (industry, city/state, date, count)
- Pre-export validation (phone exists, no duplicates, valid email)
- Output: CSV compatible with GoHighLevel contact import

---

## 4. Data Model

### Lead Record Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| LeadID | UUID | Yes | Auto-generated |
| BusinessName | String | Yes | Store raw + normalized version |
| Phone | String | Yes | Normalized to `5551234567` format |
| Email | String | No | Lowercased, validated |
| Website | String | No | Normalized to root domain for dedup |
| ContactPerson | String | No | Not a dedup signal |
| City | String | No | |
| State | String | No | |
| Country | String | No | |
| Category | String | No | Industry/business category |
| Source | String | Yes | Platform where discovered |
| DateCollected | DateTime | Yes | Auto-generated |

### Metadata Fields

| Field | Type | Notes |
|---|---|---|
| RecordStatus | Enum | `active`, `flagged`, `invalid` |
| DuplicateFlag | Boolean | True if detected as duplicate |
| DataQualityScore | Integer | 0–100, increases over time |
| IndustriesFoundIn | Array | List of all industries where lead was encountered |
| LastUpdated | DateTime | Updated on any record change |

### Database Indexing Strategy

Indexes should be created on:
- `Phone` — primary dedup signal
- `Website` (root domain) — dedup signal
- `BusinessName` — fuzzy matching
- `City` + `State` — location filtering

**Recommended Database:** PostgreSQL

---

## 5. Deduplication System

### Philosophy

The lead database is **global and cross-industry**. A lead belongs to the system, not to a campaign or industry. The industry tag on the original record is metadata only.

> If a lead already exists in the database under any industry, it will NOT be re-inserted — regardless of which industry the new scrape job was targeting.

### Dedup Signals

| Signal | Strength | Logic |
|---|---|---|
| Phone number (normalized) | **Strong** | Any match = duplicate |
| Email address | **Strong** | Any match = duplicate |
| Website (root domain) | **Strong** | Any match = duplicate |
| Business Name + Location | Weak | Used in combination only |

**One strong signal match = blocked as duplicate.**

### Dedup Outcome Actions

| Result | Action |
|---|---|
| `new` | Insert as new lead record |
| `duplicate` | Skip insert, update `IndustriesFoundIn` array, recalculate `DataQualityScore` |
| `possible match` | Send to manual review queue for Data Miner Specialist |

### Pre-Crawl Dedup

Before re-crawling a website, the system checks if a fresh, valid record already exists for that domain. If yes, skip the crawl entirely — no wasted resources.

### Normalization Before Comparison

- **Phone:** Strip all non-digits → `(555) 123-4567` becomes `5551234567`
- **Website:** Strip protocol, `www.`, and trailing slash → `https://www.johndoe.com/` becomes `johndoe.com`
- **Email:** Lowercase before comparison
- **Business Name:** Lowercase, strip legal suffixes (LLC, Inc, Co, Ltd) for fuzzy matching

---

## 6. Data Quality Score

### Scoring Model

The `DataQualityScore` is a 0–100 integer that reflects both **field completeness** and **cross-industry validation**. The score only ever increases — it never resets.

### Field Completeness Points

| Field | Points |
|---|---|
| Business Name | 10 |
| Phone | 20 |
| Email | 20 |
| Website | 15 |
| Contact Person | 15 |
| City / State | 10 |
| Category | 10 |

**Max from completeness: 100**

### Cross-Industry Bonus

Each time a lead is encountered in a **new industry**, a bonus is added to the score:

| Event | Bonus |
|---|---|
| Found in 2nd industry | +10 |
| Found in 3rd industry | +10 |
| Found in 4th+ industry | +5 each |

### Score Interpretation

| Score Range | Meaning |
|---|---|
| 0–30 | Low quality — incomplete data |
| 31–60 | Medium quality — usable but missing fields |
| 61–80 | High quality — complete record |
| 81–100 | Premium lead — complete + multi-industry validated |

### Score Update Trigger

Every time an automated scraping job encounters an existing lead:
1. Check if any new fields can be filled in
2. Check if a new industry was discovered
3. Recalculate and update `DataQualityScore`
4. Update `IndustriesFoundIn` array
5. Update `LastUpdated` timestamp

---

## `Phase 2` — System Architecture & Data Pipeline

## 7. System Architecture (5 Components)

### Component 1 — Data Discovery Engine

**Purpose:** Identify businesses from publicly available online sources based on search criteria.

**Input Parameters:**
- Industry or business category
- City or geographic location
- Country (optional)
- Maximum number of results

**Data Sources:**
- Google Maps
- Yelp
- Public business directories
- Chamber of commerce directories
- Industry-specific listing websites

**Output:** Initial list of businesses (Name, Address, Website, Phone, Source) — passed to the Scraping Engine via job queue.

---

### Component 2 — Web Scraping Engine

**Purpose:** Visit each business website and extract contact information. Enriches the dataset beyond what directories provide.

**Scraping Approach:**
- Uses **rendered HTML** (post-JavaScript execution) via headless browser
- Intelligently handles dynamic content:
  - **Pagination** — detects and clicks through numbered/next-page buttons
  - **"Show More" / "Load More"** — detects and clicks, waits for content, repeats until exhausted
  - **Infinite scroll** — scrolls to bottom, waits for new content, repeats until no new content loads

**Pages Scanned:**
- Homepage
- Contact page (`/contact`)
- About page (`/about`)
- Team/Staff page (`/team`, `/staff`)
- Website footer

**Data Extraction Targets:**
- Phone numbers
- Email addresses
- Contact person names
- Social media links (optional)

**Scraping Logic Sequence:**
1. Receive website URL from Discovery Engine (via job queue)
2. Load and render full page via headless browser
3. Parse rendered HTML
4. Extract contact data using pattern recognition
5. Follow internal links to contact-related pages
6. Store extracted results

---

### Component 3 — Data Processing Layer

**Purpose:** Clean and standardize raw data before storage.

**Processing Functions:**

| Function | Logic |
|---|---|
| Duplicate Detection | Check phone, email, website domain against existing DB records |
| Phone Normalization | Strip non-digits → `5551234567` |
| Email Validation | Pattern matching, discard or flag invalid formats |
| URL Cleanup | Normalize all variants to consistent root domain format |
| Completeness Check | Flag records missing Business Name or Phone — do not export |

---

### Component 4 — Lead Database

**Purpose:** Store all processed lead records in a structured, queryable format.

- **Database:** PostgreSQL
- Supports search, filter, and export operations
- Indexed for fast dedup checks and location filtering
- See [Data Model](#4-data-model) for full schema

---

### Component 5 — Export Module

**Purpose:** Generate GHL-compatible lead files for CRM import.

**Export Formats:**
- CSV (primary — GHL compatible)
- Excel (optional)

**Filter Controls:**
- Industry
- City or State
- Date collected
- Number of leads

**Pre-Export Validation:**
- Phone number exists
- No duplicate records
- Email format is valid

**GHL Export Fields:**
Business Name, Phone, Email, Website, Contact Person, City, State, Country, Category

---

## `Phase 3` — Automated Scraping Jobs & Lead Generation Pipeline

## 8. Automated Scraping Jobs (Phase 3)

### Job Configuration

Each scraping job is configured with:

| Parameter | Example |
|---|---|
| Industry | Roofing |
| Location | Texas |
| Maximum leads | 1000 |
| Data source | Google Maps |
| Frequency | Daily |

### Scheduling Options

- One-time job
- Daily
- Weekly
- Custom interval

### Job Execution Flow (Automated)

1. Query business sources based on job parameters
2. Discover business listings
3. Crawl associated websites
4. Extract contact information
5. Process and clean data
6. Store results in lead database (dedup applied at every step)

### Job Status Tracking

| Status | Meaning |
|---|---|
| Pending | Queued, not yet started |
| Running | Currently executing |
| Completed | Finished successfully |
| Failed | Encountered critical error |
| Paused | Manually paused by user |

### Job Monitoring Metrics

Each job displays:
- Job ID
- Status
- Start time / Completion time
- Leads discovered
- Leads successfully processed
- Duplicates removed
- Failed records

### System-Wide Lead Generation Metrics

- Total leads generated per job
- Duplicate rate
- Extraction success rate
- Average processing time per job

### Proxy Management

For large-scale operations:
- Rotating IP addresses
- Request throttling
- Automatic retry mechanisms

### Error Logging

Logs capture:
- Scraping failures
- Connection errors
- Blocked requests
- Invalid website responses

---

## 9. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js + TypeScript | Dashboard UI |
| UI Components | ShadCN + Tailwind CSS | Pre-built accessible components, utility-first styling |
| Backend API | Node.js + TypeScript | Next.js API routes |
| Headless Browser / Scraping | Playwright (Node) | Renders JS, handles dynamic content |
| HTML Parsing | Cheerio | Fast DOM parsing on rendered content |
| Job Queue & Scheduling | BullMQ + Redis | Async jobs, scheduling, retries, status tracking |
| Database | PostgreSQL + Prisma | Structured storage, ORM |
| Real-time UI Updates | WebSockets or SSE | Live job status without page refresh |
| Export | Node.js CSV generation | GHL-compatible output |
| Proxy Layer | Third-party proxy service | Bright Data / Oxylabs / Smartproxy |

---

## 10. Phase Completion Criteria

### Phase 1 — Product Brief ✅
- Product concept defined
- User roles defined
- Core workflow documented
- GHL-compatible data fields specified

### Phase 2 — System Architecture ✅
- Data Discovery Engine implemented
- Web Scraping Engine implemented
- Data Processing Layer implemented
- Lead Database structured and indexed
- CSV Export Module working and GHL-compatible

### Phase 3 — Automation ✅
- Scraping jobs run automatically on schedule
- Job monitoring dashboard live (real-time status)
- Duplicate prevention active across all automated runs
- Proxy rotation and error handling in place
- Lead generation metrics recorded per job

---

*This document is a living reference. Update it as decisions are made during development.*
