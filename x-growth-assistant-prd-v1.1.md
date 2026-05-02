# X Growth Assistant — Product Requirements Document

> **Version:** v1.1 &nbsp;|&nbsp; **Date:** May 2026 &nbsp;|&nbsp; **Status:** Updated &nbsp;|&nbsp; **Target:** Web App (MVP)

---

## 1. Executive Summary

X Growth Assistant is a web-based AI tool that helps software engineers build a personal brand on X (formerly Twitter) without spending hours daily on content creation. The product solves a specific, well-defined problem: talented engineers who want to transition to solopreneurship have the knowledge to share but lack the time and platform experience to grow an audience.

The tool provides four AI-powered modules — Tweet Generator, Reply Writer, Content Idea Planner, and Bio Builder — each pre-tuned to the user's niche (software engineering, AI, indie hacking). A user can open the app, generate a week of content, and write 10 high-visibility replies in under 20 minutes.

| Problem | Solution |
|---|---|
| Software engineers who want to become solopreneurs need an audience before launching a product. Building one on X requires consistent posting and active engagement — both time-intensive activities that compete with a day job. | An AI co-pilot that generates authentic, on-brand X content in seconds — tuned to the software engineer / solopreneur persona — so the user can maintain a consistent presence with minimal daily effort. |

---

## 2. Problem Statement

### 2.1 Background

The rise of AI tools has made it viable for solo developers to build and ship software products independently. However, a product without an audience is a product without customers. X has become the dominant platform for tech founders, engineers, and indie hackers to build in public and attract early adopters.

The challenge is that X growth is a game of consistency and visibility, not just quality. The algorithm rewards daily activity — posting, replying, and engaging. For a full-time software engineer, this is genuinely hard to sustain.

### 2.2 User Pain Points

- **Time scarcity:** Working engineers typically have 15–30 minutes per day available for X activity
- **Platform inexperience:** The unwritten rules of what works on X (reply strategies, hook structures, thread formatting) are not obvious to newcomers
- **Blank page problem:** Knowing what to tweet is harder than it sounds, especially consistently
- **Authenticity anxiety:** Generic AI-written content feels hollow; users want output that sounds like them
- **No feedback loop:** Without an existing audience, it is hard to know if the content strategy is working

### 2.3 Opportunity

There is a clear gap between generic AI writing tools (ChatGPT, Jasper) and specialised X growth platforms (Hypefury, Typefully). A tool that combines the flexibility of AI generation with deep persona-tuning for the software engineer / solopreneur niche has strong product-market fit potential.

---

## 3. Goals & Non-Goals

### 3.1 Goals

- Reduce daily time investment for X growth from 1–2 hours to under 20 minutes
- Help users generate high-quality, persona-consistent content without writing from scratch
- Teach X strategy passively through the tool's prompts and content types
- Deliver a working MVP that a solo developer can build and ship within 2–3 weeks
- Keep the product free or near-free to run, using per-request AI API calls with user-supplied keys

### 3.2 Non-Goals (MVP)

- Direct posting to X — no OAuth or X API integration in v1
- Analytics or follower tracking
- Scheduling or calendar automation
- Multi-user accounts or team features
- Mobile native app — web responsive only
- Support for platforms other than X

---

## 4. Target User

### 4.1 Primary Persona

| | |
|---|---|
| **Name** | Arif — The Engineer-Solopreneur |
| **Role** | Software engineer at a startup, 2–6 years experience |
| **Goal** | Build an audience of 1k–10k followers to validate and launch an indie product |
| **Frustration** | Has expertise to share but no time or system to share it consistently |
| **X experience** | Casual user (0–500 followers), rarely posts, no clear strategy |
| **Tech comfort** | High — comfortable with APIs, can follow a setup guide |
| **Budget** | Low — happy to pay for API usage (<$5/month), reluctant to pay for SaaS subscriptions |

---

## 5. Feature Requirements

### 5.1 Feature Overview

