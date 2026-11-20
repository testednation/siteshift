import type { PlatformType, SampleId } from '../types/migration.ts';

export interface SampleSiteFixture {
  id: SampleId;
  label: string;
  platform: Exclude<PlatformType, 'html'>;
  siteName: string;
  sourceUrl: string;
  description: string;
  files: Array<{
    filename: string;
    slug: string;
    html: string;
  }>;
  bundledAssets: Array<{
    originalUrl: string;
    content: string;
    mimeType: string;
    rasterFormat?: 'png' | 'webp';
    rasterWidth?: number;
  }>;
}

const SVG_ARCH_HERO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="960" height="540">
  <defs>
    <linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#bg1)"/>
  <g stroke="#334155" stroke-width="1" fill="none">
    <path d="M0 120 H960 M0 240 H960 M0 360 H960 M0 480 H960"/>
    <path d="M160 0 V540 M320 0 V540 M480 0 V540 M640 0 V540 M800 0 V540"/>
  </g>
  <polygon points="160,440 420,160 660,160 800,440" fill="#1e3a5f" opacity="0.85"/>
  <polygon points="420,160 660,160 660,440 420,440" fill="#2563eb" opacity="0.32"/>
  <rect x="240" y="250" width="140" height="190" fill="#e2e8f0" opacity="0.92"/>
  <rect x="440" y="210" width="210" height="230" fill="#cbd5e1" opacity="0.88"/>
  <rect x="465" y="240" width="60" height="80" fill="#0f172a"/>
  <rect x="550" y="240" width="60" height="80" fill="#0f172a"/>
  <text x="64" y="84" fill="#f8fafc" font-family="sans-serif" font-size="22" font-weight="600">NORTHLINE PAVILION — ZURICH</text>
</svg>`;

const SVG_ARCH_INTERIOR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
  <rect width="800" height="500" fill="#f1f5f9"/>
  <rect x="60" y="60" width="680" height="380" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="110" y="110" width="240" height="280" fill="#e2e8f0"/>
  <rect x="390" y="110" width="300" height="130" fill="#1e293b"/>
  <rect x="390" y="265" width="300" height="125" fill="#cbd5e1"/>
  <line x1="110" y1="250" x2="350" y2="250" stroke="#94a3b8" stroke-width="2"/>
  <text x="415" y="182" fill="#f8fafc" font-family="sans-serif" font-size="18" font-weight="600">TIMBER ATRIUM STUDY</text>
</svg>`;

const SVG_PRODUCT_BOARD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 520" width="900" height="520">
  <rect width="900" height="520" fill="#0f172a"/>
  <rect x="48" y="48" width="804" height="424" rx="12" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
  <rect x="84" y="96" width="210" height="328" rx="8" fill="#0f172a"/>
  <rect x="322" y="96" width="494" height="148" rx="8" fill="#0f172a"/>
  <rect x="322" y="268" width="236" height="156" rx="8" fill="#0f172a"/>
  <rect x="580" y="268" width="236" height="156" rx="8" fill="#0f172a"/>
  <polyline points="350,210 430,180 510,192 610,140 700,154 785,118" fill="none" stroke="#38bdf8" stroke-width="3.5"/>
  <rect x="108" y="132" width="140" height="14" rx="3" fill="#475569"/>
  <rect x="108" y="164" width="104" height="12" rx="3" fill="#334155"/>
  <rect x="108" y="192" width="128" height="12" rx="3" fill="#334155"/>
  <text x="350" y="330" fill="#e2e8f0" font-family="sans-serif" font-size="24" font-weight="700">99.98%</text>
  <text x="350" y="358" fill="#94a3b8" font-family="sans-serif" font-size="13">Delivery Uptime</text>
  <text x="608" y="330" fill="#38bdf8" font-family="sans-serif" font-size="24" font-weight="700">14 ms</text>
  <text x="608" y="358" fill="#94a3b8" font-family="sans-serif" font-size="13">Median Edge Routing</text>
