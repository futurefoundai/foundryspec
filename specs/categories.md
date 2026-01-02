# FoundrySpec Exhaustive Categories

To achieve **Zero-Question Implementation readiness**, every project MUST address these categories:

## 1. Architecture (Context)
- **Scope**: System boundaries, external actors (human/AI), and high-level relationships.
- **Diagrams**: `graph TD` (C4 Level 1).

## 2. Containers (Level 2)
- **Scope**: Internal technical boundaries (e.g., Web App, API, Database, Worker).
- **Details**: Technology choices, communication protocols (REST, gRPC, Pub/Sub).
- **Diagrams**: `graph LR`.

## 3. Components (Level 3)
- **Scope**: Internal structure of a container.
- **Details**: Modules, classes, services, and their interfaces.
- **Diagrams**: `graph BT/TD`.

## 4. Sequences (Dynamic)
- **Scope**: Step-by-step logic flows for critical use cases.
- **Details**: Request/Response cycles, error handling paths.
- **Diagrams**: `sequenceDiagram`.

## 5. States (Behavioral)
- **Scope**: Lifecycle of entities and system modes.
- **Details**: State transitions and triggers.
- **Diagrams**: `stateDiagram-v2`.

## 6. Data (Schema & Flow)
- **Scope**: Information architecture and storage.
- **Details**: Database ERDs, data transformation pipelines.
- **Diagrams**: `erDiagram`, `graph LR` for pipelines.

## 7. Security (Trust & Auth)
- **Scope**: Threat modeling and access control.
- **Details**: Authentication flows, trust boundaries, encryption points.
- **Diagrams**: `graph TD` with highlighted boundaries.

## 8. Deployment (Infrastructure)
- **Scope**: Physical environment mapping.
- **Details**: Cloud services, regions, CI/CD pipelines.
- **Diagrams**: `graph TD` showing deployment nodes.

## 9. Integration (APIs & Events)
- **Scope**: Contracts between services.
- **Details**: OpenAPI/Swagger links, Event schemas.
