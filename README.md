# StudySync
An AI-assisted learning platform that help students ask questions about their course materials and receive answers from known sources.

## Frontend Setup
TBD
## Backend Setup
Built using FastAPI and uses [uv](https://docs.astral.sh/uv/getting-started/installation/) for python version and dependency management.

### Prequisites
Before setting up the backend, ensure you have:
- Git
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
The backend requires Python 3.12 and is defined in:
```text
backend/.python-version
```

### 1. Clone Repository and enter backend directory
```text
git clone https://github.com/vang838/StudySync.git
cd StudySync/backend
```
### 2. Install backend env
```text
uv sync
```
This should create the virtual environment using the specified python version from .python-version, install depedencies from pyproject.toml, and from uv-lock.
### 3. Start backend dev server to test if it works properly
```text
uv run uvicorn src.main:app --reload
```
Navigating to the url displayed in the terminal (http://127.0.0.1:8000) should display a successful request to the root endpoint like
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