| Feature | Description | Priority | Module |
|---|---|---|---|
| API Key Manager | Securely store Google Gemini API key in localStorage | **Must Have** | Settings |
| Niche Profile | User sets their niche/persona, persisted for all prompts | **Must Have** | Settings |
| Tweet Generator | Generate 2 tweet variants from a topic + tone + format input | **Must Have** | Content |
| Reply Writer | Generate 3 reply options from a pasted tweet + goal input | **Must Have** | Content |
| Content Idea Planner | Generate 7-day content calendar from context + focus input | **Must Have** | Planning |
| Bio Builder | Generate 3 X bio options from role/goal inputs | **Must Have** | Profile |
| Copy to Clipboard | One-click copy for each generated output card | **Must Have** | UX |
| Regenerate | Re-run the same prompt for a fresh set of outputs | **Must Have** | UX |
| Idea-to-Tweet flow | Click a content idea to auto-populate the Tweet Generator | Should Have | UX |
| Tone presets | Selectable tone options that shape prompt behaviour | Should Have | Content |
| History / log | Local history of last 20 generated outputs | Should Have | UX |
| Thread formatter | Format multi-tweet threads with numbered posts | Should Have | Content |
| Export to Markdown | Download a week's content as a .md file | Nice to Have | Export |
| Dark/light mode | Theme toggle persisted in localStorage | Nice to Have | UX |
| Usage counter | Track approximate API token usage and estimated cost | Nice to Have | Settings |

---

## 6. Module Specifications

### 6.1 Tweet Generator

The core module. Accepts a free-text topic and two dropdowns (tone, format), then calls the Gemini API to return two distinct tweet variations.

**Inputs**
- Topic (textarea, required): Free-form description of what to tweet about
- Tone (select, required): Authentic & direct | Slightly contrarian | Educational | Storytelling | Bold & provocative
- Format (select, required): Single tweet | Short thread (3–5 tweets) | Hook tweet only

**Outputs**
- Two variation cards, each showing: label, text, character count, Copy button
- Regenerate button re-calls API with the same inputs

**System Prompt Behaviour**
- Persona context injected: software engineer, solopreneur, AI, indie hacking
- No hashtags, minimal emojis, engineer voice
- Thread format uses numbered tweet style (1/, 2/, etc.)
- Single tweets must be under 280 characters

---

### 6.2 Reply Writer

Designed for daily engagement. The user pastes a tweet they want to reply to, selects a goal, and receives three distinct reply options. This module drives most early follower growth.

**Inputs**
- Source tweet (textarea, required): The tweet being replied to
- Goal (select, required): Add value | Agree + expand | Challenge the take | Ask a question | Introduce myself
- Angle (input, optional): Freeform context to personalise the reply

**Outputs**
- Three reply cards labelled: Value add | Personal take | Question
- Each card: text, character count, Copy button

**Strategy Note**

The prompt instructs the model to keep replies under 280 characters, avoid self-promotion in the reply text itself (the profile does that work), and signal expertise through the insight provided.

---

### 6.3 Content Idea Planner

Removes the blank-page problem by generating a full 7-day content schedule. Each idea is specific and actionable, not generic. Ideas are clickable and feed directly into the Tweet Generator.

**Inputs**
- Context (textarea, optional): What the user is working on or thinking about
- Content focus (select, required): Balanced mix | Technical/AI | Personal journey | Hot takes | Practical tips

**Outputs**
- 7 idea cards (Mon–Sun), each with: day label, idea text, content type tag
- Clicking any card populates the Tweet Generator topic field and switches to that tab

**Content Types**

Personal story, Hot take, Tutorial, Lesson learned, Behind the scenes, Question, Thread idea

---

### 6.4 Bio Builder

A one-time-use but high-value module. A strong X bio increases follow-through rate from profile visits. The tool generates three options with distinct styles for the user to choose from or remix.

**Inputs**
- Role & experience (input, required)
- What you're building (input, required)
- Things to be known for (input, optional)
- Personal detail (input, optional): Location, quirk, interest

