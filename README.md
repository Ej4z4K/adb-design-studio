# ADB Design Studio

A browser-based Oracle Autonomous Database discovery and design workbench with two stages:

1. **Presales:** a business-focused conversation leads to a proposed service and size, connection choice, estimated BOM, HLD, explicit assumptions and proposal agreement. Sales can start with **Help us choose**.
2. **Detailed design:** answer implementation and migration follow-ups and export the LLD based on the agreed presales revision.

[Open the app](https://Ej4z4K.github.io/adb-design-studio/)

[View the backend architecture and process flow diagrams](docs/backend-flow.md)

## Deployment paths

OCI Serverless, OCI Dedicated, Exadata Cloud@Customer, AWS Serverless, AWS Dedicated, Azure Serverless and Google Cloud Serverless. The initial conversation covers eight business-focused questions, one at a time. The service choice can remain open during discovery, but must be selected before agreement. The original 73-question bank remains available to the technical team after agreement; the mapped register also includes the connection-choice requirement F12. Dedicated fleet, customer-site control networks and provider-native networking remain separate. Exact offer / region / feature eligibility requires technical review.

## Presales, technical design after agreement

The whole presales journey uses business-focused screens:

1. **Getting started:** opportunity name, optional preferred location and known service preference or **Help us choose**.
2. **Your conversation:** eight questions on desired improvement, current application location, database count, rough data size, running pattern, interruption impact, connection preference and timing. Choose an approximate answer, **Not sure yet** or **Recommend an option**. Notes are optional and the user can skip to the proposal.
3. **Proposed service & size:** show numerical budget quantities derived from discovery, with explicit defaults for unknown answers. Ask data-location requirements and optional budget only here. An optional presales-architect section accepts target quantities, sizing evidence and a named reviewer. Unchecked manual targets are ignored; discovery-based budget quantities remain explicitly indicative until validated.
4. **How you connect:** private company connection, restricted public access where supported, or help choosing. Exact addresses, routes and permissions belong in Stage 2.
5. **Estimated costs:** service scope, priced monthly subtotal and pending lines; SKU/metric details and supplier quote entry stay in an optional architect section. Database compute and applicable storage are estimated immediately using published catalogue rates. Multicloud options show clearly labelled OCI reference budgets until provider offer pricing is supplied. Fixed infrastructure, recovery and delivery scope remain separately priced; the subtotal is not a complete project cost.
6. **Connection diagram:** option-specific HLD with OCI icons, connection assumption, security intent and recovery dependencies.
7. **Review & agree:** four review areas — proposed service, estimated costs, connection approach and assumptions. One technical contact and follow-up date covers open assumptions. Conditional agreement can accept pending sizing, location or quotations without completing the technical register.
8. **Detailed design:** only after explicit agreement. Exact network, security, fleet/site/native-provider, capacity, backup/recovery and migration questions produce the LLD and implementation runbook.

Budget assumptions are explicit and reproducible: database-count bands map to 1 / 3 / 6 (unknown: 1); total source-data bands map to 100 / 1,000 / 10,000 / 20,000 GB (unknown: 1,000), with 20% headroom divided across the databases; illustrative compute tiers are 4 / 8 / 16 / 32 ECPU per database. Runtime is 730 / 220 / 80 hours for continuous / working-hours / occasional use (unknown: 730). These are budget placeholders, not workload sizing or service minima. Open-ended bands may materially understate demand. Architect-validated quantities replace the placeholders. The same assumptions appear in the proposal, BOM CSV and agreed design baseline. Existing approvals from the earlier pricing model require renewed agreement.

Private OCI access assumes an existing customer-managed VPN or FastConnect connection can reach the target OCI network. **New private connections and carrier/provider charges are excluded.** Routing, DNS, reachability, capacity and resilience still require validation. Network/security configuration and landing-zone work remain separate scope items; they are not treated as free because a circuit is assumed to exist.

Cloud@Customer uses an existing site client-network assumption and retains separate site, backup and Oracle control-network readiness. Multicloud paths use an existing applicable provider-native/private connection assumption. The app does not apply OCI FastConnect requirements to every provider or customer site.

Restricted public database access is offered only for **OCI Serverless** in this app. The proposal requires approved fixed public source IPs, encrypted connections with mTLS where supported, least-privilege application accounts, protected/rotated credentials, audit/alerts and named security approval before implementation. No unrestricted internet access is proposed. Public HLD and LLD paths do not impose a private database endpoint or a VPN/FastConnect circuit. A stale/imported unsupported public-access selection blocks agreement until resolved.

Existing project answers and evidence are retained when upgrading. Earlier approval records require fresh review under the new proposal and assumption model. Imports always reset approval. The app records local attestations; it does not send customer messages or provide authenticated multi-user acceptance.

## Run locally

Node.js 22 or newer. No package installation or third-party runtime dependencies are required.

```sh
npm test
npm run refresh-prices
npm start
```

Open `http://127.0.0.1:8787`. Serve over HTTP; opening the HTML as a file will not load modules or JSON.

## Oracle pricing via MCP

This repository supplies a **read-only custom MCP adapter**, not an Oracle-provided MCP server or an automation of an Oracle Cost Estimator session. It retrieves Oracle's public PAY_AS_YOU_GO catalogue from:

https://apexapps.oracle.com/pls/apex/cetools/api/v1/products/

`server/mcp.mjs` implements newline-delimited JSON-RPC stdio: initialize, initialized notification, ping, tools/list and tools/call. Tool: `get_oci_price_catalogue`. No Oracle credentials are required. `scripts/refresh-prices.mjs` launches that server, negotiates MCP, discovers the tool and calls it. GitHub Actions runs this integration when deploying. The web app uses the resulting public `web/data/prices.json` catalogue. **Refresh published catalogue** reloads that published file; run the Deploy workflow to retrieve new Oracle prices.

To connect an MCP client:

```json
{"mcpServers":{"oci-pricing":{"command":"node","args":["/absolute/path/adb-design-studio/server/mcp.mjs"]}}}
```

For on-demand browser MCP calls, optionally run `npm run mcp:http`. This is a stateless, JSON-response Streamable HTTP endpoint at `http://127.0.0.1:8788/mcp`. Set `ALLOWED_ORIGINS` to the exact frontend origin; for the hosted app use `https://ej4z4k.github.io`. For a remotely hosted endpoint use HTTPS and `MCP_TOKEN`; the server refuses a non-loopback bind without a token. Set `HOST`, `PORT`, `ALLOWED_ORIGINS`, and `MCP_TOKEN` in your hosting environment, never in frontend source. The browser's **Connect live MCP** holds a bearer token in memory for that request and discards it. Browser policies may block hosted-site access to localhost; use an HTTPS endpoint in that case. No remote MCP endpoint is deployed by GitHub Pages.

The MCP adapter accepts no URL or executable parameters and only fetches the fixed Oracle catalogue. It caches a successful result for up to one hour. It exposes no OCI write tools. The HTTP service validates Origin and supports bearer authentication. Place remote instances behind TLS, request limits and your organisation's access controls.

## Estimation boundaries

- New proposals use architect-validated exact target quantities, evidence and a named reviewer. Rough database-count or data-size bands never become compute/storage orders automatically. The underlying legacy measured-workload calibration is retained for compatibility and tests; per-database sizing and service limits are reviewed in detailed design.
- Exact OCI compute SKUs differ by workload, deployment and license. Automatically mapped catalogue rates use their ECPU-hour metric. Serverless allocated storage uses its GB-month metric independently of compute runtime.
- Dedicated / Cloud@Customer infrastructure, fleet reserve, backup, connectivity, recovery and delivery have explicit quote-required lines. Multicloud is not automatically priced using OCI rates.
- The BOM labels its **priced subtotal** and excludes unresolved amounts. The existing private connection is explicitly marked as an assumed exclusion, displayed as **Excluded** rather than a free circuit. Other zero amounts require an evidenced exclusion or entered zero quote. Users can bind exact catalogue SKUs only after confirming applicability, or record a monthly recurring quote in the project currency.
- Currency changes clear entered cost lines. One-time costs belong in a separate commercial proposal. Public list prices omit discounts, taxes, commitments and support terms. Catalogue age, source and retrieval timestamp are shown; older-than-30-day catalogues warn.
- Recovery scope must be validated for the exact offer; a diagram arrow is not a claim that a standby capability is available.

## HLD and landing zone

HLD diagrams use Oracle OCI Architecture Diagram Toolkit v24.2 shapes converted to SVG. Original source and copyright appear in `web/assets/NOTICE.md`. These icons represent Oracle services even in multicloud; provider boundaries are labelled with text.

OCI foundation reference: [Core Landing Zone](https://github.com/oci-landing-zones/terraform-oci-core-landingzone), pinned revision `672037acf1674719faac61988debb17106051bf9`. The app records foundation scope, topology, IP constraints, ownership and the source revision. It does not invent Terraform inputs or deploy infrastructure. Native provider and customer-site foundations require their own designs; the OCI module is not applied to them.

## Agreement, storage and exports

Answers are stored in browser localStorage, not uploaded to GitHub, an LLM or an Oracle API. Customer answers never need to be in the public source repository. Avoid using shared devices for sensitive data. Export JSON to back up or share projects. Imports deliberately reset agreement and require review. A new project clears the current browser workspace after confirmation.

Presales agreement requires an opportunity name, a selected service, a supported access approach, a named approver, explicit acceptance and accepted conditions. If the conversation, sizing, region or residency information remains unresolved, one technical follow-up contact and valid date are required. It does not force sales to complete the deep technical question bank. The approval stores its revision, timestamp, conditions, BOM and size snapshots, pricing provenance, connection policy and assumption list. Editing the baseline or pricing requires agreement again; detailed-design answers extend the baseline. Agreement is a **local attestation, not authenticated multi-user approval**. Use a secured application service for identity-verified or tamper-resistant acceptance.

Exports: project JSON, BOM CSV, self-contained HLD SVG, business-focused HTML proposal before agreement and full design report after agreement (print to PDF) and LLD Markdown. LLD is marked draft until required design answers are supplied; even a complete draft needs technical sign-off. Online migration, hybrid connectivity, DR and deployment-specific follow-up questions appear conditionally. Designs remain deterministic and evidence-based; no AI API key is required.

## GitHub hosting

Public frontend and generic code are hosted in this repository. GitHub Pages runs static HTML/CSS/JavaScript; it cannot run the MCP service. The Deploy workflow runs tests, retrieves Oracle prices through stdio MCP, uploads `web/` and deploys Pages. Trigger the workflow manually whenever refreshed pricing is needed. No scheduled background job or paid runtime is created.

## Source layout

- `web/app.js`: workflow and exports
- `web/engine.js`: sizing, BOM, approval gates and profile-specific design logic
- `web/presales-model.js`: conversation, size validation, assumptions and connection rules
- `web/presales-ui.js`: business-focused presales screens
- `web/hld.js`: private/public/site/native-provider HLD generation
- `web/reports.js`: customer proposal and post-agreement technical report
- `web/data/questions.json`: 73 sales questions with design traceability
- `web/data/prices.json`: public Oracle catalogue snapshot; refreshed at deployment
- `server/`: pricing MCP adapter, optional HTTP endpoint and local static preview
- `test/`: domain and MCP protocol tests
- `scripts/refresh-prices.mjs`: real MCP client used in deployment

This is an independent design tool, not an Oracle product. Validate customer inputs, service support, licensing, rates and implementation details before committing commercially or deploying.