</svg>`;

const WIX_HOME_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="generator" content="Wix.com Website Builder" />
  <meta name="description" content="Northline Architecture Studio designs low-carbon timber civic buildings, adaptive reuse workspaces, and urban pavilions." />
  <title>Northline Architecture | Civic Timber & Adaptive Reuse</title>
  <link rel="stylesheet" href="https://static.parastorage.com/services/wix-thunderbolt/dist/main.renderer.min.css" />
  <link rel="stylesheet" href="https://static.wixstatic.com/ufonts/northline-theme.css" />
  <script src="https://static.parastorage.com/services/wix-thunderbolt/dist/thunderbolt-commons.bundle.min.js"></script>
  <script src="https://static.parastorage.com/services/wix-thunderbolt/dist/main.bundle.min.js"></script>
  <script src="https://static.parastorage.com/unpkg/react-dom@18.2.0/umd/react-dom.production.min.js"></script>
  <script src="https://frog.wix.com/bt?src=29&evid=3&site=northline-arch"></script>
  <script src="https://static.parastorage.com/services/tag-manager-client/1.912.0/siteEmbedder.bundle.min.js"></script>
  <script src="https://static.wixstatic.com/sites/northline/gallery-carousel.min.js"></script>
  <script id="wix-viewer-model" type="application/json">
    {"site":{"siteId":"wix-northline-01","metaSiteId":"ms-99812","isMobileFriendly":true},"experiments":{"specs.thunderbolt.fastRender":true,"specs.thunderbolt.hydration":true},"fedops":{"biLogger":"https://frog.wix.com","appName":"thunderbolt-renderer"},"routing":{"pages":["home","projects","contact"]}}
  </script>
  <script>
    window.fedops = window.fedops || { phaseStarted: function(){}, phaseEnded: function(){} };
    window.wixBiSession = { visitorId: "vis_9918273", sessionId: "sess_8831", sendBeacon: function(){} };
  </script>
</head>
<body class="wix-site-body">
  <div id="SITE_CONTAINER">
    <header id="SITE_HEADER" data-mesh-id="SITE_HEADERinlineContent">
      <nav aria-label="Primary Navigation">
        <a href="index.html">Northline Studio</a>
        <a href="index.html">Overview</a>
        <a href="projects.html">Selected Works</a>
        <a href="contact.html">Contact</a>
      </nav>
    </header>
    <main id="PAGES_CONTAINER">
      <section id="comp-hero-01" data-testid="section-container">
        <div data-testid="richTextElement">
          <h1>Civic timber architecture built to outlast trends.</h1>
          <p>Northline Studio partners with municipalities, universities, and cultural institutions across Europe to design mass-timber halls and adaptive-reuse campuses with measurable carbon reductions.</p>
          <a href="projects.html" class="wixui-button">Explore Selected Works</a>
        </div>
        <img src="https://static.wixstatic.com/media/northline_pavilion_hero.png" alt="Northline Pavilion in Zurich" />
      </section>

      <section id="comp-practice-02" data-testid="section-container">
        <div data-testid="richTextElement">
          <h2>Three disciplines under one roof</h2>
          <p>Every commission moves seamlessly from environmental site modeling through structural timber detailing and post-occupancy thermal audits.</p>
        </div>
        <div class="wix-repeater-items">
          <article>
            <h3>Mass-Timber Engineering</h3>
            <p>Cross-laminated spruce and beech structural grids prefabricated to 1.5 mm tolerances for rapid quiet assembly.</p>
          </article>
          <article>
            <h3>Adaptive Industrial Reuse</h3>
            <p>Transforming mid-century concrete warehouses into naturally ventilated public libraries and fabrication studios.</p>
          </article>
          <article>
            <h3>Daylight &amp; Acoustic Modeling</h3>
            <p>Passive solar geometry paired with slatted acoustic timber soffits that keep large civic halls calm and legible.</p>
          </article>
        </div>
      </section>

      <section id="comp-study-03" data-testid="section-container">
        <div data-testid="richTextElement">
          <h2>Featured Commission: Limmat Civic Reading Hall</h2>
          <p>Completed in 2025, the 4,200 square meter timber atrium cut embodied carbon by 58% compared to a baseline steel frame and reduced annual heating demand by 44%.</p>
        </div>
        <img src="https://static.wixstatic.com/media/timber_atrium_study.webp" alt="Timber Atrium Study interior elevation" />
      </section>
    </main>
    <footer id="SITE_FOOTER">
      <p>Northline Architecture Studio · Zurich &amp; Basel · All rights reserved.</p>
    </footer>
  </div>
</body>
</html>`;

const WIX_PROJECTS_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="generator" content="Wix.com Website Builder" />
  <meta name="description" content="Selected architectural commissions by Northline Studio across Switzerland and Germany." />
  <title>Selected Works | Northline Architecture</title>
  <link rel="stylesheet" href="https://static.parastorage.com/services/wix-thunderbolt/dist/main.renderer.min.css" />
  <script src="https://static.parastorage.com/services/wix-thunderbolt/dist/main.bundle.min.js"></script>
  <script src="https://static.wixstatic.com/sites/northline/gallery-carousel.min.js"></script>
  <script src="https://frog.wix.com/bt?src=29&evid=3&site=northline-arch"></script>
