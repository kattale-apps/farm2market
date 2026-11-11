import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "BAAKTech Uganda Limited | Software engineering solutions",
  description:
    "BAAKTech Uganda Limited: custom software engineering, IT infrastructure and commercial product distribution in Uganda. Incorporated 2016.",
};

const services = [
  {
    title: "Custom software design & development",
    description:
      "Bespoke web, desktop and Android applications built around your workflows, from civic reporting apps to solar sales systems and agricultural marketplaces.",
  },
  {
    title: "Software engineering contracts",
    description:
      "Flexible engineering support for NGOs, international missions, law firms and commercial enterprises that need dedicated technical execution.",
  },
  {
    title: "Network setup & IT infrastructure",
    description:
      "Design, structured cabling, configuration and deployment of secure LAN and Wi-Fi networks and office IT environments.",
  },
  {
    title: "Computer hardware & software supply",
    description:
      "Procurement, deployment and licensing of enterprise computer hardware, with off-the-shelf and customised software packages.",
  },
  {
    title: "Database engineering & data management",
    description:
      "Secure local and cloud databases for high-integrity data capture, reporting and analytics.",
  },
  {
    title: "Product onboarding, marketing & distribution",
    description:
      "Market entry and growth services: field marketing, user acquisition and KYC onboarding, distribution and channel management.",
  },
  {
    title: "Installation, maintenance & after-sales",
    description:
      "Installation, routine maintenance, troubleshooting and warranty support for IT systems and distributed hardware and energy products.",
  },
];

const milestones = [
  {
    year: "2016",
    title: "Incorporation & civic tech launch",
    text: "Incorporated in Uganda. Contracted by ActionAid Uganda to develop and deploy the “I Paid a Bribe” Android app to support public accountability.",
  },
  {
    year: "2017",
    title: "International mission data systems",
    text: "Contracted to design, develop and deploy a localised user-data capture database for the AMISOM (African Union Mission in Somalia) project.",
  },
  {
    year: "2018 – now",
    title: "Enterprise IT & solar sector expansion",
    text: "Enterprise network installations, hardware supply and custom sales software for Uganda’s renewable energy and legal sectors.",
  },
  {
    year: "Ongoing",
    title: "Brand onboarding & distribution",
    text: "User onboarding, marketing and distribution campaigns for global digital platforms and product manufacturers.",
  },
  {
    year: "Current",
    title: "Proprietary AgTech innovation",
    text: "Leading the development, deployment and operation of Farm2MarketUganda.com, connecting agricultural value-chain participants across Uganda.",
  },
];

const values = [
  { title: "Reliability", text: "Robust software systems, genuine hardware and dependable after-sales maintenance." },
  { title: "Practical innovation", text: "User-friendly software and digital platforms tailored to local operational realities." },
  { title: "Integrity", text: "Transparency and accountability in every client contract, data system and commercial partnership." },
  { title: "Client-centric execution", text: "Technology deployment, user onboarding and technical support aligned with measurable client goals." },
];

const objectives = [
  "Agricultural digital transformation: scale Farm2MarketUganda.com into a premier digital marketplace for Ugandan agribusinesses, suppliers and farmers.",
  "Renewable energy & hardware reach: expand distribution, installation and maintenance coverage for solar and electronics partners across Uganda.",
  "Custom software & data excellence: deliver high-impact software and database contracts for corporate, legal and institutional clients.",
  "Long-term client retention: responsive after-sales support and preventative IT maintenance.",
];

const industries = [
  {
    title: "Solar distribution & renewable energy",
    text: "A dual role: custom sales technology plus physical distribution, installation and after-sales maintenance for solar and power brands including LVtopsun, Sumry, Lumina (Lumina Solar), Green Energy, Sine Excel and Isuna.",
    detail: "Solar sales application built to streamline field and showroom sales for SHENZHEN SINEXCEL ISUNA ENERGY TECHNOLOGY CO. LTD.",
    href: "https://lumina-xi-ochre-15.vercel.app/",
    link: "View the solar sales application",
  },
  {
    title: "Agriculture & digital market systems",
    text: "Developer and operator of Farm2MarketUganda.com, a digital platform that streamlines connections, market access and commercial transactions across Uganda’s agricultural sector.",
    detail: "Scope: product architecture, web platform development, user onboarding workflows, database management and ongoing technical support.",
    href: "https://farm2marketuganda.com",
    link: "Visit Farm2MarketUganda.com",
  },
  {
    title: "Civic accountability, missions & digital finance",
    text: "Mobile civic-reporting tools for ActionAid Uganda and secure user-data capture for the AMISOM project. Large-scale user onboarding and adoption campaigns for Binance, CoinList, Huobi and MobiBuy.",
    detail: "Marketing, distribution and supply-chain support for brands including Target Link, Holdex, MYP, DSPD, Double Barrel, Vicland, UBL, Katale Global and Takenow.",
  },
];

