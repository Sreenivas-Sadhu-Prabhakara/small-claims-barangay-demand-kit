/*
 * Philippine debt-recovery rules for micro and small businesses — pure module.
 * No DOM, no storage, no network, no clock: every answer is a function of the
 * facts passed in (plus an optional "today" string), so it can be tested.
 *
 * WHAT THIS MODULE DECIDES
 *   1. Whether barangay (Katarungang Pambarangay) conciliation is a PRECONDITION
 *      to filing, on these facts, and which statutory exception applies if not.
 *   2. Which court track the money claim falls into: small claims, summary
 *      procedure, or the regular rules.
 *   3. The text of the demand letter, the barangay complaint, the conciliation
 *      statement that must go into the pleading, and the Statement of Claim
 *      entries, plus the attachments checklist.
 *
 * SOURCES OF THE RULES
 *   - Katarungang Pambarangay Law: Republic Act No. 7160 (Local Government Code
 *     of 1991), Sections 399 to 422, Chapter VII, Title I, Book III. In force
 *     since 1 January 1992.
 *       s.408  authority of the lupon and the exceptions (a) to (g)
 *       s.409  venue
 *       s.410  procedure and the 60-day interruption of prescription
 *       s.412  conciliation as a pre-condition to filing, and direct recourse
 *       s.415  parties appear in person, without counsel
 *       s.416  settlement has the force of a final judgment after 10 days
 *       s.417  lupon may execute within 6 months; after that, court action
 *       s.418  repudiation within 10 days
 *   - Supreme Court Administrative Circular No. 14-93, 15 July 1993: the court's
 *     own 12-item list of disputes excepted from prior barangay conciliation.
 *     This module's exception table follows that numbering, because that is the
 *     list a first-level judge checks a complaint against.
 *   - Rules on Expedited Procedures in the First Level Courts, A.M. No. 08-8-7-SC,
 *     effective 11 April 2022.
 *       Rule I   A(1)(b) summary procedure ceiling; A(2) definition of a small claim
 *       Rule II  s.2(a) a motion to dismiss is allowed for failure to comply with
 *                barangay conciliation
 *       Rule III s.2 a case requiring prior referral must carry a statement of
 *                compliance; without it the complaint is DISMISSED without prejudice
 *       Rule IV  the small claims procedure: s.1 ceiling, s.4 commencement and
 *                attachments, s.6 joinder, s.7 affidavits, s.8 fees, s.9 outright
 *                dismissal, s.10 and s.12 summons, s.13 response, s.17 appearance,
 *                s.18 no attorneys, s.24 decision, s.26 certification of documents
 *   - Republic Act No. 11576 (2021): first-level courts have exclusive original
 *     jurisdiction in civil actions where the demand does not exceed PHP 2,000,000.
 *   - Civil Code of the Philippines: Art. 1169 (delay runs from demand),
 *     Art. 1144 (10 years on a written contract), Art. 1145 (6 years on an oral one).
 *
 * WHAT THIS MODULE IS NOT
 *   Not legal advice, and not a filing service. It writes text for the user to
 *   check, sign and file themselves. It never sends, serves or files anything,
 *   and it has no way to: there is no network call anywhere in this repository.
 */
