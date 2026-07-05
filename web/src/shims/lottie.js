import React, {useEffect, useRef} from 'react';
import lottie from 'lottie-web';

const LottieView = ({source, autoPlay = false, loop = false, speed, style}) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !source) return undefined;
    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop,
      autoplay: autoPlay,
      animationData: source,
    });
    if (speed) anim.setSpeed(speed);
    return () => anim.destroy();
  }, [source, autoPlay, loop, speed]);

  const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
  return <div ref={containerRef} style={flat} />;
};

export default LottieView;
