# MAGI

A web app where three AI units — **MELCHIOR**, **BALTHASAR**, and **CASPER** — each a genuinely different AI model, deliberate on a question you give them, then **vote**. Majority wins. A 2-1 split is a real, live outcome — there's no 4th judge overruling them. Inspired by the MAGI supercomputer from *Neon Genesis Evangelion*.

This is a **real, working project** using actual AI APIs, not a simulation. When you run it and ask a question, you're watching real AI models genuinely disagree and vote, live.

---
## What's actually going on

Each MAGI unit is a `{ name, model, systemPrompt }` object defined in `server/server.js`, in the `MAGI_UNITS` array. **That's the file to open first.**

The flow, each time you ask a question:
1. All three units give an opening analysis (Round 1), each seeing the question but not each other yet.
2. Round 2: each unit sees what the OTHER two said in Round 1, and responds.
3. Final round: each unit gives a closing position AND casts a vote — `APPROVE` or `REJECT`.
4. The server counts the votes. With 3 voters and 2 choices, you always get 3-0 or 2-1 — never a tie. Majority wins, no exceptions, no overrides.

---

## Setup (takes about 10 minutes)

### 1. Get an OpenRouter API key
Go to [openrouter.ai](https://openrouter.ai), make an account, and create an API key. OpenRouter is a middleman — one key, access to models from OpenAI, Anthropic, DeepSeek, Google, and many others, billed per-use. You'll load a small amount of credit (a few dollars goes a long way for a project like this).

### 2. Install Node.js
If you don't have it: [nodejs.org](https://nodejs.org) — get the LTS version.

### 3. Install the server's dependencies
```
cd server
npm install
```

### 4. Add your API key
Create a file called `.env` inside the `server` folder containing:
```
OPENROUTER_API_KEY=your-key-here
```
**Never commit this file to GitHub or share it publicly.** The included `.gitignore` already excludes it, as long as you don't rename it.

### 5. Run it
```
npm start
```
Then open **http://localhost:3001** in your browser.

---

## Project structure

```
ai-council/
├── server/
│   ├── server.js        <- THE BRAIN. MAGI_UNITS, prompts, voting logic, all here.
│   ├── package.json
│   └── .env              <- you create this, holds your API key (never share it)
├── public/
│   ├── index.html         <- the page structure
│   ├── style.css          <- the terminal / war-room look
│   └── app.js              <- handles live streaming updates + vote tally display
└── README.md               <- this file
```

---

## Things to try changing

- **Swap a model.** In `server.js`, each unit has a `model:` field with an OpenRouter model ID (e.g. `"openai/gpt-4o"`). Browse [openrouter.ai/models](https://openrouter.ai/models) and swap any of the three for a different one. Try making all three the *same* model again and compare how much less interesting the disagreement gets — that's a genuinely instructive experiment.
- **Rewrite a unit's personality.** Each `systemPrompt` shapes how that unit argues. Push CASPER to be more emotional, or MELCHIOR to be more ruthless, and see how the vote outcomes shift.
- **Change the number of deliberation rounds.** `const ROUNDS = 2` in `server.js` — more rounds means a longer, deeper debate before the final vote, at higher API cost.
- **Add a 4th unit as a tie-breaker for close calls**, or track vote history across multiple questions to see if any unit tends to side with another more often — that's a great "level 2" feature.

---


