# Rosetta - Breaking Language Barriers in Real-Time Education

**Slogan:** *"Your voice in every language"*

---

## Inspiration

One of our team members has a parent who came to Canada as an international student decades ago. Despite being incredibly intelligent and driven, they struggled to keep up in lectures not because they lacked understanding of the material, but because they were constantly mentally translating English into their native language while simultaneously trying to absorb complex concepts.

This story is not unique. According to UNESCO, over 6 million students study abroad annually, with the majority attending institutions where instruction is delivered in a second language. These students often miss critical lecture content due to processing delays, spend hours after class reconstructing what was said, and experience cognitive fatigue that reduces comprehension and retention.

We built Rosetta because we believe that language should never be a barrier to education. If you are smart enough to be in the room, you deserve to understand what is being taught.

---

## What It Does

Rosetta is a real-time lecture translation and learning assistant that transforms how students with language barriers experience education. The application runs in your browser during live lectures and provides three parallel outputs:

**1. Real-Time Translated Audio**
As the professor speaks English, Rosetta captures the audio and outputs natural-sounding speech in the student's native language through their headphones. The translation maintains the professor's pacing and tone, allowing students to follow along without constant mental translation effort.

**2. Live Transcription with Smart Citations**
The center panel displays a real-time transcription of the lecture. As the professor discusses concepts covered in uploaded course materials (textbooks, lecture notes, readings), superscript citation numbers automatically appear inline, linking spoken content to relevant pages in the student's PDFs.

**3. AI-Powered Note Generation**
After the lecture ends, students can generate structured study notes that organize the transcript by topic (not chronologically), embed all citations with page references, and create bullet-point summaries of key concepts.

Additional features include:
- Question Translation: Type a question in your native language, get grammatically correct English to ask the professor, and have the system speak it aloud for you
- PDF Export: Export polished notes for offline study
- Folder Organization: Organize sessions by course for easy navigation

Rosetta supports Chinese (Mandarin), Hindi, Spanish, French, and Bengali, covering the native languages of a significant portion of international students.

---

## How We Built It

Rosetta is a full-stack web application with a React/TypeScript frontend and a FastAPI/Python backend, backed by PostgreSQL for relational data and ChromaDB for vector embeddings.

**Real-Time Translation Pipeline:**
The browser captures microphone audio using the Web Speech API for speech-to-text. Transcribed text is sent to our backend, which calls OpenRouter (Claude 3 Haiku) for translation, then streams the translated text to ElevenLabs Text-to-Speech for natural voice synthesis. The audio is streamed back to the browser via WebSocket for immediate playback.

**RAG (Retrieval-Augmented Generation) Pipeline:**
When students upload PDFs, we extract text, chunk it with overlap for context continuity, and generate 768-dimensional embeddings using a local BGE model. During lectures, transcript segments trigger semantic searches against the document index. Results are re-ranked using a TinyBERT cross-encoder to surface the top 3 most relevant citations.

**Note Generation:**
Post-lecture note generation uses an LLM to reorganize raw transcript content into logical sections with headings, bullet points, and properly formatted citations. The output is stored as Markdown, rendered in a TipTap-based rich text editor, and can be exported as PDF using WeasyPrint.

**Frontend Architecture:**
The UI uses Material UI for accessible, modern components. State management combines TanStack Query for server state (API caching, optimistic updates) and Zustand for client state (audio controls, UI preferences). The entire interface supports dynamic language switching, updating all copy in real-time based on user preference.

---

## Challenges We Ran Into

**Speeding Up the RAG Pipeline**

Our initial RAG implementation followed the standard pattern: call an LLM for query enrichment, call an embedding API for vectors, search the database, then re-rank. The problem? End-to-end latency was 400-950ms, which felt sluggish during live lectures where citations need to appear within seconds of the professor speaking.

We tackled this through several optimizations:

1. Replaced two sequential LLM API calls for keyword extraction and concept expansion with KeyBERT, a local library using sentence-transformers. This cut query enrichment from 200-600ms down to 10-30ms.

2. Switched from OpenAI's text-embedding-3-large (3072 dimensions, API call) to BAAI/bge-base-en-v1.5 (768 dimensions, local inference). Embedding latency dropped from 80-150ms to 5-15ms, and the quality difference for educational content is negligible.

3. Added distance-based early exit: if the vector search returns no candidates within an L2 distance of 1.5, we skip re-ranking entirely and return no citations. This prevents wasted computation on irrelevant queries like "let me take a sip of water."

4. Switched from a 6-layer cross-encoder to TinyBERT (2 layers) and reduced candidates from 10 to 5. Re-ranking went from 100-150ms down to 30-40ms.

The result: total RAG latency dropped from 400-950ms to 70-125ms, making citations feel nearly instantaneous.

**Scoping and Architecture Decisions**

