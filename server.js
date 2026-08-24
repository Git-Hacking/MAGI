/**
 * MAGI — a 3-AI debate & voting engine
 * ------------------------------------------------------
 * Inspired by the MAGI supercomputer from Neon Genesis Evangelion:
 * three AI units — MELCHIOR, BALTHASAR, CASPER — each independently
 * analyze a question, debate, then VOTE. Majority wins. A 2-1 split
 * is a real possible outcome — there's no 4th judge overruling them.
 * That's the whole point of the show's version, and it's what makes
 * this more interesting than a single AI "deciding."
 *
 * BIG UPGRADE FROM V1: each unit is now a genuinely DIFFERENT AI
 * model, not the same model wearing three different personalities.
 * We do this through OpenRouter (https://openrouter.ai), a service
 * that gives you one API key with access to many different AI
 * companies' models. This matters because real model diversity —
 * different training data, different quirks, different blind spots —
 * produces more interesting, less "fake" disagreement than one model
 * roleplaying three characters.
 *
 * You can swap the three model names below for any other models
 * OpenRouter supports. Full list: https://openrouter.ai/models
 */

const path = require("path");
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai"); // OpenRouter uses an OpenAI-compatible API

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// OpenRouter speaks the same API shape as OpenAI, so we just point the
// OpenAI SDK at OpenRouter's URL instead of OpenAI's. One key, many models.
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

// ---------------------------------------------------------------------------
// STEP 1: Define the three MAGI units.
// Each one pairs a REAL, DIFFERENT model with a personality that matches
// the original show's characterization of that unit. Swap the `model`
// string for any model ID from https://openrouter.ai/models to experiment.
// ---------------------------------------------------------------------------
const MAGI_UNITS = [
  {
    id: "melchior",
    name: "MELCHIOR",
    number: 1,
    role: "The Scientist",
    color: "#5B8DEF",
    model: "openai/gpt-4o",
    systemPrompt: `You are MELCHIOR-1, one of the three MAGI units. You embody the
scientist: rigorous, evidence-driven, focused on what is technically true and provable.
You are impatient with arguments that aren't grounded in fact or mechanism. State your
position clearly. Keep responses to 2-4 sentences — this is a live deliberation, not
an essay.`,
  },
  {
    id: "balthasar",
    name: "BALTHASAR",
    number: 2,
    role: "The Mother",
    color: "#E85D75",
    model: "anthropic/claude-sonnet-4.5",
    systemPrompt: `You are BALTHASAR-2, one of the three MAGI units. You embody the
mother: protective, focused on consequences for the people involved, deeply attentive
to who could be harmed by a decision. You are not sentimental — you are precise about
duty of care. State your position clearly. Keep responses to 2-4 sentences — this is
a live deliberation, not an essay.`,
  },
  {
    id: "casper",
    name: "CASPER",
    number: 3,
    role: "The Woman",
    color: "#F5A623",
    model: "deepseek/deepseek-chat",
    systemPrompt: `You are CASPER-3, one of the three MAGI units. You embody the
individual: personal, intuitive, willing to weigh things the other two units dismiss
as irrational — instinct, dignity, what it actually feels like to live with a decision.
You often vote differently from the other two. State your position clearly. Keep
responses to 2-4 sentences — this is a live deliberation, not an essay.`,
  },
];

const VOTE_INSTRUCTION = `
After your response, on a NEW final line, output your vote in EXACTLY this format
(nothing else on that line):
VOTE: APPROVE
or
VOTE: REJECT
`;

// ---------------------------------------------------------------------------
// STEP 2: Call one MAGI unit for one round, STREAMING the response back
// token-by-token via `onToken`. This is what makes it feel like the unit
// is actively "thinking out loud" in real time, instead of text just
// appearing all at once after a delay — much closer to how NGE shows the
// MAGI actively processing.
// ---------------------------------------------------------------------------
async function askUnit(unit, question, transcriptSoFar, isFinalRound, onToken) {
  let contextBlock = `THE QUESTION BEFORE MAGI:\n"${question}"\n\n`;

  if (transcriptSoFar.length > 0) {
    contextBlock += `DELIBERATION SO FAR:\n`;
    for (const turn of transcriptSoFar) {
      contextBlock += `[${turn.name}]: ${turn.text}\n\n`;
    }
    contextBlock += isFinalRound
      ? `This is the FINAL round. Give your closing position and cast your vote.`
      : `Respond to the deliberation so far. If you're reacting to another unit, say so directly.`;
  } else {
    contextBlock += `You are first to speak. Give your opening analysis.`;
  }

  if (isFinalRound) {
    contextBlock += VOTE_INSTRUCTION;
  }

  // `stream: true` makes OpenRouter send the response back in small pieces
  // as the model generates them, rather than making us wait for the whole
  // thing. We loop over those pieces and call onToken() for each one.
  const stream = await client.chat.completions.create({
    model: unit.model,
    max_tokens: 300,
    stream: true,
    messages: [
      { role: "system", content: unit.systemPrompt },
      { role: "user", content: contextBlock },
    ],
  });

  let fullText = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (delta) {
      fullText += delta;
      onToken(delta, fullText);
    }
  }
  fullText = fullText.trim();

  // On the final round, split the vote line off from the spoken response
  // so the frontend can show them separately.
  let text = fullText;
  let vote = null;
  const voteMatch = fullText.match(/VOTE:\s*(APPROVE|REJECT)/i);
  if (voteMatch) {
    vote = voteMatch[1].toUpperCase();
    text = fullText.replace(/VOTE:\s*(APPROVE|REJECT)/i, "").trim();
  }

  return { text, vote };
}

