import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Bio-Farm × Kattale Group of Brands | Traceable farming on Farm2Market",
  description:
    "Bio-Farm (UNODE AGRO Uganda Limited) and Kattale Group of Brands: before-and-after pictures with GPS and dates for Bio-Farm farms, recorded on Farm2Market.",
};

// Product and company facts below are as published by Bio-Farm at unodeagro.com.
// Everything about records, GPS, photos, QR codes and reports describes what
// Farm2Market does today.

const recordFields = [
  { label: "Tree tag photo", text: "The numbered tag on the tree, so the record belongs to one tree." },
  { label: "Coffee tree photo", text: "The tree itself, on the day." },
  { label: "Tag name or number", text: "The farmer’s name for the tree." },
  { label: "Date", text: "Set to the day the record is made." },
  { label: "GPS point", text: "Captured by the phone when the form opens." },
];

const steps = [
  {
    title: "Join the Bio-Farm community",
    text: "Farmers who use Bio-Farm join its community on Farm2Market. Each member is approved by Bio-Farm’s team.",
  },
  {
    title: "Tag the tree: the “before”",
    text: "A required form with two photos, the tag name or number, the date and the phone’s GPS point. Its fields are fixed, so every farm is recorded the same way, and it cannot be deleted.",
  },
  {
    title: "Plan and record each spray",
    text: "The fertilizer planner sets the spray dates and dose for the crop and reminds the farmer on the day. After each spray the farmer records it with photos: best leaf, worst leaf, whole plant, flowers, fruits and a field overview.",
  },
  {
    title: "Photograph again: the “after”",
    text: "Every later visit is a new record with its own date and GPS point, so the same tree or field can be compared weeks apart.",
  },
  {
    title: "Bio-Farm reviews and exports",
    text: "Bio-Farm’s admins see which farms are active, open any farmer’s records and export them to PDF with photos, GPS and date: one record, a selection or all.",
  },
  {
    title: "The evidence earns the guarantee",
    text: "The Yield Guarantee switches on only when the dose is right, sprays are on time, the required photos are in and every record is complete. By default the dose must be within 5% and each spray within a day of plan.",
  },
];

const marketLinks = [
  {
    title: "On every goods QR",
    text: "Scanning a coffee lot’s QR shows how much of it traces to farms on Farm2Market, in plain words: “X% traces to Y farms”.",
  },
  {
    title: "A six-stage coffee journey",
    text: "Export lots follow harvest at the farm, drying, hulling, grading, warehouse and export bagging. Each stage carries photos with GPS and weights in and out, and a weight that rises between stages is flagged.",
  },
  {
    title: "Farm stages checked by the community",
    text: "Harvest and drying are verified by an admin of the farmer’s own community. For Bio-Farm growers, that is Bio-Farm.",
  },
  {
    title: "A report buyers can open",
    text: "The traceability report downloads as a PDF, with farm locations as GeoJSON. It states EUDR geolocation readiness only when every farm has a GPS point and farms over 4 hectares have a boundary. The importer still files its own due diligence statement.",
  },
];

const roles = [
  {
    who: "Bio-Farm brings",
    points: [
      "The Bio-Farm organic liquid fertilizer and its crop guidance",
      "Agronomists, farmer training and field demonstrations",
      "A network of 80+ authorised agro-dealers",
      "The coffee programme and its export plans",
    ],
  },
  {
    who: "Kattale Group of Brands brings",
    points: [
      "The Bio-Farm community on Farm2Market, with the Coffee Tag and spray records",
      "Photo, GPS and date capture on the farmer’s own phone",
      "QR traceability and reports from farm to buyer",
      "MarketSpace, where Bio-Farm farmers can sell their produce",
    ],
  },
];

const productFacts = [
  { label: "What it is", text: "A liquid organic fertilizer, described by Bio-Farm as about 90% amino acids and 10% NPK." },
  { label: "How it is used", text: "Applied as a foliar spray, diluted in water, with the dose set by crop." },
  { label: "Crops", text: "Coffee, bananas, tea, maize, tomatoes, cotton and horticulture." },
  { label: "Registration", text: "Product registration approved on 24 February 2021 (Min. No. ACB/49/6/2021)." },
  { label: "Field results", text: "Bio-Farm reports greener foliage within two to three weeks in its client evaluations." },
];

const phases = [
  { phase: "Phase 1", text: "Uganda as the base" },
  { phase: "Phase 2", text: "Kenya, Rwanda and Tanzania" },
  { phase: "Phase 3", text: "DR Congo" },
];