**Outputs**
- Three bio options: Minimal & punchy | Story-driven | Bold & direct
- Each under 160 characters with char count shown

---

## 7. User Stories

**US-01** — As a new X user with no content strategy, I want to generate a tweet from a rough idea without writing it myself.

*Acceptance Criteria:*
- Given I type a topic and select tone/format, when I click Generate, I receive 2 tweet variants within 5 seconds
- Each variant has a Copy button that copies the text to clipboard
- Character count is visible for each tweet
- Regenerate button produces different output from the same inputs

---

**US-02** — As a software engineer with limited time, I want to write 5–10 smart replies in under 10 minutes.

*Acceptance Criteria:*
- I can paste any tweet into the Reply Writer and receive 3 reply options
- Each option reflects a clearly different angle or approach
- I can copy and paste directly to X without editing
- Optional angle input lets me personalise without retyping my background each time

---

**US-03** — As a user who doesn't know what to tweet, I want to get a full week of content ideas based on what I'm working on.

*Acceptance Criteria:*
- Providing context about my current projects generates 7 specific tweet ideas
- Each idea includes a content type label to show format variety
- Clicking an idea takes me directly to the Tweet Generator with the idea pre-filled
- Regenerating produces a meaningfully different set of ideas

---

**US-04** — As a user setting up my X profile for the first time, I want to generate a professional, authentic bio that reflects my transition.

*Acceptance Criteria:*
- I receive 3 bio options that each feel different in style and tone
- All options are under 160 characters
- Options reflect the specific role, goals, and personal details I entered
- I can copy any option with one click

---

## 8. Technical Requirements

### 8.1 Architecture

The MVP is a single-file web application (HTML + CSS + vanilla JavaScript). No backend is required. All AI calls are made client-side using the Google Gemini API with a user-supplied API key.

- **Frontend:** HTML5, CSS3, Vanilla JS (or React for component structure)
- **AI:** Google Gemini API — gemini-2.5-flash for quality, speed, and low cost
- **Storage:** localStorage for API key, niche profile, and output history
- No backend, no database, no authentication system in MVP

### 8.2 API Integration

- **Model:** `gemini-2.5-flash` (best quality-to-cost ratio, built-in reasoning)
- **Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
- **Required headers:** Content-Type only — API key passed as query param (`?key=YOUR_KEY`)
- **Max output tokens:** 1024 per request (set via `generationConfig.maxOutputTokens`)
- **Response format:** JSON with `{ variations: [] }` or `{ ideas: [] }` schema
- **Thinking mode:** Disabled for MVP (`thinkingConfig.thinkingBudget: 0`) to reduce latency and cost
- **Fallback:** Robust JSON extraction (direct parse → strip fences → regex match)

### 8.3 Performance Requirements

- API response rendered within 5 seconds on a standard broadband connection
- No loading state longer than 8 seconds before showing a timeout error
- Typing and dropdown interactions must feel instant (no lag)

### 8.4 Security

- API key stored only in localStorage, never transmitted to any server other than Google
- API key input is `type=password` to prevent over-the-shoulder exposure
- No user data collected, stored, or sent anywhere by the application

---

## 9. UX Requirements

### 9.1 Layout

- Sidebar navigation with 4 module tabs
- Main content area: input card on top, output area below
- Output cards are stacked vertically, each visually separated
- Responsive: usable on tablet; sidebar collapses to top nav on mobile

### 9.2 Visual Design Principles

- Dark-mode first: background `#0A0A0A`, surface `#111111`
- Brand colour: X blue (`#1D9BF0`) for accents and active states
- Typography: Syne (headings/UI) + JetBrains Mono (metadata, char counts)
- No decorative gradients or animations — clean, engineer-aesthetic
- Loading state: 3-dot pulsing animation inside the output area

### 9.3 Error States

- Missing API key: Alert prompt asking user to enter key in sidebar
- Empty required field: Inline alert before API call is made
- API error: Display raw error message in monospace font inside output card
- JSON parse failure: Show partial raw response for debugging

