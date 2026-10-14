# CBSE AI MCQ Test Portal — deployment starter

## What this build does
- Student chooses class (6–12), subject, chapter/unit, and number of questions.
- The server calls the OpenAI Responses API to generate original MCQs at test time.
- 4 options per question, timer, question palette, blue selected option, auto-scoring, explanations and print/save PDF.
- Results are saved server-side and appear on a shared leaderboard.
- Built-in chapter catalogue is a starter catalogue, not a guarantee that every entry matches the current CBSE session. Verify against the current CBSE/NCERT syllabus.

## Important requirements
1. Node.js 20 or newer.
2. An OpenAI API key with API billing enabled. ChatGPT subscription and API billing are separate.
3. A host to publish the website (for example Render).
4. For persistent shared results on Render, attach a persistent disk mounted at `/var/data`. Without persistent storage, local JSON result data may be lost on redeploy/restart.

## Run locally
1. Install Node.js 20+.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Set your secret in the terminal before running:
   - macOS/Linux: `export OPENAI_API_KEY="your-key"`
   - Windows PowerShell: `$env:OPENAI_API_KEY="your-key"`
5. Optional: `export OPENAI_MODEL="gpt-4.1-mini"` and `export DATA_DIR="./data"` (PowerShell equivalents use `$env:...`).
6. Run `npm start`.
7. Open `http://localhost:3000`.

Never put the API key in `public/index.html`, send it to students, or commit it to a public Git repository.

## Deploy to Render
1. Create a GitHub repository and upload the contents of this folder.
2. Sign in to Render and create a new Web Service from that repository.
3. Render can use `render.yaml`; build command `npm install`, start command `npm start`.
4. In Render Environment, add `OPENAI_API_KEY` as a secret and `OPENAI_MODEL=gpt-4.1-mini`.
5. Add a persistent disk mounted at `/var/data` and keep `DATA_DIR=/var/data` so the shared leaderboard survives restarts.
6. Deploy and open the Render URL. Test AI generation and result saving.

Free hosting tiers and persistent disks may have changing limitations/costs; check the provider's current plan before publishing.

## Current limitations and next production steps
- No student accounts or school admin login yet. The leaderboard is public to anyone who can access the URL and students can submit display names. Do not use it for sensitive personal data.
- The current catalogue is a starter list and may not reflect the exact current syllabus, textbook edition, deleted/revised chapters, or school-specific curriculum.
- AI-generated questions can contain mistakes. Treat this as practice, not an official CBSE paper; review important questions against the textbook.
- Add authentication, request quotas, abuse protection, a database (Postgres/Supabase) and moderation before large-scale public use.
- The server applies a small per-IP generation cooldown but this is not a substitute for robust production abuse controls.

## API notes
Question generation uses the OpenAI Responses API and structured JSON output so the result has a predictable question/option/answer shape. See the official docs:
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/reference/resources/responses/methods/create
