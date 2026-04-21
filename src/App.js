import { useState, useEffect } from "react";
import { db } from "./firebase";
import { ref, set, get, onValue, update, off } from "firebase/database";
import { CARTOONS } from "./cartoons";

// ── Constants ────────────────────────────────────────────────────────────────
const POINTS_CORRECT_MATCH = 2;
const POINTS_FOOLED        = 1;
const POINTS_FAVORITE      = 3;

const PHASE = {
  HOME:       "home",
  LOBBY:      "lobby",
  CAPTION:    "caption",
  WAIT:       "wait",
  JUDGE:      "judge",
  RESULTS:    "results",
  FINAL:      "final",
};

// ── Utilities ────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Lato:wght@300;400;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body {
    background: #1a1209;
    font-family: 'Lato', sans-serif;
    color: #f0e8d8;
    min-height: 100vh;
    -webkit-text-size-adjust: 100%;
  }
  .app {
    max-width: 430px;
    margin: 0 auto;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #1a1209;
  }
  .content { flex: 1; display: flex; flex-direction: column; padding-bottom: 24px; }
  .header {
    text-align: center;
    padding: 18px 16px 8px;
    border-bottom: 1px solid #3a2a14;
  }
  .header-title {
    font-family: 'Playfair Display', serif;
    font-style: italic;
    font-size: 1.5rem;
    color: #e8c87a;
  }
  .header-sub { font-size: 0.7rem; color: #7a6a50; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 2px; }
  .card {
    background: #241808;
    border: 1px solid #3a2a14;
    border-radius: 12px;
    padding: 18px;
    margin: 10px 16px 0;
  }
  .cartoon-frame {
    background: white;
    border: 3px solid #3a2a14;
    border-radius: 8px;
    margin: 10px 16px 0;
    overflow: hidden;
    aspect-ratio: 320/220;
    box-shadow: 0 4px 24px #00000060;
  }
  input[type=text], textarea {
    background: #0e0a04;
    border: 1px solid #4a3820;
    border-radius: 8px;
    color: #f0e8d8;
    font-family: 'Lato', sans-serif;
    font-size: 1rem;
    padding: 12px 14px;
    width: 100%;
    outline: none;
    transition: border-color 0.2s;
  }
  input[type=text]:focus, textarea:focus { border-color: #e8c87a; }
  textarea { resize: none; }
  .btn {
    display: block;
    width: calc(100% - 32px);
    margin: 10px 16px 0;
    padding: 15px;
    border: none;
    border-radius: 10px;
    font-family: 'Lato', sans-serif;
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn:active { transform: scale(0.97); }
  .btn:disabled { opacity: 0.35; cursor: default; }
  .btn-primary { background: #e8c87a; color: #1a1209; }
  .btn-secondary { background: transparent; color: #e8c87a; border: 1px solid #4a3820; }
  .btn-danger { background: #7a2020; color: #f0d0d0; }
  .btn-inline {
    display: inline-block;
    width: auto;
    margin: 0;
    padding: 8px 16px;
    font-size: 0.8rem;
  }
  .label { font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; color: #7a6a50; margin-bottom: 8px; }
  .player-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .player-pill {
    background: #2e1e08;
    border: 1px solid #4a3820;
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 0.85rem;
    color: #c0a860;
  }
  .player-pill.judge { border-color: #e8c87a; color: #e8c87a; }
  .player-pill.me { border-color: #4a9a4a; color: #7aca7a; }
  .room-code {
    font-family: 'Playfair Display', serif;
    font-size: 3.5rem;
    color: #e8c87a;
    letter-spacing: 0.2em;
    text-align: center;
    padding: 10px 0;
  }
  .round-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    font-size: 0.72rem;
    color: #7a6a50;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .score-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid #2a1a08;
  }
  .score-row:last-child { border-bottom: none; }
  .score-name { font-size: 1rem; color: #e0d0b0; }
  .score-pts { font-family: 'Playfair Display', serif; font-size: 1.3rem; color: #e8c87a; }
  .caption-option {
    background: #0e0a04;
    border: 2px solid #3a2a14;
    border-radius: 10px;
    padding: 14px;
    margin-bottom: 10px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .caption-option:hover { border-color: #6a4a20; }
  .caption-option.selected { border-color: #e8c87a; background: #1e1204; }
  .caption-option.fave { border-color: #e87a7a; }
  .caption-option.fave.selected { border-color: #e87a7a; background: #2e1010; }
  .caption-text { font-family: 'Playfair Display', serif; font-style: italic; font-size: 1rem; color: #f0e8d8; line-height: 1.5; }
  .result-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    background: #0e0a04;
    border-radius: 8px;
    margin-bottom: 8px;
    border-left: 3px solid #3a2a14;
  }
  .result-item.correct { border-left-color: #4a9a4a; }
  .result-item.favorite { border-left-color: #e87a7a; }
  .result-caption { font-family: 'Playfair Display', serif; font-style: italic; font-size: 0.95rem; }
  .result-meta { font-size: 0.78rem; color: #7a6a50; }
  .result-pts { font-size: 0.82rem; color: #e8c87a; font-weight: 700; }
  .center { text-align: center; }
  .big-icon { font-size: 3rem; text-align: center; display: block; margin: 8px 0; }
  .hero-text { font-family: 'Playfair Display', serif; font-size: 1.6rem; color: #e8c87a; text-align: center; }
  .muted { color: #7a6a50; font-size: 0.9rem; line-height: 1.6; text-align: center; }
  .divider { height: 1px; background: #3a2a14; margin: 12px 0; }
  .spacer { flex: 1; }
  .waiting-dots::after {
    content: '...';
    animation: dots 1.5s steps(4, end) infinite;
  }
  @keyframes dots {
    0%, 20% { content: ''; }
    40% { content: '.'; }
    60% { content: '..'; }
    80%, 100% { content: '...'; }
  }
  .tag {
    display: inline-block;
    background: #2e1e08;
    border: 1px solid #4a3820;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 0.72rem;
    color: #c0a860;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-right: 4px;
  }
  .winner-name { font-family: 'Playfair Display', serif; font-size: 2rem; color: #e8c87a; text-align: center; }
  .error { color: #e87a7a; font-size: 0.85rem; margin-top: 8px; }
`;

// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  // Local player identity
  const [myName, setMyName]       = useState("");
  const [nameInput, setNameInput] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [roomCode, setRoomCode]   = useState("");
  const [isHost, setIsHost]       = useState(false);
  const [error, setError]         = useState("");
  const [localPhase] = useState(PHASE.HOME);

  // Live game state from Firebase
  const [game, setGame] = useState(null);

  // Local judge interaction state (not synced — only judge's phone needs this)
  const [matches, setMatches]   = useState({});
  const [favorite, setFavorite] = useState(null);

  // Local caption input
  const [captionInput, setCaptionInput] = useState("");
  const [submitted, setSubmitted]       = useState(false);

  // ── Subscribe to game state ───────────────────────────────────────────────
  useEffect(() => {
    if (!roomCode) return;
    const gameRef = ref(db, `rooms/${roomCode}`);
    onValue(gameRef, (snap) => {
      const data = snap.val();
      if (data) setGame(data);
    });
    return () => off(gameRef);
  }, [roomCode]);

  // Reset submission flag when phase changes to caption
  useEffect(() => {
    if (game?.phase === PHASE.CAPTION) {
      setSubmitted(false);
      setCaptionInput("");
    }
    if (game?.phase === PHASE.JUDGE) {
      setMatches({});
      setFavorite(null);
    }
  }, [game?.phase, game?.round]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const players     = game ? Object.keys(game.players || {}) : [];
  const judge       = game?.judge || "";
  const nonJudges   = players.filter(p => p !== judge);
  const amJudge     = myName === judge;
  const captions    = game?.captions || {};
  const shuffledCaptions = game?.shuffledCaptions
    ? game.shuffledCaptions.map(key => [key, captions[key]])
    : [];
  const scores      = game?.scores || {};
  const round       = game?.round ?? 0;
  const totalRounds = game?.totalRounds ?? 3;
  const currentCartoon = game?.cartoonOrder
    ? CARTOONS.find(c => c.id === game.cartoonOrder[round]) || CARTOONS[0]
    : CARTOONS[0];

  // ── Create room (host) ────────────────────────────────────────────────────
  async function createRoom() {
    const name = nameInput.trim();
    if (!name) return;
    const code = generateRoomCode();
    const cartoonOrder = shuffle(CARTOONS.map(c => c.id));
    await set(ref(db, `rooms/${code}`), {
      host: name,
      phase: PHASE.LOBBY,
      round: 0,
      totalRounds: 3,
      judge: "",
      cartoonOrder,
      players: { [name]: true },
      scores: { [name]: 0 },
      captions: {},
      shuffledCaptions: [],
      results: [],
    });
    setMyName(name);
    setRoomCode(code);
    setIsHost(true);
  }

  // ── Join room ─────────────────────────────────────────────────────────────
  async function joinRoom() {
    const name = nameInput.trim();
    const code = roomInput.trim().toUpperCase();
    if (!name || code.length !== 4) { setError("Enter your name and a 4-letter room code."); return; }
    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) { setError("Room not found. Check the code and try again."); return; }
    const data = snap.val();
    if (data.phase !== PHASE.LOBBY) { setError("That game has already started."); return; }
    if (Object.keys(data.players || {}).includes(name)) { setError("That name is already taken."); return; }
    await update(ref(db, `rooms/${code}`), {
      [`players/${name}`]: true,
      [`scores/${name}`]: 0,
    });
    setMyName(name);
    setRoomCode(code);
    setIsHost(false);
  }

  // ── Host: start game ──────────────────────────────────────────────────────
  async function startGame() {
    const playerList = Object.keys(game.players);
    if (playerList.length < 3) return;
    const judgePlayer = playerList[0];
    await update(ref(db, `rooms/${roomCode}`), {
      phase: PHASE.CAPTION,
      judge: judgePlayer,
      round: 0,
      captions: {},
      shuffledCaptions: [],
    });
  }

  // ── Host: change rounds ───────────────────────────────────────────────────
  async function setTotalRounds(n) {
    await update(ref(db, `rooms/${roomCode}`), { totalRounds: n });
  }

  // ── Submit caption ────────────────────────────────────────────────────────
  async function submitCaption() {
    const text = captionInput.trim();
    if (!text || submitted) return;
    await update(ref(db, `rooms/${roomCode}`), {
      [`captions/${myName}`]: text,
    });
    setSubmitted(true);
    // Check if all non-judges have submitted — host advances
    const updatedCaptions = { ...captions, [myName]: text };
    const allIn = nonJudges.every(p => updatedCaptions[p]);
    if (allIn && isHost) {
      // Shuffle caption order for judge
      const shuffled = shuffle(nonJudges.filter(p => updatedCaptions[p]));
      await update(ref(db, `rooms/${roomCode}`), {
        phase: PHASE.JUDGE,
        shuffledCaptions: shuffled,
      });
    }
  }

  // Also watch for all captions in (non-host players need this too)
  useEffect(() => {
    if (!game || game.phase !== PHASE.CAPTION || !isHost) return;
    const allIn = nonJudges.every(p => captions[p]);
    if (allIn && nonJudges.length > 0) {
      const shuffled = shuffle(nonJudges.filter(p => captions[p]));
      update(ref(db, `rooms/${roomCode}`), {
        phase: PHASE.JUDGE,
        shuffledCaptions: shuffled,
      });
    }
  }, [captions, game?.phase, isHost, nonJudges, roomCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Judge submits ─────────────────────────────────────────────────────────
  async function submitJudgment() {
    if (!favorite) return;
    const newScores = { ...scores };
    const results = [];

    shuffledCaptions.forEach(([writer, captionText]) => {
      const guessed = matches[captionText];
      const correct = guessed === writer;
      const isFave  = captionText === favorite;
      const pts = [];

      if (correct) {
        newScores[judge] = (newScores[judge] || 0) + POINTS_CORRECT_MATCH;
        pts.push(`Judge +${POINTS_CORRECT_MATCH}`);
      } else {
        newScores[writer] = (newScores[writer] || 0) + POINTS_FOOLED;
        pts.push(`${writer} +${POINTS_FOOLED} (fooled judge)`);
      }
      if (isFave) {
        newScores[writer] = (newScores[writer] || 0) + POINTS_FAVORITE;
        pts.push(`${writer} +${POINTS_FAVORITE} (favorite!)`);
      }
      results.push({ writer, captionText, guessed: guessed || null, correct, isFave, pts });
    });

    await update(ref(db, `rooms/${roomCode}`), {
      phase: PHASE.RESULTS,
      scores: newScores,
      results,
    });
  }

  // ── Next round / end ──────────────────────────────────────────────────────
  async function nextRound() {
    if (!isHost) return;
    const nextRound = (game.round || 0) + 1;
    if (nextRound >= totalRounds) {
      await update(ref(db, `rooms/${roomCode}`), { phase: PHASE.FINAL });
      return;
    }
    const playerList = Object.keys(game.players);
    const currentJudgeIdx = playerList.indexOf(game.judge);
    const nextJudge = playerList[(currentJudgeIdx + 1) % playerList.length];
    await update(ref(db, `rooms/${roomCode}`), {
      phase: PHASE.CAPTION,
      round: nextRound,
      judge: nextJudge,
      captions: {},
      shuffledCaptions: [],
      results: [],
    });
  }

  // ── Play again ────────────────────────────────────────────────────────────
  async function playAgain() {
    if (!isHost) return;
    const playerList = Object.keys(game.players);
    const freshScores = {};
    playerList.forEach(p => { freshScores[p] = 0; });
    const cartoonOrder = shuffle(CARTOONS.map(c => c.id));
    await update(ref(db, `rooms/${roomCode}`), {
      phase: PHASE.LOBBY,
      round: 0,
      judge: "",
      captions: {},
      shuffledCaptions: [],
      results: [],
      scores: freshScores,
      cartoonOrder,
    });
  }

  // ── Toggle judge match ────────────────────────────────────────────────────
  function toggleMatch(captionText, playerName) {
    setMatches(m => {
      const n = { ...m };
      Object.keys(n).forEach(k => { if (n[k] === playerName) delete n[k]; });
      if (n[captionText] === playerName) delete n[captionText];
      else n[captionText] = playerName;
      return n;
    });
  }

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{S}</style>
      <div className="app">
        <div className="content">

          {/* HEADER */}
          <div className="header">
            <div className="header-title">Caption Contest</div>
            <div className="header-sub">
              {roomCode ? `Room: ${roomCode}` : "The Party Game"}
            </div>
          </div>

          {/* ── HOME ── */}
          {!roomCode && localPhase === PHASE.HOME && (
            <>
              <div className="card" style={{marginTop:20}}>
                <div className="label">Your Name</div>
                <input
                  type="text"
                  placeholder="Enter your name…"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  maxLength={18}
                />
              </div>
              <button className="btn btn-primary" onClick={createRoom} disabled={!nameInput.trim()}>
                Create Room (Host)
              </button>
              <div style={{textAlign:"center",margin:"12px 0",color:"#4a3820",fontSize:"0.85rem"}}>— or —</div>
              <div className="card">
                <div className="label">Room Code</div>
                <input
                  type="text"
                  placeholder="4-letter code…"
                  value={roomInput}
                  onChange={e => setRoomInput(e.target.value.toUpperCase())}
                  maxLength={4}
                  style={{textTransform:"uppercase",letterSpacing:"0.2em",fontSize:"1.3rem"}}
                />
                {error && <div className="error">{error}</div>}
              </div>
              <button className="btn btn-secondary" onClick={joinRoom} disabled={!nameInput.trim() || roomInput.length !== 4}>
                Join Room
              </button>
              <div className="spacer"/>
              <div className="card" style={{marginTop:16}}>
                <div className="label">How to Play</div>
                <div style={{fontSize:"0.82rem",color:"#7a6a50",lineHeight:1.7}}>
                  1. Host creates a room and shares the code<br/>
                  2. Everyone joins on their own phone<br/>
                  3. Each round: write a funny caption for the cartoon<br/>
                  4. The judge guesses who wrote each one &amp; picks a favorite<br/>
                  5. Points for matching and for the best caption!
                </div>
              </div>
            </>
          )}

          {/* ── LOBBY ── */}
          {game?.phase === PHASE.LOBBY && (
            <>
              <div className="card" style={{marginTop:16,textAlign:"center"}}>
                <div className="label">Room Code — Share with friends</div>
                <div className="room-code">{roomCode}</div>
                <div className="muted">Everyone opens this app and enters the code</div>
              </div>

              <div className="card">
                <div className="label">Players ({players.length}/8)</div>
                <div className="player-list">
                  {players.map(p => (
                    <div key={p} className={`player-pill ${p===myName?"me":""}`}>
                      {p} {p===myName ? "· you" : ""}
                    </div>
                  ))}
                </div>
              </div>

              {isHost && (
                <>
                  <div className="card">
                    <div className="label">Rounds</div>
                    <div style={{display:"flex",gap:"10px"}}>
                      {[1,2,3,4,5].map(n => (
                        <button
                          key={n}
                          className={`btn btn-inline ${game.totalRounds===n?"btn-primary":"btn-secondary"}`}
                          style={{flex:1,padding:"10px 0"}}
                          onClick={() => setTotalRounds(n)}
                        >{n}</button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={startGame}
                    disabled={players.length < 3}
                  >
                    {players.length < 3 ? `Need ${3-players.length} more player${3-players.length===1?"":"s"}` : "Start Game"}
                  </button>
                </>
              )}

              {!isHost && (
                <div className="card" style={{textAlign:"center",marginTop:24}}>
                  <span className="big-icon">⏳</span>
                  <div className="muted">Waiting for the host to start<span className="waiting-dots"/></div>
                </div>
              )}
            </>
          )}

          {/* ── CAPTION PHASE ── */}
          {game?.phase === PHASE.CAPTION && (
            <>
              <div className="round-bar">
                <span>Round {round+1} of {totalRounds}</span>
                <span>Judge: <strong style={{color:"#e8c87a"}}>{judge}</strong></span>
              </div>

              <div className="cartoon-frame">
                <img src={currentCartoon.src} alt="Cartoon" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
              </div>

              {amJudge ? (
                <div className="card" style={{textAlign:"center",marginTop:16}}>
                  <span className="big-icon">🎭</span>
                  <div className="hero-text">You're the Judge!</div>
                  <div className="muted" style={{marginTop:8}}>
                    Everyone else is writing captions.<br/>Get ready to guess who wrote what.
                  </div>
                  <div className="divider"/>
                  <div style={{fontSize:"0.82rem",color:"#5a4a30"}}>
                    {nonJudges.filter(p=>captions[p]).length} / {nonJudges.length} captions submitted
                    <span className="waiting-dots"/>
                  </div>
                </div>
              ) : submitted ? (
                <div className="card" style={{textAlign:"center",marginTop:16}}>
                  <span className="big-icon">✅</span>
                  <div className="hero-text">Caption submitted!</div>
                  <div className="muted" style={{marginTop:8}}>
                    Waiting for others<span className="waiting-dots"/>
                  </div>
                  <div className="divider"/>
                  <div style={{fontSize:"0.82rem",color:"#5a4a30"}}>
                    {nonJudges.filter(p=>captions[p]).length} / {nonJudges.length} submitted
                  </div>
                </div>
              ) : (
                <>
                  <div className="card">
                    <div className="label">Your Caption</div>
                    <textarea
                      rows={3}
                      placeholder="Write your funniest caption…"
                      value={captionInput}
                      onChange={e => setCaptionInput(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-primary" onClick={submitCaption} disabled={!captionInput.trim()}>
                    Submit Caption
                  </button>
                </>
              )}
            </>
          )}

          {/* ── JUDGE PHASE ── */}
          {game?.phase === PHASE.JUDGE && (
            <>
              <div className="round-bar">
                <span>Round {round+1}</span>
                <span style={{color:"#e8c87a"}}>{amJudge ? "Your turn to judge" : `${judge} is judging`}</span>
              </div>

              <div className="cartoon-frame">
                <img src={currentCartoon.src} alt="Cartoon" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
              </div>

              {amJudge ? (
                <>
                  <div className="card">
                    <div className="label">Match each caption to its author, then pick your ★ favorite</div>
                    {shuffledCaptions.map(([_writer, captionText]) => {
                      const assignedTo = matches[captionText];
                      const isFave = favorite === captionText;
                      return (
                        <div key={captionText} className={`caption-option ${assignedTo?"selected":""} ${isFave?"fave":""}`}>
                          <div className="caption-text">"{captionText}"</div>
                          <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginTop:"10px",alignItems:"center"}}>
                            {nonJudges.map(p => (
                              <button
                                key={p}
                                onClick={() => toggleMatch(captionText, p)}
                                style={{
                                  padding:"5px 10px",
                                  fontSize:"0.75rem",
                                  fontFamily:"'Lato',sans-serif",
                                  fontWeight:700,
                                  background: assignedTo===p ? "#3a2808" : "#1e1004",
                                  border: `1px solid ${assignedTo===p ? "#e8c87a" : "#3a2a14"}`,
                                  color: assignedTo===p ? "#e8c87a" : "#7a6a50",
                                  borderRadius:"6px",
                                  cursor:"pointer",
                                }}
                              >{p}</button>
                            ))}
                            <button
                              onClick={() => setFavorite(isFave ? null : captionText)}
                              style={{
                                marginLeft:"auto",
                                padding:"5px 10px",
                                fontSize:"0.75rem",
                                fontFamily:"'Lato',sans-serif",
                                fontWeight:700,
                                background: isFave ? "#3a0808" : "#1e0404",
                                border: `1px solid ${isFave ? "#e87a7a" : "#3a1414"}`,
                                color: isFave ? "#e87a7a" : "#6a3a3a",
                                borderRadius:"6px",
                                cursor:"pointer",
                              }}
                            >{isFave ? "★ Fave" : "☆ Fave"}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={submitJudgment}
                    disabled={!favorite}
                  >
                    Reveal Results
                  </button>
                </>
              ) : (
                <div className="card" style={{textAlign:"center",marginTop:16}}>
                  <span className="big-icon">🔍</span>
                  <div className="hero-text">{judge} is judging</div>
                  <div className="muted" style={{marginTop:8}}>
                    They're trying to figure out who wrote what<span className="waiting-dots"/>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── RESULTS ── */}
          {game?.phase === PHASE.RESULTS && (
            <>
              <div className="round-bar">
                <span>Round {round+1} Results</span>
              </div>
              <div className="cartoon-frame">
                <img src={currentCartoon.src} alt="Cartoon" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
              </div>
              <div className="card">
                <div className="label">Captions Revealed</div>
                {(game.results || []).map((r, i) => (
                  <div key={i} className={`result-item ${r.correct?"correct":""} ${r.isFave?"favorite":""}`}>
                    <div className="result-caption">"{r.captionText}"</div>
                    <div className="result-meta">
                      Written by <strong style={{color:"#c0a860"}}>{r.writer}</strong>
                      {" · "}Judge guessed: <strong style={{color:r.correct?"#4a9a4a":"#e87a7a"}}>{r.guessed || "—"}</strong>
                      {r.correct && " ✓"}
                    </div>
                    {r.isFave && <div style={{fontSize:"0.8rem",color:"#e87a7a"}}>★ Judge's Favorite</div>}
                    <div className="result-pts">{(r.pts||[]).join(" · ")}</div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="label">Scores</div>
                {[...players].sort((a,b)=>(scores[b]||0)-(scores[a]||0)).map(p => (
                  <div key={p} className="score-row">
                    <span className="score-name">{p}{p===myName?" (you)":""}</span>
                    <span className="score-pts">{scores[p]||0} pts</span>
                  </div>
                ))}
              </div>
              {isHost ? (
                <button className="btn btn-primary" onClick={nextRound}>
                  {round+1 >= totalRounds ? "See Final Results" : "Next Round →"}
                </button>
              ) : (
                <div className="card" style={{textAlign:"center"}}>
                  <div className="muted">Waiting for host to continue<span className="waiting-dots"/></div>
                </div>
              )}
            </>
          )}

          {/* ── FINAL ── */}
          {game?.phase === PHASE.FINAL && (
            <>
              <div style={{marginTop:16}}/>
              {(() => {
                const sorted = [...players].sort((a,b)=>(scores[b]||0)-(scores[a]||0));
                const winner = sorted[0];
                return (
                  <>
                    <div className="card" style={{textAlign:"center"}}>
                      <div className="label">Winner</div>
                      <span className="big-icon">🏆</span>
                      <div className="winner-name">{winner}</div>
                      <div style={{color:"#7a6a50",marginTop:"6px",fontSize:"0.9rem"}}>
                        {scores[winner]||0} points
                      </div>
                    </div>
                    <div className="card">
                      <div className="label">Final Standings</div>
                      {sorted.map((p, i) => (
                        <div key={p} className="score-row">
                          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                            <span style={{fontFamily:"'Playfair Display',serif",fontSize:"1.1rem"}}>
                              {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`}
                            </span>
                            <span className="score-name">{p}{p===myName?" (you)":""}</span>
                          </div>
                          <span className="score-pts">{scores[p]||0} pts</span>
                        </div>
                      ))}
                    </div>
                    {isHost && (
                      <button className="btn btn-primary" onClick={playAgain}>
                        Play Again
                      </button>
                    )}
                    {!isHost && (
                      <div className="card" style={{textAlign:"center"}}>
                        <div className="muted">Waiting for host to start a new game<span className="waiting-dots"/></div>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}

        </div>
      </div>
    </>
  );
}