With a hackathon timeline, we had to make hard choices about what to build versus what to defer. Early debates included:

- Should we build a mobile app or web app? We chose web for faster iteration and broader browser API support (Web Speech API is Chrome/Edge only on mobile).
- Should translation be speech-to-speech or text-based? We went with text-based (STT then translation then TTS) because it lets us display transcripts, trigger RAG queries, and generate notes from the same text stream.
- How do we handle the ElevenLabs API efficiently? Instead of bidirectional streaming, we buffer transcript segments and send them for TTS, which simplified error handling and reduced complexity.

Each of these decisions involved tradeoffs, but clear documentation in our FRDs helped us stay aligned as a team.

---

## Accomplishments That We Are Proud Of

**Sub-2-Second Translation Latency**
Achieving real-time translation with natural-sounding voice output in under 2 seconds end-to-end was a significant technical milestone. Students can genuinely follow along with lectures without perceiving lag.

**A Complete, Polished Product**
Rosetta is not a demo with mocked data. You can create folders, start sessions, upload real PDFs, receive live citations, generate notes, export PDFs, and change your language preference with all UI copy updating dynamically. Every feature works end-to-end.

**RAG Pipeline Performance**
Reducing RAG latency by 85% through thoughtful architectural decisions rather than just "throwing more hardware at it" felt like a genuine engineering win.

**Accessibility-First Design**
The entire UI supports keyboard navigation, screen readers, and dynamic font sizing. We built with accessibility as a core requirement and not an afterthought.

---

## What We Learned

- **Local models are underrated.** The assumption that cloud APIs are always better does not hold for latency-sensitive applications. Local inference with sentence-transformers gave us 10x faster embeddings with minimal quality loss.

- **RAG is only as good as its retrieval.** Spending time on query enrichment, proper chunking with overlap, and re-ranking made a bigger difference than model selection for the LLM.

- **Internationalization from day one pays off.** Building the language store early meant we could add new languages and update all copy in minutes, not hours.

---

## What is Next for Rosetta

**Speaker Diarization:** Distinguish between the professor and students asking questions, improving transcript clarity.

**Offline Mode:** Package local models with the frontend for situations without reliable internet, using WebGPU for in-browser inference.

**LMS Integration:** Connect with Canvas, Blackboard, and Moodle to automatically pull course materials and sync notes.

**Mobile App:** A dedicated iOS/Android app for better audio capture and background operation.

**Additional Languages:** Expand support to Arabic, Portuguese, Korean, Japanese, and more based on user demand.

---

## Built With

**Frontend:**
- React 18 with TypeScript
- Material UI (MUI) for components
- TanStack Query for server state
- Zustand for client state
- TipTap for rich text editing
- Web Speech API for speech recognition

**Backend:**
- FastAPI with Python 3.11
- PostgreSQL for relational data
- ChromaDB for vector storage
- SQLAlchemy with Alembic migrations
- WebSockets for real-time communication

**AI/ML:**
- ElevenLabs Text-to-Speech (eleven_turbo_v2_5)
- OpenRouter for LLM access (Claude 3 Haiku)
- BAAI/bge-base-en-v1.5 for embeddings (local)
- KeyBERT for keyword extraction (local)
- TinyBERT cross-encoder for re-ranking (local)

**Infrastructure:**
- Docker and Docker Compose
- WeasyPrint for PDF generation

---

## Track Alignment

### Best Minority Hack

Rosetta directly addresses the needs of underrepresented communities in higher education:

- **International students** who speak English as a second language and struggle with real-time comprehension
- **First-generation university students** who may lack support networks to help them catch up after lectures
- **ESL learners** who benefit from both audio translation and visual transcription
- **Hearing-impaired students** who rely on visual transcription to follow lectures

Our solution removes systemic barriers that disproportionately affect these groups. A student's ability to learn should not depend on being a native speaker of the instruction language.

### Best Use of ElevenLabs

ElevenLabs is central to Rosetta's core value proposition, not a supplementary feature. The entire translation experience depends on ElevenLabs Text-to-Speech:

- **Real-time voice synthesis:** Translated text is converted to natural, human-sounding audio that students listen to throughout the lecture
- **Voice selection:** Users can choose from available ElevenLabs voices to find one they find comfortable for extended listening
- **Question translation TTS:** When students translate a question to ask the professor, they can have ElevenLabs speak it aloud rather than reading it themselves

Without ElevenLabs, Rosetta would just be a transcription tool with text translation. ElevenLabs makes it a genuine real-time audio translation experience that reduces cognitive load and enables true lecture comprehension.

---

## Links

- **GitHub Repository:** https://github.com/AbeerDas/HackHive2026
- **Demo Video:** [Link to video]

---

*Built with care for HackHive 2026 by Abeer Das, Aaron Chow, Tawsif Mayaz, and Aryan Kansagara*
