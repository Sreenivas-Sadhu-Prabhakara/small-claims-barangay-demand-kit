/*
 * Table-driven tests for the Philippine debt-recovery rules module.
 *
 *   node tests/rules.test.js        (from the repo root)
 *   or open tests/index.html in a browser
 *
 * The expected figures below are typed out again here, independently of
 * assets/rules.js, so a slip in either copy fails the run.
 */
(function () {
  "use strict";

  var CLAIMS = (typeof require === "function")
    ? require("../assets/rules.js")
    : (typeof window !== "undefined" ? window.CLAIMS : null);

  /* Independently restated constants. If the module's figure moves, these
     must move with it, deliberately. */
  var CEILING = 1000000;
  var SUMMARY_CEILING = 2000000;
  var TODAY = "2026-11-24";

  var results = [];
  function check(group, name, got, want) {
    var g = JSON.stringify(got), w = JSON.stringify(want);
    results.push({ group: group, name: name, pass: g === w, got: g, want: w });
  }
  function truthy(group, name, got) { check(group, name, !!got, true); }
  function falsy(group, name, got) { check(group, name, !!got, false); }

  /* A baseline collection case: two individuals in the same city, a written
     invoice, nothing unusual. Every table below varies one thing from this. */
  function base(over) {
    var f = {
      claimantName: "Rosario Hardware",
      claimantType: "sole_proprietorship",
      claimantAddress: "19 Mabini Street",
      claimantBarangay: "Poblacion",
      claimantCity: "Lipa City",
      debtorName: "Mario Tolentino",
      debtorType: "individual",
      debtorAddress: "7 Rizal Avenue",
      debtorBarangay: "Sabang",
      debtorCity: "Lipa City",
      sameCityMunicipality: true,
      principalPHP: 250000,
      interestClaimedPHP: 0,
      basis: "sale",
      writtenContract: true,
      dueDate: "2026-03-15",
      letterDate: "2026-11-20",
      reference: "Invoice RH-2026-0412",
      moneyOnly: true
    };
    if (over) {
      Object.keys(over).forEach(function (k) { f[k] = over[k]; });
    }
    return f;
  }

  /* ================================================================== *
   * 1. THE CONSTANTS. One place, with its issuance and effective date,
   *    flagged indicative, Supreme Court as the authority.
   * ================================================================== */

  check("constants", "small claims ceiling", CLAIMS.SMALL_CLAIMS_CEILING_PHP, CEILING);
  check("constants", "descriptor repeats the same figure", CLAIMS.SMALL_CLAIMS_CEILING.amountPHP, CEILING);
  check("constants", "ceiling issuance", CLAIMS.SMALL_CLAIMS_CEILING.issuance, "A.M. No. 08-8-7-SC");
  check("constants", "ceiling effective date", CLAIMS.SMALL_CLAIMS_CEILING.effective, "2022-04-11");
  check("constants", "ceiling authority", CLAIMS.SMALL_CLAIMS_CEILING.authority, "Supreme Court of the Philippines");
  check("constants", "ceiling labelled indicative", CLAIMS.SMALL_CLAIMS_CEILING.indicative, true);
  check("constants", "ceiling measured exclusive of interest and costs",
        /exclusive of interest and costs/.test(CLAIMS.SMALL_CLAIMS_CEILING.measuredOn), true);
  check("constants", "summary procedure ceiling", CLAIMS.SUMMARY_PROCEDURE_CEILING_PHP, SUMMARY_CEILING);
  check("constants", "summary ceiling also indicative", CLAIMS.SUMMARY_PROCEDURE_CEILING.indicative, true);

  var PERIODS = {
    luponMediationDays: 15, pangkatConveneDays: 3, pangkatSettleDays: 15,
    pangkatExtensionDays: 15, prescriptionInterruptMaxDays: 60,
    settlementFinalAfterDays: 10, repudiationWindowDays: 10,
    luponExecutionMonths: 6, transmittalDays: 5
  };
  Object.keys(PERIODS).forEach(function (k) {
    check("constants", "LGC period " + k, CLAIMS.KP_PERIODS[k], PERIODS[k]);
  });

  var STEPS = {
    summonsIssuedWithinHours: 24, summonsServedWithinDays: 10, responseDays: 10,
    hearingWithinDays: 30, hearingWithinDaysOutsideRegion: 60,
    decisionWithinHours: 24, postponementsAllowed: 1
  };
  Object.keys(STEPS).forEach(function (k) {
    check("constants", "Rule IV period " + k, CLAIMS.SMALL_CLAIMS_STEPS[k], STEPS[k]);
  });

  check("constants", "summons service fee is never waived", CLAIMS.SMALL_CLAIMS_FEES.summonsServiceFeePHP, 1000);
  check("constants", "free claims per year", CLAIMS.SMALL_CLAIMS_FEES.freeClaimsPerYear, 5);
  check("constants", "s.408(c) fine limit", CLAIMS.KP_CRIMINAL_LIMITS.finePHP, 5000);
  check("constants", "prescription, written contract", CLAIMS.PRESCRIPTION_YEARS.writtenContract, 10);
  check("constants", "prescription, oral contract", CLAIMS.PRESCRIPTION_YEARS.oralContract, 6);

  /* ================================================================== *
   * 2. THE CEILING — at, above and below, on the principal only.
   * ================================================================== */

  var CEILING_TABLE = [
    { amount: 0,                   forum: "UNDETERMINED",      blocked: "NO_AMOUNT" },
    { amount: 1,                   forum: "SMALL_CLAIMS",      blocked: null },
    { amount: 250000,              forum: "SMALL_CLAIMS",      blocked: null },
    { amount: CEILING - 0.01,      forum: "SMALL_CLAIMS",      blocked: null },
    { amount: CEILING,             forum: "SMALL_CLAIMS",      blocked: null },
    { amount: CEILING + 0.01,      forum: "SUMMARY_PROCEDURE", blocked: "OVER_CEILING" },
    { amount: CEILING + 1,         forum: "SUMMARY_PROCEDURE", blocked: "OVER_CEILING" },
    { amount: 1500000,             forum: "SUMMARY_PROCEDURE", blocked: "OVER_CEILING" },
    { amount: SUMMARY_CEILING,     forum: "SUMMARY_PROCEDURE", blocked: "OVER_CEILING" },
    { amount: SUMMARY_CEILING + 1, forum: "REGULAR",           blocked: "OVER_CEILING" },
    { amount: 9000000,             forum: "REGULAR",           blocked: "OVER_CEILING" }
  ];

  CEILING_TABLE.forEach(function (row) {
    var a = CLAIMS.assess(base({ principalPHP: row.amount }), TODAY);
    if (row.forum) {
      check("ceiling", row.amount + " -> forum", a.forum.id, row.forum);
    }
    check("ceiling", row.amount + " -> within ceiling", a.withinCeiling, row.amount <= CEILING);
    var ids = a.blockers.map(function (b) { return b.id; });
    if (row.blocked) {
      truthy("ceiling", row.amount + " -> blocker " + row.blocked, ids.indexOf(row.blocked) >= 0);
    } else {
      check("ceiling", row.amount + " -> no blockers", ids, []);
    }
  });

  /* Interest and costs are excluded from the measurement, so a principal at
     the ceiling stays a small claim however much interest has run. */
  var INTEREST_TABLE = [
    { principal: CEILING,     interest: 0,       forum: "SMALL_CLAIMS" },
    { principal: CEILING,     interest: 1,       forum: "SMALL_CLAIMS" },
    { principal: CEILING,     interest: 500000,  forum: "SMALL_CLAIMS" },
    { principal: CEILING - 1, interest: 999999,  forum: "SMALL_CLAIMS" },
    { principal: CEILING + 1, interest: 0,       forum: "SUMMARY_PROCEDURE" }
  ];
  INTEREST_TABLE.forEach(function (row) {
    var a = CLAIMS.assess(base({ principalPHP: row.principal, interestClaimedPHP: row.interest }), TODAY);
    check("interest excluded", row.principal + " + " + row.interest + " interest",
          a.forum.id, row.forum);
    check("interest excluded", row.principal + " + " + row.interest + " total claimed",
          a.totalClaimedPHP, row.principal + row.interest);
  });

  check("ceiling", "headroom below the ceiling",
        CLAIMS.assess(base({ principalPHP: 250000 }), TODAY).headroomPHP, CEILING - 250000);
  check("ceiling", "headroom is negative above the ceiling",
        CLAIMS.assess(base({ principalPHP: 1200000 }), TODAY).headroomPHP, CEILING - 1200000);

  /* ================================================================== *
   * 3. SAME CITY OR MUNICIPALITY vs DIFFERENT
   * ================================================================== */

  var LGU_TABLE = [
    { same: true,  adjoin: false, required: true,  status: "REQUIRED",     note: "same city, nothing else -> precondition" },
    { same: false, adjoin: false, required: false, status: "NOT_REQUIRED", note: "different cities -> outside any lupon" },
    { same: false, adjoin: true,  required: true,  status: "REQUIRED",     note: "adjoining barangays and both agree -> one lupon may take it" }
  ];

  LGU_TABLE.forEach(function (row) {
    var a = CLAIMS.assess(base({
      sameCityMunicipality: row.same,
      adjoiningBarangaysAndAgreed: row.adjoin,
      debtorCity: row.same ? "Lipa City" : "Tanauan City"
    }), TODAY);
    check("same municipality", row.note + " -> required", a.conciliation.required, row.required);
    check("same municipality", row.note + " -> status", a.conciliation.status, row.status);
  });

  var diff = CLAIMS.assess(base({ sameCityMunicipality: false, debtorCity: "Tanauan City" }), TODAY);
  check("same municipality", "different cities cites the opening clause of s.408",
        diff.conciliation.exceptions.map(function (e) { return e.id; }), ["DIFFERENT_CITY_OR_MUNICIPALITY"]);
  truthy("same municipality", "different cities cites s.408(f)",
         diff.conciliation.exceptions.some(function (e) { return /s\.408\(f\)/.test(e.cite); }));

  var adjoin = CLAIMS.assess(base({
    sameCityMunicipality: false, adjoiningBarangaysAndAgreed: true, debtorCity: "Tanauan City"
  }), TODAY);
  truthy("same municipality", "adjoining route is flagged as optional, not mandatory",
         adjoin.conciliation.optionalAcrossLGUs);
  truthy("same municipality", "adjoining route warns that it needs the debtor's agreement",
         adjoin.warnings.join(" ").indexOf("optional, not required") >= 0);

  /* The typed cities are cross-checked against the answer, but never override it. */
  var mismatch = CLAIMS.assess(base({ sameCityMunicipality: true, debtorCity: "Tanauan City" }), TODAY);
  truthy("same municipality", "typed cities contradicting the answer raise a warning",
         mismatch.warnings.join(" ").indexOf("the other way") >= 0);
  check("same municipality", "the answer still governs the rule", mismatch.conciliation.required, true);

  check("same municipality", "sameLGU ignores the 'City of' prefix", CLAIMS.sameLGU("City of Lipa", "Lipa"), true);
  check("same municipality", "sameLGU ignores a trailing 'City'", CLAIMS.sameLGU("Lipa City", "lipa"), true);
  check("same municipality", "sameLGU separates two real cities", CLAIMS.sameLGU("Lipa City", "Tanauan City"), false);
  check("same municipality", "sameLGU is undecided when a field is blank", CLAIMS.sameLGU("", "Lipa"), null);

  /* ================================================================== *
   * 4. EVERY STATUTORY EXCEPTION, one row per A.C. 14-93 item.
   *    Each civil row is fired on its own from the baseline; each
   *    criminal-only row is proved never to fire on a money claim.
   * ================================================================== */

  var EXCEPTION_TABLE = [
    { id: "GOVERNMENT_PARTY",               item: "A.C. 14-93 I.1",    civil: true,  facts: { governmentParty: true } },
    { id: "PUBLIC_OFFICER_FUNCTIONS",       item: "A.C. 14-93 I.2",    civil: true,  facts: { publicOfficerFunctions: true } },
    { id: "REAL_PROPERTY_DIFFERENT_LGU",    item: "A.C. 14-93 I.3",    civil: true,  facts: { realPropertyDifferentLGU: true } },
    { id: "JURIDICAL_ENTITY_PARTY",         item: "A.C. 14-93 I.4",    civil: true,  facts: { claimantType: "juridical" } },
    { id: "DIFFERENT_CITY_OR_MUNICIPALITY", item: "A.C. 14-93 I.5",    civil: true,  facts: { sameCityMunicipality: false } },
    { id: "OFFENSE_OVER_ONE_YEAR_OR_FINE",  item: "A.C. 14-93 I.6",    civil: false, facts: {} },
    { id: "OFFENSE_NO_PRIVATE_OFFENDED_PARTY", item: "A.C. 14-93 I.7", civil: false, facts: {} },
    { id: "ACCUSED_IN_CUSTODY",             item: "A.C. 14-93 I.8(a)", civil: false, facts: {} },
    { id: "HABEAS_CORPUS",                  item: "A.C. 14-93 I.8(b)", civil: false, facts: {} },
    { id: "PROVISIONAL_REMEDY",             item: "A.C. 14-93 I.8(c)", civil: true,  facts: { provisionalRemedy: true } },
    { id: "PRESCRIPTION_IMMINENT",          item: "A.C. 14-93 I.8(d)", civil: true,  facts: { prescriptionImminent: true } },
    { id: "PRESIDENTIALLY_EXCEPTED",        item: "A.C. 14-93 I.9",    civil: true,  facts: { presidentiallyExcepted: true } },
    { id: "AGRARIAN_CARL",                  item: "A.C. 14-93 I.10",   civil: true,  facts: { agrarianDispute: true } },
    { id: "LABOR_DISPUTE",                  item: "A.C. 14-93 I.11",   civil: true,  facts: { laborDispute: true } },
    { id: "ANNUL_COMPROMISE_JUDGMENT",      item: "A.C. 14-93 I.12",   civil: true,  facts: { annulCompromiseJudgment: true } }
  ];

  check("exceptions", "the table is the whole A.C. 14-93 part I list",
        CLAIMS.KP_EXCEPTIONS.length, EXCEPTION_TABLE.length);

  EXCEPTION_TABLE.forEach(function (row, i) {
    var inModule = CLAIMS.KP_EXCEPTIONS[i];
    check("exceptions", "row " + i + " id", inModule.id, row.id);
    check("exceptions", row.id + " item number", inModule.item, row.item);
    check("exceptions", row.id + " civil relevance", inModule.civil, row.civil);
    truthy("exceptions", row.id + " carries a citation", String(inModule.cite).length > 5);
    truthy("exceptions", row.id + " carries a plain-language label", String(inModule.label).length > 15);

    var a = CLAIMS.assess(base(row.facts), TODAY);
    var fired = a.conciliation.exceptions.map(function (e) { return e.id; });

    if (row.civil) {
      check("exceptions", row.id + " fires on its own fact", fired, [row.id]);
      check("exceptions", row.id + " -> conciliation not required", a.conciliation.required, false);
      check("exceptions", row.id + " -> status", a.conciliation.status, "NOT_REQUIRED");
      truthy("exceptions", row.id + " -> the pleading statement names it",
             CLAIMS.conciliationStatement(a).indexOf(inModule.label) >= 0);
      truthy("exceptions", row.id + " -> the statement cites the authority",
             CLAIMS.conciliationStatement(a).indexOf(inModule.cite) >= 0);
    } else {
      /* A criminal-only row must never fire on a civil money claim, whatever
         else is set. */
      falsy("exceptions", row.id + " never fires on a money claim", fired.indexOf(row.id) >= 0);
      check("exceptions", row.id + " test() is inert", inModule.test(CLAIMS.normalize(base())), false);
    }
  });

  /* The baseline fires nothing: that is why the gate closes on it. */
  check("exceptions", "baseline fires no exception",
        CLAIMS.assess(base(), TODAY).conciliation.exceptions, []);

  /* Several exceptions at once are all reported, not just the first. */
  var multi = CLAIMS.assess(base({ laborDispute: true, governmentParty: true, sameCityMunicipality: false }), TODAY);
  check("exceptions", "all applicable exceptions are listed",
        multi.conciliation.exceptions.map(function (e) { return e.id; }).sort(),
        ["DIFFERENT_CITY_OR_MUNICIPALITY", "GOVERNMENT_PARTY", "LABOR_DISPUTE"]);

  /* ================================================================== *
   * 5. PARTY TYPES — the sole-proprietorship trap
   * ================================================================== */

  var PARTY_TABLE = [
    { claimant: "individual",           debtor: "individual",           required: true,  why: null },
    { claimant: "sole_proprietorship",  debtor: "individual",           required: true,  why: null },
    { claimant: "individual",           debtor: "sole_proprietorship",  required: true,  why: null },
    { claimant: "sole_proprietorship",  debtor: "sole_proprietorship",  required: true,  why: null },
    { claimant: "juridical",            debtor: "individual",           required: false, why: "JURIDICAL_ENTITY_PARTY" },
    { claimant: "individual",           debtor: "juridical",            required: false, why: "JURIDICAL_ENTITY_PARTY" },
    { claimant: "juridical",            debtor: "juridical",            required: false, why: "JURIDICAL_ENTITY_PARTY" },
    { claimant: "sole_proprietorship",  debtor: "juridical",            required: false, why: "JURIDICAL_ENTITY_PARTY" }
  ];

  PARTY_TABLE.forEach(function (row) {
    var a = CLAIMS.assess(base({ claimantType: row.claimant, debtorType: row.debtor }), TODAY);
    var name = row.claimant + " v " + row.debtor;
    check("party types", name + " -> required", a.conciliation.required, row.required);
    if (row.why) {
      truthy("party types", name + " -> " + row.why,
             a.conciliation.exceptions.some(function (e) { return e.id === row.why; }));
    }
  });

  falsy("party types", "a sole proprietorship is not a juridical entity",
        CLAIMS.partyType("sole_proprietorship").juridical);
  truthy("party types", "a corporation is a juridical entity", CLAIMS.partyType("juridical").juridical);
  falsy("party types", "an individual is not a juridical entity", CLAIMS.partyType("individual").juridical);
  check("party types", "an unknown type falls back to individual", CLAIMS.partyType("zzz").id, "individual");

  truthy("party types", "the sole-proprietorship trap is spelled out in a warning",
         CLAIMS.assess(base({ claimantType: "sole_proprietorship" }), TODAY)
           .warnings.join(" ").indexOf("not a separate person") >= 0);
  truthy("party types", "a company claimant must attach a board resolution",
         CLAIMS.assess(base({ claimantType: "juridical" }), TODAY).attachments
           .some(function (at) { return at.id === "BOARD_RESOLUTION" && at.status === "required"; }));
  check("party types", "an individual claimant needs no board resolution",
        CLAIMS.assess(base(), TODAY).attachments
          .filter(function (at) { return at.id === "BOARD_RESOLUTION"; })[0].status, "not needed");

  /* ================================================================== *
   * 6. WHERE THE USER ALREADY IS
   * ================================================================== */

  var PROGRESS_TABLE = [
    { facts: {},                                                    status: "REQUIRED",            required: true },
    { facts: { hasCertificateToFileAction: true },                  status: "SATISFIED",           required: false },
    { facts: { settlementRepudiated: true },                        status: "SATISFIED",           required: false },
    { facts: { sameIndigenousCommunity: true },                     status: "REQUIRED_INDIGENOUS", required: true },
    { facts: { sameIndigenousCommunity: true,
               hasCertificateToFileAction: true },                  status: "SATISFIED",           required: false },
    { facts: { basis: "settlement" },                               status: "ALREADY_CONCILIATED", required: false },
    { facts: { laborDispute: true, hasCertificateToFileAction: true }, status: "NOT_REQUIRED",     required: false }
  ];

  PROGRESS_TABLE.forEach(function (row) {
    var a = CLAIMS.assess(base(row.facts), TODAY);
    var name = JSON.stringify(row.facts);
    check("progress", name + " -> status", a.conciliation.status, row.status);
    check("progress", name + " -> required", a.conciliation.required, row.required);
    check("progress", name + " -> satisfied",
          a.conciliation.satisfied, row.status === "SATISFIED" || row.status === "ALREADY_CONCILIATED");
  });

  truthy("progress", "indigenous track cites s.412(c)",
         /412\(c\)/.test(CLAIMS.assess(base({ sameIndigenousCommunity: true }), TODAY).conciliation.cite));

  /* Enforcing a barangay settlement: the lupon has six months of its own. */
  var enf0 = CLAIMS.assess(base({ basis: "settlement" }), TODAY);
  check("progress", "settlement still within the lupon's six months -> lupon executes",
        enf0.forum.id, "LUPON_EXECUTION");
  truthy("progress", "and the reason cites s.417",
         enf0.blockers.some(function (b) { return /s\.417/.test(b.cite); }));

  var enf1 = CLAIMS.assess(base({ basis: "settlement", settlementUnexecutedSixMonths: true }), TODAY);
  check("progress", "unexecuted after six months, within ceiling -> small claims", enf1.forum.id, "SMALL_CLAIMS");
  check("progress", "unexecuted after six months, over ceiling -> summary procedure",
        CLAIMS.assess(base({ basis: "settlement", settlementUnexecutedSixMonths: true, principalPHP: 1500000 }), TODAY).forum.id,
        "SUMMARY_PROCEDURE");

  /* ================================================================== *
   * 7. WHAT KEEPS A CASE OUT OF SMALL CLAIMS even under the ceiling
   * ================================================================== */

  var BLOCKER_TABLE = [
    { facts: { moneyOnly: false },        blocker: "RELIEF_BEYOND_MONEY",            forum: "SUMMARY_PROCEDURE" },
    { facts: { provisionalRemedy: true }, blocker: "COUPLED_WITH_PROVISIONAL_REMEDY", forum: "SUMMARY_PROCEDURE" },
    { facts: { principalPHP: 0 },         blocker: "NO_AMOUNT",                      forum: "UNDETERMINED" },
    { facts: { principalPHP: "" },        blocker: "NO_AMOUNT",                      forum: "UNDETERMINED" },
    { facts: { moneyOnly: false, principalPHP: 3000000 }, blocker: "RELIEF_BEYOND_MONEY", forum: "REGULAR" }
  ];

  BLOCKER_TABLE.forEach(function (row) {
    var a = CLAIMS.assess(base(row.facts), TODAY);
    var name = JSON.stringify(row.facts);
    truthy("blockers", name + " -> " + row.blocker,
           a.blockers.some(function (b) { return b.id === row.blocker; }));
    check("blockers", name + " -> forum", a.forum.id, row.forum);
  });

  /* A provisional remedy both excepts the case from conciliation and
     excludes it from small claims. Both must show. */
  var pr = CLAIMS.assess(base({ provisionalRemedy: true }), TODAY);
  check("blockers", "provisional remedy -> conciliation not required", pr.conciliation.required, false);
  check("blockers", "provisional remedy -> not a small claim", pr.forum.id, "SUMMARY_PROCEDURE");

  /* ================================================================== *
   * 8. THE LAWYER BAR
   * ================================================================== */

  check("lawyers", "small claims bars attorneys",
        CLAIMS.assess(base(), TODAY).forum.lawyersBarred, true);
  check("lawyers", "summary procedure does not",
        CLAIMS.assess(base({ principalPHP: 1500000 }), TODAY).forum.lawyersBarred, false);
  check("lawyers", "the regular rules do not",
        CLAIMS.assess(base({ principalPHP: 3000000 }), TODAY).forum.lawyersBarred, false);
  check("lawyers", "a blank amount asserts nothing about lawyers",
        CLAIMS.assess(base({ principalPHP: 0 }), TODAY).forum.lawyersBarred, null);
  falsy("lawyers", "and no lawyer warning is shown on a blank form",
        CLAIMS.assess(base({ principalPHP: 0 }), TODAY).warnings.join(" ").indexOf("No lawyer may appear") >= 0);
  falsy("lawyers", "nor is a court track named on a blank form",
        CLAIMS.assess(base({ principalPHP: 0 }), TODAY).steps.some(function (s) { return /^File under/.test(s.title); }));
  truthy("lawyers", "the bar is stated as a warning on a small claim",
         CLAIMS.assess(base(), TODAY).warnings.join(" ").indexOf("No lawyer may appear") >= 0);
  truthy("lawyers", "the barangay stage says parties appear in person",
         CLAIMS.assess(base(), TODAY).steps.some(function (s) { return /s\.415/.test(s.cite); }));

  /* ================================================================== *
   * 9. PRESCRIPTION
   * ================================================================== */

  var PRESCRIPTION_TABLE = [
    { written: true,  due: "2026-03-15", years: 10, deadline: "2036-03-15", expired: false },
    { written: false, due: "2026-03-15", years: 6,  deadline: "2032-03-15", expired: false },
    { written: true,  due: "2016-01-01", years: 10, deadline: "2026-01-01", expired: true },
    { written: false, due: "2019-01-01", years: 6,  deadline: "2025-01-01", expired: true },
    { written: true,  due: "2016-11-24", years: 10, deadline: "2026-11-24", expired: false },
    { written: true,  due: "2016-11-23", years: 10, deadline: "2026-11-23", expired: true },
    { written: true,  due: "",           years: 10, deadline: null,         expired: false }
  ];

  PRESCRIPTION_TABLE.forEach(function (row) {
    var a = CLAIMS.assess(base({ writtenContract: row.written, dueDate: row.due }), TODAY);
    var name = (row.written ? "written" : "oral") + " due " + (row.due || "(blank)");
    check("prescription", name + " -> years", a.prescription.years, row.years);
    check("prescription", name + " -> deadline", a.prescription.deadline, row.deadline);
    check("prescription", name + " -> expired", a.prescription.expired, row.expired);
  });

  truthy("prescription", "an expired claim is warned about loudly",
         CLAIMS.assess(base({ dueDate: "2010-01-01" }), TODAY).warnings.join(" ").indexOf("already run") >= 0);
  truthy("prescription", "a claim with under a year left is warned about",
         CLAIMS.assess(base({ dueDate: "2017-01-01" }), TODAY).warnings.join(" ").indexOf("days are left") >= 0);
  falsy("prescription", "a fresh claim is not warned about",
        CLAIMS.assess(base({ dueDate: "2026-03-15" }), TODAY).warnings.join(" ").indexOf("days are left") >= 0);

  /* Leap-day arithmetic must not drift. */
  check("prescription", "29 Feb plus 10 years clamps to 28 Feb", CLAIMS.addYears("2016-02-29", 10), "2026-02-28");
  check("prescription", "29 Feb plus 4 years stays 29 Feb", CLAIMS.addYears("2016-02-29", 4), "2020-02-29");
  check("prescription", "a malformed date yields null", CLAIMS.addYears("15/03/2026", 10), null);
  check("prescription", "31 February is rejected", CLAIMS.addYears("2026-02-31", 1), null);
  check("prescription", "days between two dates", CLAIMS.daysBetween("2026-11-24", "2026-12-24"), 30);
  check("prescription", "days between is signed", CLAIMS.daysBetween("2026-12-24", "2026-11-24"), -30);

  /* ================================================================== *
   * 10. NUMBER AND MONEY HYGIENE — never NaN, never Infinity, never negative
   * ================================================================== */

  var JUNK = ["", null, undefined, "abc", NaN, Infinity, -Infinity, -5, "1,234.56", "  250000  "];
  JUNK.forEach(function (v) {
    var f = CLAIMS.normalize({ principalPHP: v, interestClaimedPHP: v, smallClaimsFiledThisYear: v, demandDays: v });
    truthy("hygiene", "principal from " + JSON.stringify(String(v)) + " is a finite number >= 0",
           isFinite(f.principalPHP) && f.principalPHP >= 0);
    truthy("hygiene", "interest from " + JSON.stringify(String(v)) + " is a finite number >= 0",
           isFinite(f.interestClaimedPHP) && f.interestClaimedPHP >= 0);
    truthy("hygiene", "claim count from " + JSON.stringify(String(v)) + " is a whole number >= 0",
           isFinite(f.smallClaimsFiledThisYear) && f.smallClaimsFiledThisYear >= 0 &&
           f.smallClaimsFiledThisYear === Math.round(f.smallClaimsFiledThisYear));
    truthy("hygiene", "demand days from " + JSON.stringify(String(v)) + " is at least 1", f.demandDays >= 1);
  });

  check("hygiene", "a comma-grouped amount parses", CLAIMS.normalize({ principalPHP: "1,234.56" }).principalPHP, 1234.56);
  check("hygiene", "a negative amount clamps to zero", CLAIMS.normalize({ principalPHP: -900 }).principalPHP, 0);

  var MONEY_TABLE = [
    [0, "PHP 0.00"], [1, "PHP 1.00"], [0.5, "PHP 0.50"], [0.005, "PHP 0.01"],
    [999, "PHP 999.00"], [1000, "PHP 1,000.00"], [1234.56, "PHP 1,234.56"],
    [250000, "PHP 250,000.00"], [CEILING, "PHP 1,000,000.00"],
    [SUMMARY_CEILING, "PHP 2,000,000.00"], [12345678.9, "PHP 12,345,678.90"],
    [1.999, "PHP 2.00"]
  ];
  MONEY_TABLE.forEach(function (row) {
    check("money", "pesos(" + row[0] + ")", CLAIMS.pesos(row[0]), row[1]);
  });
  check("money", "pesos never prints NaN", CLAIMS.pesos(NaN), "PHP 0.00");
  check("money", "pesos never prints Infinity", CLAIMS.pesos(Infinity), "PHP 0.00");

  check("dates", "long date", CLAIMS.longDate("2026-03-15"), "March 15, 2026");
  check("dates", "long date passes through unparseable input", CLAIMS.longDate("soon"), "soon");

  /* No assessment, on any fact pattern in these tables, may leak NaN. */
  var ALL_FACTS = [{}].concat(
    EXCEPTION_TABLE.map(function (r) { return r.facts; }),
    PROGRESS_TABLE.map(function (r) { return r.facts; }),
    BLOCKER_TABLE.map(function (r) { return r.facts; }),
    CEILING_TABLE.map(function (r) { return { principalPHP: r.amount }; })
  );
  ALL_FACTS.forEach(function (facts, i) {
    var a = CLAIMS.assess(base(facts), TODAY);
    var blob = JSON.stringify(a) + CLAIMS.demandLetter(a) + CLAIMS.statementOfClaim(a) +
               CLAIMS.barangayComplaint(a) + CLAIMS.conciliationStatement(a);
    falsy("hygiene", "fact set " + i + " renders no NaN", blob.indexOf("NaN") >= 0);
    falsy("hygiene", "fact set " + i + " renders no Infinity", blob.indexOf("Infinity") >= 0);
    falsy("hygiene", "fact set " + i + " renders no undefined", blob.indexOf("undefined") >= 0);
  });

  /* Empty facts must still produce usable blanks rather than breaking. */
  var blank = CLAIMS.assess({}, TODAY);
  truthy("hygiene", "an empty form still yields a demand letter", CLAIMS.demandLetter(blank).length > 200);
  truthy("hygiene", "an empty form still yields a claim sheet", CLAIMS.statementOfClaim(blank).length > 500);
  truthy("hygiene", "blanks are rendered as fill-in rules", CLAIMS.demandLetter(blank).indexOf("____") >= 0);

  /* ================================================================== *
   * 11. THE DOCUMENTS
   * ================================================================== */

  var full = CLAIMS.assess(base({ interestClaimedPHP: 18750 }), TODAY);
  var letter = CLAIMS.demandLetter(full);

  truthy("demand letter", "names the debtor", letter.indexOf("Mario Tolentino") >= 0);
  truthy("demand letter", "names the creditor", letter.indexOf("Rosario Hardware") >= 0);
  truthy("demand letter", "states the principal", letter.indexOf("PHP 250,000.00") >= 0);
  truthy("demand letter", "states the interest separately", letter.indexOf("PHP 18,750.00") >= 0);
  truthy("demand letter", "states the total", letter.indexOf("PHP 268,750.00") >= 0);
  truthy("demand letter", "carries the reference", letter.indexOf("Invoice RH-2026-0412") >= 0);
  truthy("demand letter", "states the due date in words", letter.indexOf("March 15, 2026") >= 0);
  truthy("demand letter", "gives a deadline to pay", /within 15 days/.test(letter));
  truthy("demand letter", "invokes Art. 1169 so delay runs", letter.indexOf("Article 1169") >= 0);
  truthy("demand letter", "warns of the barangay as the next step", letter.indexOf("Lupong Tagapamayapa") >= 0);
  truthy("demand letter", "is signed by the proprietor", letter.indexOf("Proprietor") >= 0);
  check("demand letter", "a custom period is honoured",
        /within 7 days/.test(CLAIMS.demandLetter(CLAIMS.assess(base({ demandDays: 7 }), TODAY))), true);

  /* The letter's threatened next step must match the assessed path. */
  var letterCorp = CLAIMS.demandLetter(CLAIMS.assess(base({ debtorType: "juridical" }), TODAY));
  falsy("demand letter", "no barangay threat when conciliation does not apply",
        letterCorp.indexOf("Lupong Tagapamayapa") >= 0);
  truthy("demand letter", "small claims named instead", letterCorp.indexOf("A.M. No. 08-8-7-SC") >= 0);
  truthy("demand letter", "a big claim threatens the right court",
         CLAIMS.demandLetter(CLAIMS.assess(base({ principalPHP: 3000000, debtorType: "juridical" }), TODAY))
           .indexOf("Regional Trial Court") >= 0);

  var complaint = CLAIMS.barangayComplaint(full);
  truthy("barangay complaint", "addressed to the Punong Barangay", complaint.indexOf("TO THE PUNONG BARANGAY") >= 0);
  truthy("barangay complaint", "venue is the respondent's barangay", complaint.indexOf("Barangay Sabang") >= 0);
  truthy("barangay complaint", "cites s.409(b) for venue", complaint.indexOf("Section 409(b)") >= 0);
  truthy("barangay complaint", "cites the Katarungang Pambarangay chapter",
         complaint.indexOf("Sections 399 to 422") >= 0);
  truthy("barangay complaint", "warns that the parties appear in person",
         complaint.indexOf("Section 415") >= 0 && complaint.indexOf("IN PERSON") >= 0);
  falsy("barangay complaint", "no stray section placeholder leaks", complaint.indexOf("Section s.409") >= 0);

  /* Venue switches to s.409(a) when both are in one barangay. */
  truthy("barangay complaint", "s.409(a) when both parties share a barangay",
         CLAIMS.barangayComplaint(CLAIMS.assess(base({ claimantBarangay: "Sabang" }), TODAY))
           .indexOf("Section 409(a)") >= 0);

  var claim = CLAIMS.statementOfClaim(full);
  truthy("claim sheet", "names Form 1-SCC", claim.indexOf("FORM 1-SCC") >= 0);
  truthy("claim sheet", "says it is not itself a court form", claim.indexOf("not a court form") >= 0);
  truthy("claim sheet", "separates the principal from the interest",
         claim.indexOf("exclusive of interest and costs") >= 0 && claim.indexOf("pleaded separately") >= 0);
  truthy("claim sheet", "carries the Rule IV, s.4 lending declaration",
         claim.indexOf("DECLARATION REQUIRED BY RULE IV, SECTION 4") >= 0);
  truthy("claim sheet", "carries the conciliation statement", claim.indexOf("BARANGAY CONCILIATION") >= 0);
  truthy("claim sheet", "flags the certification against splitting",
         claim.indexOf("split this single cause of action") >= 0);
  truthy("claim sheet", "lists the attachments as a checklist", claim.indexOf("[ ]  Form 1-SCC") >= 0);
  truthy("claim sheet", "warns that omitted evidence is shut out", claim.indexOf("Nothing you leave out") >= 0);
  falsy("claim sheet", "does not list attachments marked not needed",
        claim.indexOf("Board resolution or secretary's certificate") >= 0);
  truthy("claim sheet", "a company claimant's board resolution IS listed",
         CLAIMS.statementOfClaim(CLAIMS.assess(base({ claimantType: "juridical" }), TODAY))
           .indexOf("Board resolution or secretary's certificate") >= 0);

  /* When conciliation is still owed, the claim sheet must not pretend otherwise. */
  var owed = CLAIMS.statementOfClaim(CLAIMS.assess(base(), TODAY));
  truthy("claim sheet", "says the certification is not yet available",
         owed.indexOf("NOT YET AVAILABLE") >= 0);
  truthy("claim sheet", "and the checklist still demands the certification",
         CLAIMS.assess(base(), TODAY).attachments.some(function (at) {
           return at.id === "CERTIFICATE_TO_FILE_ACTION" && at.status === "required";
         }));

  var satisfiedStatement = CLAIMS.conciliationStatement(
    CLAIMS.assess(base({ hasCertificateToFileAction: true, certificateNumber: "2026-118" }), TODAY));
  truthy("statement", "compliance statement cites s.412(a)", satisfiedStatement.indexOf("Section 412(a)") >= 0);
  truthy("statement", "and carries the certification number", satisfiedStatement.indexOf("2026-118") >= 0);

  var repudiated = CLAIMS.conciliationStatement(CLAIMS.assess(base({ settlementRepudiated: true }), TODAY));
  truthy("statement", "repudiation statement cites s.418", repudiated.indexOf("Section 418") >= 0);

  /* ================================================================== *
   * 12. THE INVARIANT: this tool writes text and nothing else.
   * ================================================================== */

  check("never transmits", "assess reports that nothing is transmitted",
        CLAIMS.assess(base(), TODAY).transmits, false);

  var SOURCE = (typeof require === "function")
    ? require("fs").readFileSync(require("path").join(__dirname, "..", "assets", "rules.js"), "utf8")
    : null;

  if (SOURCE !== null) {
    [
      ["fetch(", /\bfetch\s*\(/],
      ["XMLHttpRequest", /XMLHttpRequest/],
      ["eval(", /\beval\s*\(/],
      ["new Function", /new\s+Function/],
      ["importScripts", /importScripts/],
      ["sendBeacon", /sendBeacon/],
      ["WebSocket", /WebSocket/],
      ["localStorage", /localStorage/],
      ["document.", /\bdocument\s*\./],
      ["window.", /\bwindow\s*\./]
    ].forEach(function (row) {
      falsy("never transmits", "rules.js contains no " + row[0], row[1].test(SOURCE));
    });
  }

  /* No generated document may tell the user the tool did the filing. */
  var ALL_DOCS = [
    CLAIMS.demandLetter(full), CLAIMS.barangayComplaint(full),
    CLAIMS.statementOfClaim(full), CLAIMS.conciliationStatement(full)
  ].join("\n");
  [/\bwe have (?:sent|filed)\b/i, /\bhas been (?:sent|filed) (?:for you|on your behalf)\b/i,
   /\bautomatically (?:sent|filed|served)\b/i].forEach(function (re, i) {
    falsy("never transmits", "no document claims to have sent or filed anything (" + i + ")", re.test(ALL_DOCS));
  });

  /* ================================================================== *
   * 13. ATTACHMENTS CHECKLIST
   * ================================================================== */

  var ATTACH_IDS = ["FORM_1_SCC", "FORM_1_A_SCC", "ACTIONABLE_DOCUMENTS", "AFFIDAVITS",
                    "DEMAND_LETTER_PROOF", "CERTIFICATE_TO_FILE_ACTION", "BOARD_RESOLUTION",
                    "FORM_7_SCC", "COPIES_FOR_DEFENDANTS", "LENDING_DECLARATION", "FEES",
                    "FORM_1_B_SCC"];
  var baseAttach = CLAIMS.assess(base(), TODAY).attachments;
  check("attachments", "every expected row is present",
        baseAttach.map(function (a) { return a.id; }), ATTACH_IDS);
  baseAttach.forEach(function (at) {
    truthy("attachments", at.id + " carries a citation", String(at.cite).length > 5);
    truthy("attachments", at.id + " has a known status",
           ["required", "if applicable", "not needed"].indexOf(at.status) >= 0);
  });

  check("attachments", "non-small-claims drops Form 1-SCC",
        CLAIMS.assess(base({ principalPHP: 1500000 }), TODAY).attachments
          .filter(function (a) { return a.id === "FORM_1_SCC"; })[0].status, "not needed");
  check("attachments", "a representative makes the SPA required",
        CLAIMS.assess(base({ appearingByRepresentative: true }), TODAY).attachments
          .filter(function (a) { return a.id === "FORM_7_SCC"; })[0].status, "required");
  check("attachments", "extra parties make Form 1-A-SCC required",
        CLAIMS.assess(base({ extraParties: true }), TODAY).attachments
          .filter(function (a) { return a.id === "FORM_1_A_SCC"; })[0].status, "required");
  truthy("attachments", "an exception replaces the certification with a statement row",
         CLAIMS.assess(base({ laborDispute: true }), TODAY).attachments
           .some(function (a) { return a.id === "CONCILIATION_STATEMENT"; }));
  truthy("attachments", "a sixth claim in the year surcharges the fees row",
         CLAIMS.assess(base({ smallClaimsFiledThisYear: 6 }), TODAY).attachments
           .filter(function (a) { return a.id === "FEES"; })[0].label.indexOf("PHP 500.00") >= 0);

  /* ================================================================== *
   * 14. STEPS — order and citations
   * ================================================================== */

  var reqSteps = CLAIMS.assess(base(), TODAY).steps;
  check("steps", "the demand comes first", reqSteps[0].title.indexOf("demand letter") >= 0, true);
  check("steps", "the barangay comes second", reqSteps[1].title.indexOf("Punong Barangay") >= 0, true);
  truthy("steps", "the certification step warns about a premature one",
         reqSteps.join ? reqSteps.some(function (s) { return /premature/.test(s.detail); }) : false);
  truthy("steps", "court filing is last among the barangay steps",
         reqSteps.some(function (s) { return /only then, file in court/i.test(s.title); }));
  reqSteps.forEach(function (s, i) {
    truthy("steps", "step " + i + " carries a citation", String(s.cite).length > 3);
    truthy("steps", "step " + i + " explains itself", String(s.detail).length > 40);
  });

  var exemptSteps = CLAIMS.assess(base({ debtorType: "juridical" }), TODAY).steps;
  falsy("steps", "no barangay step when the gate is open",
        exemptSteps.some(function (s) { return /Punong Barangay/.test(s.title); }));
  truthy("steps", "instead the exception must be pleaded",
         exemptSteps.some(function (s) { return /exception in writing/.test(s.title); }));
  truthy("steps", "the 24-hour decision is explained",
         exemptSteps.some(function (s) { return /24 hours/.test(s.title) || /24\s*hours/.test(s.detail); }));
  truthy("steps", "a defendant outside the judicial region gets the 60-day hearing window",
         CLAIMS.assess(base({ debtorType: "juridical", defendantOutsideJudicialRegion: true }), TODAY)
           .steps.some(function (s) { return /60 calendar days/.test(s.detail); }));

  /* ================================================================== *
   * 15. PURITY — assess() must not mutate its input, and must be stable
   * ================================================================== */

  var input = base();
  var before = JSON.stringify(input);
  var r1 = CLAIMS.assess(input, TODAY);
  var r2 = CLAIMS.assess(input, TODAY);
  check("purity", "the input object is untouched", JSON.stringify(input), before);
  check("purity", "two runs on the same facts agree", JSON.stringify(r1), JSON.stringify(r2));
  check("purity", "defaults() hands back a fresh object each time",
        CLAIMS.defaults() === CLAIMS.defaults(), false);
  var d = CLAIMS.defaults();
  d.principalPHP = 999;
  check("purity", "mutating one defaults() copy does not affect the next", CLAIMS.defaults().principalPHP, 0);
  check("purity", "unknown keys in the input are ignored",
        CLAIMS.normalize({ nonsense: 1 }).nonsense, undefined);

  /* ================================================================== *
   * REPORT
   * ================================================================== */

  var fails = results.filter(function (r) { return !r.pass; });
  var groups = [];
  results.forEach(function (r) { if (groups.indexOf(r.group) < 0) { groups.push(r.group); } });

  if (typeof document !== "undefined") {
    var sum = document.getElementById("summary");
    var tbody = document.getElementById("rows");
    if (sum) {
      sum.textContent = fails.length
        ? fails.length + " failing of " + results.length + " assertions"
        : "All " + results.length + " assertions pass";
    }
    if (tbody) {
      groups.forEach(function (g) {
        var inG = results.filter(function (r) { return r.group === g; });
        var badG = inG.filter(function (r) { return !r.pass; });
        var tr = document.createElement("tr");
        var td1 = document.createElement("td");
        td1.textContent = g;
        var td2 = document.createElement("td");
        td2.className = "num";
        td2.textContent = String(inG.length);
        var td3 = document.createElement("td");
        td3.className = "num" + (badG.length ? " neg" : "");
        td3.textContent = badG.length ? badG.length + " FAIL" : "ok";
        tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
        tbody.appendChild(tr);
      });
      fails.slice(0, 40).forEach(function (r) {
        var tr = document.createElement("tr");
        var td = document.createElement("td");
        td.colSpan = 3;
        td.className = "neg";
        td.textContent = r.group + " / " + r.name + " — got " + r.got + ", want " + r.want;
        tr.appendChild(td);
        tbody.appendChild(tr);
      });
    }
  } else {
    groups.forEach(function (g) {
      var inG = results.filter(function (r) { return r.group === g; });
      var badG = inG.filter(function (r) { return !r.pass; });
      var line = (badG.length ? "FAIL " : "ok   ") + g + " (" + inG.length + ")";
      if (badG.length) { line += " — " + badG.length + " failing"; }
      console.log(line);
    });
    fails.forEach(function (r) {
      console.log("  FAIL " + r.group + " / " + r.name + "\n    got  " + r.got + "\n    want " + r.want);
    });
    console.log("\n" + results.length + " assertions, " + fails.length + " failing");
    if (typeof process !== "undefined") { process.exitCode = fails.length ? 1 : 0; }
  }
})();
