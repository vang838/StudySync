# StudySync
An AI-assisted learning platform that helps students ask questions about their course materials and receive answers from known sources.

### Reminder:
Ensure that you clone the repository by doing:
```text
git clone https://github.com/vang838/StudySync.git
```

## Frontend Setup
Built using Next.js, which handles what the user interacts with and views in the browser.

### Prerequisites
Before setting up the frontend, ensure you have:
- Git
- npm

### 1. Enter the frontend directory
```text
cd StudySync/frontend
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

Manual activation of a Python venv is not required when using `uv run`.