</head>
<body>
  <header id="SITE_HEADER">
    <nav>
      <a href="index.html">Northline Studio</a>
      <a href="index.html">Overview</a>
      <a href="projects.html">Selected Works</a>
      <a href="contact.html">Contact</a>
    </nav>
  </header>
  <main id="PAGES_CONTAINER">
    <section id="comp-projects-hero">
      <h1>Selected Works (2022–2026)</h1>
      <p>A curated index of civic pavilions, educational campuses, and adaptive warehouse conversions delivered with regional timber fabricators.</p>
    </section>
    <section id="comp-projects-grid">
      <h2>Completed Commissions</h2>
      <article>
        <h3>Limmat Civic Reading Hall — Zurich</h3>
        <p>4,200 sqm municipal library framed in Swiss spruce glulam with geothermal floor conditioning and sawtooth north skylights.</p>
        <img src="https://static.wixstatic.com/media/timber_atrium_study.webp" alt="Limmat Civic Reading Hall interior" />
      </article>
      <article>
        <h3>Rhine Depot Studios — Basel</h3>
        <p>Adaptive conversion of a 1954 rail freight hall into 28 daylight-first design workshops and an open neighborhood courtyard.</p>
        <img src="https://static.wixstatic.com/media/northline_pavilion_hero.png" alt="Rhine Depot Studios facade" />
      </article>
    </section>
  </main>
  <footer id="SITE_FOOTER">
    <p>Northline Architecture Studio · Zurich &amp; Basel</p>
  </footer>
</body>
</html>`;

const WIX_CONTACT_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="generator" content="Wix.com Website Builder" />
  <meta name="description" content="Start a feasibility study or architectural commission inquiry with Northline Studio." />
  <title>Contact | Northline Architecture</title>
  <link rel="stylesheet" href="https://static.parastorage.com/services/wix-thunderbolt/dist/main.renderer.min.css" />
  <script src="https://static.parastorage.com/services/wix-thunderbolt/dist/main.bundle.min.js"></script>
  <script src="https://static.parastorage.com/services/wix-forms-viewer/dist/forms.bundle.min.js"></script>
</head>
<body>
  <header id="SITE_HEADER">
    <nav>
      <a href="index.html">Northline Studio</a>
      <a href="index.html">Overview</a>
      <a href="projects.html">Selected Works</a>
      <a href="contact.html">Contact</a>
    </nav>
  </header>
  <main id="PAGES_CONTAINER">
    <section id="comp-contact">
      <h1>Commission &amp; Feasibility Inquiries</h1>
      <p>Share your site location, approximate floor area, and target timeline. Our partners respond within two business days.</p>
      <form action="#" method="post">
        <label for="name">Full Name</label>
        <input id="name" name="name" type="text" placeholder="Dr. Elena Vance" required />
        <label for="email">Work Email</label>
        <input id="email" name="email" type="email" placeholder="elena@municipality.ch" required />
        <label for="brief">Project Summary</label>
        <textarea id="brief" name="brief" rows="4" placeholder="Describe site constraints, program goals, and schedule..."></textarea>
        <button type="submit">Send Inquiry</button>
      </form>
    </section>
  </main>
  <footer id="SITE_FOOTER">
    <p>Northline Architecture Studio · Hardturmstrasse 161, 8005 Zurich</p>
  </footer>
</body>
</html>`;

const STRIKINGLY_HOME_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="generator" content="Strikingly" />
  <meta name="description" content="PacketDock delivers deterministic webhook routing, local replay queues, and zero-downtime payload inspection for backend engineering teams." />
  <title>PacketDock — Deterministic Webhook Routing</title>
  <link rel="stylesheet" href="https://assets.strikingly.com/assets/themes/fresh/main_v4.css" />
  <link rel="stylesheet" href="https://custom-assets.strikinglycdn.com/sites/packetdock/custom-overrides.css" />
  <script src="https://assets.strikingly.com/assets/packed/bobcat-runtime.min.js"></script>
  <script src="https://assets.strikingly.com/assets/packed/strikingly-sections.min.js"></script>
  <script src="https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js"></script>
  <script src="https://cdn.segment.com/analytics.js/v1/packetdock-key/analytics.min.js"></script>
  <script src="https://custom-assets.strikinglycdn.com/sites/packetdock/pricing-calculator.js"></script>
  <script>
    window.$S = { siteId: 9402182, globalConf: { env: "production", mixpanelToken: "mp_live_8291" }, pageSections: ["hero","features","pricing","contact"] };
  </script>
