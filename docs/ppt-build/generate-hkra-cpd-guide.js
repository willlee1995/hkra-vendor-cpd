const pptxgen = require("pptxgenjs");
const path = require("path");

const OUT = path.join(__dirname, "..", "HKRA-CPD-Lifecycle-Guide.pptx");

const C = {
  navy: "065A82",
  teal: "028090",
  seafoam: "00A896",
  mint: "02C39A",
  midnight: "21295C",
  sand: "E7E8D1",
  cream: "F5F7FA",
  charcoal: "36454F",
  slate: "50808E",
  white: "FFFFFF",
  cherry: "990011",
  amber: "C77700",
};

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "HKRA";
pres.title = "HKRA CPD Event Lifecycle Guide";
pres.subject = "vendor-cpd + record-wizard system guide";

function addFooter(slide, text) {
  slide.addText(text, {
    x: 0.5,
    y: 5.25,
    w: 9,
    h: 0.25,
    fontSize: 9,
    color: C.slate,
    fontFace: "Calibri",
    margin: 0,
  });
}

function slideTitle(slide, title, subtitle) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 0.12,
    h: 5.625,
    fill: { color: C.teal },
    line: { color: C.teal, width: 0 },
  });
  slide.addText(title, {
    x: 0.55,
    y: 0.35,
    w: 8.8,
    h: 0.7,
    fontSize: 32,
    bold: true,
    color: C.midnight,
    fontFace: "Georgia",
    margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.55,
      y: 1.05,
      w: 8.8,
      h: 0.45,
      fontSize: 14,
      color: C.slate,
      fontFace: "Calibri",
      margin: 0,
    });
  }
}

function bullets(slide, items, opts = {}) {
  const runs = items.map((t, i) => ({
    text: t,
    options: {
      bullet: true,
      breakLine: i < items.length - 1,
      fontSize: opts.fontSize || 14,
      color: opts.color || C.charcoal,
      fontFace: "Calibri",
      paraSpaceAfter: 6,
    },
  }));
  slide.addText(runs, {
    x: opts.x ?? 0.55,
    y: opts.y ?? 1.55,
    w: opts.w ?? 8.8,
    h: opts.h ?? 3.6,
    valign: "top",
    margin: 0,
  });
}

function statBlock(slide, x, y, w, value, label, accent) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x,
    y,
    w,
    h: 0.75,
    fill: { color: C.white },
    line: { color: "D8E3EA", width: 1 },
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x,
    y,
    w: 0.08,
    h: 0.75,
    fill: { color: accent },
    line: { color: accent, width: 0 },
  });
  slide.addText(String(value), {
    x: x + 0.2,
    y: y + 0.08,
    w: w - 0.3,
    h: 0.35,
    fontSize: 24,
    bold: true,
    color: accent,
    fontFace: "Georgia",
    margin: 0,
  });
  slide.addText(label, {
    x: x + 0.2,
    y: y + 0.45,
    w: w - 0.3,
    h: 0.25,
    fontSize: 10,
    color: C.charcoal,
    fontFace: "Calibri",
    margin: 0,
  });
}

// --- Slide 1: Title ---
{
  const slide = pres.addSlide();
  slide.background = { color: C.midnight };
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0,
    y: 4.6,
    w: 10,
    h: 1.025,
    fill: { color: C.teal },
    line: { color: C.teal, width: 0 },
  });
  slide.addText("HKRA CPD Event Lifecycle", {
    x: 0.7,
    y: 1.4,
    w: 8.6,
    h: 1,
    fontSize: 40,
    bold: true,
    color: C.white,
    fontFace: "Georgia",
    margin: 0,
  });
  slide.addText("System guide for vendors and administrators", {
    x: 0.7,
    y: 2.45,
    w: 8.6,
    h: 0.5,
    fontSize: 18,
    color: C.sand,
    fontFace: "Calibri",
    margin: 0,
  });
  slide.addText("vendor-cpd  ·  record-wizard  ·  hkra.org.hk", {
    x: 0.7,
    y: 4.75,
    w: 8.6,
    h: 0.35,
    fontSize: 13,
    color: C.white,
    fontFace: "Calibri",
    margin: 0,
  });
}

