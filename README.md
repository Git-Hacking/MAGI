# MAGI

A web app where three AI units — **MELCHIOR**, **BALTHASAR**, and **CASPER** — each a genuinely different AI model, deliberate on a question you give them, then **vote**. Majority wins. A 2-1 split is a real, live outcome — there's no 4th judge overruling them. Inspired by the MAGI supercomputer from *Neon Genesis Evangelion*.

This is a **real, working project** using actual AI APIs, not a simulation. When you run it and ask a question, you're watching real AI models genuinely disagree and vote, live.

---

## What's different about this version (v2)

The first version used one AI model wearing three different "personality" system prompts. This version uses **three actually different models** — different companies, different training data, different quirks — via a service called **OpenRouter**, which gives you one API key with access to dozens of AI providers. That's a meaningfully more honest version of "three minds disagreeing," and it's the same design choice a well-known real GitHub project (`fshiori/magi`) makes, which is worth knowing: you're not copying it, you built your own independently, but it's good confirmation your instinct was a real, sound engineering choice.

---

## What's actually going on (read this first)

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

## Publishing to GitHub — complete beginner walkthrough

This assumes you've never used git or GitHub before. Every step is spelled out.

### 1. Create a GitHub account
Go to [github.com](https://github.com) and sign up. Free.

### 2. Install Git on your computer
Git is different from GitHub — GitHub is a website, Git is the actual tool that tracks and uploads your code.
- **Mac**: open Terminal (search for it in Spotlight) and type `git --version`. If it's not installed, your Mac will prompt you to install it — just follow that prompt.
- **Windows**: download and install [Git for Windows](https://git-scm.com/download/win). This also gives you "Git Bash," a terminal you'll use for the commands below.

### 3. Tell Git who you are (one-time setup)
Open your terminal (Terminal on Mac, Git Bash on Windows) and type these two lines, replacing the name/email with your own — this just labels your future uploads, it doesn't create an account:
```
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### 4. Create a new, empty repository on GitHub
1. Go to [github.com/new](https://github.com/new)
2. Repository name: `magi` (or anything you want)
3. Leave it set to **Public** so others can see it
4. **Do NOT check "Add a README"** — you already have one in this project, and having two causes a conflict
5. Click **Create repository**
6. GitHub will show you a page with some commands and a URL like `https://github.com/YOUR-USERNAME/magi.git` — keep this page open, you'll need that URL in step 6

### 5. Open a terminal INSIDE your project folder
This part trips people up, so be precise: you need your terminal's "current location" to actually be the `ai-council` folder from the zip you downloaded, not just any random location.
- **Mac**: find the unzipped `ai-council` folder in Finder, right-click it, choose "New Terminal at Folder" (or drag the folder onto the Terminal icon)
- **Windows**: open the `ai-council` folder in File Explorer, click the address bar, type `cmd` and hit Enter — or right-click inside the folder and choose "Git Bash Here"

Verify you're in the right place by typing:
```
ls
```
(Mac/Linux) or
```
dir
```
(Windows) — you should see `server`, `public`, `README.md` listed. If you don't, you're in the wrong folder.

### 6. Run these five commands, in order
Type each one, hit Enter, wait for it to finish before typing the next:
```
git init
git add .
git commit -m "First version of MAGI"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/magi.git
git push -u origin main
```
**Replace the URL in the second-to-last line** with the actual URL GitHub showed you in step 4.

### 7. You'll likely be asked to log in
The first time you push, GitHub may open a browser window asking you to sign in and authorize Git — just follow the prompts, it's a one-time thing per computer.

### 8. Check it worked
Refresh your GitHub repository page in the browser. You should see all your files — `server`, `public`, `README.md` — sitting there. That's it. It's live and public.

### 9. The one thing to double-check every single time
Look at your repo page and confirm there is **no `.env` file visible**. If you ever see one, delete it immediately from GitHub and treat your API key as compromised — go regenerate a new one at openrouter.ai. This shouldn't happen because of the `.gitignore` file already in the project, but it's always worth a 5-second glance.

### Updating your project later
Once this is set up, every time you make changes and want to re-upload them, you only need three commands, run from inside the project folder:
```
git add .
git commit -m "describe what you changed here"
git push
```
That's the entire day-to-day workflow — the steps above (1 through 6) are only needed once, the very first time.


