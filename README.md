# StudySync
An AI-assisted learning platform that helps students ask questions about their course materials and receive answers from known sources.

### Reminder:
Ensure that you clone the repository by doing:
```text
git clone https://github.com/vang838/StudySync.git
```

## Frontend Setup
Built Next.js bootstrapped with create-next-app.

### Prerequisites
Before setting up the frontend, ensure you have:
- Git
- npm

### 1. Enter the frontend directory
```text
cd StudySync/frontend
```

### 2. Install frontend dependencies
```text
npm ci
```

### 3. Start the frontend dev server to test if it works properly
```text
npm run dev
```
Navigating to the URL displayed in the terminal (localhost:3000) should display the app via any browser.

## Backend Setup
Built using FastAPI and uses [uv](https://docs.astral.sh/uv/getting-started/installation/) for Python version and dependency management.

### Prerequisites
Before setting up the backend, ensure you have:
- Git
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
The backend requires Python 3.12 and is defined in:
```text
backend/.python-version
```

### 1. Enter the backend directory
```text
cd StudySync/backend
```
### 2. Install backend env
```text
uv sync
```
This should create the virtual environment using the specified python version from .python-version, install depedencies from pyproject.toml, and from uv-lock.
### 3. Start the backend dev server to test if it works properly
```text
uv run uvicorn src.main:app --reload
```
Navigating to the URL displayed in the terminal (http://127.0.0.1:8000) should display a successful request to the root endpoint like
```text
{
  "status": "success",
  "message": "FastAPI Standard Setup is Complete! Study Sync!!!"
}
```
### Backend Dependency Management
All backend dependencies will be managed through:
```text
backend/pyproject.toml
backend/uv.lock
```

To add a runtime dependency: ```text uv add <package> ```

Example: ```bash uv add sqlalchemy```

To add a development-only dependency: ```bash uv add --dev <package>```

When backend dependencies change, commit both `pyproject.toml` and `uv.lock`.

After pulling changes that modify either dependency file, run: ```bash uv sync```

Manual activation of python venv is not required when using `uv run`.

## Database Setup
StudySync stores its structured data in PostgreSQL.

### Prerequisites
Before setting up the database, ensure you have:
- PostgreSQL 17 installed and running
- `psql` available on your PATH

If `psql` or `createdb` is not recognized in PowerShell, add PostgreSQL tools to PATH for the current terminal session:
```powershell
$env:Path += ";C:\Program Files\PostgreSQL\17\bin"
```

### 1. Create the database
```powershell
createdb -U postgres studysync
```

If the database already exists, this command will fail with an "already exists" message, which is safe to ignore.

### 2. Set the backend connection string
```powershell
cd backend
$env:DATABASE_URL = 'postgresql+psycopg://postgres:<password>@localhost:5432/studysync'
```

### 3. Initialize the database schema
```powershell
$env:DATABASE_URL = 'postgresql+psycopg://postgres:<password>@localhost:5432/studysync'
uv run python -c "from src.db.session import init_db; init_db()"
```

This creates tables and seeds initial course records used for testing.

### 4. Start the backend against PostgreSQL
```powershell
$env:DATABASE_URL = 'postgresql+psycopg://postgres:<password>@localhost:5432/studysync'
uv run python -m uvicorn src.main:app --reload
```

### 5. View the database and seeded data
```powershell
psql -U postgres -d studysync
```

Inside `psql`, run:
```sql
\dt
SELECT course_id, title, subject, year FROM courses ORDER BY course_id;
```

Exit `psql` with:
```sql
\q
```

## System Architecture
StudySync follows a simple browser-to-backend pattern.

The frontend talks to FastAPI.

FastAPI talks to PostgreSQL for structured data.

The frontend never connects to PostgreSQL directly.

If the backend needs any other service later, that stays behind FastAPI as well.

## Communication Contract
### Frontend to Backend
- The frontend calls the FastAPI server over HTTP.
- Standard reads and writes use REST endpoints that return JSON.
- Long-running answer generation can use Server-Sent Events so the UI can stream updates.
- The frontend should not embed backend secrets.

### Backend to PostgreSQL
- PostgreSQL is the system of record for users, courses, documents, chat sessions, message history, and citation records.
- FastAPI performs all database access through backend code only.
- The frontend receives API responses; it never reads PostgreSQL directly.

## REST API Structure
The API should stay versioned and resource-oriented under `/api/v1`.

- `GET /api/v1/health` - service health check.
- `POST /api/v1/auth/login` - sign in a user.
- `POST /api/v1/auth/logout` - end a session.
- `GET /api/v1/courses` - list the current user's courses.
- `POST /api/v1/courses` - create a course.
- `GET /api/v1/courses/{course_id}` - fetch course details.
- `POST /api/v1/documents` - upload a document for ingestion.
- `GET /api/v1/documents` - list uploaded documents.
- `POST /api/v1/chat` - create a question, start answer generation, and return either a full response or an SSE stream.
- `GET /api/v1/chat/{chat_id}` - fetch a chat thread and its messages.
- `GET /api/v1/chat/{chat_id}/stream` - stream the answer as SSE tokens.
- `GET /api/v1/sources/{source_id}` - fetch citation or source metadata.

Request and response payloads should use Pydantic models so the frontend always receives a stable contract for validation errors, streaming status, citations, and answer content.

## Environment Variables
Use the backend settings and frontend API base URL that the app expects.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend | Base URL for the FastAPI API, such as `http://localhost:8000`. |
| `DATABASE_URL` | Backend | PostgreSQL connection string used by FastAPI. |
| `CORS_ORIGINS` | Backend | Comma-separated list of allowed browser origins. |
| `AI_PROVIDER` | Backend | Which model provider to use. |
| `AI_API_KEY` | Backend | API key for the selected model provider. |
| `AI_MODEL` | Backend | Chat/completion model name used for answers. |
| `EMBEDDING_MODEL` | Backend | Embedding model used during document ingestion. |
| `JWT_SECRET` | Backend | Signs authentication tokens or sessions if auth is enabled. |
| `APP_ENV` | Backend | Runtime mode, such as development, staging, or production. |

Pinecone is intentionally omitted here. I do not know enough about it.
