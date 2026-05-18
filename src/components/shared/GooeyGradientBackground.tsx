import { useEffect, useRef, type ReactNode } from 'react';
import './GooeyGradientBackground.css';

interface GooeyGradientBackgroundProps {
  className?: string;
  children?: ReactNode;
}

export function GooeyGradientBackground({ className = '', children }: GooeyGradientBackgroundProps) {
  const interactiveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let curX = 0;
    let curY = 0;
    let targetX = window.innerWidth * 0.5;
    let targetY = window.innerHeight * 0.4;
    let frameId = 0;

    const handleMouseMove = (event: MouseEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
    };

    const animate = () => {
      const node = interactiveRef.current;
      if (!node) return;

      curX += (targetX - curX) * 0.075;
      curY += (targetY - curY) * 0.075;

      node.style.transform = `translate3d(${Math.round(curX - 200)}px, ${Math.round(curY - 200)}px, 0)`;
      frameId = window.requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className={`gooey-bg z-0 ${className}`.trim()} aria-hidden="true">
      <svg className="gooey-bg__svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="gooey-gradient-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <div className="gooey-bg__field">
        <div className="gooey-bg__blob gooey-bg__blob--one" />
        <div className="gooey-bg__blob gooey-bg__blob--two" />
        <div className="gooey-bg__blob gooey-bg__blob--three" />
        <div className="gooey-bg__blob gooey-bg__blob--four" />
        <div className="gooey-bg__blob gooey-bg__blob--five" />
        <div ref={interactiveRef} className="gooey-bg__blob gooey-bg__interactive" />
      </div>

      <div className="gooey-bg__vignette" />

      {children && <div className="gooey-bg__content">{children}</div>}
    </div>
  );
}

export default GooeyGradientBackground;