</head>
<body class="strikingly-site">
  <header class="s-navbar-section">
    <nav class="s-nav">
      <a href="#hero" class="s-brand">PacketDock</a>
      <a href="#features">Architecture</a>
      <a href="#pricing">Plans</a>
      <a href="#contact">Request Demo</a>
    </nav>
  </header>

  <main class="s-page-content">
    <section id="hero" class="s-section s-hero-section">
      <div class="s-title">
        <h1>Reliable webhook delivery without blind retries.</h1>
      </div>
      <div class="s-subtitle">
        <p>Inspect signatures, throttle burst traffic, and replay failed webhook deliveries across staging and production clusters from a single auditable queue.</p>
      </div>
      <a href="#contact" class="s-button">Schedule Engineering Walkthrough</a>
      <img src="https://custom-assets.strikinglycdn.com/res/packetdock_console_overview.webp" alt="PacketDock routing console dashboard" />
    </section>

    <section id="features" class="s-section s-columns-section">
      <h2>Built for high-throughput payment and logistics pipelines</h2>
      <div class="s-columns-grid">
        <div class="s-component">
          <h3>Idempotent Dead-Letter Queues</h3>
          <p>Automatically quarantine 5xx downstream timeouts and replay batched events in strict chronological order once services recover.</p>
        </div>
        <div class="s-component">
          <h3>HMAC Signature Verification</h3>
          <p>Validate Stripe, Shopify, and custom SHA-256 webhook headers at the ingress edge before payloads touch your internal network.</p>
        </div>
        <div class="s-component">
          <h3>Local Tunnel &amp; Offline Replay</h3>
          <p>Export any production webhook stream as a redacted JSON bundle to reproduce edge-case regressions on developer laptops offline.</p>
        </div>
      </div>
    </section>

    <section id="pricing" class="s-section s-pricing-section">
      <h2>Predictable infrastructure tiers</h2>
      <p>Start free for internal staging clusters, or deploy dedicated regional queues with 90-day payload retention.</p>
      <ul>
        <li>Developer Tier — 250,000 deliveries/month, 14-day retention, CLI replay tool ($0/month)</li>
        <li>Growth Tier — 5,000,000 deliveries/month, 60-day retention, custom rate-limiting ($149/month)</li>
        <li>Enterprise Dedicated — Unlimited isolated queues, SOC 2 audit logs, VPC peering (Custom)</li>
      </ul>
    </section>

    <section id="contact" class="s-section s-contact-section">
      <h2>Talk with our infrastructure engineers</h2>
      <p>Tell us your monthly event volume and primary webhook providers.</p>
      <form action="#" method="post">
        <label for="eng-name">Your Name</label>
        <input id="eng-name" name="name" type="text" placeholder="Marcus Chen" required />
        <label for="eng-email">Company Email</label>
        <input id="eng-email" name="email" type="email" placeholder="marcus@acme.io" required />
        <label for="eng-notes">Pipeline Volume &amp; Requirements</label>
        <textarea id="eng-notes" name="notes" rows="4" placeholder="Approx. 4M webhooks/month from Stripe and ERP..."></textarea>
        <button type="submit">Request Architecture Review</button>
      </form>
    </section>
  </main>

  <footer class="s-footer-section">
    <p>PacketDock Systems Inc. · Austin &amp; Frankfurt · Built for deterministic delivery.</p>
  </footer>
</body>
</html>`;

const SVG_SQUARESPACE_CERAMICS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 520" width="920" height="520">
  <rect width="920" height="520" fill="#f5f3ef"/>
  <rect x="0" y="340" width="920" height="180" fill="#e7e2d9"/>
  <ellipse cx="320" cy="368" rx="92" ry="18" fill="#d6cfc3"/>
  <path d="M250 362 C240 280 264 210 288 168 L352 168 C376 210 400 280 390 362 Z" fill="#292524"/>
  <ellipse cx="320" cy="168" rx="32" ry="9" fill="#44403c"/>
  <ellipse cx="565" cy="376" rx="112" ry="20" fill="#d6cfc3"/>
  <path d="M475 370 C475 292 505 244 565 244 C625 244 655 292 655 370 Z" fill="#78716c"/>
  <ellipse cx="565" cy="244" rx="48" ry="11" fill="#a8a29e"/>
  <text x="58" y="80" fill="#1c1917" font-family="serif" font-size="24" font-weight="600">KANSO KILN — AUTUMN VESSEL SERIES</text>
</svg>`;

