'use client';

import { useEffect, useState } from 'react';
import { motion, MotionProps } from 'framer-motion';

interface MotionWrapperProps extends MotionProps {
  children: React.ReactNode;
  as?: keyof typeof motion;
  fallback?: React.ComponentType<{ children: React.ReactNode; className?: string }>;
  className?: string;
}

/**
 * SSR-safe wrapper for Framer Motion components
 * Prevents hydration mismatches by only enabling animations after client-side hydration
 */
export function MotionWrapper({ 
  children, 
  as = 'div', 
  fallback: Fallback,
  className,
  initial,
  animate,
  exit,
  transition,
  ...motionProps 
}: MotionWrapperProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial client render, use fallback or static div
  if (!mounted) {
    if (Fallback) {
      return <Fallback className={className}>{children}</Fallback>;
    }
    
    const Component = as as keyof JSX.IntrinsicElements;
    return <Component className={className}>{children}</Component>;
  }

  // After hydration, use motion component with animations
  const MotionComponent = motion[as as keyof typeof motion] as any;
  
  return (
    <MotionComponent
      initial={initial}
      animate={animate}
      exit={exit}
      transition={transition}
      className={className}
      {...motionProps}
    >
      {children}
    </MotionComponent>
  );
}

/**
 * Hook to check if component is mounted (client-side)
 * Useful for conditional animations
 */
export function useIsMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}

/**
 * SSR-safe motion div with common animation patterns
 */
export function SafeMotionDiv({ 
  children, 
  className,
  delay = 0,
  duration = 0.5,
  ...props 
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
} & Omit<MotionProps, 'initial' | 'animate' | 'transition'>) {
  const mounted = useIsMounted();

  return (
    <motion.div
      initial={mounted ? { opacity: 0, y: 20 } : undefined}
      animate={mounted ? { opacity: 1, y: 0 } : undefined}
      transition={mounted ? { duration, delay } : undefined}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Fade in animation that's SSR-safe
 */
export function FadeIn({ 
  children, 
  className,
  delay = 0,
  duration = 0.5,
  ...props 
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
} & Omit<MotionProps, 'initial' | 'animate' | 'transition'>) {
  const mounted = useIsMounted();

  return (
    <motion.div
      initial={mounted ? { opacity: 0 } : undefined}
      animate={mounted ? { opacity: 1 } : undefined}
      transition={mounted ? { duration, delay } : undefined}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Slide up animation that's SSR-safe
 */
export function SlideUp({ 
  children, 
  className,
  delay = 0,
  duration = 0.5,
  distance = 30,
  ...props 
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  distance?: number;
} & Omit<MotionProps, 'initial' | 'animate' | 'transition'>) {
  const mounted = useIsMounted();

  return (
    <motion.div
      initial={mounted ? { opacity: 0, y: distance } : undefined}
      animate={mounted ? { opacity: 1, y: 0 } : undefined}
      transition={mounted ? { duration, delay } : undefined}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Slide in from left animation that's SSR-safe
 */
export function SlideInLeft({ 
  children, 
  className,
  delay = 0,
  duration = 0.5,
  distance = 30,
  ...props 
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  distance?: number;
} & Omit<MotionProps, 'initial' | 'animate' | 'transition'>) {
  const mounted = useIsMounted();

  return (
    <motion.div
      initial={mounted ? { opacity: 0, x: -distance } : undefined}
      animate={mounted ? { opacity: 1, x: 0 } : undefined}
      transition={mounted ? { duration, delay } : undefined}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Slide in from right animation that's SSR-safe
 */
export function SlideInRight({ 
  children, 
  className,
  delay = 0,
  duration = 0.5,
  distance = 30,
  ...props 
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  distance?: number;
} & Omit<MotionProps, 'initial' | 'animate' | 'transition'>) {
  const mounted = useIsMounted();

  return (
    <motion.div
      initial={mounted ? { opacity: 0, x: distance } : undefined}
      animate={mounted ? { opacity: 1, x: 0 } : undefined}
      transition={mounted ? { duration, delay } : undefined}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Scale animation that's SSR-safe
 */
export function ScaleIn({ 
  children, 
  className,
  delay = 0,
  duration = 0.5,
  scale = 0.95,
  ...props 
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  scale?: number;
} & Omit<MotionProps, 'initial' | 'animate' | 'transition'>) {
  const mounted = useIsMounted();

  return (
    <motion.div
      initial={mounted ? { opacity: 0, scale } : undefined}
      animate={mounted ? { opacity: 1, scale: 1 } : undefined}
      transition={mounted ? { duration, delay } : undefined}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Viewport animation component that's SSR-safe
 * Only animates when element comes into view
 */
export function ViewportSlideUp({ 
  children, 
  className,
  delay = 0,
  duration = 0.8,
  distance = 30,
  ...props 
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  distance?: number;
} & Omit<MotionProps, 'initial' | 'whileInView' | 'transition' | 'viewport'>) {
  const mounted = useIsMounted();

  return (
    <motion.div
      initial={mounted ? { opacity: 0, y: distance } : undefined}
      whileInView={mounted ? { opacity: 1, y: 0 } : undefined}
      transition={mounted ? { duration, delay } : undefined}
      viewport={{ once: true }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default MotionWrapper;