---

## 10. Roadmap

| Phase | Deliverable | Timeline | Status |
|---|---|---|---|
| **MVP** | Tweet Generator, Reply Writer, Content Ideas, Bio Builder, API key flow | Week 1–2 | Planned |
| **v1.1** | Output history (last 20), Idea-to-Tweet shortcut, Thread formatter | Week 3 | Planned |
| **v1.2** | Export content as Markdown, Usage/cost estimator, Keyboard shortcuts | Week 4 | Planned |
| **v2.0** | X OAuth — direct tweet & reply posting from the app | Month 2 | Planned |
| **v2.1** | Analytics dashboard: post engagement pulled via X API | Month 3 | Planned |
| **v3.0** | Multi-profile support, saved prompt presets, shared templates | Month 4+ | Planned |

---

## 11. Open Questions

- **Monetisation model:** Free with user API key (MVP) vs. hosted SaaS with monthly billing — which gate is lower friction for the target user?
- **Model selection:** Gemini 2.5 Flash is the recommended default. Should users be able to upgrade to Gemini 2.5 Pro for higher quality output?
- **Persona persistence:** Should niche/persona inputs be a one-time setup screen or always visible and editable per-session?
- **Content variety signals:** How do we prevent the model from producing repetitive patterns across a 7-day plan? (temperature tuning, prompt rotation)
- **X API integration timing:** When does direct posting become table-stakes vs. a nice-to-have? Copy-paste is viable early but creates friction.
- **Competitive positioning:** Tools like Typefully and Hypefury exist. The differentiation is niche persona-tuning. Is that a durable enough moat?

---

## 12. Success Metrics

### 12.1 Product Metrics (MVP)

- **Activation:** User generates at least one tweet within first session — target 70%
- **Retention:** User returns and generates content in week 2 — target 40%
- **Engagement depth:** User uses 3+ modules in a single session — target 30%
- **Copy rate:** Percentage of generated outputs that are copied — target 50%+

### 12.2 User Outcome Metrics (90 days)

- Average follower growth rate for active users vs. baseline
- Self-reported time saved per week on X content creation
- NPS score from early user interviews

### 12.3 Definition of MVP Success

The MVP is successful if 10 target users (software engineers building in public) use it for 2+ consecutive weeks and report that it meaningfully reduces the time they spend on X content creation without sacrificing authenticity.

---

## 13. Appendix

### A. Prompt Engineering Guidelines

All prompts share a base system context, passed as `systemInstruction.parts[0].text` in the Gemini API request body:

```
You are a personal branding expert for software engineers building in public on X.
The user is a software engineer transitioning to solopreneur, focused on AI and indie hacking.
Write content that feels authentic, smart, and human.
No hashtags. Minimal emojis. Engineer voice. Return only raw JSON.
```

---

### B. Tech Stack Recommendation

- **Framework:** Vanilla HTML/JS for MVP (no build step, easy to ship); migrate to React/Next.js for v2
- **Styling:** CSS custom properties for theming; no CSS framework needed at this scope
- **Hosting:** GitHub Pages or Netlify (free, static file, no backend required)
- **Future backend:** Edge functions (Cloudflare Workers or Vercel) if proxying API keys becomes necessary

Gemini API call pattern:

```js
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: 1024 }
    })
  }
);
const text = data.candidates[0].content.parts[0].text;
```

---

### C. Competitive Landscape

| Tool | Strength | Weakness | Our Differentiation |
|---|---|---|---|
| ChatGPT / Claude.ai | Powerful general AI | No X-specific context or persona | Purpose-built for X growth |
| Typefully | Scheduling + polish | No AI generation, expensive | AI-first, persona-tuned, cheaper |
| Hypefury | Templates + automation | Generic templates, not engineer-focused | Niche persona: SE → solopreneur |
| Taplio (LinkedIn) | AI + analytics | LinkedIn only | X focused, lower cost |

---

*Confidential — X Growth Assistant PRD v1.1 — May 2026*