const SVG_WEBFLOW_GRID = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 520" width="920" height="520">
  <rect width="920" height="520" fill="#0b1120"/>
  <g stroke="#1e293b" stroke-width="1">
    <path d="M0 104 H920 M0 208 H920 M0 312 H920 M0 416 H920"/>
    <path d="M184 0 V520 M368 0 V520 M552 0 V520 M736 0 V520"/>
  </g>
  <rect x="72" y="76" width="776" height="368" rx="10" fill="#111827" stroke="#334155"/>
  <rect x="108" y="132" width="220" height="120" rx="6" fill="#1e293b"/>
  <rect x="350" y="132" width="220" height="120" rx="6" fill="#1e293b"/>
  <rect x="592" y="132" width="220" height="120" rx="6" fill="#1e293b"/>
  <polyline points="108,390 220,352 330,364 460,310 610,322 800,280" fill="none" stroke="#60a5fa" stroke-width="3"/>
  <text x="128" y="182" fill="#f8fafc" font-family="sans-serif" font-size="24" font-weight="700">4.2 ms</text>
  <text x="128" y="210" fill="#94a3b8" font-family="sans-serif" font-size="13">Ingestion p99</text>
  <text x="370" y="182" fill="#34d399" font-family="sans-serif" font-size="24" font-weight="700">128k/s</text>
  <text x="370" y="210" fill="#94a3b8" font-family="sans-serif" font-size="13">Spans Processed</text>
  <text x="612" y="182" fill="#60a5fa" font-family="sans-serif" font-size="24" font-weight="700">0 Drops</text>
  <text x="612" y="210" fill="#94a3b8" font-family="sans-serif" font-size="13">Buffered Local Queue</text>
</svg>`;

const SQUARESPACE_HOME_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="generator" content="Squarespace" />
  <meta name="description" content="Kanso Ceramic Atelier produces small-batch wood-fired stoneware vessels and architectural tiles in Kyoto and Portland." />
  <title>Kanso Ceramic Atelier | Wood-Fired Stoneware</title>
  <link rel="stylesheet" href="https://static1.squarespace.com/static/sitecss/64c291/site.css" />
  <link rel="stylesheet" href="https://assets.squarespace.com/universal/styles-compressed/commerce-9182.min.css" />
  <link rel="stylesheet" href="https://static1.squarespace.com/static/kanso/editorial-overrides.css" />
  <script src="https://assets.squarespace.com/universal/scripts-compressed/common-4b18d.min.js"></script>
  <script src="https://assets.squarespace.com/universal/scripts-compressed/extract-css-runtime-8f22.min.js"></script>
  <script src="https://static1.squarespace.com/static/vta/scripts/site-bundle.min.js"></script>
  <script src="https://assets.squarespace.com/universal/scripts-compressed/performance-a812.min.js"></script>
  <script src="https://static1.squarespace.com/static/kanso/kiln-schedule.js"></script>
  <script id="sqs-context-script">
    Static.SQUARESPACE_CONTEXT = {"templateVersion":"7.1","website":{"id":"sqs-kanso-01","identifier":"kanso-atelier"},"rollups":{"commerce":true,"fluidEngine":true}};
  </script>
</head>
<body class="sqs-site-body">
  <header id="header" class="header">
    <nav class="header-nav">
      <a href="index.html">Kanso Atelier</a>
      <a href="index.html">Collection</a>
      <a href="exhibitions.html">Exhibitions</a>
    </nav>
  </header>
  <main id="page" class="sqs-layout">
    <section class="page-section" data-section-id="sqs-hero-01">
      <div class="sqs-block">
        <h1>Small-batch wood-fired stoneware shaped by ash and clay.</h1>
        <p>Every Kanso vessel is thrown from unrefined Shigaraki and Oregon clay bodies, then fired for seventy-two hours in an anagama tunnel kiln without synthetic glazes.</p>
        <a href="exhibitions.html" class="sqs-button-element--primary">View Upcoming Exhibitions</a>
      </div>
      <div class="sqs-block-image">
        <img data-src="https://images.squarespace-cdn.com/content/v1/kanso/kanso_autumn_vessels.png" alt="Kanso Kiln Autumn Vessel Series stoneware" />
      </div>
    </section>

    <section class="page-section" data-section-id="sqs-craft-02">
      <h2>Studio Practice &amp; Commissions</h2>
      <div class="sqs-block-summary-v2">
        <h3>Tableware for Restaurants</h3>
        <p>Custom matte iron-slip plates and pouring bowls developed in collaboration with seasonal tasting kitchens.</p>
      </div>
      <div class="sqs-block-summary-v2">
        <h3>Architectural Ceramic Tiles</h3>
        <p>Hand-pressed acoustic wall relief tiles engineered for hotel lobbies, tea rooms, and quiet residential entries.</p>
      </div>
      <div class="sqs-block-summary-v2">
        <h3>Private Viewing Appointments</h3>
        <p>Collectors and interior designers may book private weekday appointments at our Portland kiln showroom.</p>
      </div>
    </section>
  </main>
  <footer id="footer-sections">
    <p>Kanso Ceramic Atelier · Portland &amp; Kyoto · Wood-fired stoneware.</p>
  </footer>
</body>
</html>`;