(function (root) {
  "use strict";

  /* ================================================================== *
   * 1. NAMED CONSTANTS. Every figure and period in this tool is written
   *    exactly once, here, with the issuance it comes from. Nothing
   *    below re-states a number.
   * ================================================================== */

  /* The small claims monetary ceiling. THE one constant for this figure. */
  var SMALL_CLAIMS_CEILING_PHP = 1000000;

  var SMALL_CLAIMS_CEILING = {
    amountPHP: SMALL_CLAIMS_CEILING_PHP,
    currency: "PHP",
    measuredOn: "the claim or demand, exclusive of interest and costs",
    issuance: "A.M. No. 08-8-7-SC",
    issuanceTitle: "Rules on Expedited Procedures in the First Level Courts",
    provision: "Rule IV, Section 1 (see also Rule I A(2) and Rule IV, Sections 6 and 15)",
    effective: "2022-04-11",
    authority: "Supreme Court of the Philippines",
    /* Deliberately flagged. The ceiling has been raised repeatedly — it was
       PHP 100,000 in 2008, PHP 200,000, then PHP 300,000, then PHP 400,000,
       before the 2022 Rules set the present figure. Treat it as indicative
       and confirm it with the Office of the Clerk of Court before filing. */
    indicative: true,
    lastCheckedOn: "2026-11-24",
    sourceUrl: "https://sc.judiciary.gov.ph/wp-content/uploads/2022/11/08-8-7-SC-1.pdf"
  };

  /* Ceiling for the Rule on Summary Procedure in the first level courts, which
     is where a money claim lands once it passes the small claims ceiling.
     A.M. No. 08-8-7-SC, Rule I A(1)(b); it tracks R.A. 11576. */
  var SUMMARY_PROCEDURE_CEILING_PHP = 2000000;

  var SUMMARY_PROCEDURE_CEILING = {
    amountPHP: SUMMARY_PROCEDURE_CEILING_PHP,
    currency: "PHP",
    measuredOn: "the total amount of the claim, exclusive of interest, damages, attorney's fees, litigation expenses and costs",
    issuance: "A.M. No. 08-8-7-SC",
    provision: "Rule I A(1)(b)",
    effective: "2022-04-11",
    authority: "Supreme Court of the Philippines",
    alsoSeeIssuance: "Republic Act No. 11576 (2021)",
    indicative: true,
    lastCheckedOn: "2026-11-24"
  };

  /* Barangay periods, Local Government Code of 1991. */
  var KP_PERIODS = {
    luponMediationDays: 15,            /* s.410(b) */
    pangkatConveneDays: 3,             /* s.410(d) */
    pangkatSettleDays: 15,             /* s.410(e) */
    pangkatExtensionDays: 15,          /* s.410(e) */
    prescriptionInterruptMaxDays: 60,  /* s.410(c) */
    settlementFinalAfterDays: 10,      /* s.416 */
    repudiationWindowDays: 10,         /* s.418 */
    luponExecutionMonths: 6,           /* s.417 */
    transmittalDays: 5                 /* s.419 */
  };

  /* Small claims periods and fees, A.M. No. 08-8-7-SC, Rule IV. */
  var SMALL_CLAIMS_STEPS = {
    summonsIssuedWithinHours: 24,                /* s.10, s.12(a) */
    summonsServedWithinDays: 10,                 /* s.12(a) */
    responseDays: 10,                            /* s.13, non-extendible */
    hearingWithinDays: 30,                       /* s.10 */
    hearingWithinDaysOutsideRegion: 60,          /* s.10 */
    decisionWithinHours: 24,                     /* s.22, s.24 */
    postponementsAllowed: 1                      /* s.20 */
  };

  var SMALL_CLAIMS_FEES = {
    summonsServiceFeePHP: 1000,        /* s.8, never waived, not even for an indigent */
    extraAfterFifthClaimPHP: 500,      /* s.8, per claim after the 5th in a calendar year */
    extraAfterTenthClaimPHP: 600,      /* s.8, total per claim after the 10th */
    extraAfterFifteenthClaimPHP: 700,  /* s.8, total per claim after the 15th */
    refilingWithinOneYearPHP: 2000,    /* s.8, inclusive of the summons service fee */
    freeClaimsPerYear: 5,
    misrepresentedServiceFinePHP: 5000, /* s.12(e) */
    docketFeeRule: "Rule 141 of the Revised Rules of Court, assessed by the Office of the Clerk of Court on the amount claimed"
  };

  /* Prescriptive periods for a collection suit, Civil Code of the Philippines. */
  var PRESCRIPTION_YEARS = {
    writtenContract: 10,  /* Art. 1144(1) */
    oralContract: 6       /* Art. 1145(1) */
  };

  /* Not statutory: the period this tool suggests in the demand letter. */
  var DEFAULT_DEMAND_DAYS = 15;

  /* The criminal thresholds in s.408(c) are carried here so the exception table
     can state them, even though a collection case never reaches them. */
  var KP_CRIMINAL_LIMITS = {
    imprisonmentYears: 1,     /* s.408(c) */
    finePHP: 5000             /* s.408(c) */
  };

  var AUTHORITIES = {
    lgc: {
      key: "lgc",
      title: "Katarungang Pambarangay Law",
      issuance: "Republic Act No. 7160, Sections 399 to 422 (Local Government Code of 1991)",
      effective: "1992-01-01",
      body: "Congress of the Philippines"
    },
    ac1493: {
      key: "ac1493",
      title: "Guidelines on the Katarungang Pambarangay conciliation procedure",
      issuance: "Supreme Court Administrative Circular No. 14-93",
      dated: "1993-07-15",
      body: "Supreme Court of the Philippines"
    },
    rep: {
      key: "rep",
      title: "Rules on Expedited Procedures in the First Level Courts",
      issuance: "A.M. No. 08-8-7-SC",
      effective: "2022-04-11",
      body: "Supreme Court of the Philippines",
      sourceUrl: SMALL_CLAIMS_CEILING.sourceUrl
    },
    ra11576: {
      key: "ra11576",
      title: "An Act expanding the jurisdiction of the first level courts",
      issuance: "Republic Act No. 11576",
      effective: "2021-08-21",
      body: "Congress of the Philippines"
    },
    civilCode: {
      key: "civilCode",
      title: "Civil Code of the Philippines",
      issuance: "Republic Act No. 386, Articles 1144, 1145 and 1169",
      effective: "1950-08-30",
      body: "Congress of the Philippines"
    }
  };

  /* ================================================================== *
   * 2. PARTY TYPES. The distinction that decides most collection cases:
   *    a sole proprietorship has NO personality separate from its owner,
   *    so the party is a natural person and conciliation still applies.
   *    A corporation, partnership or cooperative is a juridical entity,
   *    and only individuals may be parties before the lupon.
   * ================================================================== */

  var PARTY_TYPES = {
    individual: {
      id: "individual",
      label: "Individual",
      juridical: false,
      note: "A natural person. May be a party before the lupon."
    },
    sole_proprietorship: {
      id: "sole_proprietorship",
      label: "Sole proprietorship (DTI business name)",
      juridical: false,
      note: "A registered business name is not a separate person. The owner sues and is sued as an individual, so barangay conciliation still applies."
    },
    juridical: {
      id: "juridical",
      label: "Corporation, partnership or cooperative",
      juridical: true,
      note: "A juridical entity. Only individuals may be parties to barangay conciliation, so the requirement does not apply to it."
    }
  };

  function partyType(id) {
    return PARTY_TYPES[id] || PARTY_TYPES.individual;
  }

  /* ================================================================== *
   * 3. THE EXCEPTION TABLE. Administrative Circular No. 14-93 part I,
   *    item by item, each pointing back at the Local Government Code.
   *    `civil` marks the rows a civil money claim can ever trigger;
   *    the criminal-only rows are kept so the table is the whole list
   *    and so the tests can prove they never fire on a collection case.
   * ================================================================== */

  var KP_EXCEPTIONS = [
    {
      id: "GOVERNMENT_PARTY",
      item: "A.C. 14-93 I.1",
      cite: "LGC s.408(a); A.C. 14-93 I.1",
      civil: true,
      label: "One party is the government, or a subdivision or instrumentality of it",
      test: function (f) { return f.governmentParty === true; }
    },
    {
      id: "PUBLIC_OFFICER_FUNCTIONS",
      item: "A.C. 14-93 I.2",
      cite: "LGC s.408(b); A.C. 14-93 I.2",
      civil: true,
      label: "One party is a public officer or employee and the dispute relates to official functions",
      test: function (f) { return f.publicOfficerFunctions === true; }
    },
    {
      id: "REAL_PROPERTY_DIFFERENT_LGU",
      item: "A.C. 14-93 I.3",
      cite: "LGC s.408(e); A.C. 14-93 I.3",
      civil: true,
      label: "The dispute involves real property located in different cities or municipalities, and the parties have not agreed on one lupon",
      test: function (f) { return f.realPropertyDifferentLGU === true; }
    },
    {
      id: "JURIDICAL_ENTITY_PARTY",
      item: "A.C. 14-93 I.4",
      cite: "A.C. 14-93 I.4 (Section 1, Rule VI, Katarungang Pambarangay Rules)",
      civil: true,
      label: "A corporation, partnership or other juridical entity is a party — only individuals may be parties to barangay conciliation",
      test: function (f) {
        return partyType(f.claimantType).juridical || partyType(f.debtorType).juridical;
      }
    },
    {
      id: "DIFFERENT_CITY_OR_MUNICIPALITY",
      item: "A.C. 14-93 I.5",
      cite: "LGC s.408 (opening clause) and s.408(f); A.C. 14-93 I.5",
      civil: true,
      label: "The parties do not actually reside in the same city or municipality, so the dispute is outside the authority of any lupon",
      test: function (f) {
        return f.sameCityMunicipality !== true && f.adjoiningBarangaysAndAgreed !== true;
      }
    },
    {
      id: "OFFENSE_OVER_ONE_YEAR_OR_FINE",
      item: "A.C. 14-93 I.6",
      cite: "LGC s.408(c); A.C. 14-93 I.6",
      civil: false,
      label: "A criminal offence punishable by imprisonment over " + KP_CRIMINAL_LIMITS.imprisonmentYears +
             " year or a fine over PHP " + KP_CRIMINAL_LIMITS.finePHP.toLocaleString("en-US"),
      test: function () { return false; }
    },
    {
      id: "OFFENSE_NO_PRIVATE_OFFENDED_PARTY",
      item: "A.C. 14-93 I.7",
      cite: "LGC s.408(d); A.C. 14-93 I.7",
      civil: false,
      label: "A criminal offence with no private offended party",
      test: function () { return false; }
    },
    {
      id: "ACCUSED_IN_CUSTODY",
      item: "A.C. 14-93 I.8(a)",
      cite: "LGC s.412(b)(1); A.C. 14-93 I.8(a)",
      civil: false,
      label: "A criminal case where the accused is under police custody or detention",
      test: function () { return false; }
    },
    {
      id: "HABEAS_CORPUS",
      item: "A.C. 14-93 I.8(b)",
      cite: "LGC s.412(b)(2); A.C. 14-93 I.8(b)",
      civil: false,
      label: "A petition for habeas corpus",
      test: function () { return false; }
    },
    {
      id: "PROVISIONAL_REMEDY",
      item: "A.C. 14-93 I.8(c)",
      cite: "LGC s.412(b)(3); A.C. 14-93 I.8(c)",
      civil: true,
      label: "The action is coupled with a provisional remedy: preliminary injunction, attachment, delivery of personal property or support during the case",
      test: function (f) { return f.provisionalRemedy === true; }
    },
    {
      id: "PRESCRIPTION_IMMINENT",
      item: "A.C. 14-93 I.8(d)",
      cite: "LGC s.412(b)(4); A.C. 14-93 I.8(d)",
      civil: true,
      label: "The action would otherwise be barred by the statute of limitations",
      test: function (f) { return f.prescriptionImminent === true; }
    },
    {
      id: "PRESIDENTIALLY_EXCEPTED",
      item: "A.C. 14-93 I.9",
      cite: "LGC s.408(g); A.C. 14-93 I.9",
      civil: true,
      label: "A class of disputes the President has excepted in the interest of justice",
      test: function (f) { return f.presidentiallyExcepted === true; }
    },
    {
      id: "AGRARIAN_CARL",
      item: "A.C. 14-93 I.10",
      cite: "A.C. 14-93 I.10 (R.A. 6657, Sections 46 and 47)",
      civil: true,
      label: "The dispute arises from the Comprehensive Agrarian Reform Law",
      test: function (f) { return f.agrarianDispute === true; }
    },
    {
      id: "LABOR_DISPUTE",
      item: "A.C. 14-93 I.11",
      cite: "A.C. 14-93 I.11 (Article 226, Labor Code; Montoya v. Escayo)",
      civil: true,
      label: "A labour dispute arising from employer-employee relations",
      test: function (f) { return f.laborDispute === true; }
    },
    {
      id: "ANNUL_COMPROMISE_JUDGMENT",
      item: "A.C. 14-93 I.12",
      cite: "A.C. 14-93 I.12 (Sanchez v. Tupaz)",
      civil: true,
      label: "An action to annul a judgment upon a compromise",
      test: function (f) { return f.annulCompromiseJudgment === true; }
    }
  ];

  /* ================================================================== *
   * 4. CONCILIATION STATUSES AND FORUMS
   * ================================================================== */

  var CONCILIATION = {
    REQUIRED: {
      id: "REQUIRED",
      headline: "Barangay first",
      summary: "Barangay conciliation is a pre-condition. Do not file in court yet.",
      cite: "LGC s.412(a)"
    },
    REQUIRED_INDIGENOUS: {
      id: "REQUIRED_INDIGENOUS",
      headline: "Barangay first",
      summary: "Conciliation is a pre-condition, and the customs of your indigenous cultural community apply to it.",
      cite: "LGC s.412(c); A.C. 14-93 II.3"
    },
    SATISFIED: {
      id: "SATISFIED",
      headline: "Court next",
      summary: "The conciliation requirement is satisfied. Attach the certification and say so in the pleading.",
      cite: "LGC s.412(a); A.M. No. 08-8-7-SC, Rule III, s.2"
    },
    NOT_REQUIRED: {
      id: "NOT_REQUIRED",
      headline: "Court next",
      summary: "The dispute is outside the conciliation requirement. State the exception in the pleading.",
      cite: "LGC s.408; A.C. 14-93 I"
    },
    ALREADY_CONCILIATED: {
      id: "ALREADY_CONCILIATED",
      headline: "Court next",
      summary: "You are enforcing the output of conciliation, so prior referral is not a separate pre-condition.",
      cite: "LGC s.417; A.M. No. 08-8-7-SC, Rule I A(2)(b)"
    }
  };

  var FORUMS = {
    /* No amount entered yet. Naming a track on a blank form would be a guess,
       and the whole point of this tool is not to guess the procedure. */
    UNDETERMINED: {
      id: "UNDETERMINED",
      headline: "—",
      label: "Not yet determined — enter the amount claimed",
      court: "the court of the place of venue",
      cite: "A.M. No. 08-8-7-SC, Rule I",
      lawyersBarred: null
    },
    SMALL_CLAIMS: {
      id: "SMALL_CLAIMS",
      headline: "Small claims",
      label: "Small claims case",
      court: "the Metropolitan, Municipal Trial Court in Cities, Municipal or Municipal Circuit Trial Court of the place of venue",
      cite: "A.M. No. 08-8-7-SC, Rule IV",
      lawyersBarred: true
    },
    SUMMARY_PROCEDURE: {
      id: "SUMMARY_PROCEDURE",
      headline: "Summary procedure",
      label: "Civil action under the Rule on Summary Procedure",
      court: "the same first level court",
      cite: "A.M. No. 08-8-7-SC, Rule III",
      lawyersBarred: false
    },
    REGULAR: {
      id: "REGULAR",
      headline: "Regular rules",
      label: "Ordinary civil action under the regular rules of procedure",
      court: "the Regional Trial Court",
      cite: "Republic Act No. 11576; Rules of Court",
      lawyersBarred: false
    },
    LUPON_EXECUTION: {
      id: "LUPON_EXECUTION",
      headline: "Back to the lupon",
      label: "Execution by the lupon, not a court case",
      court: "the Lupong Tagapamayapa that approved the settlement",
      cite: "LGC s.417",
      lawyersBarred: false
    }
  };

  /* ================================================================== *
   * 5. SMALL HELPERS. Deterministic, no locale surprises, no clock.
   * ================================================================== */

  function num(v) {
    var n = typeof v === "number" ? v : parseFloat(String(v === null || v === undefined ? "" : v).replace(/,/g, ""));
    if (!isFinite(n)) { return 0; }
    return n;
  }

  function nonNegative(v) {
    var n = num(v);
    return n > 0 ? n : 0;
  }

  function round2(n) {
    return Math.round((num(n) + Number.EPSILON) * 100) / 100;
  }

  /* "PHP 1,234,567.00" — written here rather than taken from Intl so the
     generated documents and the tests read the same on every machine. */
  function pesos(v) {
    var n = round2(Math.abs(num(v)));
    var whole = Math.floor(n);
    var cents = Math.round((n - whole) * 100);
    if (cents === 100) { whole += 1; cents = 0; }
    var s = String(whole);
    var out = "";
    while (s.length > 3) {
      out = "," + s.slice(-3) + out;
      s = s.slice(0, -3);
    }
    out = s + out;
    return (num(v) < 0 ? "-PHP " : "PHP ") + out + "." + (cents < 10 ? "0" + cents : String(cents));
  }

  function text(v) {
    return String(v === null || v === undefined ? "" : v).trim();
  }

  function or(v, fallback) {
    var t = text(v);
    return t === "" ? fallback : t;
  }

  var MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];

  /* Accepts "YYYY-MM-DD" only. Returns null on anything else. */
  function parseISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(s));
    if (!m) { return null; }
    var y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) { return null; }
    if (d > daysInMonth(y, mo)) { return null; }
    return { y: y, m: mo, d: d };
  }

  function daysInMonth(y, m) {
    if (m === 2) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28; }
    return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  }

  function isoOf(p) {
    return p.y + "-" + (p.m < 10 ? "0" + p.m : p.m) + "-" + (p.d < 10 ? "0" + p.d : p.d);
  }

  function longDate(s) {
    var p = parseISO(s);
    if (!p) { return text(s); }
    return MONTHS[p.m - 1] + " " + p.d + ", " + p.y;
  }

  function addYears(s, years) {
    var p = parseISO(s);
    if (!p) { return null; }
    var y = p.y + years, m = p.m, d = p.d;
    if (d > daysInMonth(y, m)) { d = daysInMonth(y, m); }
    return isoOf({ y: y, m: m, d: d });
  }

  /* Days between two ISO dates, b - a. Civil days, no timezone involved. */
  function daysBetween(a, b) {
    var pa = parseISO(a), pb = parseISO(b);
    if (!pa || !pb) { return null; }
    return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
  }

  function sameLGU(a, b) {
    var x = text(a).toLowerCase().replace(/\s+/g, " ").replace(/^(city|municipality) of\s+/, "").replace(/\s+city$/, "");
    var y = text(b).toLowerCase().replace(/\s+/g, " ").replace(/^(city|municipality) of\s+/, "").replace(/\s+city$/, "");
    if (x === "" || y === "") { return null; }
    return x === y;
  }

  /* ================================================================== *
   * 6. FACTS
   * ================================================================== */

  var BASES = {
    sale: { id: "sale", label: "Sale of goods", phrase: "a contract of sale of personal property", ruleRef: "Rule IV, Sec. 1(a)(4)" },
    services: { id: "services", label: "Services rendered", phrase: "a contract of services", ruleRef: "Rule IV, Sec. 1(a)(3)" },
    lease: { id: "lease", label: "Lease / rent", phrase: "a contract of lease", ruleRef: "Rule IV, Sec. 1(a)(1)" },
    loan: { id: "loan", label: "Loan or credit accommodation", phrase: "a contract of loan or other credit accommodation", ruleRef: "Rule IV, Sec. 1(a)(2)" },
    settlement: { id: "settlement", label: "Barangay settlement to enforce", phrase: "a barangay amicable settlement that has not been executed", ruleRef: "Rule IV, Sec. 1(b)" },
    other: { id: "other", label: "Other money obligation", phrase: "the obligation described below", ruleRef: "Rule IV, Sec. 1" }
  };

  function basis(id) {
    return BASES[id] || BASES.other;
  }

  function defaults() {
    return {
      /* the parties */
      claimantName: "",
      claimantType: "sole_proprietorship",
      claimantAddress: "",
      claimantBarangay: "",
      claimantCity: "",
      debtorName: "",
      debtorType: "individual",
      debtorAddress: "",
      debtorBarangay: "",
      debtorCity: "",
      sameCityMunicipality: true,
      adjoiningBarangaysAndAgreed: false,

      /* the debt */
      principalPHP: 0,
      interestClaimedPHP: 0,
      basis: "sale",
      writtenContract: true,
      dueDate: "",
      reference: "",
      demandDays: DEFAULT_DEMAND_DAYS,
      letterDate: "",

      /* the procedural facts */
      moneyOnly: true,
      provisionalRemedy: false,
      prescriptionImminent: false,
      governmentParty: false,
      publicOfficerFunctions: false,
      laborDispute: false,
      agrarianDispute: false,
      realPropertyDifferentLGU: false,
      annulCompromiseJudgment: false,
      presidentiallyExcepted: false,
      sameIndigenousCommunity: false,

      /* where the user already is */
      hasCertificateToFileAction: false,
      certificateNumber: "",
      settlementRepudiated: false,
      settlementUnexecutedSixMonths: false,
      defendantOutsideJudicialRegion: false,

      /* small claims declarations required by Rule IV, Sec. 4 */
      lendingOrBanking: false,
      smallClaimsFiledThisYear: 0,
      appearingByRepresentative: false,
      extraParties: false
    };
  }

  function normalize(input) {
    var d = defaults(), f = {}, k;
    for (k in d) { if (Object.prototype.hasOwnProperty.call(d, k)) { f[k] = d[k]; } }
    if (input) {
      for (k in input) { if (Object.prototype.hasOwnProperty.call(f, k)) { f[k] = input[k]; } }
    }
    f.principalPHP = round2(nonNegative(f.principalPHP));
    f.interestClaimedPHP = round2(nonNegative(f.interestClaimedPHP));
    f.demandDays = Math.max(1, Math.round(num(f.demandDays) || DEFAULT_DEMAND_DAYS));
    f.smallClaimsFiledThisYear = Math.max(0, Math.round(nonNegative(f.smallClaimsFiledThisYear)));
    if (!PARTY_TYPES[f.claimantType]) { f.claimantType = "individual"; }
    if (!PARTY_TYPES[f.debtorType]) { f.debtorType = "individual"; }
    if (!BASES[f.basis]) { f.basis = "other"; }
    /* Enforcing a settlement is a fact about the basis, not a separate switch. */
    f.enforcingBarangaySettlement = f.basis === "settlement";
    return f;
  }

  /* ================================================================== *
   * 7. THE GATE
   * ================================================================== */

  function firedExceptions(f) {
    var out = [], i;
    for (i = 0; i < KP_EXCEPTIONS.length; i++) {
      if (KP_EXCEPTIONS[i].civil && KP_EXCEPTIONS[i].test(f)) {
        out.push({
          id: KP_EXCEPTIONS[i].id,
          item: KP_EXCEPTIONS[i].item,
          label: KP_EXCEPTIONS[i].label,
          cite: KP_EXCEPTIONS[i].cite
        });
      }
    }
    return out;
  }

  function conciliationFor(f) {
    var fired = firedExceptions(f);
    var status;

    if (f.enforcingBarangaySettlement) {
      status = CONCILIATION.ALREADY_CONCILIATED;
    } else if (fired.length > 0) {
      status = CONCILIATION.NOT_REQUIRED;
    } else if (f.hasCertificateToFileAction || f.settlementRepudiated) {
      status = CONCILIATION.SATISFIED;
    } else if (f.sameIndigenousCommunity) {
      status = CONCILIATION.REQUIRED_INDIGENOUS;
    } else {
      status = CONCILIATION.REQUIRED;
    }

    var required = status === CONCILIATION.REQUIRED || status === CONCILIATION.REQUIRED_INDIGENOUS;

    /* Venue for the barangay complaint. LGC s.409(a) and (b). */
    var venueBarangay = text(f.debtorBarangay), venueRule, venueSection;
    if (text(f.claimantBarangay) !== "" && text(f.debtorBarangay) !== "" &&
        text(f.claimantBarangay).toLowerCase() === text(f.debtorBarangay).toLowerCase()) {
      venueSection = "Section 409(a)";
      venueRule = "LGC s.409(a) — both parties reside in the same barangay";
    } else {
      venueSection = "Section 409(b)";
      venueRule = "LGC s.409(b) — the barangay where the respondent actually resides";
    }

    return {
      status: status.id,
      required: required,
      satisfied: status === CONCILIATION.SATISFIED || status === CONCILIATION.ALREADY_CONCILIATED,
      headline: status.headline,
      summary: status.summary,
      cite: status.cite,
      exceptions: fired,
      indigenousTrack: status === CONCILIATION.REQUIRED_INDIGENOUS,
      optionalAcrossLGUs: f.sameCityMunicipality !== true && f.adjoiningBarangaysAndAgreed === true,
      venueBarangay: venueBarangay,
      venueCity: text(f.debtorCity),
      venueRule: venueRule,
      venueSection: venueSection,
      /* The consequence of getting this wrong, which is the whole point. */
      riskIfSkipped: "A complaint that needed prior referral and does not show compliance is dismissed without prejudice, on the court's own initiative or on the defendant's motion, and may be re-filed only after the requirement is met (A.M. No. 08-8-7-SC, Rule III, s.2; Rule IV, s.9(i); Rule II, s.2(a))."
    };
  }

  function forumFor(f) {
    var claim = f.principalPHP;
    var withinCeiling = claim <= SMALL_CLAIMS_CEILING_PHP;
    var blockers = [];

    if (f.enforcingBarangaySettlement) {
      if (!f.settlementUnexecutedSixMonths) {
        return {
          forum: FORUMS.LUPON_EXECUTION,
          blockers: [{
            id: "LUPON_STILL_HAS_SIX_MONTHS",
            label: "The lupon can still execute the settlement itself for " + KP_PERIODS.luponExecutionMonths +
                   " months from the date of the settlement. Ask it to, before going to court.",
            cite: "LGC s.417"
          }],
          withinCeiling: withinCeiling
        };
      }
      return {
        forum: withinCeiling ? FORUMS.SMALL_CLAIMS : FORUMS.SUMMARY_PROCEDURE,
        blockers: [],
        withinCeiling: withinCeiling,
        enforcement: true
      };
    }

    if (claim <= 0) {
      blockers.push({
        id: "NO_AMOUNT",
        label: "Enter the amount claimed, exclusive of interest and costs.",
        cite: "A.M. No. 08-8-7-SC, Rule IV, s.1"
      });
    }
    if (f.moneyOnly !== true) {
      blockers.push({
        id: "RELIEF_BEYOND_MONEY",
        label: "A small claim is solely for the payment or reimbursement of a sum of money. Asking for anything else takes the case out of Rule IV.",
        cite: "A.M. No. 08-8-7-SC, Rule I A(2)"
      });
    }
    if (f.provisionalRemedy === true) {
      blockers.push({
        id: "COUPLED_WITH_PROVISIONAL_REMEDY",
        label: "A claim coupled with a provisional remedy, such as attachment or injunction, is excluded from small claims.",
        cite: "A.M. No. 08-8-7-SC, Rule I A(2)"
      });
    }
    if (!withinCeiling) {
      blockers.push({
        id: "OVER_CEILING",
        label: "The claim exceeds the small claims ceiling of " + pesos(SMALL_CLAIMS_CEILING_PHP) + ", exclusive of interest and costs.",
        cite: "A.M. No. 08-8-7-SC, Rule IV, s.1"
      });
    }

    var forum;
    if (claim <= 0) {
      forum = FORUMS.UNDETERMINED;
    } else if (blockers.length === 0) {
      forum = FORUMS.SMALL_CLAIMS;
    } else if (claim <= SUMMARY_PROCEDURE_CEILING_PHP) {
      forum = FORUMS.SUMMARY_PROCEDURE;
    } else {
      forum = FORUMS.REGULAR;
    }

    return { forum: forum, blockers: blockers, withinCeiling: withinCeiling };
  }

  function prescriptionFor(f, today) {
    var years = f.writtenContract ? PRESCRIPTION_YEARS.writtenContract : PRESCRIPTION_YEARS.oralContract;
    var out = {
      years: years,
      cite: f.writtenContract
        ? "Civil Code, Art. 1144(1) — ten years on a written contract"
        : "Civil Code, Art. 1145(1) — six years on an oral contract",
      deadline: null,
      daysLeft: null,
      expired: false
    };
    var deadline = addYears(f.dueDate, years);
    if (!deadline) { return out; }
    out.deadline = deadline;
    var left = daysBetween(today, deadline);
    if (left !== null) {
      out.daysLeft = left;
      out.expired = left < 0;
    }
    return out;
  }

  /* ================================================================== *
   * 8. WHAT TO DO, IN ORDER
   * ================================================================== */

  function stepsFor(f, conc, forumInfo) {
    var steps = [];

    steps.push({
      title: "Send the demand letter",
      detail: "Deliver it personally against a signed acknowledgement, or by registered mail and keep the registry receipt and return card. Under Article 1169 of the Civil Code, delay runs from this demand, and the barangay and the court will both ask to see it.",
      cite: "Civil Code, Art. 1169"
    });

    if (conc.required) {
      steps.push({
        title: "File the complaint with the Punong Barangay",
        detail: "Venue: Barangay " + or(conc.venueBarangay, "____") + ", " + or(conc.venueCity, "____") + ". " + conc.venueRule +
                ". Pay the barangay filing fee. The complaint may be oral or written; a written one is better evidence.",
        cite: "LGC s.409, s.410(a)"
      });
      steps.push({
        title: "Appear in person for mediation, then before the pangkat",
        detail: "You must appear yourself, with no lawyer and no representative. The Punong Barangay mediates for up to " +
                KP_PERIODS.luponMediationDays + " days from your first meeting; failing that, a pangkat is constituted, convenes within " +
                KP_PERIODS.pangkatConveneDays + " days, and has " + KP_PERIODS.pangkatSettleDays + " days, extendible by another " +
                KP_PERIODS.pangkatExtensionDays + " days, to settle the dispute.",
        cite: "LGC s.410(b), (d), (e), s.415"
      });
      steps.push({
        title: "Take home the Certification to File Action",
        detail: "If there is no settlement, the Pangkat Secretary issues it, attested by the Pangkat Chairman. The Punong Barangay cannot issue it at the mediation stage — if you are offered one before a pangkat was formed, it is premature and the court can throw out your case. " +
                "Prescription is interrupted while the dispute is before the barangay, but by no more than " +
                KP_PERIODS.prescriptionInterruptMaxDays + " days.",
        cite: "A.C. 14-93 II.2 and II.4; LGC s.410(c)"
      });
      steps.push({
        title: "Then, and only then, file in court",
        detail: "A settlement reached at the barangay has the force of a final judgment " + KP_PERIODS.settlementFinalAfterDays +
                " days after it is signed, unless repudiated within those " + KP_PERIODS.repudiationWindowDays +
                " days. If it is honoured, you are done and no case is needed.",
        cite: "LGC s.412(a), s.416, s.418"
      });
    } else if (conc.status === "ALREADY_CONCILIATED") {
      steps.push({
        title: "Ask the lupon to execute the settlement first",
        detail: "The lupon may enforce its own settlement for " + KP_PERIODS.luponExecutionMonths +
                " months from the date of the settlement. Only after that period does enforcement move to the court.",
        cite: "LGC s.417"
      });
    } else {
      steps.push({
        title: "Put the exception in writing in the pleading",
        detail: "Your filing must say why prior barangay referral does not apply. Copy the statement this tool generates into the pleading; a case that is silent on conciliation invites a dismissal even when an exception does apply.",
        cite: "A.M. No. 08-8-7-SC, Rule III, s.2"
      });
    }

    if (forumInfo.forum.id === "SMALL_CLAIMS") {
      steps.push({
        title: "Get the official forms",
        detail: "Form 1-SCC (Statement of Claim/s), Form 1-A-SCC if there is more than one plaintiff or defendant, and Form 1-B-SCC (information for the plaintiff). They are free at the Office of the Clerk of Court of any first level court. Read Form 1-B-SCC before you fill anything in.",
        cite: "A.M. No. 08-8-7-SC, Rule IV, s.16"
      });
      steps.push({
        title: "File the Statement of Claim/s with its attachments",
        detail: "Bring as many copies as there are defendants. Nothing you leave out can be used at the hearing unless the court finds good cause. Pay the docket fees under Rule 141 plus the " +
                pesos(SMALL_CLAIMS_FEES.summonsServiceFeePHP) + " fee for service of summons, which is never waived.",
        cite: "A.M. No. 08-8-7-SC, Rule IV, s.4, s.8"
      });
      steps.push({
        title: "Appear on the hearing date, without a lawyer",
        detail: "Summons issues within " + SMALL_CLAIMS_STEPS.summonsIssuedWithinHours + " hours of filing; the defendant has " +
                SMALL_CLAIMS_STEPS.responseDays + " calendar days from receipt to file a verified Response; the hearing is set within " +
                (f.defendantOutsideJudicialRegion ? SMALL_CLAIMS_STEPS.hearingWithinDaysOutsideRegion : SMALL_CLAIMS_STEPS.hearingWithinDays) +
                " calendar days of filing. You get one postponement at most, and only on proof you physically cannot attend.",
        cite: "A.M. No. 08-8-7-SC, Rule IV, s.10, s.13, s.20"
      });
      steps.push({
        title: "Decision within 24 hours, and it is final",
        detail: "The judge first tries to settle the case, then hears it informally and decides within " +
                SMALL_CLAIMS_STEPS.decisionWithinHours + " hours. The decision is final, executory and unappealable. Move for execution yourself using Form 12-SCC.",
        cite: "A.M. No. 08-8-7-SC, Rule IV, s.22, s.24, s.25"
      });
    } else if (forumInfo.forum.id !== "LUPON_EXECUTION" && forumInfo.forum.id !== "UNDETERMINED") {
      steps.push({
        title: "File under " + forumInfo.forum.label.toLowerCase(),
        detail: "This case is outside Rule IV, so the small claims forms and the bar on lawyers do not apply to it. Pleadings must be verified and, for summary procedure, judicial affidavits are attached to the complaint.",
        cite: forumInfo.forum.cite
      });
    }

    return steps;
  }

  /* ================================================================== *
   * 9. ATTACHMENTS CHECKLIST — A.M. No. 08-8-7-SC, Rule IV
   * ================================================================== */

  var REQUIRED = "required", IF_APPLICABLE = "if applicable", NOT_NEEDED = "not needed";

  function attachmentsFor(f, conc, forumInfo) {
    var smallClaims = forumInfo.forum.id === "SMALL_CLAIMS";
    var list = [];

    function add(id, label, status, cite) {
      list.push({ id: id, label: label, status: status, cite: cite });
    }

    add("FORM_1_SCC",
        "Form 1-SCC — Plaintiff's Statement of Claim/s, with the Verification and Certification Against Forum Shopping, Splitting a Single Cause of Action, and Multiplicity of Suits signed and sworn",
        smallClaims ? REQUIRED : NOT_NEEDED,
        "Rule IV, s.4");

    add("FORM_1_A_SCC",
        "Form 1-A-SCC — used when there is more than one plaintiff or more than one defendant",
        smallClaims && f.extraParties ? REQUIRED : (smallClaims ? IF_APPLICABLE : NOT_NEEDED),
        "Rule IV, s.16");

    add("ACTIONABLE_DOCUMENTS",
        "Duly certified photocopies of the actionable documents: the contract or purchase order, the invoices, delivery receipts, the statement of account, and any acknowledgement of the debt. Certify each one with your own signature.",
        REQUIRED,
        "Rule IV, s.4, s.26");

    add("AFFIDAVITS",
        "Affidavits of your witnesses, stating only facts of their direct personal knowledge or taken from authentic records. Leaving them out causes immediate dismissal of the claim.",
        smallClaims ? REQUIRED : IF_APPLICABLE,
        "Rule IV, s.4, s.7");

    add("DEMAND_LETTER_PROOF",
        "The demand letter and proof it reached the debtor: the signed acknowledgement, or the registry receipt and return card.",
        REQUIRED,
        "Civil Code, Art. 1169");

    if (conc.required) {
      add("CERTIFICATE_TO_FILE_ACTION",
          "Certification to File Action from the Pangkat Secretary, attested by the Pangkat Chairman. You do not have it yet — this is what the barangay stage produces, and the case cannot be filed without it.",
          REQUIRED,
          "LGC s.412(a); A.C. 14-93 II");
    } else if (conc.status === "SATISFIED") {
      add("CERTIFICATE_TO_FILE_ACTION",
          "Certification to File Action" + (f.settlementRepudiated
            ? ", or the sworn repudiation of the settlement filed with the Lupon Chairman within the 10-day window"
            : "") + (text(f.certificateNumber) !== "" ? " (no. " + text(f.certificateNumber) + ")" : "") + ".",
          REQUIRED,
          "LGC s.412(a), s.418; A.C. 14-93 II");
    } else {
      add("CONCILIATION_STATEMENT",
          "No Certification to File Action is needed, but the pleading must carry the written statement of why prior referral does not apply.",
          REQUIRED,
          "A.M. No. 08-8-7-SC, Rule III, s.2");
    }

    add("BOARD_RESOLUTION",
        "Board resolution or secretary's certificate authorising the person filing on behalf of the company.",
        partyType(f.claimantType).juridical ? REQUIRED : NOT_NEEDED,
        "Rule IV, s.4 (per the Resolution dated 15 March 2022), s.12(d)");

    add("FORM_7_SCC",
        "Form 7-SCC — Special Power of Attorney, if someone appears for you. That person must not be a lawyer, and a company may not be represented by a lawyer in any capacity.",
        f.appearingByRepresentative ? REQUIRED : (smallClaims ? IF_APPLICABLE : NOT_NEEDED),
        "Rule IV, s.17");

    add("COPIES_FOR_DEFENDANTS",
        "One full set of copies of the Statement of Claim/s and every attachment for each defendant.",
        smallClaims ? REQUIRED : IF_APPLICABLE,
        "Rule IV, s.4");

    add("LENDING_DECLARATION",
        "The statement, on the form itself, of whether you are engaged in the business of lending, banking or similar activities, and how many small claims you have filed this calendar year" +
        (f.smallClaimsFiledThisYear > 0 ? " (you entered " + f.smallClaimsFiledThisYear + ")" : "") +
        ". Misrepresenting this gets the claim dismissed with prejudice and can be punished as contempt.",
        smallClaims ? REQUIRED : NOT_NEEDED,
        "Rule IV, s.4, s.9");

    add("FEES",
        "Docket and other legal fees under " + SMALL_CLAIMS_FEES.docketFeeRule + ", plus " +
        pesos(SMALL_CLAIMS_FEES.summonsServiceFeePHP) + " for service of summons" +
        (f.smallClaimsFiledThisYear >= SMALL_CLAIMS_FEES.freeClaimsPerYear
          ? ", plus the progressive surcharge of " + pesos(SMALL_CLAIMS_FEES.extraAfterFifthClaimPHP) +
            " on each claim after your fifth this calendar year"
          : "") + ".",
        smallClaims ? REQUIRED : IF_APPLICABLE,
        "Rule IV, s.8");

    add("FORM_1_B_SCC",
        "Form 1-B-SCC — Information for the Small Claims Plaintiff. Not filed; read it first.",
        smallClaims ? REQUIRED : NOT_NEEDED,
        "Rule IV, s.16");

    return list;
  }

  /* ================================================================== *
   * 10. WARNINGS — the traps that get DIY filings thrown out
   * ================================================================== */

  function warningsFor(f, conc, forumInfo, pres) {
    var w = [];

    var typed = sameLGU(f.claimantCity, f.debtorCity);
    if (typed !== null && typed !== f.sameCityMunicipality) {
      w.push("The two cities you typed " + (typed ? "look like the same city or municipality" : "look like different cities or municipalities") +
             ", but you answered the same-city question the other way. The legal test is where each party ACTUALLY resides or holds business, not the billing address — check it before you rely on this.");
    }

    if (!partyType(f.claimantType).juridical && !partyType(f.debtorType).juridical &&
        (f.claimantType === "sole_proprietorship" || f.debtorType === "sole_proprietorship")) {
      w.push("A sole proprietorship is not a separate person. The owner is the party, so the juridical-entity exception does NOT apply and barangay conciliation is still a pre-condition when both sides are in the same city or municipality. This is the single most common reason a DIY collection case is dismissed.");
    }

    if (f.principalPHP > SMALL_CLAIMS_CEILING_PHP && f.principalPHP <= SUMMARY_PROCEDURE_CEILING_PHP) {
      w.push("Do not break the debt into separate claims to get under the ceiling. The Statement of Claim/s is certified against splitting a single cause of action, and joined claims are counted together.");
    }

    if (f.interestClaimedPHP > 0) {
      w.push("Interest and costs do not count toward the " + pesos(SMALL_CLAIMS_CEILING_PHP) +
             " ceiling, so a principal within the ceiling stays a small claim however much interest has run. Plead the interest separately from the principal.");
    }

    if (pres.expired) {
      w.push("On the due date you entered, the " + pres.years + "-year prescriptive period has already run (" + pres.cite +
             "). A prescribed claim is dismissed outright. Get advice before spending anything on this.");
    } else if (pres.daysLeft !== null && pres.daysLeft <= 365) {
      w.push("Only " + pres.daysLeft + " days are left before this claim prescribes on " + longDate(pres.deadline) + " (" + pres.cite +
             "). Barangay proceedings interrupt prescription by at most " + KP_PERIODS.prescriptionInterruptMaxDays + " days.");
    }

    if (f.lendingOrBanking) {
      w.push("Lenders and banks pay the regular rate of filing fees, not the small claims rate, and must file where the defendant resides or holds business if they have a branch there.");
    }

    if (conc.optionalAcrossLGUs) {
      w.push("Across city or municipal lines, conciliation is optional, not required: it works only if the two barangays adjoin each other AND both sides agree to use one lupon. If the debtor will not agree, go straight to court.");
    }

    if (forumInfo.forum.lawyersBarred) {
      w.push("No lawyer may appear for you at a small claims hearing, and a company may not be represented by a lawyer in any capacity. A lawyer can still help you prepare the papers out of court.");
    }

    return w;
  }

  /* ================================================================== *
   * 11. assess(facts, today) — the single entry point for the gate
   * ================================================================== */

  function assess(input, today) {
    var f = normalize(input);
    var conc = conciliationFor(f);
    var forumInfo = forumFor(f);
    var pres = prescriptionFor(f, today);

    return {
      facts: f,
      conciliation: conc,
      forum: forumInfo.forum,
      blockers: forumInfo.blockers,
      withinCeiling: forumInfo.withinCeiling,
      headroomPHP: round2(SMALL_CLAIMS_CEILING_PHP - f.principalPHP),
      totalClaimedPHP: round2(f.principalPHP + f.interestClaimedPHP),
      ceiling: SMALL_CLAIMS_CEILING,
      summaryCeiling: SUMMARY_PROCEDURE_CEILING,
      prescription: pres,
      steps: stepsFor(f, conc, forumInfo),
      attachments: attachmentsFor(f, conc, forumInfo),
      warnings: warningsFor(f, conc, forumInfo, pres),
      /* An invariant, asserted in the tests: this tool only ever writes text. */
      transmits: false
    };
  }

  /* ================================================================== *
   * 12. DOCUMENTS. Pure string builders. Each one is text for the user
   *     to read, sign and deliver or file themselves.
   * ================================================================== */

  function partyBlock(name, addr, brgy, city) {
    var lines = [or(name, "____________________")];
    if (text(addr) !== "") { lines.push(text(addr)); }
    var tail = [];
    if (text(brgy) !== "") { tail.push("Barangay " + text(brgy)); }
    if (text(city) !== "") { tail.push(text(city)); }
    if (tail.length) { lines.push(tail.join(", ")); }
    return lines.join("\n");
  }

  function describe(f) {
    var b = basis(f.basis);
    var ref = text(f.reference) !== "" ? " under " + text(f.reference) : "";
    return b.phrase + ref;
  }

  function nextStepSentence(a) {
    var f = a.facts;
    if (a.conciliation.required) {
      return "I will file a complaint against you before the Lupong Tagapamayapa of Barangay " +
        or(a.conciliation.venueBarangay, "____") + ", " + or(a.conciliation.venueCity, "____") +
        ", under the Katarungang Pambarangay Law (Sections 399 to 422 of the Local Government Code of 1991), and from there pursue every remedy the law allows.";
    }
    if (a.forum.id === "SMALL_CLAIMS") {
      return "I will file a Statement of Claim/s against you as a small claim before the first level court of " +
        or(f.debtorCity, "____") + " under A.M. No. 08-8-7-SC, where the case is heard in one setting and decided within a day.";
    }
    if (a.forum.id === "LUPON_EXECUTION") {
      return "I will ask the Lupong Tagapamayapa to execute the settlement you signed, and failing that, enforce it in court.";
    }
    return "I will file the appropriate civil action before " + a.forum.court + " to recover the amount in full, with interest and costs.";
  }

  function demandLetter(a) {
    var f = a.facts;
    var date = text(f.letterDate) !== "" ? longDate(f.letterDate) : "____________________";
    var L = [];

    L.push(date);
    L.push("");
    L.push(partyBlock(f.debtorName, f.debtorAddress, f.debtorBarangay, f.debtorCity));
    L.push("");
    L.push("Subject:  Demand for payment of " + pesos(f.principalPHP));
    L.push("");
    L.push("Dear " + or(f.debtorName, "Sir or Madam") + ",");
    L.push("");
    L.push("1.  You are indebted to " + or(f.claimantName, "the undersigned") + " in the principal sum of " +
           pesos(f.principalPHP) + ", arising from " + describe(f) + ".");
    L.push("");
    L.push("2.  The amount became due and demandable on " +
           (text(f.dueDate) !== "" ? longDate(f.dueDate) : "____________________") +
           " and remains wholly unpaid to date despite repeated follow-up.");
    L.push("");
    if (f.interestClaimedPHP > 0) {
      L.push("3.  In addition to the principal, " + pesos(f.interestClaimedPHP) +
             " is claimed as interest and penalties accrued as of the date of this letter.");
      L.push("");
    }
    L.push("DEMAND.  Demand is hereby made upon you to pay " +
           (f.interestClaimedPHP > 0
             ? "the total sum of " + pesos(f.principalPHP + f.interestClaimedPHP) +
               " (principal " + pesos(f.principalPHP) + " plus " + pesos(f.interestClaimedPHP) + ")"
             : "the sum of " + pesos(f.principalPHP)) +
           " within " + f.demandDays + " days from your receipt of this letter.");
    L.push("");
    L.push("This letter is an extrajudicial demand. Under Article 1169 of the Civil Code of the Philippines, you incur delay from the date of this demand.");
    L.push("");
    L.push("Should payment not be received within the period stated above, " + nextStepSentence(a));
    L.push("");
    L.push("I would much rather settle this between us. Please call or write if you wish to discuss terms of payment.");
    L.push("");
    L.push("Very truly yours,");
    L.push("");
    L.push("");
    L.push("____________________________________");
    L.push(partyBlock(f.claimantName, f.claimantAddress, f.claimantBarangay, f.claimantCity));
    if (partyType(f.claimantType).juridical) {
      L.push("By its duly authorised representative");
    } else if (f.claimantType === "sole_proprietorship") {
      L.push("Proprietor");
    }

    return L.join("\n");
  }

  function conciliationStatement(a) {
    var f = a.facts, L = [];

    if (a.conciliation.status === "SATISFIED") {
      L.push("STATEMENT OF COMPLIANCE WITH BARANGAY CONCILIATION");
      L.push("");
      L.push("The parties actually reside in the same city or municipality, and this dispute was referred to the Lupong Tagapamayapa of Barangay " +
             or(a.conciliation.venueBarangay, "____") + ", " + or(a.conciliation.venueCity, "____") + ".");
      if (f.settlementRepudiated) {
        L.push("A settlement was reached and thereafter repudiated within the ten-day period, which is sufficient basis for the issuance of the certification to file action under Section 418 of the Local Government Code of 1991.");
      } else {
        L.push("No settlement was reached, and a Certification to File Action" +
               (text(f.certificateNumber) !== "" ? " (no. " + text(f.certificateNumber) + ")" : "") +
               " was issued and is attached to this pleading.");
      }
      L.push("The pre-condition in Section 412(a) of the Local Government Code of 1991 has therefore been complied with.");
      return L.join("\n");
    }

    if (a.conciliation.status === "ALREADY_CONCILIATED") {
      L.push("STATEMENT ON BARANGAY CONCILIATION");
      L.push("");
      L.push("This action enforces an amicable settlement reached before the Lupong Tagapamayapa, which the barangay did not execute within six months from the date of the settlement. Prior referral is therefore not a separate pre-condition; Section 417 of the Local Government Code of 1991 and Rule I A(2)(b) of A.M. No. 08-8-7-SC expressly allow this claim.");
      return L.join("\n");
    }

    if (a.conciliation.required) {
      L.push("NOT YET AVAILABLE — BARANGAY CONCILIATION IS STILL A PRE-CONDITION");
      L.push("");
      L.push("On the facts entered, prior referral to the Lupon is required by Section 412(a) of the Local Government Code of 1991. There is no statement to make yet, because there is nothing to certify: go to the barangay first, obtain the Certification to File Action, then come back for the statement of compliance.");
      return L.join("\n");
    }

    L.push("STATEMENT ON BARANGAY CONCILIATION (NON-COVERAGE)");
    L.push("");
    L.push("Prior referral of this dispute to the Lupong Tagapamayapa is not a pre-condition to this filing, for the following reason" +
           (a.conciliation.exceptions.length > 1 ? "s" : "") + ":");
    L.push("");
    a.conciliation.exceptions.forEach(function (e, i) {
      L.push("    " + (i + 1) + ".  " + e.label + ".");
      L.push("        (" + e.cite + ")");
    });
    L.push("");
    L.push("This statement is made in compliance with Section 2, Rule III of A.M. No. 08-8-7-SC, which requires every case needing prior referral to carry a statement of compliance, and so that the absence of a Certification to File Action is explained on the face of the pleading.");
    return L.join("\n");
  }

  function barangayComplaint(a) {
    var f = a.facts, L = [];

    L.push("Republic of the Philippines");
    L.push("City / Municipality of " + or(a.conciliation.venueCity, "____________________"));
    L.push("Barangay " + or(a.conciliation.venueBarangay, "____________________"));
    L.push("OFFICE OF THE LUPONG TAGAPAMAYAPA");
    L.push("");
    L.push(or(f.claimantName, "____________________") + ",");
    L.push("            Complainant,");
    L.push("");
    L.push("      - versus -                        Barangay Case No. ____________");
    L.push("");
    L.push(or(f.debtorName, "____________________") + ",");
    L.push("            Respondent.");
    L.push("x- - - - - - - - - - - - - - - - - - - - - - - - -x");
    L.push("");
    L.push("                        COMPLAINT");
    L.push("        (Katarungang Pambarangay — Sections 399 to 422,");
    L.push("         Local Government Code of 1991, R.A. No. 7160)");
    L.push("");
    L.push("TO THE PUNONG BARANGAY:");
    L.push("");
    L.push("The complainant respectfully states:");
    L.push("");
    L.push("1.  Complainant is of legal age, with address at " +
           or(f.claimantAddress, "____________________") + ", Barangay " +
           or(f.claimantBarangay, "____") + ", " + or(f.claimantCity, "____") + ".");
    L.push("");
    L.push("2.  Respondent is of legal age, with address at " +
           or(f.debtorAddress, "____________________") + ", Barangay " +
           or(f.debtorBarangay, "____") + ", " + or(f.debtorCity, "____") + ".");
    L.push("");
    L.push("3.  Both parties actually reside or hold business in " + or(f.debtorCity, "____") +
           ", so this dispute is within the authority of the Lupon under Section 408 of the Local Government Code of 1991, and venue lies in this barangay under " +
           a.conciliation.venueSection + " of the same Code.");
    L.push("");
    L.push("4.  Respondent owes complainant the principal sum of " + pesos(f.principalPHP) +
           ", arising from " + describe(f) + ", which became due on " +
           (text(f.dueDate) !== "" ? longDate(f.dueDate) : "____________________") + " and remains unpaid.");
    if (f.interestClaimedPHP > 0) {
      L.push("");
      L.push("5.  Interest and penalties of " + pesos(f.interestClaimedPHP) + " have also accrued on the obligation.");
    }
    L.push("");
    L.push((f.interestClaimedPHP > 0 ? "6" : "5") + ".  A written demand dated " +
           (text(f.letterDate) !== "" ? longDate(f.letterDate) : "____________________") +
           " was served on the respondent and went unheeded. A copy is attached.");
    L.push("");
    L.push("                          PRAYER");
    L.push("");
    L.push("Complainant respectfully prays that the respondent be summoned for mediation and conciliation, and that respondent be made to pay the sum of " +
           pesos(f.principalPHP + f.interestClaimedPHP) + ", or such amount as may be agreed upon.");
    L.push("");
    L.push(or(f.debtorCity, "____________________") + ", ____________________.");
    L.push("");
    L.push("");
    L.push("                                    ____________________________________");
    L.push("                                    " + or(f.claimantName, "Complainant"));
    L.push("                                    Complainant");
    L.push("");
    L.push("Filing fee paid: ____________   Received by: ____________   Date: ____________");
    L.push("");
    L.push("NOTE ON APPEARANCE.  Section 415 of the Local Government Code of 1991 requires the parties to appear IN PERSON, without a lawyer and without a representative. Send nobody in your place.");

    return L.join("\n");
  }

  function statementOfClaim(a) {
    var f = a.facts, b = basis(f.basis), L = [];

    L.push("ENTRIES FOR FORM 1-SCC — PLAINTIFF'S STATEMENT OF CLAIM/S");
    L.push("Copy these onto the official form. Get it free from the Office of the");
    L.push("Clerk of Court of any first level court. This page is not a court form");
    L.push("and must not be filed in place of one.");
    L.push("");
    L.push("----------------------------------------------------------------------");
    L.push("COURT             First level court of " + or(f.debtorCity, "____________________"));
    L.push("                  (small claims — A.M. No. 08-8-7-SC, Rule IV)");
    L.push("");
    L.push("PLAINTIFF         " + or(f.claimantName, "____________________"));
    L.push("                  " + partyType(f.claimantType).label);
    L.push("  address         " + or(f.claimantAddress, "____________________") +
           ", Barangay " + or(f.claimantBarangay, "____") + ", " + or(f.claimantCity, "____"));
    L.push("");
    L.push("DEFENDANT         " + or(f.debtorName, "____________________"));
    L.push("                  " + partyType(f.debtorType).label);
    L.push("  address         " + or(f.debtorAddress, "____________________") +
           ", Barangay " + or(f.debtorBarangay, "____") + ", " + or(f.debtorCity, "____"));
    L.push("");
    L.push("AMOUNT OF CLAIM   " + pesos(f.principalPHP) + "   exclusive of interest and costs");
    L.push("INTEREST CLAIMED  " + pesos(f.interestClaimedPHP) + "   pleaded separately; does not count");
    L.push("                  " + new Array(pesos(f.interestClaimedPHP).length + 1).join(" ") +
           "   toward the " + pesos(SMALL_CLAIMS_CEILING.amountPHP) + " ceiling");
    L.push("NATURE OF CLAIM   " + b.label + " — " + b.phrase + " (" + b.ruleRef + ")");
    L.push("----------------------------------------------------------------------");
    L.push("");
    L.push("STATEMENT OF THE CLAIM");
    L.push("");
    L.push("1.  Plaintiff is " + or(f.claimantName, "____") + ", " +
           partyType(f.claimantType).label.toLowerCase() + ", with the address stated above.");
    L.push("");
    L.push("2.  Defendant is " + or(f.debtorName, "____") + ", " +
           partyType(f.debtorType).label.toLowerCase() + ", with the address stated above.");
    L.push("");
    L.push("3.  Defendant is indebted to plaintiff in the principal sum of " + pesos(f.principalPHP) +
           " arising from " + describe(f) + ".");
    L.push("");
    L.push("4.  The obligation became due and demandable on " +
           (text(f.dueDate) !== "" ? longDate(f.dueDate) : "____________________") + " and remains unpaid.");
    L.push("");
    L.push("5.  Plaintiff made a written extrajudicial demand dated " +
           (text(f.letterDate) !== "" ? longDate(f.letterDate) : "____________________") +
           ", a copy of which is attached together with proof of its receipt. Defendant has not paid.");
    L.push("");
    L.push("6.  The claim is solely for the payment of a sum of money, is not coupled with any provisional remedy, and does not exceed " +
           pesos(SMALL_CLAIMS_CEILING.amountPHP) + " exclusive of interest and costs, so it falls within Rule IV of A.M. No. 08-8-7-SC.");
    L.push("");
    L.push("DECLARATION REQUIRED BY RULE IV, SECTION 4");
    L.push("");
    L.push("    Engaged in the business of lending, banking or similar activities:  " +
           (f.lendingOrBanking ? "YES" : "NO"));
    L.push("    Small claims filed by plaintiff this calendar year, any station:    " +
           f.smallClaimsFiledThisYear);
    L.push("");
    L.push(conciliationStatement(a));
    L.push("");
    L.push("PRAYER");
    L.push("");
    L.push("Plaintiff prays that judgment be rendered ordering defendant to pay the principal sum of " +
           pesos(f.principalPHP) +
           (f.interestClaimedPHP > 0 ? ", interest and penalties of " + pesos(f.interestClaimedPHP) : "") +
           ", and the costs of this action.");
    L.push("");
    L.push("BEFORE YOU SIGN THE VERIFICATION AND CERTIFICATION ON THE FORM");
    L.push("");
    L.push("Form 1-SCC carries a Verification and Certification Against Forum Shopping,");
    L.push("Splitting a Single Cause of Action, and Multiplicity of Suits. By signing it");
    L.push("you swear, among other things, that:");
    L.push("");
    L.push("    [ ]  you have read the Statement of Claim/s and its allegations are true");
    L.push("         of your own personal knowledge or based on authentic records;");
    L.push("    [ ]  you have commenced no other action on the same claim, and none is");
    L.push("         pending before any court, tribunal or agency;");
    L.push("    [ ]  you have not split this single cause of action into separate claims;");
    L.push("    [ ]  the declaration above about lending or banking is true.");
    L.push("");
    L.push("Do not sign until each box is honestly ticked. A false certification gets the");
    L.push("claim dismissed with prejudice and can be punished as contempt of court.");
    L.push("");
    L.push("ATTACH, AND BRING ONE FULL SET OF COPIES FOR EACH DEFENDANT");
    L.push("");
    a.attachments.forEach(function (at) {
      if (at.status === NOT_NEEDED) { return; }
      L.push("    [ ]  " + at.label + "  (" + at.cite + ")");
      L.push("");
    });
    L.push("Nothing you leave out can be used at the hearing unless the court finds good");
    L.push("cause to admit it later (Rule IV, Section 4).");

    return L.join("\n");
  }

  /* ================================================================== *
   * 13. EXPORTS
   * ================================================================== */

  var CLAIMS = {
    /* constants */
    SMALL_CLAIMS_CEILING_PHP: SMALL_CLAIMS_CEILING_PHP,
    SMALL_CLAIMS_CEILING: SMALL_CLAIMS_CEILING,
    SUMMARY_PROCEDURE_CEILING_PHP: SUMMARY_PROCEDURE_CEILING_PHP,
    SUMMARY_PROCEDURE_CEILING: SUMMARY_PROCEDURE_CEILING,
    KP_PERIODS: KP_PERIODS,
    KP_CRIMINAL_LIMITS: KP_CRIMINAL_LIMITS,
    SMALL_CLAIMS_STEPS: SMALL_CLAIMS_STEPS,
    SMALL_CLAIMS_FEES: SMALL_CLAIMS_FEES,
    PRESCRIPTION_YEARS: PRESCRIPTION_YEARS,
    DEFAULT_DEMAND_DAYS: DEFAULT_DEMAND_DAYS,
    AUTHORITIES: AUTHORITIES,

    /* tables */
    KP_EXCEPTIONS: KP_EXCEPTIONS,
    PARTY_TYPES: PARTY_TYPES,
    BASES: BASES,
    CONCILIATION: CONCILIATION,
    FORUMS: FORUMS,
    STATUS: { REQUIRED: REQUIRED, IF_APPLICABLE: IF_APPLICABLE, NOT_NEEDED: NOT_NEEDED },

    /* helpers, exported because the UI and the tests both format money */
    pesos: pesos,
    longDate: longDate,
    addYears: addYears,
    daysBetween: daysBetween,
    sameLGU: sameLGU,
    partyType: partyType,
    basis: basis,

    /* the gate */
    defaults: defaults,
    normalize: normalize,
    firedExceptions: firedExceptions,
    conciliationFor: conciliationFor,
    forumFor: forumFor,
    prescriptionFor: prescriptionFor,
    attachmentsFor: attachmentsFor,
    assess: assess,

    /* the documents */
    demandLetter: demandLetter,
    barangayComplaint: barangayComplaint,
    conciliationStatement: conciliationStatement,
    statementOfClaim: statementOfClaim
  };

  if (typeof module === "object" && module && module.exports) { module.exports = CLAIMS; }
  root.CLAIMS = CLAIMS;
})(typeof globalThis !== "undefined" ? globalThis : this);
