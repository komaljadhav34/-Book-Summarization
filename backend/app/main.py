from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, books, feedback, quizzes, admin

app = FastAPI(title="Intelligent Book Summarization API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(books.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")
app.include_router(quizzes.router, prefix="/api")
app.include_router(admin.router, prefix="/api")   # ← new admin router


@app.get("/")
async def root():
    return {"message": "Book Summarization API is running"}