const SQUARESPACE_EXHIBITIONS_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="generator" content="Squarespace" />
  <meta name="description" content="Current gallery exhibitions, kiln openings, and collector inquiry form for Kanso Ceramic Atelier." />
  <title>Exhibitions | Kanso Ceramic Atelier</title>
  <link rel="stylesheet" href="https://static1.squarespace.com/static/sitecss/64c291/site.css" />
  <script src="https://assets.squarespace.com/universal/scripts-compressed/common-4b18d.min.js"></script>
  <script src="https://assets.squarespace.com/universal/scripts-compressed/performance-a812.min.js"></script>
</head>
<body>
  <header id="header">
    <nav>
      <a href="index.html">Kanso Atelier</a>
      <a href="index.html">Collection</a>
      <a href="exhibitions.html">Exhibitions</a>
    </nav>
  </header>
  <main id="page" class="sqs-layout">
    <section class="page-section" data-section-id="sqs-exhibitions-01">
      <h1>2026 Kiln Openings &amp; Exhibitions</h1>
      <ul>
        <li>Autumn Firing No. 14 — Portland Showroom · October 12–28</li>
        <li>Raw Clay &amp; Cedar — Hinoki Gallery, Kyoto · November 15–December 8</li>
        <li>Architectural Surfaces Preview — San Francisco Design Week · February 2027</li>
      </ul>
    </section>
    <section class="page-section" data-section-id="sqs-inquiry-02">
      <h2>Request Exhibition Catalogue</h2>
      <p>Receive high-resolution dimensions, clay provenance notes, and private acquisition availability.</p>
      <form action="#" method="post">
        <label for="collector-name">Full Name</label>
        <input id="collector-name" name="name" type="text" placeholder="Hana Takahashi" required />
        <label for="collector-email">Email Address</label>
        <input id="collector-email" name="email" type="email" placeholder="hana@studio.jp" required />
        <button type="submit">Request Catalogue</button>
      </form>
    </section>
  </main>
</body>
</html>`;

const WEBFLOW_HOME_HTML = `<!doctype html>
<html lang="en" data-wf-site="wf-gridline-9821" data-wf-page="wf-home-01">
<head>
  <meta charset="utf-8" />
  <meta name="generator" content="Webflow" />
  <meta name="description" content="Gridline Telemetry gives platform teams sub-5ms distributed trace ingestion and zero-config OpenTelemetry pipelines." />
  <title>Gridline Telemetry | OpenTelemetry at Edge Speed</title>
  <link rel="stylesheet" href="https://cdn.prod.website-files.com/65a21/css/gridline.webflow.min.css" />
  <script src="https://cdn.prod.website-files.com/65a21/js/webflow.min.js"></script>
  <script src="https://cdn.prod.website-files.com/65a21/js/webflow.schunk.8129.js"></script>
  <script src="https://www.googletagmanager.com/gtag/js?id=G-GRIDLINE01"></script>
  <script src="https://cdn.prod.website-files.com/65a21/js/latency-estimator.js"></script>
