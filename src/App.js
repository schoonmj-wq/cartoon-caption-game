import { useState, useEffect } from "react";
import { db } from "./firebase";
import { ref, set, get, onValue, update, off } from "firebase/database";
import { CARTOONS } from "./cartoons";

const POINTS_CORRECT_MATCH = 2;
const POINTS_FOOLED        = 1;
const POINTS_FAVORITE      = 3;

const PHASE = {
  LOBBY:   "lobby",
  CAPTION: "caption",
  JUDGE:   "judge",
  RESULTS: "results",
  FINAL:   "final",
};

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

function getSaved() {
  return {
    name: localStorage.getItem("cc_name") || "",
    room: localStorage.getItem("cc_room") || "",
    host: localStorage.getItem("cc_host") === "true",
  };
}

function saveSession(name, room, host) {
  localStorage.setItem("cc_name", name);
  localStorage.setItem("cc_room", room);
  localStorage.setItem("cc_host", host ? "true" : "false");
}

function clearSession() {
  localStorage.removeItem("cc_name");
  localStorage.removeItem("cc_room");
  localStorage.removeItem("cc_host");
}

const S = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Lato:wght@300;400;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { background: #1a1209; font-family: 'Lato', sans-serif; color: #f0e8d8; min-height: 100vh; -webkit-text-size-adjust: 100%; }
  .app { max-width: 430px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; background: #1a1209; }
  .content { flex: 1; display: flex; flex-direction: column; padding-bottom: 24px; }
  .header { text-align: center; padding: 14px 16px 10px; border-bottom: 1px solid #3a2a14; position: relative; }
  .header-title { font-family: 'Playfair Display', serif; font-style: italic; font-size: 1.5rem; color: #e8c87a; }
  .header-sub { font-size: 0.7rem; color: #7a6a50; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 2px; }
  .leave-btn {
    position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
    background: none; border: 1px solid #3a2a14; border-radius: 6px;
    color: #5a4a30; font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase;
    cursor: pointer; padding: 5px 10px; font-family: 'Lato', sans-serif;
  }
  .leave-btn:hover { color: #e87a7a; border-color: #7a3a3a; }
  .card { background: #241808; border: 1px solid #3a2a14; border-radius: 12px; padding: 18px; margin: 10px 16px 0; }
  .cartoon-frame { background: white; border: 3px solid #3a2a14; border-radius: 8px; margin: 10px 16px 0; overflow: hidden; aspect-ratio: 320/220; box-shadow: 0 4px 24px #00000060; }
  input[type=text], textarea { background: #0e0a04; border: 1px solid #4a3820; border-radius: 8px; color: #f0e8d8; font-family: 'Lato', sans-serif; font-size: 1rem; padding: 12px 14px; width: 100%; outline: none; transition: border-color 0.2s; }
  input[type=text]:focus, textarea:focus { border-color: #e8c87a; }
  textarea { resize: none; }
  .btn { display: block; width: calc(100% - 32px); margin: 10px 16px 0; padding: 15px; border: none; border-radius: 10px; font-family: 'Lato', sans-serif; font-weight: 700; font-size: 1rem; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
  .btn:active { transform: scale(0.97); }
  .btn:disabled { opacity: 0.35; cursor: default; }
  .btn-primary { background: #e8c87a; color: #1a1209; }
  .btn-secondary { background: transparent; color: #e8c87a; border: 1px solid #4a3820; }
  .btn-inline { display: inline-block; width: auto; margin: 0; padding: 8px 16px; font-size: 0.8rem; }
  .label { font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; color: #7a6a50; margin-bottom: 8px; }
  .player-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .player-pill { background: #2e1e08; border: 1px solid #4a3820; border-radius: 20px; padding: 6px 14px; font-size: 0.85rem; color: #c0a860; }
  .player-pill.me { border-color: #4a9a4a; color: #7aca7a; }
  .room-code { font-family: 'Playfair Display', serif; font-size: 3.5rem; color: #e8c87a; letter-spacing: 0.2em; text-align: center; padding: 10px 0; }
  .round-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; font-size: 0.72rem; color: #7a6a50; text-transform: uppercase; letter-spacing: 0.1em; }
  .score-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a1a08; }
  .score-row:last-child { border-bottom: none; }
  .score-name { font-size: 1rem; color: #e0d0b0; }
  .score-pts { font-family: 'Playfair Display', serif; font-size: 1.3rem; color: #e8c87a; }
  .caption-option { background: #0e0a04; border: 2px solid #3a2a14; border-radius: 10px; padding: 14px; margin-bottom: 10px; transition: all 0.15s; }
  .caption-option.interactive:hover { border-color: #6a4a20; cursor: pointer; }
  .caption-option.selected { border-color: #e8c87a; background: #1e1204; }
  .caption-option.fave { border-color: #e87a7a; }
  .caption-option.fave.selected { border-color: #e87a7a; background: #2e1010; }
  .caption-text { font-family: 'Playfair Display', serif; font-style: italic; font-size: 1rem; color: #f0e8d8; line-height: 1.5; }
  .result-item { display: flex; flex-direction: column; gap: 4px; padding: 12px; background: #0e0a04; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid #3a2a14; }
  .result-item.correct { border-left-color: #4a9a4a; }
  .result-item.favorite { border-left-color: #e87a7a; }
  .result-caption { font-family: 'Playfair Display', serif; font-style: italic; font-size: 0.95rem; }
  .result-meta { font-size: 0.78rem; color: #7a6a50; }
  .result-pts { font-size: 0.82rem; color: #e8c87a; font-weight: 700; }
  .big-icon { font-size: 3rem; text-align: center; display: block; margin: 8px 0; }
  .hero-text { font-family: 'Playfair Display', serif; font-size: 1.6rem; color: #e8c87a; text-align: center; }
  .muted { color: #7a6a50; font-size: 0.9rem; line-height: 1.6; text-align: center; }
  .divider { height: 1px; background: #3a2a14; margin: 12px 0; }
  .spacer { flex: 1; }
  .error { color: #e87a7a; font-size: 0.85rem; margin-top: 8px; }
  .winner-name { font-family: 'Playfair Display', serif; font-size: 2rem; color: #e8c87a; text-align: center; }
  .waiting-dots::after { content: ''; animation: dots 1.5s steps(4, end) infinite; }
  @keyframes dots { 0%,20%{content:''} 40%{content:'.'} 60%{content:'..'} 80%,100%{content:'...'} }
`;

export default function App() {
  const saved = getSaved();

  const [myName,    setMyName]    = useState(saved.name);
  const [roomCode,  setRoomCode]  = useState(saved.room);
  const [isHost,    setIsHost]    = useState(saved.host);
  const [nameInput, setNameInput] = useState(saved.name);
  const [roomInput, setRoomInput] = useState(saved.room);
  const [error,     setError]     = useState("");
  const [game,      setGame]      = useState(null);
  const [matches,   setMatches]   = useState({});
  const [favorite,  setFavorite]  = useState(null);
  const [captionInput, setCaptionInput] = useState("");
  const [submitted,    setSubmitted]    = useState(false);

  // Subscribe to Firebase whenever we have a roomCode
  useEffect(() => {
    if (!roomCode) return;
    const gameRef = ref(db, `rooms/${roomCode}`);
    onValue(gameRef, (snap) => {
      const data = snap.val();
      if (data) {
        setGame(data);
        // Re-add ourselves if we got dropped from the player list
        if (myName && !data.players?.[myName]) {
          update(ref(db, `rooms/${roomCode}`), {
            [`players/${myName}`]: true,
            [`scores/${myName}`]: data.scores?.[myName] ?? 0,
          });
        }
      } else {
        // Room was deleted
        clearSession();
        setGame(null); setRoomCode(""); setMyName("");
      }
    });
    return () => off(gameRef);
  }, [roomCode, myName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset local state on phase/round change
  useEffect(() => {
    if (!game) return;
    if (game.phase === PHASE.CAPTION) {
      setMatches({}); setFavorite(null);
      if (game.captions?.[myName]) { setSubmitted(true); }
      else { setSubmitted(false); setCaptionInput(""); }
    }
    if (game.phase === PHASE.JUDGE) {
      setMatches({}); setFavorite(null);
    }
  }, [game?.phase, game?.round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived
  const players   = game ? Object.keys(game.players || {}) : [];
  const judge     = game?.judge || "";
  const nonJudges = players.filter(p => p !== judge);
  const amJudge   = myName === judge;
  const captions  = game?.captions || {};
  const shuffledCaptions = (game?.shuffledCaptions || []).map(key => [key, captions[key]]);
  const scores    = game?.scores || {};
  const round     = game?.round ?? 0;
  const totalRounds = game?.totalRounds ?? 3;
  const currentCartoon = game?.cartoonOrder
    ? (CARTOONS[game.cartoonOrder[round]] || CARTOONS[0])
    : CARTOONS[0];

  function leaveRoom() {
    clearSession();
    setMyName(""); setRoomCode(""); setIsHost(false);
    setGame(null); setNameInput(""); setRoomInput(""); setError("");
  }

  async function createRoom() {
    const name = nameInput.trim();
    if (!name) return;
    const code = generateRoomCode();
    const cartoonOrder = shuffle([...Array(CARTOONS.length).keys()]);
    await set(ref(db, `rooms/${code}`), {
      host: name, phase: PHASE.LOBBY, round: 0, totalRounds: 3,
      judge: "", cartoonOrder,
      players: { [name]: true }, scores: { [name]: 0 },
      captions: {}, shuffledCaptions: [], results: [],
    });
    saveSession(name, code, true);
    setMyName(name); setRoomCode(code); setIsHost(true);
  }

  async function joinRoom() {
    const name = nameInput.trim();
    const code = roomInput.trim().toUpperCase();
    if (!name || code.length !== 4) { setError("Enter your name and a 4-letter room code."); return; }
    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) { setError("Room not found. Check the code and try again."); return; }
    const data = snap.val();
    const alreadyIn = Object.keys(data.players || {}).includes(name);
    if (!alreadyIn && data.phase !== PHASE.LOBBY) { setError("That game has already started."); return; }
    if (!alreadyIn) {
      await update(ref(db, `rooms/${code}`), { [`players/${name}`]: true, [`scores/${name}`]: 0 });
    }
    const wasHost = data.host === name;
    saveSession(name, code, wasHost);
    setMyName(name); setRoomCode(code); setIsHost(wasHost);
  }

  async function startGame() {
    const playerList = Object.keys(game.players);
    if (playerList.length < 3) return;
    await update(ref(db, `rooms/${roomCode}`), {
      phase: PHASE.CAPTION, judge: playerList[0],
      round: 0, captions: {}, shuffledCaptions: [], results: [],
    });
  }

  async function setTotalRounds(n) {
    await update(ref(db, `rooms/${roomCode}`), { totalRounds: n });
  }

  async function submitCaption() {
    const text = captionInput.trim();
    if (!text || submitted) return;
    const newCaptions = { ...captions, [myName]: text };
    await update(ref(db, `rooms/${roomCode}`), { [`captions/${myName}`]: text });
    setSubmitted(true);
    if (isHost && nonJudges.every(p => newCaptions[p])) {
      await update(ref(db, `rooms/${roomCode}`), {
        phase: PHASE.JUDGE,
        shuffledCaptions: shuffle(nonJudges.filter(p => newCaptions[p])),
      });
    }
  }

  // Host watches for all captions in
  useEffect(() => {
    if (!game || game.phase !== PHASE.CAPTION || !isHost) return;
    if (nonJudges.length > 0 && nonJudges.every(p => captions[p])) {
      update(ref(db, `rooms/${roomCode}`), {
        phase: PHASE.JUDGE,
        shuffledCaptions: shuffle(nonJudges.filter(p => captions[p])),
      });
    }
  }, [captions, game?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitJudgment() {
    if (!favorite) return;
    const newScores = { ...scores };
    const results = [];
    shuffledCaptions.forEach(([writer, captionText]) => {
      const guessed = matches[captionText];
      const correct = guessed === writer;
      const isFave  = captionText === favorite;
      const pts = [];
      if (correct) { newScores[judge] = (newScores[judge]||0) + POINTS_CORRECT_MATCH; pts.push(`Judge +${POINTS_CORRECT_MATCH}`); }
      else { newScores[writer] = (newScores[writer]||0) + POINTS_FOOLED; pts.push(`${writer} +${POINTS_FOOLED} (fooled judge)`); }
      if (isFave) { newScores[writer] = (newScores[writer]||0) + POINTS_FAVORITE; pts.push(`${writer} +${POINTS_FAVORITE} (favorite!)`); }
      results.push({ writer, captionText, guessed: guessed||null, correct, isFave, pts });
    });
    await update(ref(db, `rooms/${roomCode}`), { phase: PHASE.RESULTS, scores: newScores, results });
  }

  async function nextRound() {
    if (!isHost) return;
    const next = (game.round||0) + 1;
    if (next >= totalRounds) { await update(ref(db, `rooms/${roomCode}`), { phase: PHASE.FINAL }); return; }
    const playerList = Object.keys(game.players);
    const nextJudge = playerList[(playerList.indexOf(game.judge)+1) % playerList.length];
    await update(ref(db, `rooms/${roomCode}`), {
      phase: PHASE.CAPTION, round: next, judge: nextJudge,
      captions: {}, shuffledCaptions: [], results: [],
    });
  }

  async function playAgain() {
    if (!isHost) return;
    const playerList = Object.keys(game.players);
    const freshScores = {};
    playerList.forEach(p => { freshScores[p] = 0; });
    await update(ref(db, `rooms/${roomCode}`), {
      phase: PHASE.LOBBY, round: 0, judge: "",
      captions: {}, shuffledCaptions: [], results: [],
      scores: freshScores,
      cartoonOrder: shuffle([...Array(CARTOONS.length).keys()]),
    });
  }

  function toggleMatch(captionText, playerName) {
    setMatches(m => {
      const n = { ...m };
      Object.keys(n).forEach(k => { if (n[k] === playerName) delete n[k]; });
      if (n[captionText] === playerName) delete n[captionText];
      else n[captionText] = playerName;
      return n;
    });
  }

  const inRoom = !!roomCode;

  return (
    <>
      <style>{S}</style>
      <div className="app">
        <div className="content">

          {/* HEADER */}
          <div className="header">
            <div className="header-title">Caption Contest</div>
            <div className="header-sub">{inRoom ? `Room: ${roomCode} · ${myName}` : "The Party Game"}</div>
            {inRoom && <button className="leave-btn" onClick={leaveRoom}>Leave</button>}
          </div>

          {/* HOME */}
          {!inRoom && (
            <>
              <div className="card" style={{marginTop:20}}>
                <div className="label">Your Name</div>
                <input type="text" placeholder="Enter your name…" value={nameInput}
                  onChange={e => setNameInput(e.target.value)} maxLength={18}
                  onKeyDown={e => e.key==="Enter" && createRoom()}/>
              </div>
              <button className="btn btn-primary" onClick={createRoom} disabled={!nameInput.trim()}>
                Create Room (Host)
              </button>
              <div style={{textAlign:"center",margin:"12px 0",color:"#4a3820",fontSize:"0.85rem"}}>— or —</div>
              <div className="card">
                <div className="label">Join with Room Code</div>
                <input type="text" placeholder="4-letter code…" value={roomInput}
                  onChange={e => { setRoomInput(e.target.value.toUpperCase()); setError(""); }}
                  maxLength={4} style={{textTransform:"uppercase",letterSpacing:"0.2em",fontSize:"1.3rem"}}
                  onKeyDown={e => e.key==="Enter" && joinRoom()}/>
                {error && <div className="error">{error}</div>}
              </div>
              <button className="btn btn-secondary" onClick={joinRoom}
                disabled={!nameInput.trim() || roomInput.length !== 4}>
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

          {/* CONNECTING (saved session, waiting for Firebase) */}
          {inRoom && !game && (
            <div className="card" style={{marginTop:24,textAlign:"center"}}>
              <span className="big-icon">⏳</span>
              <div className="hero-text">Reconnecting…</div>
              <div className="muted" style={{marginTop:8}}>Rejoining room <strong style={{color:"#e8c87a"}}>{roomCode}</strong> as {myName}</div>
              <div className="divider"/>
              <button className="btn btn-secondary" style={{width:"auto",margin:"0 auto"}} onClick={leaveRoom}>
                Leave Room
              </button>
            </div>
          )}

          {/* LOBBY */}
          {game?.phase === PHASE.LOBBY && (
            <>
              <div className="card" style={{marginTop:16,textAlign:"center"}}>
                <div className="label">Room Code — Share with friends</div>
                <div className="room-code">{roomCode}</div>
                {/* QR code pointing directly to the site */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(window.location.href)}`}
                  alt="QR Code"
                  style={{width:160,height:160,margin:"10px auto",display:"block",borderRadius:8,border:"3px solid #3a2a14"}}
                />
                <div className="muted" style={{marginBottom:10}}>Scan to join, or enter the code above</div>
                <button
                  onClick={() => {
                    const url = window.location.href;
                    if (navigator.share) {
                      navigator.share({ title: "Caption Contest", text: `Join my Caption Contest game! Room code: ${roomCode}`, url });
                    } else {
                      navigator.clipboard.writeText(`${url}\nRoom code: ${roomCode}`);
                      alert("Link copied to clipboard!");
                    }
                  }}
                  style={{
                    background:"#2e1e08",border:"1px solid #4a3820",borderRadius:8,
                    color:"#e8c87a",fontFamily:"'Lato',sans-serif",fontWeight:700,
                    fontSize:"0.85rem",letterSpacing:"0.08em",textTransform:"uppercase",
                    padding:"10px 20px",cursor:"pointer",
                  }}
                >
                  📤 Share Link
                </button>
              </div>
              <div className="card">
                <div className="label">Players ({players.length}/8)</div>
                <div className="player-list">
                  {players.map(p => (
                    <div key={p} className={`player-pill ${p===myName?"me":""}`}>
                      {p}{p===myName?" · you":""}{p===game.host?" · host":""}
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
                        <button key={n}
                          className={`btn btn-inline ${game.totalRounds===n?"btn-primary":"btn-secondary"}`}
                          style={{flex:1,padding:"10px 0"}}
                          onClick={() => setTotalRounds(n)}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={startGame} disabled={players.length < 3}>
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

          {/* CAPTION */}
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
                  <div className="muted" style={{marginTop:8}}>Everyone else is writing captions.<br/>Get ready to guess who wrote what.</div>
                  <div className="divider"/>
                  <div style={{fontSize:"0.82rem",color:"#5a4a30"}}>
                    {nonJudges.filter(p=>captions[p]).length} / {nonJudges.length} captions submitted<span className="waiting-dots"/>
                  </div>
                </div>
              ) : submitted ? (
                <div className="card" style={{textAlign:"center",marginTop:16}}>
                  <span className="big-icon">✅</span>
                  <div className="hero-text">Caption submitted!</div>
                  <div className="muted" style={{marginTop:8}}>Waiting for others<span className="waiting-dots"/></div>
                  <div className="divider"/>
                  <div style={{fontSize:"0.82rem",color:"#5a4a30"}}>
                    {nonJudges.filter(p=>captions[p]).length} / {nonJudges.length} submitted
                  </div>
                </div>
              ) : (
                <>
                  <div className="card">
                    <div className="label">Your Caption</div>
                    <textarea rows={3} placeholder="Write your funniest caption…"
                      value={captionInput} onChange={e => setCaptionInput(e.target.value)}/>
                  </div>
                  <button className="btn btn-primary" onClick={submitCaption} disabled={!captionInput.trim()}>
                    Submit Caption
                  </button>
                </>
              )}
            </>
          )}

          {/* JUDGE */}
          {game?.phase === PHASE.JUDGE && (
            <>
              <div className="round-bar">
                <span>Round {round+1}</span>
                <span style={{color:"#e8c87a"}}>{amJudge?"Your turn to judge":`${judge} is judging`}</span>
              </div>
              <div className="cartoon-frame">
                <img src={currentCartoon.src} alt="Cartoon" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
              </div>
              {amJudge ? (
                <>
                  <div className="card">
                    <div className="label">Match each caption to its author · pick your ★ favorite</div>
                    {shuffledCaptions.map(([_writer, captionText]) => {
                      const assignedTo = matches[captionText];
                      const isFave = favorite === captionText;
                      return (
                        <div key={captionText} className={`caption-option interactive ${assignedTo?"selected":""} ${isFave?"fave":""}`}>
                          <div className="caption-text">"{captionText}"</div>
                          <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginTop:"10px",alignItems:"center"}}>
                            {nonJudges.map(p => (
                              <button key={p} onClick={() => toggleMatch(captionText, p)} style={{
                                padding:"5px 10px",fontSize:"0.75rem",fontFamily:"'Lato',sans-serif",fontWeight:700,
                                background:assignedTo===p?"#3a2808":"#1e1004",
                                border:`1px solid ${assignedTo===p?"#e8c87a":"#3a2a14"}`,
                                color:assignedTo===p?"#e8c87a":"#7a6a50",
                                borderRadius:"6px",cursor:"pointer",
                              }}>{p}</button>
                            ))}
                            <button onClick={() => setFavorite(isFave?null:captionText)} style={{
                              marginLeft:"auto",padding:"5px 10px",fontSize:"0.75rem",
                              fontFamily:"'Lato',sans-serif",fontWeight:700,
                              background:isFave?"#3a0808":"#1e0404",
                              border:`1px solid ${isFave?"#e87a7a":"#3a1414"}`,
                              color:isFave?"#e87a7a":"#6a3a3a",
                              borderRadius:"6px",cursor:"pointer",
                            }}>{isFave?"★ Fave":"☆ Fave"}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button className="btn btn-primary" onClick={submitJudgment} disabled={!favorite}>
                    Reveal Results
                  </button>
                </>
              ) : (
                <div className="card" style={{marginTop:0}}>
                  <div className="label" style={{marginBottom:12}}>{judge} is judging — all the captions:</div>
                  {shuffledCaptions.map(([_writer, captionText]) => (
                    <div key={captionText} className="caption-option">
                      <div className="caption-text">"{captionText}"</div>
                    </div>
                  ))}
                  <div style={{fontSize:"0.78rem",color:"#5a4a30",marginTop:8,textAlign:"center"}}>
                    Waiting for {judge} to reveal results<span className="waiting-dots"/>
                  </div>
                </div>
              )}
            </>
          )}

          {/* RESULTS */}
          {game?.phase === PHASE.RESULTS && (
            <>
              <div className="round-bar"><span>Round {round+1} Results</span></div>
              <div className="cartoon-frame">
                <img src={currentCartoon.src} alt="Cartoon" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
              </div>
              <div className="card">
                <div className="label">Captions Revealed</div>
                {(game.results||[]).map((r,i) => (
                  <div key={i} className={`result-item ${r.correct?"correct":""} ${r.isFave?"favorite":""}`}>
                    <div className="result-caption">"{r.captionText}"</div>
                    <div className="result-meta">
                      Written by <strong style={{color:"#c0a860"}}>{r.writer}</strong>
                      {" · "}Judge guessed: <strong style={{color:r.correct?"#4a9a4a":"#e87a7a"}}>{r.guessed||"—"}</strong>
                      {r.correct&&" ✓"}
                    </div>
                    {r.isFave&&<div style={{fontSize:"0.8rem",color:"#e87a7a"}}>★ Judge's Favorite</div>}
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
                  {round+1>=totalRounds?"See Final Results":"Next Round →"}
                </button>
              ) : (
                <div className="card" style={{textAlign:"center"}}>
                  <div className="muted">Waiting for host to continue<span className="waiting-dots"/></div>
                </div>
              )}
            </>
          )}

          {/* FINAL */}
          {game?.phase === PHASE.FINAL && (() => {
            const sorted = [...players].sort((a,b)=>(scores[b]||0)-(scores[a]||0));
            const winner = sorted[0];
            return (
              <>
                <div className="card" style={{marginTop:16,textAlign:"center"}}>
                  <div className="label">Winner</div>
                  <span className="big-icon">🏆</span>
                  <div className="winner-name">{winner}</div>
                  <div style={{color:"#7a6a50",marginTop:"6px",fontSize:"0.9rem"}}>{scores[winner]||0} points</div>
                </div>
                <div className="card">
                  <div className="label">Final Standings</div>
                  {sorted.map((p,i) => (
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
                {isHost ? (
                  <button className="btn btn-primary" onClick={playAgain}>Play Again</button>
                ) : (
                  <div className="card" style={{textAlign:"center"}}>
                    <div className="muted">Waiting for host to start a new game<span className="waiting-dots"/></div>
                  </div>
                )}
              </>
            );
          })()}

        </div>
      </div>
    </>
  );
}