// ---------------------------------------------------------------------------
// STEP 3: The main endpoint. Runs N rounds of deliberation, then a final
// vote round, then tallies APPROVE vs REJECT. Majority wins.
//
// Event sequence per unit, per round:
//   unit_start    -> fired the instant we begin calling that unit (lets the
//                     UI light up its hexagon as "processing" immediately,
//                     before any text exists yet)
//   unit_token    -> fired repeatedly as text streams in, a few words at a
//                     time (lets the UI show text appearing live, like the
//                     unit is actively thinking out loud)
//   turn_complete -> fired once that unit's full statement (and vote, on
//                     the final round) is finished
// ---------------------------------------------------------------------------
app.post("/api/deliberate", async (req, res) => {
  const { question } = req.body;
  if (!question || question.trim().length === 0) {
    return res.status(400).json({ error: "A question is required." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const transcript = [];
  const ROUNDS = 2; // deliberation rounds BEFORE the final vote round

  // NOTE on parallel calls: because all three units in a round fire at the
  // SAME time (see Promise.all below), none of them can read what the
  // others say *during that same round* — only what was said in PREVIOUS
  // rounds. This is actually a reasonable trade: it's more visually
  // faithful to the show (three units processing independently and
  // simultaneously, not politely waiting their turn), at the cost of
  // slightly less reactive cross-talk within a single round. If you want
  // units to react to each other within the same round instead, you'd
  // switch back to calling them one at a time (a for-loop instead of
  // Promise.all) — slower, but each unit sees everything said just before it.
  async function runUnitTurn(unit, round, isFinalRound) {
    send("unit_start", { name: unit.name, role: unit.role, color: unit.color, model: unit.model, round });

    const { text, vote } = await askUnit(unit, question, transcript, isFinalRound, (delta, fullSoFar) => {
      send("unit_token", { name: unit.name, delta, fullSoFar });
    });

    const turn = { name: unit.name, role: unit.role, color: unit.color, model: unit.model, text, round, vote };
    transcript.push(turn);
    send("turn_complete", turn);
    return { vote };
  }

  try {
    for (let round = 1; round <= ROUNDS; round++) {
      // Promise.all runs all three units' API calls AT THE SAME TIME, not
      // one after another. This matters visually: all three hexagons should
      // light up and start streaming text simultaneously, the way the real
      // MAGI process in parallel — not take turns like people in a meeting.
      await Promise.all(MAGI_UNITS.map((unit) => runUnitTurn(unit, round, false)));
    }

    // Final round: everyone votes, also in parallel.
    send("status", { message: "MAGI is casting final votes..." });
    const results = await Promise.all(MAGI_UNITS.map((unit) => runUnitTurn(unit, ROUNDS + 1, true)));
    const votes = MAGI_UNITS.map((unit, i) => ({ name: unit.name, vote: results[i].vote }));

    // Tally the vote. With 3 voters and 2 options, a strict tie is
    // mathematically impossible — you always get 3-0 or 2-1.
    const approveCount = votes.filter((v) => v.vote === "APPROVE").length;
    const rejectCount = votes.filter((v) => v.vote === "REJECT").length;
    const result = approveCount > rejectCount ? "APPROVE" : "REJECT";
    const unanimous = approveCount === 3 || rejectCount === 3;

    send("verdict", {
      result,
      approveCount,
      rejectCount,
      unanimous,
      votes,
    });
    send("done", {});
  } catch (err) {
    console.error(err);
    send("error", { message: "MAGI encountered an error: " + err.message });
  } finally {
    res.end();
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`MAGI is listening on http://localhost:${PORT}`);
});
