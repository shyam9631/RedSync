from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import models, models_more  # noqa: F401  (importing these registers the tables)
from app.database import Base, engine, get_db
from app.routers import admin, auth, donor, hospital, notifications, public


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create any missing tables when the server starts
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="RedSync API", version="0.2.0", lifespan=lifespan)

# Let the React app (Vite dev server) call this API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(public.router)
app.include_router(donor.router)
app.include_router(hospital.router)
app.include_router(notifications.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {"app": "RedSync API", "status": "running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/db")
def health_db(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"database": "ok"}