const caseStudies = [
  {
    category: "Civic accountability · 2016",
    title: "“I Paid a Bribe” Android application",
    client: "ActionAid Uganda",
    challenge:
      "An accessible, mobile-first tool for Ugandan citizens to document and report bribery and public-service corruption in real time.",
    solution:
      "BAAKTech developed, tested and deployed the Android application with incident submission forms, categorised reporting workflows, secure data transmission and an administrative reporting backend.",
    impact:
      "Streamlined citizen reporting and digital data collection for ActionAid Uganda’s anti-corruption advocacy.",
    status: "Completed and deployed",
  },
  {
    category: "International missions · 2017",
    title: "Local user data capture database system",
    client: "AMISOM project",
    challenge:
      "A reliable, locally hosted database to capture, structure and store user records in environments with strict operational and connectivity demands.",
    solution:
      "A customised local database with structured data-entry interfaces, validation rules against duplicate or incomplete records, local storage resilience and export and reporting functions.",
    impact: "Improved speed, accuracy and reliability of user record management on the ground.",
    status: "Completed and deployed",
  },
  {
    category: "Agriculture & digital commerce",
    title: "Farm2MarketUganda.com digital marketplace",
    client: "BAAKTech proprietary product",
    challenge:
      "Agricultural producers and buyers in Uganda face fragmented market information, middleman inefficiencies and limited digital visibility.",
    solution:
      "A dedicated platform connecting farmers, suppliers and buyers: producer and buyer onboarding, product listings, market discovery tools and transaction facilitation.",
    impact:
      "A centralised digital channel for Ugandan agricultural stakeholders to showcase produce and connect directly with market demand.",
    status: "Ongoing: active development and operations",
    href: "https://farm2marketuganda.com",
  },
];

const technology = [
  { label: "Languages", text: "Java, Kotlin, JavaScript, PHP, Python, SQL" },
  { label: "Frameworks", text: "Android SDK, React, Laravel, Node.js, Bootstrap" },
  { label: "Databases", text: "MySQL, PostgreSQL, SQLite and MS SQL Server, for offline-capable local and cloud deployments" },
  { label: "Cloud & DevOps", text: "Web hosting, domain and SSL management, local server configuration, automated backups" },
  { label: "Mobile & web", text: "Native Android, responsive web applications, customised off-the-shelf software integration" },
  { label: "Infrastructure", text: "LAN setup, router and switch configuration, workstation deployment, solar and power hardware installation" },
  { label: "Integrations", text: "RESTful APIs, messaging and notification gateways, user onboarding workflows" },
  { label: "Support", text: "Preventative maintenance, troubleshooting, software enhancements and after-sales service for installed hardware and solar systems" },
];

const lifecycle = [
  "Discovery & requirements",
  "Architecture & design",
  "Development & configuration",
  "Testing & quality assurance",
  "Deployment, onboarding & staff training",
];

const partnerGroups = [
  { title: "Renewable energy & power equipment", text: "LVtopsun, Sumry, Lumina (Lumina Solar), Green Energy, Sine Excel, Isuna", role: "Distribution, installation, maintenance and after-sales support" },
  { title: "Global digital & fintech platforms", text: "Binance, CoinList, Huobi, MobiBuy", role: "User onboarding, market activation and community growth" },
  { title: "Consumer goods & local enterprises", text: "Target Link, Holdex, MYP, DSPD, Double Barrel, Vicland, UBL, Takenow", role: "Marketing, product distribution and channel support" },
];

const team = [
  { title: "Leadership & management", text: "Experienced Ugandan technology and commercial practitioners with a 10-year track record in contractual software delivery, enterprise IT infrastructure and multi-brand product distribution." },
  { title: "Software & database engineering", text: "Application developers, database administrators and QA specialists for custom builds and platform maintenance." },
  { title: "IT infrastructure & technical support", text: "Network engineers, hardware technicians and solar and equipment installation and maintenance specialists." },
  { title: "Commercial onboarding & distribution", text: "Field marketing officers, onboarding coordinators and distribution logistics personnel." },
];

