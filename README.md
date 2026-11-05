# ADB Design Studio

A browser-based Oracle Autonomous Database discovery and design workbench with two stages:

1. **Presales:** choose a deployment, complete sales discovery, capture sizing evidence and connectivity needs, produce a traceable BOM and HLD, then record agreement.
2. **Detailed design:** answer implementation and migration follow-ups and export the LLD based on the agreed presales revision.

[Open the app](https://Ej4z4K.github.io/adb-design-studio/)

[View the backend architecture and process flow diagrams](docs/backend-flow.md)

## Deployment paths

OCI Serverless, OCI Dedicated, Exadata Cloud@Customer, AWS Serverless, AWS Dedicated, Azure Serverless and Google Cloud Serverless. Each path has its own nine sales questions plus ten shared questions. Dedicated fleet, customer-site control networks and provider-native networking remain separate. Exact offer / region / feature eligibility requires technical review.

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

- ECPU sizing uses measured workload and a pilot calibration, not a universal core conversion. The cohort model must be replaced by per-database sizing in detailed design.
- Exact OCI compute SKUs differ by workload, deployment and license. Automatically mapped catalogue rates use their ECPU-hour metric. Serverless allocated storage uses its GB-month metric independently of compute runtime.
- Dedicated / Cloud@Customer infrastructure, fleet reserve, backup, connectivity, recovery and delivery have explicit quote-required lines. Multicloud is not automatically priced using OCI rates.
- The BOM labels its **priced subtotal** and excludes unresolved amounts. A zero is only recorded for an evidenced exclusion or an entered zero quote. Users can bind exact catalogue SKUs only after confirming applicability, or record a monthly recurring quote in the project currency.
- Currency changes clear entered cost lines. One-time costs belong in a separate commercial proposal. Public list prices omit discounts, taxes, commitments and support terms. Catalogue age, source and retrieval timestamp are shown; older-than-30-day catalogues warn.
- Recovery scope must be validated for the exact offer; a diagram arrow is not a claim that a standby capability is available.

## HLD and landing zone

HLD diagrams use Oracle OCI Architecture Diagram Toolkit v24.2 shapes converted to SVG. Original source and copyright appear in `web/assets/NOTICE.md`. These icons represent Oracle services even in multicloud; provider boundaries are labelled with text.

OCI foundation reference: [Core Landing Zone](https://github.com/oci-landing-zones/terraform-oci-core-landingzone), pinned revision `672037acf1674719faac61988debb17106051bf9`. The app records foundation scope, topology, IP constraints, ownership and the source revision. It does not invent Terraform inputs or deploy infrastructure. Native provider and customer-site foundations require their own designs; the OCI module is not applied to them.

## Agreement, storage and exports

Answers are stored in browser localStorage, not uploaded to GitHub, an LLM or an Oracle API. Customer answers never need to be in the public source repository. Avoid using shared devices for sensitive data. Export JSON to back up or share projects. Imports deliberately reset agreement and require review. A new project clears the current browser workspace after confirmation.

Presales agreement requires an answer or an owned, dated unknown for every discovery question, a selected deployment and location, a named approver, explicit acceptance and recorded conditions. Conditional agreement may accept open sizing, pricing and technical actions. Editing presales inputs, cost lines, profile or live prices revokes agreement. Detailed answers may extend the baseline. The approval stores its revision, timestamp, conditions, BOM snapshot and price provenance. Agreement is a **local attestation, not an authenticated multi-user approval**. This Pages deployment has no user accounts or shared project database; use a secured application service if your organisation needs tamper-resistant approvals.

Exports: project JSON, BOM CSV, self-contained HLD SVG, full HTML design report (print to PDF) and LLD Markdown. LLD is marked draft until required design answers are supplied; even a complete draft needs technical sign-off. Online migration, hybrid connectivity, DR and deployment-specific follow-up questions appear conditionally. Designs remain deterministic and evidence-based; no AI API key is required.

## GitHub hosting

Public frontend and generic code are hosted in this repository. GitHub Pages runs static HTML/CSS/JavaScript; it cannot run the MCP service. The Deploy workflow runs tests, retrieves Oracle prices through stdio MCP, uploads `web/` and deploys Pages. Trigger the workflow manually whenever refreshed pricing is needed. No scheduled background job or paid runtime is created.

## Source layout

- `web/app.js`: workflow and exports
- `web/engine.js`: sizing, BOM, approval gates and profile-specific design logic
- `web/data/questions.json`: 73 sales questions with design traceability
- `web/data/prices.json`: public Oracle catalogue snapshot; refreshed at deployment
- `server/`: pricing MCP adapter, optional HTTP endpoint and local static preview
- `test/`: domain and MCP protocol tests
- `scripts/refresh-prices.mjs`: real MCP client used in deployment

This is an independent design tool, not an Oracle product. Validate customer inputs, service support, licensing, rates and implementation details before committing commercially or deploying.