// --- Slide 2: Audience ---
{
  const slide = pres.addSlide();
  slide.background = { color: C.cream };
  slideTitle(slide, "Who uses these systems?", "Three roles across one CPD lifecycle");

  const roles = [
    {
      title: "Vendor",
      body: "Submit CPD requests, upload posters, monitor approval status, upload Zoom attendance after events.",
      color: C.teal,
      x: 0.55,
    },
    {
      title: "HKRA Admin",
      body: "Approve requests, publish WordPress events, schedule email campaigns, download attendance, process CPD.",
      color: C.seafoam,
      x: 3.45,
    },
    {
      title: "HKRA Member",
      body: "Register on hkra.org.hk via Events Manager bookings after receiving promotional emails.",
      color: C.navy,
      x: 6.35,
    },
  ];

  roles.forEach((r) => {
    slide.addShape(pres.shapes.OVAL, {
      x: r.x + 1.05,
      y: 1.75,
      w: 0.55,
      h: 0.55,
      fill: { color: r.color },
      line: { color: r.color, width: 0 },
    });
    slide.addText(r.title.charAt(0), {
      x: r.x + 1.05,
      y: 1.75,
      w: 0.55,
      h: 0.55,
      fontSize: 18,
      bold: true,
      color: C.white,
      align: "center",
      valign: "middle",
      fontFace: "Georgia",
      margin: 0,
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: r.x,
      y: 2.45,
      w: 2.75,
      h: 2.55,
      fill: { color: C.white },
      line: { color: "D8E3EA", width: 1 },
    });
    slide.addText(r.title, {
      x: r.x + 0.15,
      y: 2.6,
      w: 2.45,
      h: 0.35,
      fontSize: 16,
      bold: true,
      color: C.midnight,
      fontFace: "Georgia",
      margin: 0,
    });
    slide.addText(r.body, {
      x: r.x + 0.15,
      y: 3.05,
      w: 2.45,
      h: 1.75,
      fontSize: 12,
      color: C.charcoal,
      fontFace: "Calibri",
      valign: "top",
      margin: 0,
    });
  });
  addFooter(slide, "HKRA CPD Lifecycle Guide");
}

// --- Slide 3: Two systems ---
{
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  slideTitle(slide, "Two systems, one WordPress hub", "Separate Supabase databases; shared Events Manager on hkra.org.hk");

  const cards = [
    {
      x: 0.55,
      title: "hkra-vendor-cpd",
      phase: "Phases 1–4",
      color: C.teal,
      lines: [
        "Vendor CPD accreditation portal",
        "Admin approval + CPD points (0.5–8.0)",
        "WordPress draft event on approval",
        "FluentCRM email campaigns",
        "Vendor attendance upload",
      ],
    },
    {
      x: 5.15,
      title: "hkra-record-wizard",
      phase: "Phase 5",
      color: C.seafoam,
      lines: [
        "CPD Attendance Processor",
        "cpdprocess.hkra.org.hk",
        "Zoom export validation (75% rule)",
        "Registration + member cross-check",
        "CPD import + certificates",
      ],
    },
  ];

  cards.forEach((c) => {
    slide.addShape(pres.shapes.RECTANGLE, {
      x: c.x,
      y: 1.55,
      w: 4.3,
      h: 2.95,
      fill: { color: C.cream },
      line: { color: "D8E3EA", width: 1 },
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: c.x,
      y: 1.55,
      w: 4.3,
      h: 0.55,
      fill: { color: c.color },
      line: { color: c.color, width: 0 },
    });
    slide.addText(c.title, {
      x: c.x + 0.2,
      y: 1.62,
      w: 2.8,
      h: 0.4,
      fontSize: 16,
      bold: true,
      color: C.white,
      fontFace: "Georgia",
      margin: 0,
    });
    slide.addText(c.phase, {
      x: c.x + 2.9,
      y: 1.68,
      w: 1.2,
      h: 0.3,
      fontSize: 10,
      color: C.sand,
      align: "right",
      fontFace: "Calibri",
      margin: 0,
    });
    bullets(
      slide,
      c.lines,
      { x: c.x + 0.25, y: 2.25, w: 3.9, h: 2.0, fontSize: 12 }
    );
  });

  statBlock(slide, 0.55, 4.35, 2.1, "2", "Admin systems", C.teal);
  statBlock(slide, 2.85, 4.35, 2.1, "5", "Lifecycle phases", C.navy);
  statBlock(slide, 5.15, 4.35, 2.1, "75%", "Attendance rule", C.amber);
  statBlock(slide, 7.45, 4.35, 2.0, "WP", "Shared hub", C.seafoam);
}