const governance = [
  { title: "Project management", text: "Milestone-driven execution with clear scope, regular client updates, structured change control and formal UAT sign-off." },
  { title: "Software quality", text: "Pre-deployment functional testing, input validation, peer code reviews and structured version control." },
  { title: "Data protection & privacy", text: "Client confidentiality and data minimisation, aligned with Uganda’s Data Protection and Privacy Act, 2019." },
  { title: "Information security", text: "Role-based access control, encrypted transmission (HTTPS/SSL), secure database authentication and regular backups." },
  { title: "Business continuity", text: "Redundant backups for hosted platforms, spare-parts availability and field technician dispatch for hardware and solar installations." },
];

const reasons = [
  { title: "A ten-year track record", text: "Established in Uganda in 2016, with a decade of continuous delivery across software, IT infrastructure and commercial contracts." },
  { title: "Trusted by institutions and global platforms", text: "Execution for ActionAid Uganda, the AMISOM project, Binance, CoinList, Huobi and LVtopsun." },
  { title: "Tech plus field distribution", text: "Custom software combined with hardware supply, network setup, user onboarding and nationwide product distribution." },
  { title: "End-to-end after-sales commitment", text: "Accountability from system design or product import through installation, training and ongoing maintenance." },
  { title: "Deep local market knowledge", text: "Ugandan business workflows, consumer onboarding, legal services, solar adoption and agricultural value chains." },
];