</head>
<body>
  <header class="w-nav">
    <nav>
      <a href="index.html">Gridline</a>
      <a href="index.html">Platform</a>
      <a href="security.html">Security</a>
    </nav>
  </header>
  <main>
    <section id="wf-hero">
      <div class="w-richtext">
        <h1>Distributed tracing without sampling blind spots.</h1>
        <p>Capture 100% of anomalous spans across Kubernetes clusters, store compressed columnar traces in your own S3 bucket, and query p99 regressions in milliseconds.</p>
        <a href="security.html" class="w-button">Review Security Architecture</a>
      </div>
      <img src="https://cdn.prod.website-files.com/65a21/gridline_telemetry_mesh.png" alt="Gridline Telemetry ingestion dashboard" />
    </section>
    <section id="wf-capabilities">
      <h2>Engineered for predictable observability bills</h2>
      <div class="w-dyn-item">
        <h3>Native OpenTelemetry Collector</h3>
        <p>Point existing OTLP/gRPC exporters at Gridline with zero proprietary SDK lock-in.</p>
      </div>
      <div class="w-dyn-item">
        <h3>Bring-Your-Own Object Storage</h3>
        <p>Keep raw trace archives inside your own AWS S3 or GCS account with deterministic retention.</p>
      </div>
    </section>
  </main>
  <footer>
    <p>Gridline Telemetry Inc. · Seattle &amp; Berlin</p>
  </footer>
</body>
</html>`;

const WEBFLOW_SECURITY_HTML = `<!doctype html>
<html lang="en" data-wf-site="wf-gridline-9821" data-wf-page="wf-security-02">
<head>
  <meta charset="utf-8" />
  <meta name="generator" content="Webflow" />
  <meta name="description" content="Encryption, SOC 2 Type II controls, and VPC deployment options for Gridline Telemetry." />
  <title>Security Architecture | Gridline Telemetry</title>
  <link rel="stylesheet" href="https://cdn.prod.website-files.com/65a21/css/gridline.webflow.min.css" />
  <script src="https://cdn.prod.website-files.com/65a21/js/webflow.min.js"></script>
</head>
<body>
  <header class="w-nav">
    <nav>
      <a href="index.html">Gridline</a>
      <a href="index.html">Platform</a>
      <a href="security.html">Security</a>
    </nav>
  </header>
  <main>
    <section id="wf-security-overview">
      <h1>Zero-Trust Telemetry Isolation</h1>
      <p>Gridline deploys inside customer-managed VPCs or regional isolated tenants with automatic PII scrubbing at ingress.</p>
      <ul>
        <li>TLS 1.3 in transit and customer-managed KMS keys at rest</li>
        <li>Deterministic regex &amp; field-level redaction before storage</li>
        <li>Annual third-party penetration testing and SOC 2 Type II reports</li>
      </ul>
    </section>
  </main>
