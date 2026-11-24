# Small claims and barangay demand kit

A single-page tool for Philippine micro and small businesses chasing unpaid invoices. It answers the question that decides everything else — **do you have to go to the barangay first?** — and then writes the papers you file yourself.

Open `index.html`. Nothing is installed, nothing is uploaded, nothing is stored.

## What it does

1. **Decides the procedural gate.** Under the Katarungang Pambarangay Law, conciliation before the lupon is a *pre-condition* to filing in court when the parties actually reside in the same city or municipality. A complaint that needed that referral and does not show compliance is dismissed. The tool applies the statutory exceptions one by one and tells you which path your facts fall on **before** it generates anything.
2. **Decides the court track.** A pure money claim within the small claims ceiling goes under the small claims rule, where lawyers may not appear and the decision comes within a day. Past the ceiling it is summary procedure, and past that the regular rules. Interest and costs are excluded from the measurement, so the tool keeps them separate.
3. **Writes three documents** — a demand letter, a barangay complaint (or, where conciliation does not apply, the statement of non-coverage your pleading must carry instead), and the entries for the Statement of Claim with its attachments checklist.

## Who it is for

Owners of micro and small businesses, their collection staff, and paralegals, handling routine unpaid-invoice recovery in the Philippines without engaging counsel. The small claims procedure is designed to be used without a lawyer; this tool is for the part before that, which is not.

## The rules it encodes

- **Katarungang Pambarangay Law** — Republic Act No. 7160 (Local Government Code of 1991), Sections 399 to 422, Chapter VII, Title I, Book III. Sections 408 (authority and exceptions), 409 (venue), 410 (procedure and the 60-day interruption of prescription), 412 (conciliation as a pre-condition, and direct recourse), 415 (parties appear in person without counsel), 416 to 418 (effect, execution and repudiation of a settlement).
- **Supreme Court Administrative Circular No. 14-93**, 15 July 1993 — the court's own twelve-item list of disputes excepted from prior barangay conciliation. The tool's exception table follows that numbering, because that list is what a first-level judge checks a complaint against.
- **Rules on Expedited Procedures in the First Level Courts** — A.M. No. 08-8-7-SC, effective 11 April 2022. Rule I (coverage and the ceilings), Rule II s.2(a), Rule III s.2 (the statement of compliance, and dismissal without it), Rule IV (the small claims procedure: the ceiling, commencement and attachments, affidavits, fees, grounds for outright dismissal, summons, response, appearance, the bar on attorneys, the 24-hour decision).
- **Republic Act No. 11576** (2021) — first-level court civil jurisdiction.
- **Civil Code of the Philippines** — Articles 1144 and 1145 (prescriptive periods) and 1169 (delay runs from demand).

Every figure sits in one named constant in `assets/rules.js`, with the issuance it comes from and its effective date. The small claims ceiling is `SMALL_CLAIMS_CEILING_PHP`; its descriptor records the issuance number, the effective date, the Supreme Court as the authority, and the date we last checked it.

## Honesty about the ceiling

The small claims ceiling in this tool is **₱1,000,000.00**, exclusive of interest and costs, from Rule IV, Section 1 of A.M. No. 08-8-7-SC, effective 11 April 2022, on the authority of the Supreme Court of the Philippines.

**Treat it as indicative.** That figure has been raised four times — it began at ₱100,000 and passed through ₱200,000, ₱300,000 and ₱400,000 — and a single en banc resolution can move it again without any change in statute. We checked it on 24 November 2026 against the Supreme Court's published text of A.M. No. 08-8-7-SC and found no later amendment; secondary commentary on the point is inconsistent and some of it is stale. Absence of a find is not proof of absence. Confirm the current ceiling with the Office of the Clerk of Court before you file. If it has moved, update the one constant and the whole tool follows.

## Scope and accuracy

This is **not legal advice**, and it cannot be. It reads published rules against facts you type in, and it can be wrong — about your facts, about your barangay's practice, or because the rules changed after this page was written. **Procedure and ceilings change.** Nothing here creates a lawyer-client relationship. For anything substantial, or any claim near a prescriptive deadline, consult a lawyer, the Public Attorney's Office, or the Office of the Clerk of Court.

**The tool never sends or files anything,** and has no way to: there is no network call anywhere in this repository. It writes text in your browser. You print it, sign it, deliver it and file it.

Not modelled: criminal cases of any kind, including estafa and bouncing cheques under Batas Pambansa Blg. 22; ejectment and unlawful detainer; enforcement of a court judgment; the special venue rules for lenders and banks beyond a warning; and the rules for indigenous cultural communities beyond flagging that they apply. The tool takes your answers at face value — it cannot verify where anyone actually resides, and the legal test is actual residence, not a billing address. The forms it helps you fill are the official ones, free from the Office of the Clerk of Court of any first-level court; this page is not a court form and must not be filed in place of one.

## How to run

```sh
python3 -m http.server 8137
```

Then open `http://localhost:8137/`.

## Tests

The rules live in `assets/rules.js`, a pure module with no DOM, no storage, no network and no clock. Its table-driven suite covers the ceiling at, above and below the figure; the exclusion of interest from that measurement; same city or municipality versus different, including the adjoining-barangay route; every exception in Administrative Circular No. 14-93, with the criminal-only items proved never to fire on a money claim; all nine combinations of party types; the prescriptive periods and their leap-day arithmetic; and the generated documents.

```sh
node tests/rules.test.js
```

Or open `http://localhost:8137/tests/` in a browser for the same suite.

MIT licensed.
