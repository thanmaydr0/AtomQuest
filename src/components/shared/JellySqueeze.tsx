import { useEffect, useRef, useState, useLayoutEffect } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Register GSAP plugin
if (typeof window !== "undefined") {
  gsap.registerPlugin(Draggable);
}

interface JellySqueezeProps {
  /**
   * Whether to show the bottom controls
   * @default true
   */
  showControls?: boolean;
  /**
   * Background color class
   * @default "bg-transparent"
   */
  className?: string;
  /**
   * Title text to display above the jelly
   * @default ""
   */
  title?: string;
}

export function JellySqueeze({ 
  showControls = true, 
  className,
  title = "" 
}: JellySqueezeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragTriggerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [followMouse, setFollowMouse] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(0);

  // Animation refs to persist across renders
  const animState = useRef({
    totalFrames: 215,
    startFrame: 70,
    images: [] as HTMLImageElement[],
    currentFrame: -1,
    dragFrame: 70, // Start at startFrame
    displayFrame: 70, // Start at startFrame
    dragSensitivity: 5.2,
    smoothing: 0.11,
    startTime: 0,
    rafId: 0,
    isMounted: false
  });

  // Preload images
  useEffect(() => {
    animState.current.isMounted = true;
    const totalFrames = animState.current.totalFrames;
    let loaded = 0;
    const images: HTMLImageElement[] = [];

    const loadImages = async () => {
      // Batch load slightly to not freeze UI but load fast
      for (let i = 0; i < totalFrames; i++) {
        if (!animState.current.isMounted) return;
        
        const img = new Image();
        img.src = `https://cerpow.github.io/cerpow-img/jelly/jelly_${i
          .toString()
          .padStart(5, "0")}.jpg`;
        
        img.onload = () => {
          loaded++;
          setImagesLoaded(prev => prev + 1);
          if (loaded === totalFrames) {
            setIsLoading(false);
          }
        };
        img.onerror = () => {
          // Handle error or skip
          loaded++; 
          setImagesLoaded(prev => prev + 1);
          if (loaded === totalFrames) setIsLoading(false);
        };
        
        images[i] = img;
      }
      
      animState.current.images = images;
    };

    loadImages();

    return () => {
      animState.current.isMounted = false;
      cancelAnimationFrame(animState.current.rafId);
    };
  }, []);

  // Initialize Canvas & GSAP
  useLayoutEffect(() => {
    if (isLoading || !canvasRef.current || !dragTriggerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const state = animState.current;
    
    // Initial GSAP setup
    gsap.set(canvas, { y: state.startFrame / state.dragSensitivity });

    // Helper to clamp frame
    const resetWithinBounds = (frame: number) => {
      return Math.max(0, Math.min(state.totalFrames - 1, Math.floor(frame)));
    };

    // Canvas sizing
    const setCanvasSize = () => {
      if (!canvas) return;
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = width * (3 / 4); // Force 4:3
      
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.height = `${height}px`;
      
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "medium";
      }
      
      state.currentFrame = -1; // Force redraw
    };

    setCanvasSize();
    window.addEventListener("resize", setCanvasSize);

    // Draggable setup
    const draggable = Draggable.create(canvas, {
      trigger: dragTriggerRef.current,
      type: "y",
      inertia: true,
      bounds: { minY: 0, maxY: (state.totalFrames - 1) / state.dragSensitivity },
      allowNativeTouchScrolling: false, // Changed to false for better mobile control
      dragResistance: 0.5, // Averaged from original code
      edgeResistance: 1,
      minDuration: 0.4,
      onDrag: function() {
        state.dragFrame = this.y * state.dragSensitivity;
      },
      onThrowUpdate: function() {
        state.dragFrame = this.y * state.dragSensitivity;
      }
    })[0];

    // Animation Loop
    state.startTime = Date.now();
    const animate = () => {
      if (!state.isMounted) return;
      
      const now = Date.now();
      const dt = (now - state.startTime) / 1000;
      state.startTime = now;

      // Dampening logic from original
      const dampening = 1.0 - Math.exp(-state.smoothing * 60 * dt);
      state.displayFrame += (state.dragFrame - state.displayFrame) * dampening;

      const newFrame = resetWithinBounds(state.displayFrame);

      if (newFrame !== state.currentFrame && state.images[newFrame]?.complete && ctx) {
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        ctx.drawImage(
          state.images[newFrame],
          0,
          0,
          canvas.clientWidth,
          canvas.clientHeight
        );
        state.currentFrame = newFrame;
      }

      state.rafId = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    // Mouse move handler for "Follow Mouse" mode
    const handleMouseMove = (e: MouseEvent) => {
      if (followMouse) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
           const normalizedY = (e.clientY - rect.top) / rect.height;
           state.dragFrame = Math.max(0, Math.min(1, normalizedY)) * (state.totalFrames - 1);
        }
      }
    };
    
    if (followMouse) {
      window.addEventListener("mousemove", handleMouseMove);
    }

    // Toggle Draggable based on followMouse
    if (followMouse) {
      draggable.disable();
    } else {
      draggable.enable();
      // Sync draggable to current frame when re-enabling
      gsap.set(canvas, { y: state.displayFrame / state.dragSensitivity });
      draggable.update();
    }

    return () => {
      window.removeEventListener("resize", setCanvasSize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(state.rafId);
      draggable.kill();
    };
  }, [isLoading, followMouse]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative flex flex-col items-center justify-center w-full h-full overflow-hidden select-none",
        "bg-transparent text-slate-800",
        className
      )}
    >
      {/* Header */}
      {title && (
        <div className="absolute top-[10%] z-20 text-center pointer-events-none transition-opacity duration-700"
             style={{ opacity: isLoading ? 0 : 1 }}>
          <h1 className="text-xl font-bold tracking-tight text-slate-800/70">
            {title}
          </h1>
        </div>
      )}

      {/* Canvas Container */}
      <div className="relative w-full max-w-[500px] min-w-[280px] aspect-[4/3] z-10">
        <canvas
          ref={canvasRef}
          className={cn(
            "w-full h-full rounded-[clamp(22px,6vw,42px)] transition-opacity duration-1000 ease-out cursor-grab active:cursor-grabbing",
            isLoading ? "opacity-0 scale-90" : "opacity-100 scale-100"
          )}
          style={{ transform: "scale3d(1, 1, 1)" }}
        />
        
        {/* Invisible Drag Trigger */}
        <div 
          ref={dragTriggerRef}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[49%] w-[56%] h-[52%] rounded-full cursor-grab active:cursor-grabbing z-20"
          aria-label="Drag to squeeze"
        />
      </div>

      {/* Loading State */}
      <div 
        className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[150px] h-[3px] bg-slate-800/10 transition-all duration-500 overflow-hidden rounded-full",
          !isLoading && "opacity-0 invisible"
        )}
      >
        <div className="h-full bg-slate-800/60 w-[30%] animate-pulse rounded-full" />
      </div>

      {/* Bottom Controls */}
      {showControls && (
        <div 
          className={cn(
            "absolute bottom-4 w-full flex justify-center gap-4 z-20 transition-opacity duration-1000 delay-300",
            isLoading ? "opacity-0" : "opacity-100"
          )}
        >
          <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold group text-slate-600 hover:text-slate-900 transition-colors">
            <input 
              type="checkbox" 
              className="peer sr-only"
              checked={followMouse}
              onChange={(e) => setFollowMouse(e.target.checked)}
            />
            <div className="w-4 h-4 border-[1.5px] border-slate-400 rounded flex items-center justify-center transition-colors peer-checked:bg-slate-800 peer-checked:border-slate-800">
              <Check className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
            </div>
            <span>Follow mouse</span>
          </label>
        </div>
      )}
    </div>
  );
}