export default function BaaktechPage() {
  return (
    <main className={styles.page}>
      <div className={styles.accentBar} />
      <header className={styles.header}>
        <div className={styles.container + " " + styles.nav}>
          <a className={styles.brand} href="#top" aria-label="BAAKTech home">
            <span className={styles.brandMark}>BT</span>
            <span>
              BAAKTech
              <small>Uganda Limited</small>
            </span>
          </a>
          <nav className={styles.navLinks} aria-label="Main navigation">
            <a href="#about">About</a>
            <a href="#services">Services</a>
            <a href="#work">Our work</a>
            <a href="#partners">Partners</a>
            <a className={styles.navCta} href="#contact">
              Get in touch <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </div>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.container + " " + styles.heroGrid}>
          <div>
            <div className={styles.eyebrow}>Software engineering · Uganda</div>
            <h1>
              Software engineering
              <br />
              <span>solutions.</span>
            </h1>
            <p className={styles.heroText}>
              BAAKTech Uganda Limited delivers custom software engineering, IT
              infrastructure and commercial product distribution for businesses,
              NGOs and international missions.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.buttonLight} href="#work">
                Explore our work <span aria-hidden="true">↓</span>
              </a>
              <a className={styles.buttonOutline} href="#contact">
                Talk to our team <span aria-hidden="true">↗</span>
              </a>
            </div>
            <p className={styles.heroNote}>
              Incorporated in Uganda 2016 <span>·</span> Wandegeya, Kampala
            </p>
          </div>

          <div className={styles.showcase} aria-label="BAAKTech at a glance">
            <div className={styles.showcaseTop}>
              <span>BAAKTech · what we do</span>
              <span className={styles.windowDots} aria-hidden="true">
                <i /> <i /> <i />
              </span>
            </div>
            <div className={styles.mockScreen}>
              <div className={styles.mockRail} aria-hidden="true">
                <i /> <i /> <i /> <i /> <i />
              </div>
              <div className={styles.mockContent}>
                <span className={styles.mockLabel}>Three areas of work</span>
                <strong>Software, infrastructure, distribution</strong>
                <div className={styles.mockCards}>
                  <div><b>01</b><span>Software</span></div>
                  <div><b>02</b><span>IT infrastructure</span></div>
                  <div><b>03</b><span>Distribution</span></div>
                </div>
                <div className={styles.mockChart}>
                  <span>Since 2016</span>
                  <svg viewBox="0 0 400 70" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0,58 C45,53 48,38 92,44 S151,62 193,36 S248,28 285,34 S348,12 400,8" />
                  </svg>
                </div>
              </div>
            </div>
            <div className={styles.floatingTag}>
              <strong>10 years</strong>
              of delivery in Uganda
            </div>
          </div>
        </div>
      </section>

      <div className={styles.stats}>
        <div className={styles.container + " " + styles.statsGrid}>
          <div><strong>2016</strong><span>Incorporated in Uganda</span></div>
          <div><strong>Software</strong><span>Custom engineering</span></div>
          <div><strong>IT</strong><span>Infrastructure &amp; hardware</span></div>
          <div><strong>Field</strong><span>Distribution &amp; after-sales</span></div>
        </div>
      </div>

      <section className={styles.section} id="about">
        <div className={styles.container + " " + styles.aboutGrid}>
          <div className={styles.yearCard}>
            <strong>2016</strong>
            <h2>Technology and commercial solutions.</h2>
            <p>Incorporated in the Republic of Uganda.</p>
          </div>
          <div className={styles.aboutCopy}>
            <SectionHeading kicker="Company at a glance" title="Technology that works on the ground." />
            <p>
              BAAKTech Uganda Limited is a Ugandan technology and commercial
              solutions company. It delivers end-to-end IT infrastructure, custom
              software engineering, computer hardware supply and technical
              maintenance for businesses, non-governmental organisations and
              international missions.
            </p>
            <p>
              Beyond core software and network engineering, BAAKTech has a strong
              track record in market entry, user onboarding, marketing and product
              distribution. It represents and supports local and international
              brands across renewable energy, consumer goods, e-commerce and
              digital finance, alongside developing proprietary platforms such as
              Farm2MarketUganda.com.
            </p>
            <div className={styles.callout}>
              Bridging reliable IT infrastructure, custom software engineering and
              practical commercial deployment in Uganda.
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section + " " + styles.services}>
        <div className={styles.container}>
          <SectionHeading
            kicker="History"
            title="From IT setup to a multidisciplinary technology partner."
            description="Over the past decade BAAKTech has grown from a contractual IT and network setup provider into a partner for complex software builds, field-level data systems and scaled product adoption."
          />
          <div className={styles.timeline}>
            {milestones.map((m) => (
              <article className={styles.timelineItem} key={m.title}>
                <span className={styles.timelineYear}>{m.year}</span>
                <h3>{m.title}</h3>
                <p>{m.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <SectionHeading kicker="Vision, mission & values" title="What we are working towards." />
          <div className={styles.visionGrid}>
            <div className={styles.visionCard}>
              <span>Our vision</span>
              <p>
                To be East Africa’s most trusted partner for practical software
                engineering, resilient IT infrastructure and seamless
                technology-driven product adoption.
              </p>
            </div>
            <div className={styles.visionCard}>
              <span>Our mission</span>
              <p>
                To empower businesses, institutions and communities by delivering
                tailored software solutions, dependable hardware and networking
                systems, and end-to-end product distribution and after-sales
                support.
              </p>
            </div>
          </div>
          <div className={styles.cardGrid4}>
            {values.map((v) => (
              <article className={styles.infoCard} key={v.title}>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </article>
            ))}
          </div>
          <h3 className={styles.subHeading}>Strategic corporate objectives</h3>
          <ol className={styles.objectives}>
            {objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.section + " " + styles.services} id="services">
        <div className={styles.container}>
          <SectionHeading
            kicker="What we do"
            title="An integrated suite of technology, infrastructure and deployment services."
          />
          <div className={styles.serviceGrid}>
            {services.map((service, i) => (
              <article className={styles.serviceCard} key={service.title}>
                <span className={styles.serviceNumber}>{String(i + 1).padStart(2, "0")}</span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section + " " + styles.work} id="work">
        <div className={styles.container}>
          <SectionHeading
            kicker="Industry experience"
            title="Where BAAKTech has delivered."
          />
          <div className={styles.projectGrid}>
            {industries.map((item) => (
              <article className={styles.projectCard} key={item.title}>
                <div className={styles.projectBody}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <p>{item.detail}</p>
                  {item.href ? (
                    <a href={item.href} target="_blank" rel="noreferrer">
                      {item.link} <span aria-hidden="true">↗</span>
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          <h3 className={styles.subHeading}>Selected projects and case studies</h3>
          <div className={styles.caseList}>
            {caseStudies.map((c) => (
              <article className={styles.caseCard} key={c.title}>
                <span className={styles.projectCategory}>{c.category}</span>
                <h3>{c.title}</h3>
                <p className={styles.caseClient}>Client / sector: {c.client}</p>
                <dl>
                  <dt>Challenge</dt>
                  <dd>{c.challenge}</dd>
                  <dt>Solution</dt>
                  <dd>{c.solution}</dd>
                  <dt>Impact</dt>
                  <dd>{c.impact}</dd>
                  <dt>Status</dt>
                  <dd>{c.status}</dd>
                </dl>
                {c.href ? (
                  <a className={styles.caseLink} href={c.href} target="_blank" rel="noreferrer">
                    Visit the live platform <span aria-hidden="true">↗</span>
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section + " " + styles.capabilities}>
        <div className={styles.container}>
          <SectionHeading
            kicker="Technology & delivery"
            title="Capabilities and how we deliver."
            description="A structured five-stage lifecycle, from discovery to deployment and staff training."
          />
          <div className={styles.lifecycle}>
            {lifecycle.map((step, i) => (
              <Capability key={step} number={`0${i + 1}`} title={step} />
            ))}
          </div>
          <div className={styles.techGrid}>
            {technology.map((t) => (
              <div className={styles.techItem} key={t.label}>
                <span>{t.label}</span>
                <p>{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} id="partners">
        <div className={styles.container}>
          <SectionHeading kicker="Partnerships" title="Strategic relationships." />
          <div className={styles.partnerCard}>
            <div>
              <h3>Kattale Group of Brands (U)</h3>
              <p>
                BAAKTech works in strategic partnership with Kattale Group of
                Brands (UG) and Kattale Global (USA), collaborating on product
                ideation, development, deployment and maintenance, commercial
                brand representation, product marketing, distribution logistics
                and technology-enabled market expansion in Uganda.
              </p>
            </div>
            <span>Strategic partner</span>
          </div>
          <div className={styles.cardGrid3}>
            {partnerGroups.map((g) => (
              <article className={styles.infoCard} key={g.title}>
                <h3>{g.title}</h3>
                <p><strong>{g.text}</strong></p>
                <p>{g.role}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section + " " + styles.services}>
        <div className={styles.container}>
          <SectionHeading kicker="Our team" title="People and organisation." />
          <div className={styles.cardGrid4}>
            {team.map((t) => (
              <article className={styles.infoCard} key={t.title}>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </article>
            ))}
          </div>
          <p className={styles.teamNote}>
            BAAKTech combines an agile core team with vetted specialist associates
            to scale quickly for contractual software builds, nationwide product
            onboarding drives and multi-site installations.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <SectionHeading kicker="Quality, security & governance" title="Delivered with care." />
          <div className={styles.cardGrid3}>
            {governance.map((g) => (
              <article className={styles.infoCard} key={g.title}>
                <h3>{g.title}</h3>
                <p>{g.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section + " " + styles.work}>
        <div className={styles.container}>
          <SectionHeading kicker="Why BAAKTech" title="Why work with us." />
          <div className={styles.cardGrid3}>
            {reasons.map((r) => (
              <article className={styles.infoCard} key={r.title}>
                <h3>{r.title}</h3>
                <p>{r.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section + " " + styles.contact} id="contact">
        <div className={styles.container + " " + styles.contactGrid}>
          <div>
            <SectionHeading
              kicker="Contact"
              title="Let’s talk about what you’re building."
              description="For software engineering, IT infrastructure and business enquiries, contact BAAKTech Uganda Limited."
            />
            <div className={styles.contactCard}>
              <h3>Business enquiries</h3>
              <ContactRow label="Contact">Bannet Akampa, Director</ContactRow>
              <ContactRow label="Email">
                <a href="mailto:baaktechug@gmail.com">baaktechug@gmail.com</a>
              </ContactRow>
              <ContactRow label="Phone">
                <a href="tel:+256759682250">+256 759 682 250</a>
              </ContactRow>
              <ContactRow label="Office">Wandegeya, Kampala, Uganda</ContactRow>
            </div>
          </div>
          <div className={styles.profileCard}>
            <span className={styles.documentIcon} aria-hidden="true">▤</span>
            <h3>Company profile</h3>
            <p>Download a short overview of BAAKTech Uganda Limited and its services.</p>
            <a href="/baaktech-company-profile.pdf" download>
              Download company profile (PDF) <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.container + " " + styles.footerRow}>
          <a className={styles.brand} href="#top">
            <span className={styles.brandMark}>BT</span>
            <span>BAAKTech<small>Uganda Limited</small></span>
          </a>
          <nav aria-label="Footer navigation">
            <a href="#about">About</a>
            <a href="#services">Services</a>
            <a href="#work">Work</a>
            <a href="mailto:baaktechug@gmail.com">Email</a>
          </nav>
          <span>© {new Date().getFullYear()} BAAKTech Uganda Limited</span>
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

function Capability({ number, title }: { number: string; title: string }) {
  return (
    <div className={styles.capability}>
      <span>{number}</span>
      <h3>{title}</h3>
    </div>
  );
}

function ContactRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.contactRow}>
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}
