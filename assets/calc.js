/*
 * Wiring only. Every rule, figure and document template lives in rules.js,
 * which is pure and separately tested (node tests/rules.test.js).
 *
 * This file reads the form, hands the facts to CLAIMS.assess(), and paints the
 * answer. It makes no network request, stores nothing, and cannot send or file
 * anything on the user's behalf.
 */
(function () {
  "use strict";

  var R = window.CLAIMS;
  if (!R) { return; }

  var PESO = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function money(n) {
    var v = typeof n === "number" ? n : parseFloat(n);
    if (!isFinite(v)) { v = 0; }
    return PESO.format(v);
  }

  function el(id) { return document.getElementById(id); }

  function clear(node) {
    while (node && node.firstChild) { node.removeChild(node.firstChild); }
  }

  function todayISO() {
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  /* ---- the form ------------------------------------------------------ */

  var TEXT_FIELDS = [
    "claimantName", "claimantAddress", "claimantBarangay", "claimantCity",
    "debtorName", "debtorAddress", "debtorBarangay", "debtorCity",
    "reference", "dueDate", "letterDate", "certificateNumber"
  ];
  var NUMBER_FIELDS = ["principalPHP", "interestClaimedPHP", "demandDays", "smallClaimsFiledThisYear"];
  var SELECT_FIELDS = ["claimantType", "debtorType", "basis"];

  var segs = [].slice.call(document.querySelectorAll(".seg[data-flag]"));

  function segValue(seg) {
    var pressed = seg.querySelector('button[aria-pressed="true"]');
    return pressed ? pressed.getAttribute("data-val") === "yes" : false;
  }

  function setSeg(seg, yes) {
    [].slice.call(seg.querySelectorAll("button")).forEach(function (b) {
      b.setAttribute("aria-pressed", (b.getAttribute("data-val") === "yes") === yes ? "true" : "false");
    });
  }

  function readFacts() {
    var f = {};
    TEXT_FIELDS.forEach(function (id) { var n = el(id); if (n) { f[id] = n.value; } });
    NUMBER_FIELDS.forEach(function (id) { var n = el(id); if (n) { f[id] = n.value; } });
    SELECT_FIELDS.forEach(function (id) { var n = el(id); if (n) { f[id] = n.value; } });
    segs.forEach(function (seg) { f[seg.getAttribute("data-flag")] = segValue(seg); });
    return f;
  }

  /* ---- small painters ------------------------------------------------ */

  function row(tbody, label, value, opts) {
    var tr = document.createElement("tr");
    if (opts && opts.cls) { tr.className = opts.cls; }
    var th = document.createElement("td");
    th.textContent = label;
    var td = document.createElement("td");
    td.className = "num";
    td.textContent = value;
    if (opts && opts.neg) { td.className = "num neg"; }
    tr.appendChild(th);
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function note(container, body, strong) {
    var d = document.createElement("div");
    d.className = "note";
    if (strong) {
      var b = document.createElement("strong");
      b.textContent = strong + " ";
      d.appendChild(b);
    }
    d.appendChild(document.createTextNode(body));
    container.appendChild(d);
  }

  /* ---- render -------------------------------------------------------- */

  function render() {
    var facts = readFacts();
    var a = R.assess(facts, todayISO());
    var c = a.conciliation;

    /* conditional fields: only ask what the answers make relevant */
    var adjoining = el("wrap-adjoining");
    if (adjoining) { adjoining.hidden = a.facts.sameCityMunicipality === true; }
    var unexecuted = el("wrap-unexecuted");
    if (unexecuted) { unexecuted.hidden = a.facts.basis !== "settlement"; }
    var certno = el("wrap-certno");
    if (certno) { certno.hidden = a.facts.hasCertificateToFileAction !== true; }

    var ctn = el("claimantTypeNote");
    if (ctn) { ctn.textContent = R.partyType(a.facts.claimantType).note; }
    var dtn = el("debtorTypeNote");
    if (dtn) { dtn.textContent = R.partyType(a.facts.debtorType).note; }

    /* the verdict */
    el("verdict-v").textContent = c.required ? c.headline : a.forum.headline;
    el("verdict-sub").textContent = c.summary;
    el("verdict-k").textContent = c.required
      ? "Do this before you file anything"
      : "Next step on your facts";

    /* the breakdown */
    var rows = el("gate-rows");
    clear(rows);

    var gateWord = c.required ? "Required first"
      : (c.status === "SATISFIED" ? "Satisfied"
      : (c.status === "ALREADY_CONCILIATED" ? "Already done" : "Not required"));
    row(rows, "Barangay conciliation", gateWord, { neg: c.required });
    row(rows, "Authority", c.cite);

    if (c.exceptions.length) {
      c.exceptions.forEach(function (e) {
        row(rows, "Exception", e.item, { cls: "sub" });
      });
    }
    if (c.required) {
      row(rows, "File the barangay complaint in",
          "Barangay " + (c.venueBarangay || "—") + (c.venueCity ? ", " + c.venueCity : ""), { cls: "sub" });
    }

    row(rows, "Claim, exclusive of interest and costs", money(a.facts.principalPHP));
    if (a.facts.interestClaimedPHP > 0) {
      row(rows, "Interest claimed on top, not counted", money(a.facts.interestClaimedPHP), { cls: "sub" });
    }
    row(rows, "Small claims ceiling (" + a.ceiling.issuance + ")", money(a.ceiling.amountPHP), { cls: "sub" });
    row(rows, a.headroomPHP >= 0 ? "Room left under the ceiling" : "Over the ceiling by",
        money(Math.abs(a.headroomPHP)), { cls: "total", neg: a.headroomPHP < 0 });

    row(rows, "Court track", a.forum.label);
    row(rows, "Lawyers at the hearing",
        a.forum.lawyersBarred === null ? "—" : (a.forum.lawyersBarred ? "Not allowed" : "Allowed"));
    if (a.prescription.deadline) {
      row(rows, "Claim prescribes on", R.longDate(a.prescription.deadline),
          { neg: a.prescription.expired });
    }

    /* blockers and warnings */
    var flags = el("flags");
    clear(flags);
    a.blockers.forEach(function (b) {
      note(flags, b.label + " (" + b.cite + ")", "Out of small claims:");
    });
    if (c.required) {
      note(flags, c.riskIfSkipped, "If you skip the barangay:");
    }
    a.warnings.forEach(function (w) { note(flags, w); });

    /* the ordered steps */
    var steps = el("steps");
    clear(steps);
    a.steps.forEach(function (s) {
      var li = document.createElement("li");
      var b = document.createElement("b");
      b.textContent = s.title;
      li.appendChild(b);
      li.appendChild(document.createTextNode(" — " + s.detail + " "));
      var pill = document.createElement("span");
      pill.className = "pill reg";
      pill.textContent = s.cite;
      li.appendChild(pill);
      steps.appendChild(li);
    });

    /* the documents */
    el("doc-demand").textContent = R.demandLetter(a);

    var bh = el("barangay-h"), bhint = el("barangay-hint"), bdoc = el("doc-barangay");
    if (c.required) {
      bh.textContent = "2 · Barangay complaint";
      bhint.textContent = "File this with the Punong Barangay yourself, in person, and pay the barangay filing fee. "
        + "You must appear in person at every session, with no lawyer and no representative.";
      bdoc.textContent = R.barangayComplaint(a);
    } else {
      bh.textContent = "2 · Statement on barangay conciliation";
      bhint.textContent = "No barangay complaint is needed on these facts. This is the paragraph your court "
        + "filing must carry instead, so the absence of a Certification to File Action is explained on the face of the pleading.";
      bdoc.textContent = R.conciliationStatement(a);
    }

    el("doc-claim").textContent = R.statementOfClaim(a);

    /* the attachments checklist */
    var at = el("attach-rows");
    clear(at);
    a.attachments.forEach(function (x) {
      if (x.status === R.STATUS.NOT_NEEDED) { return; }
      var tr = document.createElement("tr");
      if (x.status === R.STATUS.IF_APPLICABLE) { tr.className = "sub"; }
      var td1 = document.createElement("td");
      td1.textContent = x.label + " (" + x.cite + ")";
      var td2 = document.createElement("td");
      td2.className = "num";
      td2.textContent = x.status;
      tr.appendChild(td1);
      tr.appendChild(td2);
      at.appendChild(tr);
    });
  }

  /* ---- events -------------------------------------------------------- */

  document.addEventListener("input", render);
  document.addEventListener("change", render);

  segs.forEach(function (seg) {
    seg.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button[data-val]") : null;
      if (!b || !seg.contains(b)) { return; }
      setSeg(seg, b.getAttribute("data-val") === "yes");
      render();
    });
  });

  var printBtn = el("print");
  if (printBtn) {
    printBtn.addEventListener("click", function () { window.print(); });
  }

  var resetBtn = el("reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      TEXT_FIELDS.concat(NUMBER_FIELDS).forEach(function (id) {
        var n = el(id);
        if (n) { n.value = ""; }
      });
      SELECT_FIELDS.forEach(function (id) {
        var n = el(id);
        if (n) { n.selectedIndex = 0; }
      });
      segs.forEach(function (seg) {
        setSeg(seg, seg.getAttribute("data-default") === "yes");
      });
      var ld = el("letterDate");
      if (ld) { ld.value = todayISO(); }
      render();
    });
  }

  /* Copy buttons put the generated text on the clipboard. Nothing leaves the
     browser; if the clipboard is unavailable, select the text instead so the
     user can copy it by hand. */
  [].slice.call(document.querySelectorAll("button[data-copy]")).forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = el(btn.getAttribute("data-copy"));
      if (!target) { return; }
      var label = btn.textContent;
      function done(msg) {
        btn.textContent = msg;
        window.setTimeout(function () { btn.textContent = label; }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(target.textContent).then(
          function () { done("Copied"); },
          function () { selectNode(target); done("Select & copy"); }
        );
      } else {
        selectNode(target);
        done("Select & copy");
      }
    });
  });

  function selectNode(node) {
    try {
      var range = document.createRange();
      range.selectNodeContents(node);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* nothing to do: the text is on screen either way */ }
  }

  /* first paint */
  var letterDate = el("letterDate");
  if (letterDate && letterDate.value === "") { letterDate.value = todayISO(); }
  render();
})();