const leaders = [
  { name: "Joseph Z. Mugwanya", role: "Founder & CEO, Environmental Engineer" },
  { name: "Isaac Tom Musumba", role: "Software, Sales & Traceability Development Partner" },
  { name: "Joseph Nyakairu", role: "Director, Finance" },
  { name: "Sarah Namugwanya", role: "Director of Sales & Marketing" },
  { name: "Latim Muhuma Mukalazi", role: "Administrator" },
  { name: "Lutaaya Ernest", role: "Company Secretary" },
];

const socials = [
  { label: "Website", href: "https://unodeagro.com" },
  { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61557047120306" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/bio-farm-ug" },
  { label: "Instagram", href: "https://www.instagram.com/biofarmug/" },
  { label: "YouTube", href: "https://www.youtube.com/channel/UC2hz_MdvIDeklG_ta0bDhTw" },
  { label: "TikTok", href: "https://www.tiktok.com/@biofarmug" },
  { label: "X", href: "https://twitter.com/biofarm_UG" },
];

export default function BioFarmPartnerPage() {
  return (
    <main className={styles.page}>
      <div className={styles.accentBar} />
      <header className={styles.header}>
        <div className={styles.container + " " + styles.nav}>
          <a className={styles.brand} href="#top" aria-label="Bio-Farm partner page home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.brandLogo} src="/biofarmlogo.jpeg" alt="" width={44} height={44} />
            <span>
              Bio-Farm
              <small>× Kattale Group of Brands</small>
            </span>
          </a>
          <nav className={styles.navLinks} aria-label="Main navigation">
            <a href="#partnership">Partnership</a>
            <a href="#traceability">Traceability</a>
            <a href="#product">Product</a>
            <a href="#network">Network</a>
            <a className={styles.navCta} href="#contact">
              Contact Bio-Farm <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </div>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.container + " " + styles.heroGrid}>
          <div>
            <div className={styles.eyebrow}>Strategic partner · Kattale Group of Brands</div>
            <h1>
              Proof from the farm,
              <br />
              <span>on the record.</span>
            </h1>
            <p className={styles.heroText}>
              Bio-Farm and Kattale Group of Brands work together so that every
              Bio-Farm farm is recorded on Farm2Market with before-and-after
              pictures, a GPS point and a date.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.buttonLight} href="#traceability">
                See how it works <span aria-hidden="true">↓</span>
              </a>
              <a className={styles.buttonOutline} href="#contact">
                Contact Bio-Farm <span aria-hidden="true">↗</span>
              </a>
            </div>
            <p className={styles.heroNote}>
              Science. Soil. Sustainability. Prosperity.
            </p>
          </div>

          <div
            className={styles.record}
            role="img"
            aria-label="Example layout of a Bio-Farm record: a before photo and an after photo, each with a date and a GPS point"
          >
            <div className={styles.recordTop}>
              <span>Bio-Farm Coffee Tag</span>
              <span className={styles.recordBadge}>Example layout</span>
            </div>
            <div className={styles.shots}>
              <figure className={styles.shot}>
                <div className={styles.shotBefore}>
                  <Plant full={false} />
                </div>
                <figcaption>
                  <b>Before</b>
                  <span>Date · GPS point</span>
                </figcaption>
              </figure>
              <figure className={styles.shot}>
                <div className={styles.shotAfter}>
                  <Plant full />
                </div>
                <figcaption>
                  <b>After</b>
                  <span>Date · GPS point</span>
                </figcaption>
              </figure>
            </div>
            <ul className={styles.recordRows}>
              <li><span>Tree tag photo</span><b>Required</b></li>
              <li><span>Coffee tree photo</span><b>Required</b></li>
              <li><span>Date and GPS</span><b>Stamped on the record</b></li>
            </ul>
            <p className={styles.recordNote}>
              Real records carry the farmer’s own photos. Nothing on this card is a real farm.
            </p>
          </div>
        </div>
      </section>

      <div className={styles.stats}>
        <div className={styles.container + " " + styles.statsGrid}>
          <div><strong>2 photos</strong><span>Required on every coffee tag</span></div>
          <div><strong>GPS + date</strong><span>Stamped on each record</span></div>
          <div><strong>6 stages</strong><span>Farm to export bag</span></div>
          <div><strong>80+</strong><span>Authorised agro-dealers (Bio-Farm)</span></div>
        </div>
      </div>

      <section className={styles.section} id="partnership">
        <div className={styles.container}>
          <SectionHeading
            kicker="The partnership"
            title="Two companies, one record of what works."
            description="Bio-Farm makes and teaches the product. Kattale Group of Brands and Farm2Market keep the evidence safe and make it easy to read."
          />
          <div className={styles.partnerCard}>
            <div>
              <h3>Kattale Group of Brands (Uganda) Ltd</h3>
              <p>
                Strategic partner of UNODE AGRO Uganda Limited (Bio-Farm), working
                with Kattale Global Holdings (USA) Ltd, to bring Bio-Farm’s
                community, its farmers’ records and its coffee traceability onto
                Farm2Market.
              </p>
            </div>
            <span>Strategic partner</span>
          </div>
          <div className={styles.roleGrid}>
            {roles.map((r) => (
              <article className={styles.infoCard} key={r.who}>
                <h3>{r.who}</h3>
                <ul className={styles.tick}>
                  {r.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section + " " + styles.white} id="traceability">
        <div className={styles.container}>
          <SectionHeading
            kicker="Traceability reporting"
            title="Before and after, with GPS, on the record."
            description="Farm2Market’s main job for Bio-Farm is simple: show what Bio-Farm did on each farm, with pictures, place and date, so results are shown and not just claimed."
          />

          <h3 className={styles.subHeading}>What one record holds</h3>
          <div className={styles.fieldGrid}>
            {recordFields.map((f, i) => (
              <div className={styles.fieldItem} key={f.label}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <h4>{f.label}</h4>
                <p>{f.text}</p>
              </div>
            ))}
          </div>

          <h3 className={styles.subHeading}>How a farm gets on the record</h3>
          <ol className={styles.steps}>
            {steps.map((s, i) => (
              <li className={styles.step} key={s.title}>
                <span className={styles.stepNo}>{i + 1}</span>
                <h4>{s.title}</h4>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.section + " " + styles.dark} id="market">
        <div className={styles.container}>
          <SectionHeading
            kicker="From the farm record to the market"
            title="The same farmers, followed all the way to the buyer."
            description="When Bio-Farm growers sell coffee through Farm2Market, the lot can be traced back to their farms, and the report can be opened by the people entitled to it."
          />
          <div className={styles.marketGrid}>
            {marketLinks.map((m, i) => (
              <article className={styles.marketCard} key={m.title}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <h3>{m.title}</h3>
                <p>{m.text}</p>
              </article>
            ))}
          </div>
          <div className={styles.privacy}>
            <strong>Protecting farmers and buyers.</strong> A QR page never shows a
            farmer’s phone number. Farm locations are shared inside the
            traceability report, with the people entitled to see it.
          </div>
        </div>
      </section>

      <section className={styles.section} id="product">
        <div className={styles.container + " " + styles.productGrid}>
          <div className={styles.productVisual}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/biofarm_bottle.png" alt="Bio-Farm organic liquid fertilizer bottle" width={260} height={260} loading="lazy" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.productSeal} src="/biofarmlogo.jpeg" alt="Bio-Farm purely organic fertilizer seal" width={120} height={120} loading="lazy" />
          </div>
          <div>
            <SectionHeading
              kicker="The product"
              title="Bio-Farm organic liquid fertilizer."
              description="Product facts are as published by Bio-Farm (UNODE AGRO Uganda Limited)."
            />
            <dl className={styles.facts}>
              {productFacts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.text}</dd>
                </div>
              ))}
            </dl>
            <a className={styles.textLink} href="https://unodeagro.com" target="_blank" rel="noreferrer">
              See Bio-Farm’s own client performance reports <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

      <section className={styles.section + " " + styles.white} id="network">
        <div className={styles.container}>
          <SectionHeading
            kicker="Network and reach"
            title="Agro-dealers, trainers and a plan to grow."
            description="Bio-Farm sells through authorised agro-dealers, trains farmers in groups and on their own farms, and is growing across the region."
          />
          <div className={styles.roleGrid}>
            <article className={styles.infoCard}>
              <h3>Where Bio-Farm works</h3>
              <ul className={styles.tick}>
                <li>80+ authorised agro-dealers across Central, Eastern and Northern Uganda</li>
                <li>Agents being onboarded in Kenya and Rwanda</li>
                <li>Farmer training, field demonstrations and agronomist support</li>
              </ul>
            </article>
            <article className={styles.infoCard}>
              <h3>Bio-Farm’s expansion plan</h3>
              <ol className={styles.phaseList}>
                {phases.map((p) => (
                  <li key={p.phase}>
                    <b>{p.phase}</b> {p.text}
                  </li>
                ))}
              </ol>
            </article>
          </div>

          <h3 className={styles.subHeading}>Leadership</h3>
          <div className={styles.leaderGrid}>
            {leaders.map((l) => (
              <article className={styles.infoCard} key={l.name}>
                <h3>{l.name}</h3>
                <p>{l.role}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section + " " + styles.contact} id="contact">
        <div className={styles.container + " " + styles.contactGrid}>
          <div>
            <SectionHeading
              kicker="Contact Bio-Farm"
              title="Talk to Bio-Farm."
              description="For product, agent and distributor enquiries, and for farmer training, contact UNODE AGRO Uganda Limited directly."
            />
            <div className={styles.contactCard}>
              <h3>UNODE AGRO Uganda Limited (Bio-Farm)</h3>
              <ContactRow label="Phone">
                <a href="tel:+256772974408">+256 772 974 408</a>
                <br />
                <a href="tel:+256701974408">+256 701 974 408</a>
              </ContactRow>
              <ContactRow label="WhatsApp">
                <a href="https://wa.me/256701974408" target="_blank" rel="noreferrer">
                  Chat on +256 701 974 408
                </a>
              </ContactRow>
              <ContactRow label="Email">
                <a href="mailto:inquiries@unodeagro.com">inquiries@unodeagro.com</a>
              </ContactRow>
              <ContactRow label="Office">
                Buyala-Naziri, 14 miles along Mityana Road, P.O. Box 106619, Kampala, Uganda
              </ContactRow>
              <ContactRow label="Online">
                <span className={styles.socialRow}>
                  {socials.map((s) => (
                    <a key={s.label} href={s.href} target="_blank" rel="noreferrer">
                      {s.label}
                    </a>
                  ))}
                </span>
              </ContactRow>
            </div>
          </div>
          <div className={styles.joinCard}>
            <h3>Bio-Farm farmer?</h3>
            <p>
              Join the Bio-Farm community on Farm2Market to record your farm with
              pictures, GPS and dates, and to follow your sprays.
            </p>
            <a href="/">
              Open Farm2Market <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.container + " " + styles.footerRow}>
          <a className={styles.brand} href="#top">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.brandLogo} src="/biofarmlogo.jpeg" alt="" width={36} height={36} />
            <span>Bio-Farm<small>× Kattale Group of Brands</small></span>
          </a>
          <nav aria-label="Footer navigation">
            <a href="#partnership">Partnership</a>
            <a href="#traceability">Traceability</a>
            <a href="#contact">Contact</a>
            <a href="mailto:inquiries@unodeagro.com">Email</a>
          </nav>
        </div>
        <div className={styles.container + " " + styles.footerNote}>
          Product and company facts are as published by Bio-Farm (UNODE AGRO Uganda Limited) at unodeagro.com.
        </div>
      </footer>
    </main>
  );
}