</body>
</html>`;

export const SAMPLE_FIXTURES: Record<SampleSiteFixture['id'], SampleSiteFixture> = {
  'wix-studio': {
    id: 'wix-studio',
    label: 'Wix Studio — Northline Architecture (3 pages)',
    platform: 'wix',
    siteName: 'Northline Architecture',
    sourceUrl: 'https://northline-studio.wixsite.com/architecture',
    description:
      'Multi-page Wix site featuring Thunderbolt renderer scripts, Parastorage React bundles, Frog BI telemetry, inline viewerModel JSON, and 3 pages.',
    files: [
      { filename: 'index.html', slug: 'home', html: WIX_HOME_HTML },
      { filename: 'projects.html', slug: 'projects', html: WIX_PROJECTS_HTML },
      { filename: 'contact.html', slug: 'contact', html: WIX_CONTACT_HTML },
    ],
    bundledAssets: [
      {
        originalUrl: 'https://static.wixstatic.com/media/northline_pavilion_hero.png',
        content: SVG_ARCH_HERO,
        mimeType: 'image/png',
        rasterFormat: 'png',
        rasterWidth: 2200,
      },
      {
        originalUrl: 'https://static.wixstatic.com/media/timber_atrium_study.webp',
        content: SVG_ARCH_INTERIOR,
        mimeType: 'image/webp',
        rasterFormat: 'webp',
        rasterWidth: 2000,
      },
      {
        originalUrl: 'https://static.wixstatic.com/sites/northline/gallery-carousel.min.js',
        content: `/* Localized custom gallery helper */\nwindow.NorthlineGallery = { init: function() { document.querySelectorAll('.pp-gallery img').forEach(function(el){ el.dataset.ready = 'true'; }); } };\n`,
        mimeType: 'application/javascript',
      },
      {
        originalUrl: 'https://static.wixstatic.com/ufonts/northline-theme.css',
        content: `/* Localized Northline accent overrides */\n:root { --pp-accent: #1e3a8a; }\n`,
        mimeType: 'text/css',
      },
    ],
  },
  'squarespace-editorial': {
    id: 'squarespace-editorial',
    label: 'Squarespace 7.1 — Kanso Ceramic Atelier (2 pages)',
    platform: 'squarespace',
    siteName: 'Kanso Ceramic Atelier',
    sourceUrl: 'https://kanso-atelier.squarespace.com',
    description:
      'Squarespace 7.1 Fluid Engine site with Static.SQUARESPACE_CONTEXT, universal scripts-compressed bundles, performance telemetry, and lazy data-src imagery.',
    files: [
      { filename: 'index.html', slug: 'home', html: SQUARESPACE_HOME_HTML },
      { filename: 'exhibitions.html', slug: 'exhibitions', html: SQUARESPACE_EXHIBITIONS_HTML },
    ],
    bundledAssets: [
      {
        originalUrl: 'https://images.squarespace-cdn.com/content/v1/kanso/kanso_autumn_vessels.png',
        content: SVG_SQUARESPACE_CERAMICS,
        mimeType: 'image/png',
        rasterFormat: 'png',
        rasterWidth: 2200,
      },
      {
        originalUrl: 'https://static1.squarespace.com/static/kanso/kiln-schedule.js',
        content: `/* Localized Kanso kiln firing schedule helper */\nwindow.KansoKiln = { nextFiring: '2026-10-12' };\n`,
        mimeType: 'application/javascript',
      },
      {
        originalUrl: 'https://static1.squarespace.com/static/kanso/editorial-overrides.css',
        content: `/* Localized Kanso editorial overrides */\n:root { --pp-accent: #292524; }\n`,
        mimeType: 'text/css',
      },
    ],
  },
  'strikingly-launch': {
    id: 'strikingly-launch',
    label: 'Strikingly — PacketDock Launch Site (One-Page)',
    platform: 'strikingly',
    siteName: 'PacketDock',
    sourceUrl: 'https://packetdock.mystrikingly.com',
    description:
      'Classic Strikingly multi-section landing site with Bobcat runtime JS, Strikingly section scripts, Mixpanel/Segment trackers, and custom pricing script.',
    files: [
      { filename: 'index.html', slug: 'home', html: STRIKINGLY_HOME_HTML },
    ],
    bundledAssets: [
      {
        originalUrl: 'https://custom-assets.strikinglycdn.com/res/packetdock_console_overview.webp',
        content: SVG_PRODUCT_BOARD,
        mimeType: 'image/webp',
        rasterFormat: 'webp',
        rasterWidth: 2100,
      },
      {
        originalUrl: 'https://custom-assets.strikinglycdn.com/sites/packetdock/pricing-calculator.js',
        content: `/* Localized custom pricing helper */\nwindow.PacketDockPricing = { tiers: ['Developer', 'Growth', 'Enterprise'] };\n`,
        mimeType: 'application/javascript',
      },
      {
        originalUrl: 'https://custom-assets.strikinglycdn.com/sites/packetdock/custom-overrides.css',
        content: `/* Localized PacketDock palette overrides */\n:root { --pp-accent: #0284c7; }\n`,
        mimeType: 'text/css',
      },
    ],
  },
  'webflow-saas': {
    id: 'webflow-saas',
    label: 'Webflow — Gridline Telemetry (2 pages)',
    platform: 'webflow',
    siteName: 'Gridline Telemetry',
    sourceUrl: 'https://gridline-telemetry.webflow.io',
    description:
      'Webflow multi-page SaaS export featuring webflow.min.js runtime chunks, Google Tag Manager, website-files.com CDN assets, and w-richtext sections.',
    files: [
      { filename: 'index.html', slug: 'home', html: WEBFLOW_HOME_HTML },
      { filename: 'security.html', slug: 'security', html: WEBFLOW_SECURITY_HTML },
    ],
    bundledAssets: [
      {
        originalUrl: 'https://cdn.prod.website-files.com/65a21/gridline_telemetry_mesh.png',
        content: SVG_WEBFLOW_GRID,
        mimeType: 'image/png',
        rasterFormat: 'png',
        rasterWidth: 2200,
      },
      {
        originalUrl: 'https://cdn.prod.website-files.com/65a21/js/latency-estimator.js',
        content: `/* Localized Gridline latency estimator */\nwindow.GridlineEstimator = { p99Ms: 4.2 };\n`,
        mimeType: 'application/javascript',
      },
      {
        originalUrl: 'https://cdn.prod.website-files.com/65a21/css/gridline.webflow.min.css',
        content: `/* Localized Gridline palette overrides */\n:root { --pp-accent: #1d4ed8; }\n`,
        mimeType: 'text/css',
      },
    ],
  },
};