// --- Slide 4: Five phases ---
{
  const slide = pres.addSlide();
  slide.background = { color: C.cream };
  slideTitle(slide, "Five lifecycle phases", "End-to-end from submission to CPD issuance");

  const phases = [
    ["1", "Submission", "Vendor", "vendor-cpd", "Status: pending"],
    ["2", "Approval", "HKRA admin", "vendor-cpd", "CPD points + automation"],
    ["3", "Promotion", "HKRA admin", "FluentCRM", "Email scheduled"],
    ["4", "Event + upload", "Vendor + members", "WP + vendor-cpd", "Zoom attendance"],
    ["5", "Validation", "HKRA admin", "record-wizard", "CPD + certificates"],
  ];

  phases.forEach((p, i) => {
    const y = 1.55 + i * 0.78;
    slide.addShape(pres.shapes.OVAL, {
      x: 0.55,
      y: y + 0.05,
      w: 0.45,
      h: 0.45,
      fill: { color: C.teal },
      line: { color: C.teal, width: 0 },
    });
    slide.addText(p[0], {
      x: 0.55,
      y: y + 0.05,
      w: 0.45,
      h: 0.45,
      fontSize: 14,
      bold: true,
      color: C.white,
      align: "center",
      valign: "middle",
      margin: 0,
    });
    slide.addText(p[1], {
      x: 1.15,
      y: y,
      w: 1.6,
      h: 0.35,
      fontSize: 14,
      bold: true,
      color: C.midnight,
      fontFace: "Georgia",
      margin: 0,
    });
    slide.addText(`${p[2]}  ·  ${p[3]}`, {
      x: 2.85,
      y: y,
      w: 3.2,
      h: 0.35,
      fontSize: 12,
      color: C.slate,
      fontFace: "Calibri",
      margin: 0,
    });
    slide.addText(p[4], {
      x: 6.2,
      y: y,
      w: 3.2,
      h: 0.35,
      fontSize: 12,
      bold: true,
      color: C.teal,
      fontFace: "Calibri",
      margin: 0,
    });
    if (i < phases.length - 1) {
      slide.addShape(pres.shapes.LINE, {
        x: 0.77,
        y: y + 0.52,
        w: 0,
        h: 0.28,
        line: { color: C.seafoam, width: 2 },
      });
    }
  });
  addFooter(slide, "HKRA CPD Lifecycle Guide");
}

