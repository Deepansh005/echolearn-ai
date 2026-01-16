"use client";
import React, { useState, useEffect, useRef } from "react";
import Webcam from "react-webcam";
import {
  FilesetResolver,
  GestureRecognizer,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import Link from "next/link";

// --- DATA: MAPPINGS ---
const signLanguageMap: Record<string, string> = {
  a: "https://upload.wikimedia.org/wikipedia/commons/2/27/Sign_language_A.svg",
  b: "https://upload.wikimedia.org/wikipedia/commons/1/18/Sign_language_B.svg",
  c: "https://upload.wikimedia.org/wikipedia/commons/e/e3/Sign_language_C.svg",
  d: "https://upload.wikimedia.org/wikipedia/commons/0/06/Sign_language_D.svg",
  e: "https://upload.wikimedia.org/wikipedia/commons/c/cd/Sign_language_E.svg",
};

const gestureToTextMap: Record<string, string> = {
  Thumb_Up: "Yes, I understand.",
  Thumb_Down: "No, I am confused.",
  Open_Palm: "Hello! / Stop.",
  Victory: "May I go to the restroom?",
  Closed_Fist: "I am done writing.",
  Pointing_Up: "I have a question.",
  ILoveYou: "Thank you, Teacher!",
};

export default function LiveClassMode() {
  // --- STATE ---
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState(
    "Teacher is speaking..."
  );
  const [words, setWords] = useState<string[]>([]);

  const [cameraReady, setCameraReady] = useState(false);
  const [studentMessage, setStudentMessage] = useState("...");
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Media Controls State
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // --- REFS ---
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  const lastSpokenGestureRef = useRef<string>("None");
  const gestureHoldCounterRef = useRef<number>(0);
  const currentPotentialGestureRef = useRef<string>("None");
  const lastPredictionTimeRef = useRef<number>(0); // Throttle ref

  // --- TEACHER SPEECH RECOGNITION ---
  useEffect(() => {
    if (!mounted) return;

    if (
      typeof window !== "undefined" &&
      !("webkitSpeechRecognition" in window)
    ) {
      setTranscript("Browser doesn't support speech recognition.");
      return;
    }
    let recognition: any;
    if (isListening && typeof window !== "undefined") {
      // @ts-ignore
      recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          finalTranscript += event.results[i][0].transcript;
        }
        setTranscript(finalTranscript);
        setWords(finalTranscript.toLowerCase().trim().split(" "));
      };
      recognition.onend = () => {
        try {
          if (isListening) recognition.start();
        } catch (e) {
          console.log("Recognition restart suppressed");
        }
      };
      recognition.start();
    }
    return () => {
      if (recognition) {
        recognition.onend = null;
        recognition.stop();
      }
    };
  }, [isListening, mounted]);

  // --- STUDENT VOICE (ELEVENLABS) ---
  const speakText = async (text: string) => {
    // If Mic is Muted, don't play audio
    if (!isMicOn) return;

    try {
      const response = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, gender: voiceGender }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to speak text:", response.status, response.statusText, errorData);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      audio.onended = () => URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  };

  // --- GESTURE RECOGNITION SETUP ---
  useEffect(() => {
    const loadModel = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: "/gesture_recognizer.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numHands: 1,
          }
        );
        console.log("Gesture recognizer loaded");
      } catch (error) {
        console.error("Error loading gesture recognizer:", error);
      }
    };

    // Silence TensorFlow Info logs that look like errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      if (typeof args[0] === 'string' && args[0].includes('TensorFlow Lite')) return;
      originalConsoleError.apply(console, args);
    };

    loadModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- GESTURE LOOP ---
  useEffect(() => {
    if (!mounted) return;
    let animationFrameId: number;

    const predictWebcam = () => {
      const video = webcamRef.current?.video;
      const canvas = canvasRef.current;
      const now = Date.now();

      // THROTTLE: Only process every 150ms (~6-7 FPS) to save CPU
      if (now - lastPredictionTimeRef.current < 150) {
        animationFrameId = requestAnimationFrame(predictWebcam);
        return;
      }

      // Check if video is actually enabled/rendering
      if (video && video.readyState === 4 && canvas) {
        // Safe check for recognizer - if not ready, just skip this frame but keep loop running
        if (gestureRecognizerRef.current) {
          try {
            lastPredictionTimeRef.current = now;
            const results = gestureRecognizerRef.current.recognizeForVideo(video, now);

            // Visualization
            const ctx = canvas.getContext("2d");
            if (ctx) {
              const drawingUtils = new DrawingUtils(ctx);
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              if (results.landmarks) {
                for (const landmarks of results.landmarks) {
                  drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 3 });
                  drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 1 });
                }
              }
            }

            // Detection Logic only if Mic is ON (Optional: or let it detect but not speak. Let's detecting but not speaking)
            if (results.gestures.length > 0 && results.gestures[0][0].score > 0.5) {
              const rawGesture = results.gestures[0][0].categoryName;
              if (rawGesture === currentPotentialGestureRef.current) {
                gestureHoldCounterRef.current += 1;
              } else {
                currentPotentialGestureRef.current = rawGesture;
                gestureHoldCounterRef.current = 0;
              }

              if (gestureHoldCounterRef.current > 3) {
                if (rawGesture !== lastSpokenGestureRef.current && gestureToTextMap[rawGesture]) {
                  const message = gestureToTextMap[rawGesture];
                  setStudentMessage(message);
                  speakText(message);
                  lastSpokenGestureRef.current = rawGesture;
                }
              }
            } else {
              gestureHoldCounterRef.current = 0;
              currentPotentialGestureRef.current = "None";
            }
          } catch (error) {
            console.error("Error gesture loop:", error);
          }
        }
      }
      animationFrameId = requestAnimationFrame(predictWebcam);
    };
    if (cameraReady && isVideoOn) predictWebcam();
    return () => cancelAnimationFrame(animationFrameId);
  }, [cameraReady, voiceGender, mounted, isVideoOn, isMicOn]);

  if (!mounted) return <div className="h-screen w-full bg-zinc-900 text-white flex items-center justify-center">Loading Class...</div>;

  // --- RENDER ---
  return (
    <div className="relative h-full w-full bg-zinc-900 text-white overflow-hidden flex flex-col">
      {/* 1. MAIN STAGE (TEACHER VIEW) */}
      <div className="flex-1 relative flex items-center justify-center bg-zinc-800">
        {/* Placeholder Teacher Avatar/Video */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-48 rounded-full bg-blue-600 flex items-center justify-center text-6xl shadow-xl">
            👨‍🏫
          </div>
          <p className="absolute mt-60 text-zinc-400 text-xl font-semibold">Mr. Anderson (Teacher)</p>
        </div>

        {/* Captions / Sign Language Output Overlay */}
        <div className="absolute bottom-32 w-full max-w-5xl min-h-[160px] bg-zinc-900/90 backdrop-blur-xl rounded-2xl p-6 border border-white/10 flex flex-col items-center text-center transition-all shadow-2xl">
          <p className="text-blue-400 text-xs uppercase tracking-widest mb-4 font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Live Translation
          </p>

          <div className="flex flex-wrap gap-6 justify-center items-end w-full">
            {words.length === 0 && <span className="text-zinc-500 italic">Waiting for speech...</span>}
            {words.slice(-5).map((word, i) => (
              <div key={i} className="flex flex-col items-center gap-2 group">
                {/* 1. Signs (Top) */}
                <div className="flex gap-1 p-2 bg-white/5 rounded-lg border border-white/5 group-hover:border-blue-500/30 transition-colors">
                  {word.split("").map((char, idx) =>
                    signLanguageMap[char] ? (
                      <img key={idx} src={signLanguageMap[char]} alt={char} className="w-10 h-10 rounded bg-white shadow-sm" />
                    ) : (
                      <span key={idx} className="w-8 h-10 flex items-center justify-center bg-zinc-800 rounded text-sm text-zinc-400 font-mono border border-white/10">{char}</span>
                    )
                  )}
                </div>
                {/* 2. Text (Bottom) */}
                <span className="text-white font-bold text-lg tracking-wide bg-blue-600/20 px-3 py-1 rounded-md border border-blue-500/20">
                  {word}
                </span>
              </div>
            ))}
          </div>

          {/* Full Context Sentence (Optional, small at bottom) */}
          <div className="mt-6 pt-4 border-t border-white/10 w-full text-center">
            <p className="text-zinc-400 text-sm line-clamp-1 italic">"{transcript}"</p>
          </div>
        </div>
      </div>

      {/* 2. STUDENT PIP (SELF VIEW) */}
      <div className="absolute bottom-24 right-6 w-72 aspect-video bg-black rounded-xl border-2 border-zinc-700 shadow-2xl overflow-hidden group">
        {isVideoOn ? (
          <>
            <Webcam
              ref={webcamRef}
              audio={false}
              videoConstraints={{ width: 480, height: 360 }}
              className="w-full h-full object-cover transform scale-x-[-1]"
              onUserMedia={() => setCameraReady(true)}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full object-cover transform scale-x-[-1]"
            />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-500">
            <VideoIcon />
            <p className="text-xs mt-2">Camera Off</p>
          </div>
        )}

        {/* Status Indicators in PIP */}
        <div className="absolute bottom-2 left-2 flex gap-2">
          <span className="px-2 py-0.5 bg-black/60 text-white text-xs rounded backdrop-blur-sm">You (Student)</span>
          {!isMicOn && <span className="px-2 py-0.5 bg-red-600/80 text-white text-xs rounded backdrop-blur-sm">🔇 Muted</span>}
        </div>
      </div>

      {/* 3. ECHOLEARN ASSISTANT SIDEBAR (MOVED TO LEFT) */}
      <div className={`absolute top-6 left-6 bottom-32 w-80 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-[110%]'}`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h2 className="font-bold text-blue-400 flex items-center gap-2">
            <span className="text-xl">🦾</span> EchoLearn AI
          </h2>
          <div className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] rounded uppercase font-bold tracking-wider">BETA</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Section 1: Outgoing Voice */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Outgoing Voice</label>
            <div className={`border p-4 rounded-xl relative transition-all ${isMicOn ? 'bg-blue-600/20 border-blue-500/30' : 'bg-red-900/10 border-red-500/20'}`}>
              <div className={`absolute -top-2 -right-2 rounded-full p-1 ${isMicOn ? 'bg-blue-500' : 'bg-red-500'}`}>
                {isMicOn ? <SpeakerIcon /> : <span className="text-[10px] text-white font-bold px-1">✕</span>}
              </div>
              <p className={`font-medium italic ${isMicOn ? 'text-blue-100' : 'text-red-200'}`}>"{isMicOn ? studentMessage : 'Microphone is off'}"</p>
            </div>
          </div>

          {/* Section 2: Controls */}
          <div className="space-y-3">
            <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Controls</label>

            {/* Voice Toggle */}
            <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-lg">
              <button
                onClick={() => setVoiceGender('female')}
                className={`nav-btn ${voiceGender === 'female' ? 'bg-pink-600 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                👩 Female
              </button>
              <button
                onClick={() => setVoiceGender('male')}
                className={`nav-btn ${voiceGender === 'male' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                👨 Male
              </button>
            </div>

            {/* Teacher Listening Toggle */}
            <button
              onClick={() => {
                const newState = !isListening;
                setIsListening(newState);

                if (newState) {
                  // Simulate Teacher Speech
                  const demoText = "Hello class! Today we will learn about photosynthesis.";
                  setTranscript(demoText);
                  setWords([]); // Reset signs initially

                  if (typeof window !== "undefined") {
                    // Cancel any ongoing speech first
                    window.speechSynthesis.cancel();

                    const utterance = new SpeechSynthesisUtterance(demoText);
                    const voices = window.speechSynthesis.getVoices();
                    const maleVoice = voices.find(v => v.name.toLowerCase().includes('male')) || voices[0];
                    if (maleVoice) utterance.voice = maleVoice;
                    utterance.rate = 0.9;

                    const allWords = demoText.trim().split(" ");

                    utterance.onboundary = (event) => {
                      if (event.name === 'word') {
                        // ROBUST SYNC: Use charIndex to find exactly where we are
                        const charIndex = event.charIndex;
                        // Get text up to this point
                        const textSoFar = demoText.slice(0, charIndex);
                        // Count words so far (split by space and filter empty)
                        const wordCount = textSoFar.split(" ").length;

                        // Update state to show all words up to current
                        setWords(allWords.slice(0, wordCount));
                      }
                    };

                    // Final cleanup to ensure full text is shown at end
                    utterance.onend = () => {
                      setWords(allWords);
                    }

                    window.speechSynthesis.speak(utterance);
                  }
                } else {
                  if (typeof window !== "undefined") {
                    window.speechSynthesis.cancel();
                  }
                  setTranscript("Teacher paused.");
                  setWords([]);
                }
              }}
              className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${isListening ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse' : 'bg-green-600 hover:bg-green-500 text-white'
                }`}
            >
              {isListening ? 'Stop Listening ⏹' : 'Start Teacher AI 🎙'}
            </button>
          </div>

          {/* Section 3: Gesture Guide */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Gesture Guide</label>
            <div className="grid grid-cols-1 gap-2 text-[11px] text-zinc-300">
              <div className="bg-white/5 p-2 rounded flex items-center justify-between border border-white/5"><span>👍 Yes, I understand.</span></div>
              <div className="bg-white/5 p-2 rounded flex items-center justify-between border border-white/5"><span>👎 No, I am confused.</span></div>
              <div className="bg-white/5 p-2 rounded flex items-center justify-between border border-white/5"><span>🖐️ Hello! / Stop.</span></div>
              <div className="bg-white/5 p-2 rounded flex items-center justify-between border border-white/5"><span>✌️ May I go to restroom?</span></div>
              <div className="bg-white/5 p-2 rounded flex items-center justify-between border border-white/5"><span>✊ I am done writing.</span></div>
              <div className="bg-white/5 p-2 rounded flex items-center justify-between border border-white/5"><span>☝️ I have a question.</span></div>
              <div className="bg-white/5 p-2 rounded flex items-center justify-between border border-white/5"><span>🤟 Thank you, Teacher!</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM CONTROL BAR */}
      <div className="h-20 bg-zinc-950 border-t border-white/5 flex items-center justify-between px-8 z-50">
        <div className="flex gap-4">
          <span className="text-zinc-500 text-sm font-medium">10:42 AM | Class ID: 899-212</span>
        </div>

        <div className="flex gap-3">
          <ControlButton
            icon={isMicOn ? <MicIcon /> : <MicOffIcon />}
            label={isMicOn ? "Mute" : "Unmute"}
            isActive={isMicOn}
            onClick={() => setIsMicOn(!isMicOn)}
            bgOn="bg-zinc-800" bgOff="bg-red-600 text-white hover:bg-red-700"
          />
          <ControlButton
            icon={isVideoOn ? <VideoIcon /> : <VideoOffIcon />}
            label={isVideoOn ? "Stop Video" : "Start Video"}
            isActive={isVideoOn}
            onClick={() => setIsVideoOn(!isVideoOn)}
            bgOn="bg-zinc-800" bgOff="bg-red-600 text-white hover:bg-red-700"
          />
          <ControlButton icon={<ShareIcon />} label="Share" />
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-4 rounded-2xl transition-all flex flex-col items-center gap-1 ${isSidebarOpen ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            <BotIcon />
          </button>
        </div>

        <div>
          <Link href="/" className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-colors">
            End Call
          </Link>
        </div>
      </div>
    </div>
  );
}

// --- ICONS & SUBCOMPONENTS ---
function ControlButton({ icon, label, isActive = true, onClick, bgOn = "bg-zinc-800", bgOff }:
  { icon: React.ReactNode, label: string, isActive?: boolean, onClick?: () => void, bgOn?: string, bgOff?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isActive ? `${bgOn} hover:bg-zinc-700 text-zinc-300` : (bgOff || bgOn)}`}
      title={label}
    >
      {icon}
    </button>
  )
}

function MicIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>;
}
function MicOffIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
}
function VideoIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>;
}
function VideoOffIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>;
}
function ShareIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>;
}
function BotIcon() { // For the EchoLearn toggle
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" /><path d="M19 11v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /><circle cx="12" cy="12" r="9" /></svg>;
}
function SpeakerIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>;
}
