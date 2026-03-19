import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from './utils';

const SMOOTHING = 0.12;
const FLAT_THRESHOLD = 3;

export default function ProfilePhoto() {
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [supportsMotion, setSupportsMotion] = useState(false);
  const frameRef = useRef<number | null>(null);
  const currentAngleRef = useRef(0);
  const targetAngleRef = useRef(0);
  const lastStableAngleRef = useRef(0);
  const lastRawAngleRef = useRef(0);
  const unwrappedAngleRef = useRef(0);
  const hasAngleRef = useRef(false);

  useEffect(() => {
    setSupportsMotion('DeviceMotionEvent' in window || 'DeviceOrientationEvent' in window);
  }, []);

  useEffect(() => {
    if (!motionEnabled) return undefined;

    const applyRotation = () => {
      const delta = targetAngleRef.current - currentAngleRef.current;
      currentAngleRef.current += delta * SMOOTHING;
      setRotation(currentAngleRef.current);

      if (Math.abs(delta) > 0.1) {
        frameRef.current = window.requestAnimationFrame(applyRotation);
      } else {
        currentAngleRef.current = targetAngleRef.current;
        setRotation(currentAngleRef.current);
        frameRef.current = null;
      }
    };

    const scheduleRotation = (angle: number) => {
      targetAngleRef.current = angle;
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(applyRotation);
      }
    };

    const unwrapAngle = (rawAngle: number) => {
      if (!hasAngleRef.current) {
        lastRawAngleRef.current = rawAngle;
        unwrappedAngleRef.current = rawAngle;
        hasAngleRef.current = true;
        return unwrappedAngleRef.current;
      }

      let delta = rawAngle - lastRawAngleRef.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      unwrappedAngleRef.current += delta;
      lastRawAngleRef.current = rawAngle;
      return unwrappedAngleRef.current;
    };

    const handleMotion = (event: DeviceMotionEvent) => {
      const gravity = event.accelerationIncludingGravity;
      if (!gravity || typeof gravity.x !== 'number' || typeof gravity.y !== 'number') return;

      const xyMagnitude = Math.hypot(gravity.x, gravity.y);
      if (xyMagnitude < FLAT_THRESHOLD) {
        scheduleRotation(lastStableAngleRef.current);
        return;
      }

      const angle = Math.atan2(-gravity.x, -gravity.y) * (180 / Math.PI);
      const smoothAngle = unwrapAngle(angle);
      lastStableAngleRef.current = smoothAngle;
      scheduleRotation(smoothAngle);
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (typeof event.gamma !== 'number') return;
      const smoothAngle = unwrapAngle(-event.gamma);
      lastStableAngleRef.current = smoothAngle;
      scheduleRotation(smoothAngle);
    };

    let usingMotion = false;
    let usingOrientation = false;

    if ('DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', handleMotion, { passive: true });
      usingMotion = true;
    }

    if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
      usingOrientation = true;
    }

    return () => {
      if (usingMotion) {
        window.removeEventListener('devicemotion', handleMotion);
      }

      if (usingOrientation) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [motionEnabled]);

  const motionLabel = useMemo(() => {
    if (motionEnabled) return 'Motion-enabled profile photo';
    if (supportsMotion) return 'Enable motion-controlled profile photo';
    return 'Profile photo';
  }, [motionEnabled, supportsMotion]);

  const requestMotion = async () => {
    if (motionEnabled || !supportsMotion) return;

    try {
      let motionGranted = true;
      let orientationGranted = true;

      if (
        typeof DeviceMotionEvent !== 'undefined' &&
        'requestPermission' in DeviceMotionEvent &&
        typeof DeviceMotionEvent.requestPermission === 'function'
      ) {
        motionGranted = (await DeviceMotionEvent.requestPermission()) === 'granted';
      }

      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        'requestPermission' in DeviceOrientationEvent &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        orientationGranted = (await DeviceOrientationEvent.requestPermission()) === 'granted';
      }

      if (motionGranted || orientationGranted) {
        setMotionEnabled(true);
      }
    } catch (error) {
      console.warn('Motion permission request failed:', error);
    }
  };

  return (
    <button
      type="button"
      className={cx('photo-motion-button', motionEnabled && 'is-motion-enabled')}
      aria-label={motionLabel}
      aria-pressed={motionEnabled}
      onClick={requestMotion}
    >
      <span className="profile-photo-stack" style={{ transform: `rotate(${rotation}deg)` }}>
        <img className="profile-photo profile-photo-single" src="/images/me.png" alt="A photo of Shaunak smiling." />
      </span>
    </button>
  );
}