// --- Slide 5: Lifecycle flow diagram ---
{
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  slideTitle(slide, "Lifecycle flow", "What happens after a vendor submits a CPD request");

  const steps = [
    "Submit CPD request",
    "Admin review + CPD points",
    "WordPress draft event",
    "Email campaign dry run",
    "Member registration",
    "Event runs (Zoom/ON24)",
    "Vendor uploads attendance",
    "Validate in record-wizard",
    "CPD credits + certificates",
  ];

  const colW = 2.25;
  const startX = 0.55;
  const startY = 1.55;

  steps.forEach((label, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = startX + col * (colW + 0.28);
    const y = startY + row * 1.12;
    const isLast = i === steps.length - 1;

    slide.addShape(pres.shapes.RECTANGLE, {
      x,
      y,
      w: colW,
      h: 0.82,
      fill: { color: isLast ? C.mint : C.cream },
      line: { color: isLast ? C.seafoam : "D8E3EA", width: 1 },
    });
    slide.addText(String(i + 1), {
      x: x + 0.08,
      y: y + 0.08,
      w: 0.3,
      h: 0.25,
      fontSize: 10,
      bold: true,
      color: isLast ? C.white : C.teal,
      fontFace: "Calibri",
      margin: 0,
    });
    slide.addText(label, {
      x: x + 0.08,
      y: y + 0.3,
      w: colW - 0.16,
      h: 0.48,
      fontSize: 10,
      color: isLast ? C.white : C.charcoal,
      fontFace: "Calibri",
      valign: "top",
      margin: 0,
    });
  });

  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.55,
    y: 4.78,
    w: 8.9,
    h: 0.42,
    fill: { color: "FFF4E5" },
    line: { color: C.amber, width: 1 },
  });
  slide.addText(
    "Important: WordPress events are created as drafts — publish manually on hkra.org.hk before registration URLs go live.",
    {
      x: 0.7,
      y: 4.84,
      w: 8.6,
      h: 0.3,
      fontSize: 10,
      bold: true,
      color: "9A5B00",
      fontFace: "Calibri",
      margin: 0,
    }
  );
}

// --- Slide 6: Integration points ---
{
  const slide = pres.addSlide();
  slide.background = { color: C.cream };
  slideTitle(slide, "Integration points", "How the systems talk to WordPress and each other");

  slide.addTable(
    [
      [
        { text: "Integration", options: { bold: true, fill: { color: C.teal }, color: C.white } },
        { text: "Direction", options: { bold: true, fill: { color: C.teal }, color: C.white } },
        { text: "When", options: { bold: true, fill: { color: C.teal }, color: C.white } },
      ],
      ["WordPress event", "vendor-cpd → WP", "On admin approval"],
      ["Email campaign", "vendor-cpd → FluentCRM", "After approval"],
      ["Registration lookup", "record-wizard ← WP", "During processing"],
      ["CPD credit import", "record-wizard → WP", "After validation"],
      ["Attendance file", "Vendor → vendor-cpd", "Post-event (manual handoff)"],
    ],
    {
      x: 0.55,
      y: 1.55,
      w: 8.9,
      colW: [2.4, 2.2, 4.3],
      fontSize: 11,
      fontFace: "Calibri",
      border: { pt: 0.5, color: "D8E3EA" },
      fill: { color: C.white },
      autoPage: false,
    }
  );

  slide.addText("No automated bridge for attendance files today.", {
    x: 0.55,
    y: 4.85,
    w: 8.9,
    h: 0.35,
    fontSize: 13,
    italic: true,
    color: C.cherry,
    fontFace: "Calibri",
    margin: 0,
  });
}

// --- Slide 7: Vendor guide ---
{
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  slideTitle(
    slide,
    "Vendor guide",
    "CPD Vendor Portal — /vendor/login · /vendor/dashboard · /vendor/guide"
  );

  bullets(slide, [
    "Submit a New Request with event name, dates, contact info, and optional Zoom/ON24 details.",
    "Upload posters or agendas with the request form.",
    "Monitor status: Pending → Approved or Rejected.",
    "If rejected, read the admin reason, edit, and resubmit.",
    "While Pending or Rejected, edit details or Withdraw the request.",
    "After the event ends, upload Zoom attendance (CSV/XLSX) on the approved request page.",
  ], { w: 4.65, h: 3.6 });

  slide.addShape(pres.shapes.RECTANGLE, {
    x: 5.4,
    y: 1.55,
    w: 4.05,
    h: 3.55,
    fill: { color: C.cream },
    line: { color: "D8E3EA", width: 1 },
  });
  slide.addText("Handled by HKRA admin", {
    x: 5.6,
    y: 1.75,
    w: 3.7,
    h: 0.35,
    fontSize: 14,
    bold: true,
    color: C.midnight,
    fontFace: "Georgia",
    margin: 0,
  });
  bullets(
    slide,
    [
      "CPD point assignment",
      "WordPress event creation",
      "Promotional email blast",
      "Attendance validation",
      "Certificate generation",
    ],
    { x: 5.65, y: 2.2, w: 3.6, h: 2.8, fontSize: 12 }
  );

  slide.addText("Reminder emails at 1 and 3 months if attendance is missing.", {
    x: 5.6,
    y: 4.55,
    w: 3.7,
    h: 0.45,
    fontSize: 10,
    color: C.slate,
    fontFace: "Calibri",
    margin: 0,
  });
}

