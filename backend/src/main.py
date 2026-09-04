from fastapi import FastAPI

# Initialize the application instance
app = FastAPI()

# Define a root GET endpoint
@app.get("/")
def read_root():
    return {"status": "success", "message": "FastAPI Standard Setup is Complete! Study Sync!!!"}
