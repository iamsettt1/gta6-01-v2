// audio.js — all sound is synthesised with WebAudio: an engine hum tied to
// speed, police sirens, two distinct gunshots, pickup blips, race beeps, a
// mission jingle and a soft looping music bed. Nothing is loaded from disk,
// and every call is safe before the first user gesture (it just stays quiet).

export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    musicTimer: 0,
    musicStep: 0,

    unlock() {
      if (audio.ctx) {
        if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
        return;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audio.ctx = new AC();
        startEngine(audio);
        startMusicBed(audio);
      } catch (err) {
        audio.ctx = null;
      }
    },

    toggleMute() {
      audio.muted = !audio.muted;
      if (audio.ctx) {
        const p = audio.muted ? audio.ctx.suspend() : audio.ctx.resume();
        if (p && p.catch) p.catch(() => {});
      }
      return audio.muted;
    },

    setEngine(speedRatio, active) {
      if (!audio.ctx || !audio.engineOsc) return;
      const t = audio.ctx.currentTime;
      const freq = active ? 52 + speedRatio * 118 : 40;
      audio.engineOsc.frequency.setTargetAtTime(freq, t, 0.08);
      audio.engineGain.gain.setTargetAtTime(active ? 0.05 : 0.012, t, 0.1);
    },

    setSiren(active) {
      if (!audio.ctx) return;
      if (active && !audio.sirenOsc) {
        const ctx = audio.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        gain.gain.value = 0.0;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        audio.sirenOsc = osc;
        audio.sirenGain = gain;
      }
      if (audio.sirenOsc) {
        const t = audio.ctx.currentTime;
        audio.sirenGain.gain.setTargetAtTime(active ? 0.018 : 0.0, t, 0.2);
      }
    },

    blip(freq, dur, type, vol, slideTo) {
      if (!audio.ctx || audio.muted) return;
      const ctx = audio.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    },

    noiseBurst(dur, vol, lowpass) {
      if (!audio.ctx || audio.muted) return;
      const ctx = audio.ctx;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1800;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
    },

    shoot(kind) {
      if (kind === 'scatter') {
        audio.noiseBurst(0.22, 0.30, 900);
        audio.blip(120, 0.16, 'square', 0.10, 45);
      } else {
        audio.noiseBurst(0.09, 0.20, 2600);
        audio.blip(340, 0.07, 'square', 0.07, 120);
      }
    },

    pickup() { audio.blip(880, 0.12, 'sine', 0.09, 1320); },
    cashSound() { audio.blip(1240, 0.1, 'triangle', 0.09); setTimeout(() => audio.blip(1560, 0.14, 'triangle', 0.09), 70); },
    beep(final) { audio.blip(final ? 990 : 520, final ? 0.3 : 0.14, 'square', 0.08); },
    crash() { audio.noiseBurst(0.18, 0.22, 700); },
    jingle() {
      if (!audio.ctx || audio.muted) return;
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => setTimeout(() => audio.blip(n, 0.22, 'triangle', 0.1), i * 110));
    },
    bustedSound() {
      audio.blip(392, 0.2, 'sawtooth', 0.07);
      setTimeout(() => audio.blip(311, 0.34, 'sawtooth', 0.07), 160);
    },

    update(dt, time) {
      if (!audio.ctx || !audio.sirenOsc) return;
      // The siren wails between two tones, two cycles a second.
      const tone = Math.sin(time * Math.PI * 2 * 0.9) > 0 ? 880 : 660;
      audio.sirenOsc.frequency.setTargetAtTime(tone, audio.ctx.currentTime, 0.05);
    },
  };
  return audio;
}

function startEngine(audio) {
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 42;
  gain.gain.value = 0.012;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start();
  audio.engineOsc = osc;
  audio.engineGain = gain;
}

function startMusicBed(audio) {
  // A lazy bossa-flavoured loop: soft plucked notes over a warm pad chord,
  // scheduled a bar at a time from the update loop's step counter.
  const chords = [
    [261.6, 329.6, 392.0], [220.0, 261.6, 329.6],
    [174.6, 220.0, 261.6], [196.0, 246.9, 392.0],
  ];
  audio.musicTimer = 0;
  audio.playBar = () => {
    if (!audio.ctx || audio.muted) return;
    const chord = chords[audio.musicStep % chords.length];
    audio.musicStep++;
    for (const f of chord) audio.blip(f, 1.6, 'sine', 0.016);
    audio.blip(chord[0] / 2, 1.6, 'triangle', 0.02);
  };
}