// --- Slide 8: Admin vendor portal ---
{
  const slide = pres.addSlide();
  slide.background = { color: C.cream };
  slideTitle(
    slide,
    "Admin guide — Vendor Portal",
    "/admin/dashboard · /admin/request/:id"
  );

  bullets(slide, [
    "Filter Pending requests on the Admin Dashboard; open request detail to review.",
    "Approve with Admin Notes + CPD points (0.5–8.0) — triggers WP event + email campaign.",
    "Reject with a clear reason visible to the vendor.",
    "Self-raised events: use New Request at /vendor/request/new, select vendor, same approval flow.",
    "Verify WordPress sync (event ID, permalink) or use Create HKRA event / Force duplicate.",
    "Publish the draft event on hkra.org.hk before members can register.",
    "Download vendor attendance files from request detail for record-wizard processing.",
  ], { y: 1.5, h: 3.9 });
}

// --- Slide 9: Email campaigns ---
{
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  slideTitle(slide, "Email campaign workflow", "EmailCampaignCard on approved requests");

  slide.addTable(
    [
      [
        { text: "Job status", options: { bold: true, fill: { color: C.navy }, color: C.white } },
        { text: "Admin action", options: { bold: true, fill: { color: C.navy }, color: C.white } },
      ],
      ["queued / generating", "Wait; poll job status on request detail"],
      ["dry_run_ready", "Review HTML preview; pick FluentCRM lists; Approve schedule"],
      ["needs_input", "Fill missing fields; retry with admin_prompt"],
      ["scheduled", "Published to FluentCRM — done"],
      ["failed", "Review error; Retry or Start with force"],
    ],
    {
      x: 0.55,
      y: 1.55,
      w: 5.5,
      colW: [1.8, 3.7],
      fontSize: 11,
      fontFace: "Calibri",
      border: { pt: 0.5, color: "D8E3EA" },
      fill: { color: C.cream },
    }
  );

  slide.addShape(pres.shapes.RECTANGLE, {
    x: 6.3,
    y: 1.55,
    w: 3.15,
    h: 3.2,
    fill: { color: C.cream },
    line: { color: "D8E3EA", width: 1 },
  });
  slide.addText("Pipeline", {
    x: 6.45,
    y: 1.7,
    w: 2.8,
    h: 0.3,
    fontSize: 14,
    bold: true,
    color: C.midnight,
    fontFace: "Georgia",
    margin: 0,
  });
  bullets(
    slide,
    [
      "Cloudflare Worker orchestrator",
      "Cursor cloud agent generates HTML",
      "FluentCRM dry run + schedule",
      "Test list ID: 4",
      "Production list ID: 1",
      "Default schedule: HKT next day 09:00",
    ],
    { x: 6.45, y: 2.1, w: 2.85, h: 2.5, fontSize: 11 }
  );
}

// --- Slide 10: Record wizard ---
{
  const slide = pres.addSlide();
  slide.background = { color: C.cream };
  slideTitle(
    slide,
    "Admin guide — Record Wizard",
    "cpdprocess.hkra.org.hk · upload, process, save, export"
  );

  bullets(slide, [
    "Log in with Supabase admin credentials.",
    "Upload Zoom attendance CSV/XLSX (name, email, duration).",
    "Select matching WordPress event — auto-fills title, dates, CPD points.",
    "Use API registration mode (default) or upload registration file.",
    "Confirm radiographer registry + HKRA member data sources.",
    "Run Process — 75% attendance rule + reg number matching.",
    "Review results; fix duplicates; save to Supabase.",
    "Send to WordPress (Platform Data tab) to import CPD credits.",
    "Generate and email certificates from Certifications tab.",
  ], { y: 1.5, h: 3.85, fontSize: 13 });
}

