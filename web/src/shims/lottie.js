import React, {useEffect, useRef} from 'react';
import lottie from 'lottie-web/build/player/lottie_light_canvas';

const LottieView = ({source, autoPlay = false, loop = false, speed, style}) => {
  const containerRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !source) return undefined;
    // canvas renderer + no subframes: far cheaper than SVG DOM animation,
    // which matters on the Pi's CPU
    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'canvas',
      loop,
      autoplay: false,
      animationData: source,
    });
    anim.setSubframe(false);
    if (speed) anim.setSpeed(speed);
    animRef.current = anim;
    return () => {
      animRef.current = null;
      anim.destroy();
    };
  }, [source, loop, speed]);

  // Separate from loading, so pausing for screen sleep keeps the frame instead of re-parsing
  useEffect(() => {
    const anim = animRef.current;
    if (!anim) return;
    if (autoPlay) anim.play();
    else anim.pause();
  }, [autoPlay, source, loop, speed]);

  const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
  return <div ref={containerRef} style={flat} />;
};

export default LottieView;
