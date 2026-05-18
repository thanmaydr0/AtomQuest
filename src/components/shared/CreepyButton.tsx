import React, { useRef, useState } from "react";

interface CreepyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

type Coords = {
  x: number;
  y: number;
};

export function CreepyButton({
  children,
  className,
  onClick,
  ...props
}: CreepyButtonProps) {
  const eyesRef = useRef<HTMLSpanElement>(null);
  const [eyeCoords, setEyeCoords] = useState<Coords>({ x: 0, y: 0 });

  // Calculate translate values based on state
  // Using -50% + offset% logic from the original
  const translateX = -50 + eyeCoords.x * 50;
  const translateY = -50 + eyeCoords.y * 50;
  
  const eyeStyle: React.CSSProperties = {
    transform: `translate(${translateX}%, ${translateY}%)`,
  };

  const updateEyes = (
    e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>
  ) => {
    const userEvent = "touches" in e ? (e as React.TouchEvent).touches[0] : (e as React.MouseEvent);
    
    // get the center of the eyes container
    if (!eyesRef.current) return;
    const eyesRect = eyesRef.current.getBoundingClientRect();
    const eyesCenter: Coords = {
      x: eyesRect.left + eyesRect.width / 2,
      y: eyesRect.top + eyesRect.height / 2,
    };
    
    const cursor: Coords = {
      x: userEvent.clientX,
      y: userEvent.clientY,
    };

    // calculate the eye angle
    const dx = cursor.x - eyesCenter.x;
    const dy = cursor.y - eyesCenter.y;
    const angle = Math.atan2(-dy, dx) + Math.PI / 2;

    // then the pupil distance from the eye center
    const visionRangeX = 150; // Adjusted slightly for feel
    const visionRangeY = 100;
    const distance = Math.min(Math.hypot(dx, dy), 200); // Cap distance effect
    
    // Calculate normalized offset (-1 to 1 range approx)
    const x = (Math.sin(angle) * distance) / visionRangeX;
    const y = (Math.cos(angle) * distance) / visionRangeY;
    
    setEyeCoords({ x, y });
  };

  const resetEyes = () => {
    setEyeCoords({ x: 0, y: 0 });
  };

  return (
    <>
      <style>
        {`
          :root {
            /* Using AtomQuest's signature #fdb913 yellow instead of the default hue */
            --cb-black: hsl(0 0% 0%);
            --cb-gray1: #f8fafc;
            --cb-gray9: #171717;
            --cb-primary5: #fdb913; 
            --cb-primary6: #e5a710;
            --cb-primary3: #fef08a;
            --cb-trans-dur: 0.3s;
          }

          .creepy-btn {
            background-color: var(--cb-black);
            border-radius: 1.25em;
            color: var(--cb-black); /* Text color changed to black for yellow button */
            cursor: pointer;
            letter-spacing: 1px;
            min-width: 9em;
            padding: 0;
            border: 0;
            outline: 0.1875em solid transparent;
            transition: outline 0.1s linear;
            -webkit-tap-highlight-color: transparent;
            font-family: inherit;
            font-size: 1rem; /* Scaled down for standard UI */
            position: relative;
            display: inline-block;
            font-weight: 700;
          }

          .creepy-btn__cover {
            background-color: var(--cb-primary5);
            box-shadow: 0 0 0 0.125em var(--cb-black) inset;
            padding: 0.5em 1em;
            border-radius: inherit;
            display: block;
            position: relative;
            z-index: 1;
            transform-origin: 1.25em 50%;
            transition:
              background-color var(--cb-trans-dur),
              transform var(--cb-trans-dur) cubic-bezier(0.65, 0, 0.35, 1);
            inset: 0;
          }

          .creepy-btn__eyes {
            position: absolute;
            display: flex;
            align-items: center;
            gap: 0.375em;
            right: 1em;
            bottom: 0.6em;
            height: 0.75em;
            z-index: 0;
            pointer-events: none; 
          }

          .creepy-btn__eye {
            animation: cb-eye-blink 3s infinite;
            background-color: var(--cb-gray1);
            border-radius: 50%;
            overflow: hidden;
            width: 0.75em;
            height: 0.75em;
            position: relative;
            display: block;
          }

          .creepy-btn__pupil {
            background-color: var(--cb-black);
            border-radius: 50%;
            display: block;
            position: absolute;
            width: 0.375em;
            height: 0.375em;
            top: 50%;
            left: 50%;
            /* Transform is handled by React state inline style */
          }

          .creepy-btn:focus-visible {
            outline: 0.1875em solid var(--cb-primary3);
          }

          .creepy-btn:hover .creepy-btn__cover {
            background-color: var(--cb-primary6);
            transform: rotate(-12deg);
            transition-timing-function: cubic-bezier(0.65, 0, 0.35, 1.65);
          }

          .creepy-btn:focus-visible .creepy-btn__cover {
            transform: rotate(-12deg);
            transition-timing-function: cubic-bezier(0.65, 0, 0.35, 1.65);
          }

          .creepy-btn:active .creepy-btn__cover {
            transform: rotate(0);
            transition-timing-function: cubic-bezier(0.65, 0, 0.35, 1);
          }

          @keyframes cb-eye-blink {
            0%,
            92%,
            100% {
              animation-timing-function: cubic-bezier(0.32, 0, 0.67, 0);
              height: 0.75em;
            }

            96% {
              animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
              height: 0;
            }
          }
        `}
      </style>
      <button
        className={`creepy-btn ${className || ""}`}
        type="button"
        onClick={onClick}
        onMouseMove={updateEyes}
        onTouchMove={updateEyes}
        onMouseLeave={resetEyes}
        {...props}
      >
        <span className="creepy-btn__eyes" ref={eyesRef}>
          <span className="creepy-btn__eye">
            <span className="creepy-btn__pupil" style={eyeStyle}></span>
          </span>
          <span className="creepy-btn__eye">
            <span className="creepy-btn__pupil" style={eyeStyle}></span>
          </span>
        </span>
        <span className="creepy-btn__cover">{children}</span>
      </button>
    </>
  );
}

export default CreepyButton;