// --- Slide 11: Validation rules ---
{
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  slideTitle(slide, "Attendance validation rules", "Applied during record-wizard processing");

  const rules = [
    ["75% attendance", "Duration ≥ 75% of total event time"],
    ["Registration", "Email in approved WP bookings (status = 1)"],
    ["HKRA membership", "Email match on member DB; name fallback on registry"],
    ["CPD eligible", "Attendance + valid reg number (no Not Found / duplicate)"],
    ["Certificate", "Registered + 75% attendance + HKRA member"],
  ];

  rules.forEach((r, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.55 + col * 4.55;
    const y = 1.55 + row * 1.0;
    slide.addShape(pres.shapes.RECTANGLE, {
      x,
      y,
      w: 4.25,
      h: 0.88,
      fill: { color: C.cream },
      line: { color: "D8E3EA", width: 1 },
    });
    slide.addText(r[0], {
      x: x + 0.15,
      y: y + 0.12,
      w: 3.95,
      h: 0.3,
      fontSize: 14,
      bold: true,
      color: C.teal,
      fontFace: "Georgia",
      margin: 0,
    });
    slide.addText(r[1], {
      x: x + 0.15,
      y: y + 0.48,
      w: 3.95,
      h: 0.45,
      fontSize: 12,
      color: C.charcoal,
      fontFace: "Calibri",
      margin: 0,
    });
  });

  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.55,
    y: 4.72,
    w: 8.9,
    h: 0.42,
    fill: { color: "FFF4E5" },
    line: { color: C.amber, width: 1 },
  });
  slide.addText(
    "Edge case: WordPress event ID 353 may fail registration API — use manual registration file upload.",
    {
      x: 0.7,
      y: 4.78,
      w: 8.6,
      h: 0.3,
      fontSize: 10,
      bold: true,
      color: "9A5B00",
      fontFace: "Calibri",
      margin: 0,
    }
  );
}

// --- Slide 12: Status reference ---
{
  const slide = pres.addSlide();
  slide.background = { color: C.cream };
  slideTitle(slide, "Status reference", "Vendor requests and email campaign jobs");

  slide.addText("Vendor request status", {
    x: 0.55,
    y: 1.45,
    w: 4.2,
    h: 0.3,
    fontSize: 13,
    bold: true,
    color: C.midnight,
    fontFace: "Georgia",
    margin: 0,
  });
  slide.addTable(
    [
      ["pending", "Awaiting review", "Edit, Withdraw"],
      ["approved", "CPD assigned", "Upload attendance"],
      ["rejected", "Reason provided", "Edit, resubmit"],
      ["withdrawn", "Vendor cancelled", "View only"],
    ],
    {
      x: 0.55,
      y: 1.8,
      w: 4.2,
      colW: [1.1, 1.5, 1.6],
      fontSize: 10,
      fontFace: "Calibri",
      border: { pt: 0.5, color: "D8E3EA" },
      fill: { color: C.white },
    }
  );

  slide.addText("Email campaign job status", {
    x: 5.25,
    y: 1.45,
    w: 4.2,
    h: 0.3,
    fontSize: 13,
    bold: true,
    color: C.midnight,
    fontFace: "Georgia",
    margin: 0,
  });
  slide.addTable(
    [
      ["queued", "Waiting to start"],
      ["generating", "Cursor agent running"],
      ["dry_run_ready", "Admin must schedule"],
      ["needs_input", "Missing fields"],
      ["scheduled", "Published to FluentCRM"],
      ["failed", "Generation error"],
    ],
    {
      x: 5.25,
      y: 1.8,
      w: 4.2,
      colW: [1.4, 2.8],
      fontSize: 10,
      fontFace: "Calibri",
      border: { pt: 0.5, color: "D8E3EA" },
      fill: { color: C.white },
    }
  );
}

