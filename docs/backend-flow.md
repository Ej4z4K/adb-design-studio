# Backend and end-to-end process flow

The implemented workflow is **simple presales → agreed proposal → deep technical design**. It runs in the browser, GitHub Actions and an optional MCP pricing service. There is no shared customer database or authenticated approval backend in the Pages deployment.

## 1. Application and pricing architecture

```mermaid
flowchart TB
    REPO["GitHub repository<br/>Code, questions, design rules and OCI icons"]
    subgraph ACTIONS["GitHub Actions — push to main or manual Deploy workflow"]
        TEST["Run domain, proposal, security-path and MCP tests"]
        CLIENT["Pricing refresh script<br/>MCP client"]
        MCP["Read-only MCP stdio server"]
        NORMALIZE["Normalize public SKUs, metrics,<br/>PAYG rates, currencies and timestamps"]
        SNAPSHOT["Write prices.json"]
        DEPLOY["Deploy static web files to GitHub Pages"]
        STOP["Stop on test/pricing failure<br/>Previous published app remains"]
        TEST -->|Pass| CLIENT --> MCP
        MCP --> NORMALIZE --> SNAPSHOT --> DEPLOY
        TEST -->|Fail| STOP
        CLIENT -->|Pricing failure| STOP
    end
    ORACLE["Oracle public price catalogue API"]
    REPO --> TEST
    MCP -->|HTTPS GET| ORACLE
    ORACLE -->|Public catalogue| MCP
    subgraph BROWSER["Browser — customer-facing app and design rules"]
        LOAD["Load app, questions, icons and published prices"]
        SALES["Plain-English conversation and proposal"]
        MODEL["Size validation, BOM and connection rules"]
        HLD["Generate option-specific HLD<br/>with explicit connection assumption"]
        REVIEW["Review service, costs,<br/>connection and assumptions"]
        GATE["Record explicit agreement<br/>against proposal revision"]
        DESIGN["Unlock detailed design and LLD"]
        STORAGE[("Browser localStorage<br/>Answers, assumptions and approval snapshots")]
        EXPORT["Export JSON, CSV, SVG,<br/>customer proposal or technical report"]
        LOAD --> SALES --> MODEL
        MODEL --> HLD --> REVIEW
        MODEL --> REVIEW --> GATE --> DESIGN
        SALES --> STORAGE
        GATE --> STORAGE
        DESIGN --> STORAGE
        STORAGE -->|Restore| LOAD
        MODEL --> EXPORT
        HLD --> EXPORT
        DESIGN --> EXPORT
    end
    DEPLOY --> LOAD
    LZ["Pinned OCI Core Landing Zone reference<br/>No Terraform execution"] --> HLD
```

Customer answers remain in the browser. The pricing tool fetches only the public Oracle catalogue; it does not send customer answers to Oracle, invoke an AI model, apply negotiated discounts or control a Cost Estimator session. OCI resources and migrations are not executed by this app.

## 2. Sales-to-design workflow and approval gate

```mermaid
flowchart TB
    START["Name opportunity<br/>Optional location and service preference"]
    HELP["Known service or Help us choose<br/>No silent deployment default"]
    QUESTIONS["8 plain-English questions<br/>One at a time<br/>Approximate, unsure and skip allowed"]
    SIZE["Proposed service and size<br/>Optional residency and budget"]
    VALID{"Architect-validated exact quantities,<br/>evidence and named reviewer?"}
    PRICED["Calculate eligible catalogue cost lines<br/>using exact units and runtime"]
    PENDING["Leave affected costs pending<br/>Do not convert bands into orders"]
    CONNECT{"Choose how to connect"}
    PRIVATE["Private company connection<br/>Existing applicable connection assumed<br/>New circuits and charges excluded"]
    PUBLIC{"Restricted public access requested?<br/>OCI Serverless selected?"}
    CONTROLS["Propose IP allowlist, encrypted access,<br/>mTLS where supported, least privilege,<br/>credential rotation, audit and security approval"]
    UNSUPPORTED["Require a supported service<br/>or choose private access"]
    BOM["Show simple BOM<br/>Priced subtotal, pending scope and exclusions"]
    HLD["Show HLD with matching<br/>private/public/site/native-provider path"]
    REVIEW["Four proposal review areas<br/>Service, costs, connection, assumptions"]
    CONTACT["One technical contact and date<br/>for unresolved requirements"]
    AGREE{"Named approver explicitly agrees<br/>proposal and accepted conditions?"}
    SNAP["Save revision, BOM/size snapshots,<br/>connection policy, assumptions and price provenance"]
    TECH["Deep technical questions<br/>Exact addresses, routes, DNS, security,<br/>fleet/site/native networks and recovery"]
    LLD["Generate LLD and migration runbook<br/>Draft while required design answers are missing"]
    SIGNOFF["External technical review,<br/>change approval and implementation"]
    REVISE["Presales or pricing baseline changes<br/>Revoke agreement and lock technical stage"]
    START --> HELP --> QUESTIONS --> SIZE --> VALID
    VALID -->|Yes| PRICED
    VALID -->|No| PENDING
    SIZE --> CONNECT
    CONNECT -->|Private or recommend| PRIVATE
    CONNECT -->|Internet| PUBLIC
    PUBLIC -->|Yes| CONTROLS
    PUBLIC -->|No| UNSUPPORTED --> HELP
    PRICED --> BOM
    PENDING --> BOM
    PRIVATE --> BOM
    CONTROLS --> BOM
    PRIVATE --> HLD
    CONTROLS --> HLD
    BOM --> REVIEW
    HLD --> REVIEW
    REVIEW --> CONTACT --> AGREE
    AGREE -->|No| REVIEW
    AGREE -->|Yes| SNAP --> TECH --> LLD --> SIGNOFF
    SNAP -.-> REVISE --> REVIEW
```

