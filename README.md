# RiffNote

Voice-to-structured-note app. Speak freely — AI turns your messy speech into clean, well-organized text.

Unlike voice input methods that transcribe word-for-word, RiffNote lets you jump between topics, repeat yourself, and think out loud. The AI understands your intent and restructures everything into polished, readable prose.

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy (async), PostgreSQL
- **Frontend**: React 19, React Router 7, TailwindCSS 4
- **Auth**: Clerk
- **AI**: Google Gemini 2.5 Flash
- **Editor**: TipTap (rich text)

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL
- ffmpeg (`brew install ffmpeg`)

### Setup

```bash
# Clone
git clone git@github.com:haipome/riffnote.git
cd riffnote

# Database
createdb riffnote

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your keys
uvicorn app.main:app --reload

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env  # Edit with your keys
npm run dev
```

### Environment Variables

**backend/.env**
```
DATABASE_URL=postgresql+asyncpg://your_user@localhost:5432/riffnote
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
GEMINI_API_KEY=...
```

**frontend/.env**
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## How It Works

1. Open a notebook and tap record
2. Speak freely — no need to be organized
3. Stop recording — audio uploads automatically
4. Gemini AI transcribes and restructures your speech into clean text
5. View and edit the result in a rich text editor
