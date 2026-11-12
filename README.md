
# StudySync

StudySync is an AI-assisted learning platform that helps students interact with their course materials, retrieve relevant information, and receive AI-generated answers supported by source evidence.

The platform implements Retrieval-Augmented Generation (RAG) using document retrieval, semantic search, external information retrieval, and citation-aware answer generation.

## Project Overview

StudySync consists of the following components:

| Component | Technology | Responsibility |
| --- | --- | --- |
| Frontend | Next.js | User interface and application interactions |
| Backend | FastAPI | REST API, business logic, and AI orchestration |
| Database | PostgreSQL 17 | Structured application data |
| AI Inference | Ollama | Local language model inference |
| Embeddings | Ollama | Text embeddings for semantic retrieval |
| Vector Database | Pinecone | Vector storage and similarity search |
| Object Storage | Cloudflare R2 / Local | Uploaded document storage |
| External Search | SearXNG | External web search retrieval |
| Environment Management | uv / Docker Compose | Python dependencies and local infrastructure |

The backend follows a ports-and-adapters architecture to separate application logic from infrastructure-specific implementations.

---

## Repository Setup

### Prerequisites

Ensure the following tools are installed:

- Git
- Node.js and npm
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- [Docker](https://docs.docker.com/get-docker/) with Docker Compose
- [Ollama](https://ollama.com/) for local AI inference

### 1. Clone the repository

```bash
git clone https://github.com/vang838/StudySync.git
cd StudySync
```

---

## Frontend Setup

The frontend is built with Next.js and was initialized using `create-next-app`.

### 1. Enter the frontend directory

From the repository root:

```bash
cd frontend
```

### 2. Install frontend dependencies

```bash
npm ci
```

This installs dependencies according to the project's lockfile.

### 3. Configure the frontend environment

When required, configure the frontend API endpoint:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

Use the frontend's existing environment configuration conventions.

Do not place private API keys, database credentials, or backend secrets in variables prefixed with `NEXT_PUBLIC_`.

### 4. Start the frontend development server

```bash
npm run dev
```

Open the application at:

http://localhost:3000

---

## Backend Setup

The backend is built with FastAPI and uses [uv](https://docs.astral.sh/uv/) for Python version and dependency management.

### Prerequisites

The backend requires:

- Python 3.12
- uv
- Docker with Docker Compose
- Ollama for AI functionality

The required Python version is specified in:

```text
backend/.python-version
```

### 1. Enter the backend directory

From the repository root:

```bash
cd backend
```

### 2. Install backend dependencies

```bash
uv sync --group dev
```

This command:

- Creates or synchronizes the project's virtual environment.
- Uses the Python version specified by `.python-version`.
- Installs dependencies defined in `pyproject.toml`.
- Uses `uv.lock` for reproducible dependency resolution.
- Installs development dependencies such as pytest.

Manual activation of the virtual environment is not required when using `uv run`.

### 3. Configure environment variables

Create a local environment file using the provided template.

Linux/macOS:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Update `backend/.env` with the appropriate settings and credentials.

This file contains configuration for:

- PostgreSQL
- Ollama language models
- Ollama embeddings
- Pinecone
- Cloudflare R2
- SearXNG
- Authentication and application settings

Credentials for shared development resources should be obtained securely from the team administrator.

**Never commit `.env` files containing real credentials or secrets to GitHub.**

### 4. Generate application secrets

StudySync requires a `SEARXNG_SECRET` for its Docker-based SearXNG instance.

Generate a unique secret for your development environment.

Linux/macOS:

```bash
openssl rand -hex 32
```

Windows PowerShell:

```powershell
$b = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($b)
$rng.Dispose()
[BitConverter]::ToString($b).Replace('-', '').ToLowerInvariant()
```

Place the generated value in `backend/.env`:

```dotenv
SEARXNG_SECRET=<GENERATED_SECRET>
```

The `JWT_SECRET` used by backend authentication should also be configured with a separate cryptographically secure secret.

Do not reuse the SearXNG secret for authentication.

### 5. Start the backend infrastructure

StudySync includes a Docker Compose configuration that provides:

- PostgreSQL 17
- SearXNG

The Compose configuration is located at:

```text
compose-backend-db.yml
```

From the `backend` directory, validate the configuration:

```bash
docker compose --env-file .env -f ../compose-backend-db.yml config --quiet
```

Then start the containers:

```bash
docker compose --env-file .env -f ../compose-backend-db.yml up -d
```

Verify the containers:

```bash
docker compose --env-file .env -f ../compose-backend-db.yml ps
```

Expected services:

| Container | Port | Purpose |
| --- | --- | --- |
| `studysync-postgres` | `127.0.0.1:5433` | PostgreSQL |
| `studysync-searxng` | `127.0.0.1:8080` | External search |

The services use localhost-only port bindings to prevent direct exposure through external network interfaces.

**Important:** The `--env-file .env` argument is required because Docker Compose must read `SEARXNG_SECRET` from `backend/.env`.

The root-level `.env` file is not required for this setup.

### 6. Configure the database connection

Ensure `backend/.env` contains:

```dotenv
DATABASE_URL=postgresql+psycopg://studysync:studysync@127.0.0.1:5433/studysync
```

This matches the default local PostgreSQL configuration.

Database credentials are configurable through Docker Compose, but the default local development values are:

| Setting | Value |
| --- | --- |
| Database | `studysync` |
| Username | `studysync` |
| Password | `studysync` |
| Host | `127.0.0.1` |
| Port | `5433` |

These credentials are intended for isolated local development only.

Do not reuse them for production or publicly accessible database deployments.

### 7. Verify PostgreSQL

Check database readiness:

```bash
docker exec studysync-postgres pg_isready -U studysync -d studysync
```

Expected output:

```text
/var/run/postgresql:5432 - accepting connections
```

Connect to the database:

```bash
docker exec -it studysync-postgres psql -U studysync -d studysync
```

Inside PostgreSQL:

```sql
\dt
SELECT course_id, title, subject, year FROM courses ORDER BY course_id;
```

Exit with:

```sql
\q
```

If the application tables are missing, initialize the database using the repository's current schema-initialization procedure.

The original backend setup provides the following initialization command:

```bash
uv run python -c "from src.db.session import init_db; init_db()"
```

Verify that `init_db()` remains the supported initialization entry point before using it with an existing database.

The PostgreSQL Docker health check confirms database availability, not application schema initialization.

### 8. Start the backend development server

```bash
uv run python -m uvicorn src.main:app --reload
```

The backend runs at:

http://127.0.0.1:8000

Available development endpoints include:

- API documentation: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/api/v1/health

---

## AI Infrastructure Setup

StudySync implements a Retrieval-Augmented Generation pipeline that combines document retrieval, semantic search, external search, and AI answer generation.

The current AI backend uses Ollama for language model inference and embeddings, Pinecone for vector retrieval, and SearXNG for external search.

### 1. Configure Ollama

Install Ollama from:

https://ollama.com/

Ensure the Ollama service is running.

On systems where Ollama is not already running as a service:

```bash
ollama serve
```

Download the default language model:

```bash
ollama pull qwen3:14b
```

Configure `backend/.env`:

```dotenv
AI_PROVIDER=ollama
AI_BASE_URL=http://127.0.0.1:11434
AI_MODEL=qwen3:14b
AI_TIMEOUT=120
```

These values match the current backend configuration defaults.

The model can be changed based on the developer's available hardware.

Developers using laptops or machines without sufficient RAM or GPU resources may configure `AI_BASE_URL` to reference an accessible Ollama server running on another machine.

When using a remote Ollama server, configure appropriate network access controls rather than exposing the inference endpoint publicly without protection.

### 2. Configure the embedding model

StudySync uses text embeddings for semantic document retrieval.

Download the configured embedding model:

```bash
ollama pull qwen3-embedding:0.6b
```

Configure `backend/.env`:

```dotenv
EMBEDDING_PROVIDER=ollama
EMBEDDING_BASE_URL=http://127.0.0.1:11434
EMBEDDING_MODEL=qwen3-embedding:0.6b
EMBEDDING_DIMENSION=1024
EMBEDDING_TIMEOUT=120
EMBEDDING_BATCH_SIZE=32
```

The embedding model converts document chunks and retrieval queries into numerical vectors.

**Important:** The embedding dimension must match the dimension configured in the Pinecone index.

Changing the embedding model or vector dimension may require rebuilding existing document embeddings.

### 3. Configure Pinecone

StudySync uses Pinecone for vector storage and semantic retrieval.

The vector database stores embeddings generated from uploaded document content and supports similarity searches during retrieval.

Create or obtain access to the team's development Pinecone index.

Configure `backend/.env`:

```dotenv
PINECONE_API_KEY=<YOUR_PINECONE_API_KEY>
PINECONE_INDEX_NAME=<EXISTING_INDEX_NAME>
PINECONE_NAMESPACE=<DEVELOPMENT_NAMESPACE>
PINECONE_BATCH_SIZE=50
```

#### Team development

The team can share a Pinecone development index while using separate API keys when supported.

Recommended practices:

- Use dedicated development credentials.
- Keep production resources separate from development.
- Use separate namespaces when testing independently.
- Use a designated shared namespace for integration testing.
- Ensure document ingestion and retrieval use the correct namespace.
- Never commit Pinecone API keys to GitHub.

Pinecone namespaces provide logical separation of vectors but should not be treated as authentication or authorization boundaries.

The Pinecone Starter tier has limited access-control capabilities. Developers with project-level credentials may have access to resources outside their individual development namespaces.

### 4. Configure SearXNG

StudySync uses SearXNG to retrieve external web search results.

The project already includes a SearXNG Docker container in `compose-backend-db.yml`.

No external SearXNG subscription or developer API key is required for this local deployment.

Configure `backend/.env`:

```dotenv
SEARXNG_SECRET=<GENERATED_SECRET>
EXTERNAL_RETRIEVAL_PROVIDER=searxng
EXTERNAL_RETRIEVAL_BASE_URL=http://127.0.0.1:8080
EXTERNAL_RETRIEVAL_TIMEOUT=20
```

`SEARXNG_SECRET` is used by the SearXNG container and is not a client API key.

Each developer should generate their own secret.

#### Start SearXNG

From the backend directory:

```bash
docker compose --env-file .env -f ../compose-backend-db.yml up -d
```

#### Verify the SearXNG server

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/
```

Expected:

```text
200
```

#### Verify the search API

```bash
curl -fsS --max-time 30 -G "http://127.0.0.1:8080/search" \
  --data-urlencode "q=Python programming tutorials" \
  --data-urlencode "format=json"
```

To explicitly test Bing:

```bash
curl -fsS --max-time 30 -G "http://127.0.0.1:8080/search" \
  --data-urlencode "q=Python programming tutorials" \
  --data-urlencode "format=json" \
  --data-urlencode "engines=bing"
```

The search API should return JSON containing a `results` array.

Search results may vary depending on upstream search-engine availability.

Some providers may reject requests because of rate limits, CAPTCHAs, or connection timeouts.

#### External retrieval implementation

The backend provides:

```text
src/adapters/external_retrieval/searxng.py
```

The adapter:

- Submits HTTP requests to the SearXNG search API.
- Processes JSON search results.
- Extracts result titles, URLs, snippets, and scores.
- Normalizes results through the external retrieval interface.
- Handles unavailable services and invalid responses.

The adapter currently uses SearXNG search result snippets rather than independently fetching complete web pages.

---

## Document Storage Setup

StudySync supports Cloudflare R2 and local filesystem storage for uploaded documents.

The storage provider is configured through `backend/.env`.

### Option 1: Local filesystem storage

Recommended for developers testing document uploads without Cloudflare credentials.

```dotenv
OBJECT_STORAGE_PROVIDER=local
LOCAL_OBJECT_STORAGE_ROOT=.local-object-storage
```

Files are stored locally in the configured directory.

Local files are not automatically shared between developers.

### Option 2: Cloudflare R2 storage

Recommended for testing cloud-backed document storage and shared development integrations.

```dotenv
OBJECT_STORAGE_PROVIDER=r2
R2_ENDPOINT_URL=<YOUR_R2_ENDPOINT>
R2_BUCKET_NAME=studysync-docs
R2_ACCESS_KEY_ID=<YOUR_R2_ACCESS_KEY>
R2_SECRET_ACCESS_KEY=<YOUR_R2_SECRET_KEY>
```

The development bucket currently used by the project is:

```text
studysync-docs
```

#### Team access

Developers should receive bucket-scoped R2 credentials rather than sharing the Cloudflare account owner's login information.

Recommended practices:

- Create separate credentials for individual developers.
- Restrict credentials to the required development bucket.
- Use only authorized development documents.
- Avoid storing sensitive personal or academic records in shared test resources.
- Revoke development credentials when access is no longer needed.

Object Read & Write credentials can permit deletion of objects in the authorized bucket.

Developers should avoid destructive operations against shared data unless explicitly testing that functionality.

### Document ingestion

StudySync processes supported uploaded documents through an ingestion pipeline.

The workflow includes:

1. Receiving and validating the uploaded document.
2. Storing the original file using the configured storage provider.
3. Persisting document metadata in PostgreSQL.
4. Extracting document text.
5. Dividing extracted content into chunks.
6. Generating vector embeddings.
7. Indexing embeddings in Pinecone.
8. Making indexed content available for semantic retrieval.

Uploaded document access and ownership are managed through the backend application.

Changing the storage provider does not automatically migrate previously uploaded files.

---

## Retrieval-Augmented Generation

StudySync uses RAG to incorporate retrieved information into AI-generated responses.

The retrieval architecture separates document retrieval from external retrieval and combines evidence before answer generation.

### Document Retrieval

Document retrieval uses stored document embeddings to find relevant course material.

The general retrieval process is:

```text
User Question
     |
     v
Embedding Model
     |
     v
Pinecone Similarity Search
     |
     v
Relevant Document Chunks
     |
     v
Evidence Processing
```

Document retrieval depends on the correct embedding model, index configuration, and available indexed documents.

### External Retrieval

External retrieval uses SearXNG to obtain web search results.

```text
User Question
     |
     v
ExternalRetrievalPort
     |
     v
SearXNG Adapter
     |
     v
SearXNG Search API
     |
     v
Normalized Search Results
```

The external retrieval adapter is accessed through the application's dependency-injection layer rather than being called directly by business logic.

### Evidence Processing

StudySync includes application services responsible for retrieving, ranking, and evaluating evidence.

These components support:

- Combining document and external retrieval results.
- Ranking evidence by relevance.
- Evaluating source quality.
- Associating generated claims with evidence.
- Identifying supporting or conflicting evidence.
- Handling responses where available evidence is insufficient.

These capabilities are intended to improve answer grounding and transparency.

However, citation metadata does not independently guarantee that every generated claim is correct.

The quality of generated answers depends on retrieval relevance, source reliability, and model behavior.

---

## System Architecture

StudySync follows a ports-and-adapters architecture.

The architecture separates application services from external systems through provider-independent interfaces.

### AI Assistant Architecture

```text
                  Next.js Frontend
                         |
                         v
                   FastAPI Backend
                         |
                         v
                  AssistantService
                         |
                         v
                     RAGService
                         |
            +------------+-------------+
            |                          |
            v                          v
   EvidenceRetrievalService          LLMPort
            |                          |
      +-----+------+                   v
      |            |              OllamaAdapter
      v            v                   |
   Document     External                v
   Retrieval    Retrieval          Ollama LLM
      |            |
      v            v
   Pinecone      SearXNG
      |
      v
 Document Evidence
```

Application services coordinate retrieval and answer generation while adapters handle communication with infrastructure providers.

### Document Ingestion Architecture

```text
                  Document Upload
                         |
                         v
                       FastAPI
                         |
                         v
              DocumentIngestionService
                         |
               +---------+---------+
               |                   |
               v                   v
         Object Storage       PostgreSQL
               |
               v
        Document Processing
               |
               v
          Text Chunking
               |
               v
        Embedding Adapter
               |
               v
            Ollama
               |
               v
       Vector Store Adapter
               |
               v
            Pinecone
```

### Architectural Responsibilities

| Layer | Responsibility |
| --- | --- |
| API Layer | HTTP endpoints, request validation, dependency injection |
| Application Layer | Business logic, orchestration, retrieval workflows |
| Ports | Provider-independent interfaces |
| Adapters | External service implementations |
| Persistence | Structured data, object storage, vector storage |
| Infrastructure | PostgreSQL, SearXNG, Ollama, Pinecone, R2 |

The architecture follows dependency inversion and separation-of-concerns principles.

External service implementations should remain behind the appropriate ports rather than being directly coupled to application services.

---

## Communication Contract

### Frontend to Backend

- The frontend communicates with FastAPI over HTTP.
- REST endpoints exchange JSON request and response payloads.
- Long-running operations may expose streaming endpoints.
- Backend credentials must never be exposed to the browser.
- Protected endpoints require appropriate authentication.

### Backend to PostgreSQL

- PostgreSQL stores structured application information.
- Database operations are performed through backend application code.
- The frontend does not connect to PostgreSQL directly.

### Backend to AI Services

- Ollama provides language model inference and text embeddings.
- Pinecone provides vector storage and similarity search.
- SearXNG provides external web search results.
- Cloudflare R2 or local storage holds uploaded source documents.

The frontend should not communicate directly with backend infrastructure services using private credentials.

---

## REST API Structure

StudySync uses versioned REST endpoints under:

```text
/api/v1
```

### Health

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health` | Backend health check |

### Authentication

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/signup` | Register a user |
| POST | `/api/v1/auth/login` | Authenticate a user |
| POST | `/api/v1/auth/logout` | End a session |
| POST | `/api/v1/auth/forgotpassword` | Request password recovery |
| POST | `/api/v1/auth/resetpassword` | Password reset handling |

The password recovery and reset workflow should be reviewed for token verification and expiration before production use.

### Courses

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/courses` | List courses |
| POST | `/api/v1/courses` | Create a course |
| GET | `/api/v1/courses/{course_id}` | Retrieve course details |
| GET | `/api/v1/courses/search` | Search courses |
| GET | `/api/v1/courses/saved` | Retrieve saved courses |

Additional course endpoints support saved-course management and discussion functionality.

### Documents

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/v1/documents` | Upload a document for ingestion |
| GET | `/api/v1/documents` | List accessible documents |
| GET | `/api/v1/documents/{document_id}/download` | Download a document |
| PATCH | `/api/v1/documents/{document_id}/publish` | Update document publication status |
| DELETE | `/api/v1/documents/{document_id}` | Delete a document |

Document operations may require authentication and enforce ownership or publication rules.

### AI Chat

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/v1/chat` | Submit a question and create a chat response |
| GET | `/api/v1/chat/{chat_id}` | Retrieve an existing chat thread |
| GET | `/api/v1/chat/{chat_id}/stream` | Access the chat streaming endpoint |
| GET | `/api/v1/sources/{source_id}` | Retrieve source/citation metadata |

The chat implementation supports course-context requests and general questions.

Depending on the retrieval path, responses may contain source citations, generated claims, and evidence assessments.

See the running FastAPI documentation at `/docs` for the current request and response schemas, authentication requirements, and endpoint behavior.

---

## Environment Variables

Backend environment variables are configured in:

```text
backend/.env
```

The repository provides:

```text
backend/.env.example
```

This file should contain configuration names, safe defaults, and setup instructions without real credentials.

### Application Configuration

| Variable | Purpose |
| --- | --- |
| `APP_ENV` | Application runtime environment |
| `CORS_ORIGINS` | Allowed browser origins |
| `JWT_SECRET` | Authentication token signing secret |

### Database Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |

### AI Configuration

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | LLM provider |
| `AI_BASE_URL` | LLM server endpoint |
| `AI_MODEL` | Language model identifier |
| `AI_TIMEOUT` | Inference request timeout |

### Embedding Configuration

| Variable | Purpose |
| --- | --- |
| `EMBEDDING_PROVIDER` | Embedding provider |
| `EMBEDDING_BASE_URL` | Embedding server endpoint |
| `EMBEDDING_MODEL` | Embedding model identifier |
| `EMBEDDING_DIMENSION` | Vector dimension |
| `EMBEDDING_TIMEOUT` | Embedding request timeout |
| `EMBEDDING_BATCH_SIZE` | Number of texts processed per embedding batch |

### Pinecone Configuration

| Variable | Purpose |
| --- | --- |
| `PINECONE_API_KEY` | Pinecone authentication credential |
| `PINECONE_INDEX_NAME` | Target vector index |
| `PINECONE_NAMESPACE` | Namespace for vector records |
| `PINECONE_BATCH_SIZE` | Vector indexing batch size |

### Object Storage Configuration

| Variable | Purpose |
| --- | --- |
| `OBJECT_STORAGE_PROVIDER` | Storage provider (`local` or `r2`) |
| `LOCAL_OBJECT_STORAGE_ROOT` | Local storage directory |
| `R2_ENDPOINT_URL` | Cloudflare R2 endpoint |
| `R2_BUCKET_NAME` | Cloudflare R2 bucket |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret access key |

### External Retrieval Configuration

| Variable | Purpose |
| --- | --- |
| `SEARXNG_SECRET` | SearXNG container secret |
| `EXTERNAL_RETRIEVAL_PROVIDER` | External search provider |
| `EXTERNAL_RETRIEVAL_BASE_URL` | SearXNG HTTP endpoint |
| `EXTERNAL_RETRIEVAL_TIMEOUT` | External retrieval timeout |

### Document Processing Configuration

| Variable | Purpose |
| --- | --- |
| `DOCUMENT_MAX_UPLOAD_BYTES` | Maximum document upload size |
| `DOCUMENT_CHUNK_MAX_WORDS` | Maximum words per document chunk |
| `DOCUMENT_CHUNK_OVERLAP_WORDS` | Overlap between adjacent chunks |

### UWM Catalog Configuration

| Variable | Purpose |
| --- | --- |
| `UWM_CATALOG_SYNC_ON_STARTUP` | Enable or disable catalog synchronization on startup |
| `UWM_CATALOG_BASE_URL` | UWM catalog service URL |
| `UWM_CATALOG_TIMEOUT_SECONDS` | Catalog request timeout |
| `UWM_CATALOG_MAX_SUBJECTS` | Optional limit for catalog subject synchronization |

### Frontend Configuration

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | FastAPI base URL used by the frontend |

### Environment Security

- Never commit real secrets to the repository.
- Keep `backend/.env` and secret-bearing backups Git-ignored.
- Commit `backend/.env.example` with safe placeholders.
- Generate independent secrets for each developer's local services.
- Use development-scoped cloud credentials.
- Rotate credentials when access is no longer required.
- Avoid exposing PostgreSQL, Ollama, or SearXNG directly to untrusted networks.

---

## Backend Dependency Management

Backend dependencies are managed through:

```text
backend/pyproject.toml
backend/uv.lock
```

### Add a runtime dependency

```bash
uv add <package>
```

Example:

```bash
uv add sqlalchemy
```

### Add a development dependency

```bash
uv add --dev <package>
```

Example:

```bash
uv add --dev pytest
```

When dependencies change, commit both:

- `pyproject.toml`
- `uv.lock`

After pulling changes affecting dependencies:

```bash
uv sync --group dev
```

---

## Backend Testing

StudySync uses pytest for backend testing.

### Install test dependencies

```bash
uv sync --group dev
```

### Run the full backend test suite

```bash
uv run python -m pytest -q
```

### Run SearXNG adapter tests

```bash
uv run python -m pytest -q tests/test_searxng_external_retrieval.py
```

### Run evidence retrieval and chat API tests

```bash
uv run python -m pytest -q \
  tests/test_evidence_retrieval_service.py \
  tests/test_chat_api.py
```

### Verify live external retrieval

Ensure the SearXNG container is running before executing the following test:

```bash
uv run python - <<'PY'
from contextlib import contextmanager

from src.api.dependencies import get_external_retrieval_port

with contextmanager(get_external_retrieval_port)() as retrieval:
    results = retrieval.search("Python programming tutorials", top_k=5)
    print("Results:", len(results))

    for result in results:
        print(f"- {result.title}: {result.url}")

    assert results, "No external search results returned"
PY
```

This uses the actual FastAPI external-retrieval dependency factory to connect to SearXNG.

Successful retrieval confirms that the external retrieval dependency can communicate with the running service.

It does not independently verify the complete authenticated chat and RAG workflow.

### Integration Testing

For complete AI integration testing, verify:

1. PostgreSQL is healthy.
2. SearXNG is reachable.
3. Ollama is running with the required models.
4. Pinecone credentials and index configuration are valid.
5. Object storage credentials or local storage settings are valid.
6. Document ingestion successfully processes and indexes documents.
7. Document retrieval returns relevant indexed evidence.
8. External retrieval returns usable search results.
9. Chat requests generate answers through the configured model.
10. Generated responses persist and expose appropriate citation metadata.

Mocked unit tests are useful for testing component behavior but do not replace live integration checks.

Authentication and document-ownership requirements must remain enforced during testing.

---

## Local Development Commands

The following commands are commonly used during backend development.

Run these from `StudySync/backend`.

### Start infrastructure

```bash
docker compose --env-file .env -f ../compose-backend-db.yml up -d
```

### Check container status

```bash
docker compose --env-file .env -f ../compose-backend-db.yml ps
```

### View SearXNG logs

```bash
docker logs studysync-searxng --tail 100
```

### View PostgreSQL logs

```bash
docker logs studysync-postgres --tail 100
```

### Stop infrastructure

```bash
docker compose --env-file .env -f ../compose-backend-db.yml down
```

This stops the Compose services without intentionally removing their persistent volumes.

### Start FastAPI

```bash
uv run python -m uvicorn src.main:app --reload
```

### Run backend tests

```bash
uv run python -m pytest -q
```

### Check the API documentation

http://127.0.0.1:8000/docs

### Verify SearXNG availability

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/
```

---

## Development Guidelines

StudySync follows these engineering principles:

- Preserve the existing ports-and-adapters architecture.
- Keep business logic separate from infrastructure integrations.
- Reuse existing services, interfaces, and dependency boundaries.
- Prefer focused changes over unnecessary refactoring.
- Keep configuration externalized through environment variables.
- Avoid committing credentials or sensitive development data.
- Maintain automated test coverage for modified functionality.
- Verify integrations against real services when appropriate.
- Preserve authentication and document-ownership boundaries.
- Keep implementation decisions understandable and maintainable.

Implementation and architectural decisions should follow established software engineering practices, including separation of concerns, dependency inversion, least privilege, and maintainability.

---

## Team Development Notes

Each developer should:

1. Clone the StudySync repository.
2. Install backend and frontend dependencies.
3. Copy `backend/.env.example` to `backend/.env`.
4. Generate their own local SearXNG secret.
5. Obtain authorized development credentials for Pinecone and Cloudflare R2 if needed.
6. Start PostgreSQL and SearXNG using Docker Compose.
7. Configure and start Ollama or use an accessible inference server.
8. Start the FastAPI backend.
9. Start the Next.js frontend.
10. Verify the required functionality using appropriate tests.

Developers should not share personal Cloudflare or Pinecone account credentials.

Use dedicated development credentials, securely distributed by the project team.

All changes should be tested locally before being submitted through GitHub pull requests.