// --- Slide 13: Manual handoff ---
{
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  slideTitle(slide, "Manual handoff", "Attendance moves between systems by admin action");

  const handoff = [
    ["1", "Vendor uploads attendance", "vendor-cpd request detail → storage bucket"],
    ["2", "Admin downloads file", "Admin request detail in vendor portal"],
    ["3", "Admin processes in record-wizard", "Same WordPress event ID as approval"],
    ["4", "CPD issued on WordPress", "admin-report import + certificate emails"],
  ];

  handoff.forEach((h, i) => {
    const y = 1.5 + i * 0.82;
    slide.addShape(pres.shapes.OVAL, {
      x: 0.55,
      y: y + 0.08,
      w: 0.5,
      h: 0.5,
      fill: { color: i === 3 ? C.mint : C.teal },
      line: { color: i === 3 ? C.seafoam : C.teal, width: 0 },
    });
    slide.addText(h[0], {
      x: 0.55,
      y: y + 0.08,
      w: 0.5,
      h: 0.5,
      fontSize: 16,
      bold: true,
      color: C.white,
      align: "center",
      valign: "middle",
      margin: 0,
    });
    slide.addText(h[1], {
      x: 1.25,
      y: y,
      w: 7.8,
      h: 0.35,
      fontSize: 14,
      bold: true,
      color: C.midnight,
      fontFace: "Georgia",
      margin: 0,
    });
    slide.addText(h[2], {
      x: 1.25,
      y: y + 0.38,
      w: 7.5,
      h: 0.35,
      fontSize: 12,
      color: C.slate,
      fontFace: "Calibri",
      margin: 0,
    });
    if (i < handoff.length - 1) {
      slide.addShape(pres.shapes.LINE, {
        x: 0.8,
        y: y + 0.62,
        w: 0,
        h: 0.35,
        line: { color: C.seafoam, width: 2 },
      });
    }
  });

  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.55,
    y: 4.82,
    w: 8.9,
    h: 0.38,
    fill: { color: "FDEDEE" },
    line: { color: C.cherry, width: 1 },
  });
  slide.addText("No shared database or webhook for attendance files — operational handoff is manual.", {
    x: 0.7,
    y: 4.87,
    w: 8.6,
    h: 0.28,
    fontSize: 10,
    bold: true,
    color: C.cherry,
    fontFace: "Calibri",
    margin: 0,
  });
}

// --- Slide 14: Resources / closing ---
{
  const slide = pres.addSlide();
  slide.background = { color: C.midnight };
  slide.addText("Further reading", {
    x: 0.7,
    y: 0.8,
    w: 8.6,
    h: 0.6,
    fontSize: 36,
    bold: true,
    color: C.white,
    fontFace: "Georgia",
    margin: 0,
  });

  bullets(
    slide,
    [
      "hkra-vendor-cpd/docs/CAMPAIGN_ORCHESTRATOR.md",
      "hkra-vendor-cpd/event-api.md",
      "hkra-vendor-cpd/docs/ADMIN_SETUP.md",
      "hkra-record-wizard/spec.md",
      "hkra-record-wizard/DEPLOYMENT.md",
      "Interactive guide: hkra-cpd-lifecycle-guide.canvas.tsx",
    ],
    {
      x: 0.7,
      y: 1.7,
      w: 8.6,
      h: 3.2,
      fontSize: 14,
      color: C.sand,
    }
  );

  slide.addText("HKRA CPD Event Lifecycle Guide  ·  vendor-cpd + record-wizard", {
    x: 0.7,
    y: 5.0,
    w: 8.6,
    h: 0.35,
    fontSize: 12,
    color: C.mint,
    fontFace: "Calibri",
    margin: 0,
  });
}

pres
  .writeFile({ fileName: OUT })
  .then(() => console.log("Wrote", OUT))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
