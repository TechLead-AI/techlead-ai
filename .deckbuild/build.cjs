// Tech Lead AI — competition deck (all-dark theme).
// Built from PRESENTATION_OUTLINE.md, structured per PRESENTATION_RULES.md.
// Design goal: minimal text, one idea per slide, simple and easy to follow.
// Speaker notes are short Hebrew bullet reminders.

const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");

const ROOT = path.resolve(__dirname, "..");
const asset = (p) => path.join(ROOT, p);

// ---- palette (dark throughout) ------------------------------------------
const NAVY = "0F172A";        // slide background
const NAVY2 = "1E293B";       // card / box on dark
const LINE2 = "334155";       // hairline borders on dark
const GREEN = "10B981";       // accent — growth / mentoring
const GREEN_D = "059669";
const INDIGO = "6366F1";      // secondary accent
const RED = "EF4444";
const AMBER = "F59E0B";
const WHITE = "FFFFFF";
const ONDARK = "E2E8F0";      // primary text on dark
const SUB = "CBD5E1";         // box subtitle on dark
const MUTED = "94A3B8";       // muted text on dark

const SANS = "Calibri";
const SERIF = "Cambria";      // memorable one-liners

// ---- icon rasterization --------------------------------------------------
async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Comp, { color, size: String(size) })
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

async function buildIcons() {
  const want = {
    branch: [fa.FaCodeBranch, WHITE],
    senior: [fa.FaUserTie, WHITE],
    comment: [fa.FaRegCommentDots, WHITE],
    trash: [fa.FaRegTrashAlt, WHITE],
    brain: [fa.FaBrain, WHITE],
    arrow: [fa.FaArrowRight, GREEN],
    chart: [fa.FaChartLine, WHITE],
    warn: [fa.FaExclamationTriangle, WHITE],
    rules: [fa.FaClipboardList, WHITE],
    server: [fa.FaServer, WHITE],
    bolt: [fa.FaBolt, WHITE],
    phone: [fa.FaMobileAlt, GREEN],
    github: [fa.FaGithub, WHITE],
    db: [fa.FaDatabase, WHITE],
    robot: [fa.FaRobot, WHITE],
  };
  const out = {};
  for (const [k, [C, color]] of Object.entries(want)) out[k] = await icon(C, "#" + color);
  return out;
}

// ---- shared helpers ------------------------------------------------------
const shadow = () => ({ type: "outer", color: "020617", blur: 9, offset: 3, angle: 90, opacity: 0.30 });

function eyebrow(slide, text, x, y) {
  slide.addText(text.toUpperCase(), {
    x, y, w: 7, h: 0.3, margin: 0,
    fontFace: SANS, fontSize: 12, bold: true, color: GREEN, charSpacing: 3, align: "left",
  });
}

function iconBadge(slide, iconData, x, y, d, fill) {
  slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: fill } });
  const pad = d * 0.26;
  slide.addImage({ data: iconData, x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad });
}

function pageNum(slide, n) {
  slide.addText(String(n), { x: 9.3, y: 5.2, w: 0.5, h: 0.3, margin: 0, fontFace: SANS, fontSize: 10, color: MUTED, align: "right" });
}

// horizontal arrow pointing right (or left when leftward=true)
function harrow(slide, x, y, w, color, leftward, dash, width = 2) {
  const opt = { color, width };
  if (dash) opt.dashType = "dash";
  if (leftward) opt.beginArrowType = "triangle"; else opt.endArrowType = "triangle";
  slide.addShape("line", { x, y, w, h: 0, line: opt });
}