A service must be selected before agreement, even though discovery can start without one. Conditional agreement may accept pending quantities, quotes, location or security decisions with a technical contact and date. It does not mark the estimate complete or authorise implementation. The technical question bank is not a prerequisite for sales agreement. Detailed-design answers extend the accepted baseline; changed presales inputs, cost lines or pricing require new agreement.

## 3. Connection assumptions and public-access security

| Selected path | Presales assumption / controls | Detailed-design validation |
| --- | --- | --- |
| OCI private — Serverless or Dedicated | Existing customer-managed VPN or FastConnect reaches the target OCI network. New circuits and carrier/provider charges are excluded. | Reachability, routing and return paths, DNS, capacity, resilience, ownership and the selected service's endpoint/fleet rules |
| Cloud@Customer | Existing customer-site client network is available. New client circuits are excluded. | Facilities, client and backup networks, Oracle control/management connectivity, installation readiness and ownership; these are not assumed to be covered by VPN/FastConnect |
| AWS, Azure or Google Cloud private | Existing applicable customer/provider-native private path is available. New hybrid circuits and provider charges are excluded. | Exact native attachment/delegation, account linkage, provider network ownership, routing, DNS and offer support |
| OCI Serverless restricted public | Approved fixed public IP allowlist; no unrestricted internet access. Encrypted connections and mTLS where supported, limited application identities, protected/rotated credentials, audit/alerts and named security approval before implementation. | Actual egress IPs, DNS, encrypted connection descriptors, client compatibility, account privileges, credential lifecycle, allowlist tests and security sign-off |
| Other deployment with a stale/imported public request | Public access is not offered for this design path in the app. Agreement is blocked. | Select a supported service or resolve the private connection design |

Existing connection exclusions are explicit assumptions, not free new circuits. Network/security configuration, landing-zone work, backups, recovery infrastructure and delivery retain their own cost scope. HLD, BOM, proposal report, approval snapshots and LLD carry the connection assumption consistently.

## 4. Optional on-demand pricing MCP

The HTTP service is included as code but is not hosted by GitHub Pages.

```mermaid
sequenceDiagram
    actor User
    participant Browser as Browser app
    participant HTTP as Optional MCP HTTP service
    participant Adapter as Read-only pricing adapter
    participant Oracle as Oracle public catalogue
    User->>Browser: Connect live pricing MCP
    Browser->>User: Request endpoint and optional bearer token
    Note over Browser: Token held temporarily in memory
    Browser->>HTTP: Initialize MCP
    HTTP->>HTTP: Validate Origin and configured token
    HTTP-->>Browser: Protocol version and capabilities
    Browser->>HTTP: Initialized notification
    Browser->>HTTP: Call get_oci_price_catalogue
    HTTP->>Adapter: Retrieve public prices
    alt Successful catalogue cached for less than one hour
        Adapter-->>HTTP: Cached normalized catalogue
    else Refresh needed
        Adapter->>Oracle: HTTPS GET public catalogue
        Oracle-->>Adapter: Products and currency rates
        Adapter->>Adapter: Normalize and timestamp
        Adapter-->>HTTP: Catalogue with provenance
    end
    HTTP-->>Browser: MCP structured result
    alt Valid result
        Browser->>Browser: Replace catalogue and recalculate proposal
        Browser->>Browser: Revoke previous agreement
    else Failure
        Browser->>Browser: Show error and retain previous catalogue
    end
    Browser->>Browser: Discard temporary token
```

**Refresh published prices** only reloads the Pages snapshot. Run the Deploy workflow or connect the separately running MCP service for a fresh Oracle fetch. A changed published catalogue invalidates an older approval on workspace load. No recurring schedule or paid runtime is created.

## Storage, compatibility and export boundaries

- Answers and approval data are saved in browser localStorage; no shared customer project database is deployed.
- Old answers/evidence survive upgrade, but older approval records require renewed agreement under the new assumption model. Imported files always reset agreement.
- Existing measured sizing logic is retained for legacy data and tests; the new proposal uses explicit architect-validated target quantities.
- Presales exports contain the simple conversation, service/size proposal, costs, HLD, assumptions and agreement wording. Post-agreement reports additionally contain the LLD and technical requirements register.
- Approval is a local attestation, not authenticated multi-user acceptance. No provisioning, migration execution or final commercial purchase occurs in this app.

## Source traceability

- [Browser routing, state, approval and exports](../web/app.js)
- [Presales conversation, validation and connection policy](../web/presales-model.js)
- [Plain-English presales screens](../web/presales-ui.js)
- [Sizing, BOM, approval and detailed-design engine](../web/engine.js)
- [Private/public/site/native-provider HLD generator](../web/hld.js)
- [Customer proposal and technical report generator](../web/reports.js)
- [Technical question bank](../web/data/questions.json)
- [Pricing MCP tool](../server/pricing.mjs), [stdio transport](../server/mcp.mjs), [optional HTTP service](../server/http.mjs)
- [Deployment pricing client](../scripts/refresh-prices.mjs) and [Pages workflow](../.github/workflows/deploy.yml)
- [Setup and operating instructions](../README.md)