function SectionHeading({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description?: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <span>{kicker}</span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

function ContactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.contactRow}>
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}

/** A simple coffee plant drawing: sparse for the "before", full with cherries for the "after". */
function Plant({ full }: { full: boolean }) {
  const leaves = full
    ? [
        { x: 60, y: 92, r: -62 }, { x: 60, y: 92, r: 62 },
        { x: 60, y: 76, r: -48 }, { x: 60, y: 76, r: 48 },
        { x: 60, y: 60, r: -34 }, { x: 60, y: 60, r: 34 },
        { x: 60, y: 44, r: -20 }, { x: 60, y: 44, r: 20 },
      ]
    : [
        { x: 60, y: 92, r: -58 }, { x: 60, y: 92, r: 58 },
        { x: 60, y: 76, r: -40 },
      ];
  const fill = full ? "#2a8a43" : "#b8c46a";
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <line x1="60" y1="112" x2="60" y2={full ? 34 : 70} stroke={full ? "#3b6b2c" : "#8a8f4a"} strokeWidth="3" strokeLinecap="round" />
      {leaves.map((l, i) => (
        <ellipse key={i} cx={l.x} cy={l.y - 12} rx="8" ry="20" fill={fill} transform={`rotate(${l.r} ${l.x} ${l.y})`} />
      ))}
      {full ? (
        <>
          <circle cx="47" cy="88" r="3.6" fill="#c8302f" />
          <circle cx="73" cy="84" r="3.6" fill="#c8302f" />
          <circle cx="52" cy="66" r="3.6" fill="#c8302f" />
          <circle cx="69" cy="62" r="3.6" fill="#c8302f" />
        </>
      ) : null}
    </svg>
  );
}