// ==========================================================================
async function main() {
  const I = await buildIcons();
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625
  pres.author = "Tech Lead AI";
  pres.title = "Tech Lead AI";

  const W = 10;
  const URL = "tinyurl.com/ColmanTechLeadAI";

  // cropped team-overview screenshot (keep through the Juniors table only)
  const cropBuf = await sharp(asset("docs/screenshots/01-team-overview.png"))
    .extract({ left: 0, top: 0, width: 2880, height: 1650 }).png().toBuffer();
  const teamCrop = "image/png;base64," + cropBuf.toString("base64");
  const cropRatio = 2880 / 1650;

  const dark = (s) => { s.background = { color: NAVY }; };

  // ---------------------------------------------------------------- Slide 1
  // The problem — the bottleneck
  {
    const s = pres.addSlide(); dark(s);
    eyebrow(s, "The problem", 0.6, 0.55);
    s.addText("Training juniors is\nexpensive senior time.", {
      x: 0.6, y: 0.95, w: 8.8, h: 1.5, margin: 0, fontFace: SANS, fontSize: 40, bold: true, color: WHITE, lineSpacingMultiple: 1.0,
    });
    s.addText("Juniors get better through code review — the first thing seniors drop when they're busy.", {
      x: 0.6, y: 2.5, w: 8.6, h: 0.5, margin: 0, fontFace: SANS, fontSize: 17, color: MUTED,
    });

    // bottleneck: a cluster of junior PRs -> one senior -> a thin trickle of feedback
    const bandY = 3.5;
    s.addText("Junior PRs", { x: 0.9, y: bandY - 0.45, w: 1.95, h: 0.3, margin: 0, align: "center", fontFace: SANS, fontSize: 12, color: MUTED });
    const cells = [[0.9, bandY], [1.9, bandY], [0.9, bandY + 0.6], [1.9, bandY + 0.6]];
    cells.forEach(([cx, cy]) => {
      s.addShape("roundRect", { x: cx, y: cy, w: 0.9, h: 0.5, rectRadius: 0.05, fill: { color: NAVY2 }, line: { color: LINE2, width: 1 } });
      s.addImage({ data: I.branch, x: cx + 0.13, y: cy + 0.15, w: 0.2, h: 0.2 });
      s.addText("PR", { x: cx + 0.36, y: cy, w: 0.5, h: 0.5, margin: 0, valign: "middle", fontFace: SANS, fontSize: 12, color: ONDARK });
    });
    // converging arrow into the senior
    harrow(s, 2.95, bandY + 0.55, 0.85, MUTED, false, false, 3);
    // one senior (the bottleneck)
    iconBadge(s, I.senior, 4.0, bandY - 0.05, 1.1, GREEN_D);
    s.addText("1 senior", { x: 3.85, y: bandY + 1.05, w: 1.4, h: 0.3, margin: 0, align: "center", fontFace: SANS, fontSize: 13, bold: true, color: ONDARK });
    // a thin, slow trickle of feedback out
    harrow(s, 5.25, bandY + 0.55, 1.0, AMBER, false, true, 1.5);
    s.addShape("roundRect", { x: 6.4, y: bandY + 0.2, w: 2.9, h: 0.75, rectRadius: 0.08, fill: { color: NAVY2 }, line: { color: LINE2, width: 1 } });
    s.addImage({ data: I.comment, x: 6.65, y: bandY + 0.42, w: 0.32, h: 0.32 });
    s.addText("Feedback — only when there's time", { x: 7.1, y: bandY + 0.2, w: 2.1, h: 0.75, margin: 0, valign: "middle", fontFace: SANS, fontSize: 12.5, color: ONDARK });
    pageNum(s, 1);
    s.addNotes(
      "• מנטורינג לג'וניור = רוויו לקוד שלו\n" +
      "• רוויו טוב לוקח זמן יקר של סניורים\n" +
      "• זה הדבר הראשון שנזנח כשעמוסים\n" +
      "• סניור אחד = צוואר בקבוק, הפידבק מטפטף"
    );
  }

  // ---------------------------------------------------------------- Slide 2
  // What exists today — it forgets
  {
    const s = pres.addSlide(); dark(s);
    eyebrow(s, "What exists today", 0.6, 0.55);
    s.addText("AI code review exists —\nbut it forgets.", {
      x: 0.6, y: 0.95, w: 8.8, h: 1.5, margin: 0, fontFace: SANS, fontSize: 38, bold: true, color: WHITE, lineSpacingMultiple: 1.0,
    });

    const y = 3.0;
    // it reviews one PR
    s.addShape("roundRect", { x: 1.05, y, w: 3.2, h: 1.6, rectRadius: 0.1, fill: { color: NAVY2 }, line: { color: LINE2, width: 1 }, shadow: shadow() });
    iconBadge(s, I.comment, 1.35, y + 0.5, 0.6, INDIGO);
    s.addText("Reviews one PR", { x: 2.1, y, w: 2.0, h: 1.6, margin: 0, valign: "middle", fontFace: SANS, fontSize: 17, bold: true, color: ONDARK });

    harrow(s, 4.45, y + 0.8, 1.1, MUTED, false, false, 2.5);
    s.addText("PR closes", { x: 4.3, y: y + 0.3, w: 1.4, h: 0.35, margin: 0, align: "center", fontFace: SANS, fontSize: 11, italic: true, color: MUTED });

    // then forgets the developer
    s.addShape("roundRect", { x: 5.75, y, w: 3.2, h: 1.6, rectRadius: 0.1, fill: { color: NAVY2 }, line: { color: "7F1D1D", width: 1 }, shadow: shadow() });
    iconBadge(s, I.trash, 6.05, y + 0.5, 0.6, RED);
    s.addText("Forgets the developer", { x: 6.8, y, w: 2.0, h: 1.6, margin: 0, valign: "middle", fontFace: SANS, fontSize: 17, bold: true, color: ONDARK });

    s.addText("No history. No growth. No idea if they're improving.", {
      x: 0.6, y: 4.85, w: 8.8, h: 0.4, margin: 0, align: "center", fontFace: SANS, fontSize: 14, italic: true, color: MUTED,
    });
    pageNum(s, 2);
    s.addNotes(
      "• היום: מבקשים מ-AI לעשות code review\n" +
      "• מקבלים רק הערות על PR בודד\n" +
      "• שוכח את המפתח ברגע שה-PR נסגר\n" +
      "• אין היסטוריה, אין מעקב אחרי שיפור"
    );
  }

  // ---------------------------------------------------------------- Slide 3
  // Our approach — mentor a person
  {
    const s = pres.addSlide(); dark(s);
    eyebrow(s, "Our approach", 0.6, 0.55);
    s.addText([
      { text: "Everyone reviews a pull request.\n", options: { color: MUTED } },
      { text: "We mentor a person.", options: { color: WHITE } },
    ], { x: 0.6, y: 0.95, w: 8.8, h: 1.6, margin: 0, fontFace: SERIF, fontSize: 36, bold: true, italic: true, lineSpacingMultiple: 1.05 });

    const y = 3.05;
    const dots = ["PR 1", "PR 2", "PR 3"];
    dots.forEach((t, i) => {
      const x = 0.85 + i * 1.0;
      s.addShape("roundRect", { x, y: y + 0.15, w: 0.85, h: 0.55, rectRadius: 0.06, fill: { color: NAVY2 }, line: { color: LINE2, width: 1 } });
      s.addText(t, { x, y: y + 0.15, w: 0.85, h: 0.55, align: "center", valign: "middle", margin: 0, fontFace: SANS, fontSize: 12, color: ONDARK });
    });
    harrow(s, 3.85, y + 0.42, 0.6, GREEN, false, false, 2.5);
    iconBadge(s, I.brain, 4.6, y + 0.05, 0.75, GREEN_D);
    s.addText("Personal\nmemory", { x: 4.45, y: y + 0.85, w: 1.05, h: 0.55, align: "center", margin: 0, fontFace: SANS, fontSize: 11, color: ONDARK });
    harrow(s, 5.55, y + 0.42, 0.6, GREEN, false, false, 2.5);
    s.addShape("roundRect", { x: 6.25, y: y + 0.1, w: 3.15, h: 0.65, rectRadius: 0.08, fill: { color: GREEN_D } });
    s.addText("Smarter mentoring", { x: 6.25, y: y + 0.1, w: 3.15, h: 0.65, align: "center", valign: "middle", margin: 0, fontFace: SANS, fontSize: 15, bold: true, color: WHITE });

    s.addText("It remembers every comment a developer has ever received — so it spots repeated mistakes, tracks real growth, and tunes feedback to the person.", {
      x: 0.6, y: 4.55, w: 8.9, h: 0.8, margin: 0, fontFace: SANS, fontSize: 15, color: MUTED,
    });
    pageNum(s, 3);
    s.addNotes(
      "• כולם מבקרים PR — אנחנו מלווים אדם\n" +
      "• זוכרים כל הערה שהמפתח קיבל אי פעם\n" +
      "• מזהים טעויות חוזרות, עוקבים אחרי צמיחה\n" +
      "• כל רוויו הופך את הליווי האישי לחכם יותר"
    );
  }

  // ---------------------------------------------------------------- Slide 4
  // This is us — brand + QR
  {
    const s = pres.addSlide(); dark(s);
    s.addImage({ path: asset("public/logo.png"), x: 0.9, y: 1.35, w: 1.6, h: 1.6 * (427 / 584) });
    s.addText("Tech Lead AI", { x: 0.85, y: 2.7, w: 5.5, h: 0.9, margin: 0, fontFace: SANS, fontSize: 46, bold: true, color: WHITE });
    s.addText("We mentor the developer, not just the pull request.", {
      x: 0.9, y: 3.65, w: 5.2, h: 0.9, margin: 0, fontFace: SERIF, fontSize: 19, italic: true, color: GREEN,
    });
    s.addShape("roundRect", { x: 6.7, y: 1.15, w: 2.7, h: 3.3, rectRadius: 0.12, fill: { color: WHITE }, shadow: shadow() });
    s.addImage({ path: asset("presentation/url_as_qr.png"), x: 6.95, y: 1.4, w: 2.2, h: 2.2 });
    s.addText("Open it on your phone", { x: 6.7, y: 3.62, w: 2.7, h: 0.32, align: "center", margin: 0, fontFace: SANS, fontSize: 13, bold: true, color: NAVY });
    s.addText(URL, { x: 6.7, y: 3.95, w: 2.7, h: 0.35, align: "center", margin: 0, fontFace: SANS, fontSize: 13, color: GREEN_D, hyperlink: { url: "https://" + URL } });
    pageNum(s, 4);
    s.addNotes(
      "• השם: Tech Lead AI\n" +
      "• המשפט: מלווים את המפתח, לא רק את ה-PR\n" +
      "• להזמין את הקהל לסרוק ולפתוח באפליקציה"
    );
  }

  // ---------------------------------------------------------------- Slide 5
  // The app — screenshot + 3 features (no title, no sub-text)
  {
    const s = pres.addSlide(); dark(s);
    eyebrow(s, "The app", 0.6, 0.5);

    const iw = 5.45, ih = iw / cropRatio;
    const imgY = (5.625 - ih) / 2 + 0.2;
    s.addShape("roundRect", { x: 0.5, y: imgY - 0.1, w: iw + 0.2, h: ih + 0.2, rectRadius: 0.08, fill: { color: NAVY2 }, shadow: shadow() });
    s.addImage({ data: teamCrop, x: 0.6, y: imgY, w: iw, h: ih });

    const fx = 6.35, fw = 3.2, d = 0.75;
    const feats = [
      [I.chart, GREEN_D, "Track every junior"],
      [I.warn, AMBER, "Spot blockers fast"],
      [I.rules, INDIGO, "Team conventions"],
    ];
    feats.forEach(([ic, col, title], i) => {
      const cy = 2.1 + i * 1.15;          // vertical center of the row
      iconBadge(s, ic, fx, cy - d / 2, d, col);
      s.addText(title, { x: fx + d + 0.25, y: cy - 0.35, w: fw - d - 0.25, h: 0.7, margin: 0, valign: "middle", fontFace: SANS, fontSize: 19, bold: true, color: ONDARK });
    });
    pageNum(s, 5);
    s.addNotes(
      "• דשבורד אינטראקטיבי — הכל ניתן לחיטוט\n" +
      "• Track: מעקב אחרי כל ג'וניור לאורך זמן — יורד? חוזר על טעויות?\n" +
      "• Blockers: מבט מהיר על PR-ים עם בעיות חוסמות\n" +
      "• Conventions: רוויו מבוסס על כללי הצוות, לא דעות גנריות"
    );
  }

  // ---------------------------------------------------------------- Slide 6
  // Architecture (no title)
  {
    const s = pres.addSlide(); dark(s);
    eyebrow(s, "Architecture", 0.6, 0.5);

    const boxes = [
      [null, "GitHub PR", "opened · pushed", NAVY2],
      [null, "Webhook API", "responds instantly", INDIGO],
      [null, "Job queue", "on Postgres", INDIGO],
      [null, "Worker", "scales out", GREEN_D],
      [null, "AI Reviewer", "AI or rules", GREEN_D],
    ];
    const bw = 1.55, bh = 0.95, by = 1.35, gap = 0.3;
    const xStart = (W - (5 * bw + 4 * gap)) / 2;
    const xs = [];
    boxes.forEach((b, i) => {
      const x = xStart + i * (bw + gap);
      xs.push(x);
      s.addShape("roundRect", { x, y: by, w: bw, h: bh, rectRadius: 0.08, fill: { color: b[3] }, line: { color: LINE2, width: 1 }, shadow: shadow() });
      const ty = b[0] ? by + 0.28 : by;
      if (b[0]) s.addImage({ data: b[0], x: x + bw / 2 - 0.16, y: by + 0.12, w: 0.32, h: 0.32 });
      s.addText([
        { text: b[1] + "\n", options: { fontSize: 13.5, bold: true, color: WHITE } },
        { text: b[2], options: { fontSize: 9.5, color: SUB } },
      ], { x, y: ty, w: bw, h: bh - (b[0] ? 0.4 : 0), align: "center", valign: b[0] ? "top" : "middle", margin: 0, fontFace: SANS, lineSpacingMultiple: 1.0 });
      if (i > 0) harrow(s, xs[i - 1] + bw + 0.02, by + bh / 2, gap - 0.04, MUTED, false, false, 2);
    });

    const wc = xs[3] + bw / 2; // worker center
    const dbY = 3.45;

    // worker writes results down to Postgres
    s.addShape("line", { x: wc, y: by + bh, w: 0, h: dbY - (by + bh), line: { color: GREEN, width: 2, endArrowType: "triangle" } });
    s.addText("writes results", { x: wc + 0.08, y: by + bh + 0.18, w: 1.3, h: 0.3, margin: 0, fontFace: SANS, fontSize: 10, italic: true, color: MUTED });

    // Postgres box (with icon)
    const dbX = xs[3];
    s.addShape("roundRect", { x: dbX, y: dbY, w: bw, h: 0.9, rectRadius: 0.08, fill: { color: NAVY2 }, line: { color: LINE2, width: 1 } });
    s.addImage({ data: I.db, x: dbX + 0.22, y: dbY + 0.28, w: 0.34, h: 0.34 });
    s.addText("Postgres", { x: dbX + 0.6, y: dbY, w: bw - 0.6, h: 0.9, margin: 0, valign: "middle", fontFace: SANS, fontSize: 14, bold: true, color: ONDARK });

    // Postgres -> Dashboards (read)
    harrow(s, dbX + bw + 0.02, dbY + 0.45, gap - 0.04, MUTED, false, false, 2);
    s.addText("reads", { x: dbX + bw - 0.05, y: dbY - 0.28, w: gap + 0.6, h: 0.25, margin: 0, align: "center", fontFace: SANS, fontSize: 10, italic: true, color: MUTED });
    const dashX = xs[4];
    s.addShape("roundRect", { x: dashX, y: dbY, w: bw, h: 0.9, rectRadius: 0.08, fill: { color: NAVY2 }, line: { color: LINE2, width: 1 } });
    s.addText("Dashboards", { x: dashX, y: dbY, w: bw, h: 0.9, align: "center", valign: "middle", margin: 0, fontFace: SANS, fontSize: 13, bold: true, color: ONDARK });

    // posts review back to GitHub — clean labeled return arrow (worker -> github)
    const ry = 2.75;
    const gc = xs[0] + bw / 2;
    harrow(s, gc, ry, wc - gc, GREEN, true, false, 2);
    s.addText("posts 1 review back to GitHub", { x: gc, y: ry + 0.06, w: wc - gc, h: 0.3, margin: 0, align: "center", fontFace: SANS, fontSize: 11, bold: true, italic: true, color: GREEN });
    pageNum(s, 6);
    s.addNotes(
      "• Webhook עונה מיד — לא מחכה ל-AI\n" +
      "• העבודה נכנסת לתור, worker מעבד אותה\n" +
      "• Postgres = גם DB וגם תור (בלי Redis)\n" +
      "• אותו commit נבדק פעם אחת (לפי SHA)\n" +
      "• ה-AI מחזיר רוויו אחד מרוכז ל-GitHub\n" +
      "• הדשבורדים קוראים ישירות מ-Postgres"
    );
  }

  // ---------------------------------------------------------------- Slide 7
  // Technical depth (no title)
  {
    const s = pres.addSlide(); dark(s);
    eyebrow(s, "Technical depth", 0.6, 0.6);

    const cards = [
      [I.server, GREEN_D, "Built to scale out", "Queue + stateless workers"],
      [I.bolt, INDIGO, "Zero-token scanner", "Rules catch the obvious — free"],
    ];
    cards.forEach(([ic, col, title, tag], i) => {
      const x = 0.6 + i * 4.55;
      s.addShape("roundRect", { x, y: 1.55, w: 4.25, h: 3.2, rectRadius: 0.12, fill: { color: NAVY2 }, line: { color: LINE2, width: 1 }, shadow: shadow() });
      iconBadge(s, ic, x + 1.6, 2.0, 1.05, col);
      s.addText(title, { x: x + 0.25, y: 3.3, w: 3.75, h: 0.5, align: "center", margin: 0, fontFace: SANS, fontSize: 23, bold: true, color: WHITE });
      s.addText(tag, { x: x + 0.25, y: 3.95, w: 3.75, h: 0.5, align: "center", margin: 0, fontFace: SANS, fontSize: 15, color: MUTED });
    });
    pageNum(s, 7);
    s.addNotes(
      "• בנוי לסקייל: רוויו יקר רץ בתור ולא בבקשת ה-web; אפשר להוסיף workers לפי עומס\n" +
      "• סורק חוקים ללא טוקנים: תופס סודות, catch ריק, TODO — בחינם\n" +
      "• הסורק מזין דוגמאות ל-AI, כך שמבזבזים טוקנים רק איפה שה-AI באמת תורם"
    );
  }

  // ---------------------------------------------------------------- Slide 8
  // Demo — with QR + URL
  {
    const s = pres.addSlide(); dark(s);
    iconBadge(s, I.phone, 4.55, 0.95, 0.9, GREEN_D);
    s.addText("Demo", { x: 0, y: 2.0, w: W, h: 1.0, align: "center", margin: 0, fontFace: SANS, fontSize: 58, bold: true, color: WHITE });

    // QR + url so the audience can follow along on their phones
    s.addShape("roundRect", { x: 4.3, y: 3.15, w: 1.4, h: 1.4, rectRadius: 0.08, fill: { color: WHITE }, shadow: shadow() });
    s.addImage({ path: asset("presentation/url_as_qr.png"), x: 4.42, y: 3.27, w: 1.16, h: 1.16 });
    s.addText(URL, { x: 0, y: 4.65, w: W, h: 0.35, align: "center", margin: 0, fontFace: SANS, fontSize: 14, bold: true, color: GREEN, hyperlink: { url: "https://" + URL } });
    pageNum(s, 8);
    s.addNotes(
      "• הדגמה חיה — מלווים ג'וניור בזמן אמת\n" +
      "• אפשר לפתוח את האפליקציה בטלפון (QR)\n" +
      "• מסלול: PR → רוויו → פרופיל הצמיחה של הג'וניור"
    );
  }

  // ---------------------------------------------------------------- Slide 9
  // The bottom line (no QR)
  {
    const s = pres.addSlide(); dark(s);
    eyebrow(s, "The bottom line", 0.6, 0.85);
    s.addText("We turn code review into\nmentoring that sticks.", {
      x: 0.6, y: 1.25, w: 8.8, h: 1.5, margin: 0, fontFace: SANS, fontSize: 40, bold: true, color: WHITE, lineSpacingMultiple: 1.0,
    });

    const beats = ["Catch the bug", "Explain the why", "Remember the pattern", "Show the growth"];
    const cw = 2.15, cg = 0.18, startX = 0.6, cy = 3.5;
    beats.forEach((t, i) => {
      const x = startX + i * (cw + cg);
      s.addShape("roundRect", { x, y: cy, w: cw, h: 0.9, rectRadius: 0.1, fill: { color: i === 3 ? GREEN_D : NAVY2 }, line: { color: i === 3 ? GREEN : LINE2, width: 1 } });
      s.addText(t, { x, y: cy, w: cw, h: 0.9, align: "center", valign: "middle", margin: 0, fontFace: SANS, fontSize: 14, bold: true, color: i === 3 ? WHITE : ONDARK });
      if (i < 3) s.addImage({ data: I.arrow, x: x + cw + (cg - 0.16) / 2, y: cy + 0.35, w: 0.16, h: 0.2 });
    });
    pageNum(s, 9);
    s.addNotes(
      "• הופכים code review מ\"שער\" לליווי שנשאר\n" +
      "• חוסכים זמן לג'וניורים ולסניורים\n" +
      "• המערכת זוכרת את ההיסטוריה של כל מפתח במקומכם\n" +
      "• onboarding מהיר יותר, צמיחה מהירה יותר"
    );
  }

  await pres.writeFile({ fileName: asset("presentation/PRESENTATION.pptx") });
  console.log("wrote PRESENTATION.pptx");
}

main().catch((e) => { console.error(e); process.exit(1); });
