"use client";

import { useEffect, useRef, useState } from "react";

const VIDEOS = {
  lobbyIdle: "/videos/lobby_idle.mp4",
  lobbyToElevator: "/videos/lobby_to_elevator.mp4",
  elevatorToLobby: "/videos/elevator_to_lobby.mp4",
  elevatorToFloor1: "/videos/elevator_g_to_f1.mp4",
  floor1Landing: "/videos/f1_hallway_landing.mp4",
  roomUnlock: "/videos/room_unlock.mp4",
  roomTour: "/videos/room_tour.mp4",
} as const;

const PLAYBACK_RATE = 1;
// Set this to a dedicated `/videos/...mp4` path after a return clip is supplied.
// Until then, Back to Elevator uses the CSS door animation.
const BACK_TO_ELEVATOR_VIDEO: string | null = null;

type Scene = "LOBBY" | "ELEVATOR" | "HALLWAY_F1";
type TransitionState = "IDLE" | "TRANSITIONING" | "ARRIVED";
type VideoStep =
  | "LOBBY_TO_ELEVATOR"
  | "ELEVATOR_TO_LOBBY"
  | "ELEVATOR_TO_F1"
  | "F1_LANDING"
  | "BACK_TO_ELEVATOR";
type ModalStage = "CLOSED" | "UNLOCKING" | "TOUR";

const STEP_VIDEO: Record<VideoStep, string> = {
  LOBBY_TO_ELEVATOR: VIDEOS.lobbyToElevator,
  ELEVATOR_TO_LOBBY: VIDEOS.elevatorToLobby,
  ELEVATOR_TO_F1: VIDEOS.elevatorToFloor1,
  F1_LANDING: VIDEOS.floor1Landing,
  BACK_TO_ELEVATOR: BACK_TO_ELEVATOR_VIDEO ?? "",
};

function ElevatorIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 21V3h14v18M9 9l3-3 3 3M9 15l3 3 3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function InteractiveHotelEngine() {
  const [scene, setScene] = useState<Scene>("LOBBY");
  const [transitionState, setTransitionState] = useState<TransitionState>("IDLE");
  const [videoStep, setVideoStep] = useState<{ name: VideoStep; token: number } | null>(null);
  const [modalStage, setModalStage] = useState<ModalStage>("CLOSED");
  const [doorsActive, setDoorsActive] = useState(false);
  const [doorsClosed, setDoorsClosed] = useState(false);
  const [transitionPortrait, setTransitionPortrait] = useState(false);
  const [lobbyPortrait, setLobbyPortrait] = useState(false);
  const [elevatorStill, setElevatorStill] = useState({ ready: false, portrait: false });
  const [hallwayStill, setHallwayStill] = useState({ ready: false, portrait: false });
  const [notice, setNotice] = useState("");

  const transitionVideoRef = useRef<HTMLVideoElement>(null);
  const elevatorCanvasRef = useRef<HTMLCanvasElement>(null);
  const hallwayCanvasRef = useRef<HTMLCanvasElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const roomButtonRef = useRef<HTMLButtonElement>(null);
  const tokenRef = useRef(0);
  const completedTokenRef = useRef<number | null>(null);
  const doorTimersRef = useRef<number[]>([]);

  const isTransitioning = transitionState === "TRANSITIONING";

  useEffect(() => {
    if (modalStage === "CLOSED") return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRoom();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [modalStage]);

  useEffect(() => {
    return () => doorTimersRef.current.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    if (!videoStep) return;
    const timeout = window.setTimeout(() => {
      setNotice("The transition took too long. The destination was opened instead.");
      finishVideoStep(videoStep, false);
    }, 15_000);
    return () => window.clearTimeout(timeout);
  }, [videoStep]);

  useEffect(() => {
    if (modalStage !== "UNLOCKING") return;
    const timeout = window.setTimeout(() => {
      setNotice("The keycard clip took too long. Room details were opened instead.");
      setModalStage("TOUR");
    }, 8_000);
    return () => window.clearTimeout(timeout);
  }, [modalStage]);

  function setDoorTimer(callback: () => void, delay: number) {
    doorTimersRef.current.push(window.setTimeout(callback, delay));
  }

  function clearDoorTimers() {
    doorTimersRef.current.forEach(window.clearTimeout);
    doorTimersRef.current = [];
  }

  function startVideoTransition(name: VideoStep) {
    if (isTransitioning) return;
    setNotice("");
    setTransitionState("TRANSITIONING");
    setVideoStep({ name, token: ++tokenRef.current });
  }

  function captureFrame(destination: "ELEVATOR" | "HALLWAY_F1") {
    const video = transitionVideoRef.current;
    const canvas = destination === "ELEVATOR" ? elevatorCanvasRef.current : hallwayCanvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d", { alpha: false })?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const still = { ready: true, portrait: video.videoHeight > video.videoWidth };
    if (destination === "ELEVATOR") setElevatorStill(still);
    else setHallwayStill(still);
  }

  function arrive(nextScene: Scene) {
    setScene(nextScene);
    setVideoStep(null);
    setTransitionState("ARRIVED");
  }

  function finishVideoStep(step: { name: VideoStep; token: number }, capture = true) {
    if (completedTokenRef.current === step.token) return;
    completedTokenRef.current = step.token;

    switch (step.name) {
      case "LOBBY_TO_ELEVATOR":
        if (capture) captureFrame("ELEVATOR");
        arrive("ELEVATOR");
        break;
      case "ELEVATOR_TO_LOBBY":
        arrive("LOBBY");
        break;
      case "ELEVATOR_TO_F1":
        setVideoStep({ name: "F1_LANDING", token: ++tokenRef.current });
        break;
      case "F1_LANDING":
        if (capture) captureFrame("HALLWAY_F1");
        arrive("HALLWAY_F1");
        break;
      case "BACK_TO_ELEVATOR":
        arrive("ELEVATOR");
        break;
    }
  }

  function handleVideoError() {
    if (!videoStep) return;
    setNotice("The transition clip could not play. The destination was opened instead.");
    finishVideoStep(videoStep, false);
  }

  function skipTransition() {
    if (doorsActive) {
      clearDoorTimers();
      setScene("ELEVATOR");
      setDoorsClosed(false);
      setTransitionState("ARRIVED");
      setDoorTimer(() => setDoorsActive(false), 500);
      return;
    }

    const video = transitionVideoRef.current;
    if (!videoStep || !video) return;
    const finish = () => finishVideoStep(videoStep);
    if (Number.isFinite(video.duration) && video.duration > 0) {
      video.addEventListener("seeked", finish, { once: true });
      video.currentTime = video.duration;
      window.setTimeout(finish, 180);
    } else {
      finishVideoStep(videoStep, false);
    }
  }

  function backToElevator() {
    if (BACK_TO_ELEVATOR_VIDEO) {
      startVideoTransition("BACK_TO_ELEVATOR");
      return;
    }

    if (isTransitioning) return;
    clearDoorTimers();
    setNotice("");
    setTransitionState("TRANSITIONING");
    setDoorsActive(true);
    setDoorsClosed(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setDoorsClosed(true)));
    setDoorTimer(() => setScene("ELEVATOR"), 500);
    setDoorTimer(() => {
      setTransitionState("ARRIVED");
      setDoorsClosed(false);
    }, 800);
    setDoorTimer(() => setDoorsActive(false), 1300);
  }

  function openRoom() {
    if (isTransitioning) return;
    setNotice("");
    setModalStage("UNLOCKING");
  }

  function closeRoom() {
    setModalStage("CLOSED");
    window.setTimeout(() => roomButtonRef.current?.focus(), 0);
  }

  const sceneLabel = scene === "LOBBY" ? "Ground floor · Lobby" : scene === "ELEVATOR" ? "Elevator cab" : "Floor 1 · Corridor";

  return (
    <main
      className="relative min-h-[100svh] overflow-hidden bg-[#080b0c] font-sans text-[#f4efe6]"
      data-scene={scene}
      data-transition-state={transitionState}
      aria-busy={isTransitioning}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,#263234_0%,#111718_42%,#07090a_100%)]" />

      {scene === "LOBBY" && (
        <video
          className={`absolute inset-0 h-full w-full ${lobbyPortrait ? "object-contain" : "object-cover"}`}
          src={VIDEOS.lobbyIdle}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          onLoadedMetadata={(event) => setLobbyPortrait(event.currentTarget.videoHeight > event.currentTarget.videoWidth)}
          onError={() => setNotice("Lobby video is unavailable. Check public/videos/lobby_idle.mp4.")}
        >
          Your browser does not support HTML5 video.
        </video>
      )}

      <canvas
        ref={elevatorCanvasRef}
        className={`absolute inset-0 h-full w-full ${elevatorStill.portrait ? "object-contain" : "object-cover"} ${scene === "ELEVATOR" && elevatorStill.ready ? "block" : "hidden"}`}
        aria-hidden="true"
      />
      <canvas
        ref={hallwayCanvasRef}
        className={`absolute inset-0 h-full w-full ${hallwayStill.portrait ? "object-contain" : "object-cover"} ${scene === "HALLWAY_F1" && hallwayStill.ready ? "block" : "hidden"}`}
        aria-hidden="true"
      />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,6,7,.42),transparent_35%,rgba(4,6,7,.56))]" />

      {videoStep && (
        <video
          key={videoStep.token}
          ref={transitionVideoRef}
          className={`absolute inset-0 z-20 h-full w-full bg-[#07090a] ${transitionPortrait ? "object-contain" : "object-cover"}`}
          src={STEP_VIDEO[videoStep.name]}
          autoPlay
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          onLoadedMetadata={(event) => {
            event.currentTarget.playbackRate = PLAYBACK_RATE;
            setTransitionPortrait(event.currentTarget.videoHeight > event.currentTarget.videoWidth);
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches && event.currentTarget.duration) {
              event.currentTarget.currentTime = event.currentTarget.duration;
            }
          }}
          onSeeked={() => {
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) finishVideoStep(videoStep);
          }}
          onEnded={() => finishVideoStep(videoStep)}
          onError={handleVideoError}
        >
          Your browser does not support HTML5 video.
        </video>
      )}

      <section
        className={`absolute inset-0 z-30 transition-opacity duration-500 ${isTransitioning ? "pointer-events-none opacity-0" : "opacity-100"}`}
        aria-hidden={isTransitioning}
        inert={modalStage !== "CLOSED"}
      >
        <header className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6 sm:pt-[max(1.5rem,env(safe-area-inset-top))]">
          <div className="rounded-full border border-white/15 bg-black/35 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white/80 backdrop-blur-md">
            {sceneLabel}
          </div>
        </header>

        {scene === "LOBBY" && (
          <div className="absolute inset-0 grid place-items-center px-5">
            <button
              type="button"
              onClick={() => startVideoTransition("LOBBY_TO_ELEVATOR")}
              className="group flex min-h-14 cursor-pointer items-center gap-3 rounded-full border border-white/25 bg-black/45 px-6 py-4 text-sm font-semibold tracking-wide shadow-[0_20px_80px_rgba(0,0,0,.4)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#e3c783]/80 hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e3c783] motion-safe:animate-pulse"
            >
              <ElevatorIcon />
              Enter Elevator
            </button>
          </div>
        )}

        {scene === "ELEVATOR" && (
          <div className="absolute inset-y-0 right-0 flex w-full items-center justify-center p-5 sm:w-auto sm:justify-end sm:p-8">
            <div className="w-full max-w-[330px] rounded-[28px] border border-white/15 bg-[#0d1213]/75 p-5 shadow-[0_30px_100px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-6">
              <div className="mb-6 flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d7bd84]">Elevator panel</p>
                  <h1 className="mt-1 font-serif text-3xl">Choose a floor</h1>
                </div>
                <span className="grid h-11 min-w-11 place-items-center rounded-lg bg-black/45 font-mono text-lg text-[#85f1b6]">{scene === "ELEVATOR" ? "G" : "1"}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => startVideoTransition("ELEVATOR_TO_F1")}
                  className="min-h-20 cursor-pointer rounded-2xl border border-white/15 bg-white/[.07] text-3xl font-light transition hover:border-[#d7bd84]/70 hover:bg-white/[.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e3c783]"
                  aria-label="Go to floor 1"
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() => startVideoTransition("ELEVATOR_TO_LOBBY")}
                  className="min-h-20 cursor-pointer rounded-2xl border border-[#d7bd84]/35 bg-[#d7bd84]/10 text-3xl font-light transition hover:border-[#d7bd84] hover:bg-[#d7bd84]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e3c783]"
                  aria-label="Go to the ground-floor lobby"
                >
                  G
                </button>
              </div>
            </div>
          </div>
        )}

        {scene === "HALLWAY_F1" && (
          <>
            <button
              type="button"
              onClick={backToElevator}
              className="absolute left-4 top-20 flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-black/50 px-4 py-2 text-sm font-semibold backdrop-blur-md transition hover:border-[#d7bd84]/70 hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e3c783] sm:left-6 sm:top-24"
            >
              <ElevatorIcon className="h-4 w-4" />
              Back to Elevator
            </button>

            <button
              ref={roomButtonRef}
              type="button"
              onClick={openRoom}
              style={{ left: "35%", top: "52%" }}
              className="absolute min-h-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border border-emerald-300/60 bg-emerald-950/75 px-4 py-3 text-left shadow-[0_0_36px_rgba(52,211,153,.35)] backdrop-blur-md transition hover:scale-105 hover:border-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300 motion-safe:animate-pulse"
            >
              <span className="block text-sm font-semibold text-emerald-50">Room 101</span>
              <span className="block text-xs text-emerald-200">$180/night</span>
            </button>

            <div
              style={{ left: "65%", top: "52%" }}
              className="pointer-events-none absolute min-h-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-300/25 bg-[#281719]/80 px-4 py-3 text-left opacity-80 backdrop-blur-md"
              aria-label="Room 102, booked"
            >
              <span className="block text-sm font-semibold text-white/75">Room 102</span>
              <span className="block text-xs text-red-200/70">Booked</span>
            </div>
          </>
        )}
      </section>

      {isTransitioning && (
        <button
          type="button"
          onClick={skipTransition}
          className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 min-h-11 cursor-pointer rounded-full border border-white/15 bg-black/45 px-4 py-2 text-xs font-medium text-white/75 backdrop-blur-md transition hover:bg-black/70 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:bottom-6 sm:right-6"
        >
          Skip ⏩
        </button>
      )}

      {doorsActive && (
        <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-hidden="true">
          <div
            className={`absolute inset-y-0 left-0 w-[50.5%] border-r border-black/70 transition-transform duration-500 ease-[cubic-bezier(.65,0,.35,1)] ${doorsClosed ? "translate-x-0" : "-translate-x-full"}`}
            style={{ backgroundImage: "linear-gradient(90deg,#14191a 0%,#6d7474 18%,#242a2b 45%,#8c9291 78%,#1a1f20 100%)" }}
          />
          <div
            className={`absolute inset-y-0 right-0 w-[50.5%] border-l border-black/70 transition-transform duration-500 ease-[cubic-bezier(.65,0,.35,1)] ${doorsClosed ? "translate-x-0" : "translate-x-full"}`}
            style={{ backgroundImage: "linear-gradient(90deg,#1a1f20 0%,#8c9291 22%,#242a2b 55%,#6d7474 82%,#14191a 100%)" }}
          />
        </div>
      )}

      {modalStage !== "CLOSED" && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-0 backdrop-blur-md sm:p-5" role="dialog" aria-modal="true" aria-labelledby="room-title">
          <div className="relative grid h-full w-full overflow-hidden bg-[#0c1011] shadow-2xl sm:h-auto sm:max-h-[min(760px,calc(100svh-40px))] sm:max-w-5xl sm:grid-cols-[1.45fr_.85fr] sm:rounded-[30px] sm:border sm:border-white/15">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeRoom}
              className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-20 grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-md transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-5 sm:top-5"
              aria-label="Close room details"
            >
              <CloseIcon />
            </button>

            <div className="relative min-h-[42svh] bg-black sm:min-h-[620px]">
              {modalStage === "UNLOCKING" ? (
                <video
                  className="absolute inset-0 h-full w-full object-cover"
                  src={VIDEOS.roomUnlock}
                  autoPlay
                  muted
                  playsInline
                  preload="auto"
                  aria-label="Room 101 keycard unlock"
                  onEnded={() => setModalStage("TOUR")}
                  onError={() => {
                    setNotice("The keycard clip could not play. Room details were opened instead.");
                    setModalStage("TOUR");
                  }}
                >
                  Your browser does not support HTML5 video.
                </video>
              ) : (
                <video className="absolute inset-0 h-full w-full object-cover" src={VIDEOS.roomTour} autoPlay loop muted controls playsInline preload="metadata" aria-label="Room 101 walkthrough">
                  Your browser does not support HTML5 video.
                </video>
              )}
              {modalStage === "UNLOCKING" && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-20 text-sm font-medium text-white/85">Unlocking Room 101…</div>
              )}
            </div>

            <aside className="flex min-h-0 flex-col justify-between gap-8 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 sm:px-8 sm:pb-8 sm:pt-20">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#d7bd84]">Floor 1 · Available</p>
                <h2 id="room-title" className="mt-3 font-serif text-5xl leading-none">Room 101</h2>
                <div className="mt-6 flex flex-wrap gap-2">
                  {["King Bed", "City View", "Private Bath"].map((tag) => (
                    <span key={tag} className="rounded-full border border-white/15 bg-white/[.06] px-3 py-1.5 text-xs text-white/80">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="border-t border-white/10 pt-6">
                <p className="text-sm text-white/55">Tonight, from</p>
                <p className="mt-1 font-serif text-4xl">$180 <span className="font-sans text-sm text-white/50">/ night</span></p>
                <button
                  type="button"
                  onClick={() => setNotice("Room 101 selected. Connect checkout to complete the reservation.")}
                  className="mt-6 min-h-12 w-full cursor-pointer rounded-full bg-[#d7bd84] px-5 py-3 text-sm font-bold text-[#111516] transition hover:bg-[#ead39e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ead39e]"
                >
                  Complete Reservation
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}

      <p className="sr-only" aria-live="polite">{isTransitioning ? "Moving to the next location." : `Arrived at ${sceneLabel}.`}</p>
      {notice && (
        <p className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[90] w-[min(92vw,520px)] -translate-x-1/2 rounded-2xl border border-[#d7bd84]/35 bg-[#101516]/95 px-4 py-3 text-center text-sm text-white shadow-2xl" role="status">
          {notice}
        </p>
      )}
    </main>
  );
}
