import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy } from 'lucide-react';

interface LoadingScreenProps {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    // Sequence of animations:
    // Step 0: Initial glow & credit fade in.
    // Step 1: Pitching/throwing the ball in.
    // Step 2: The bat swings and hits the ball!
    // Step 3: Ball flies away & "6" particles explode!
    // Step 4: Fade out everything and launch the app.
    
    const timers = [
      setTimeout(() => setAnimationStep(1), 1000), // Ball starts moving in
      setTimeout(() => setAnimationStep(2), 1800), // Bat swings and hits!
      setTimeout(() => setAnimationStep(3), 2000), // Ball flies out + particle explosion
      setTimeout(() => setAnimationStep(4), 3200), // Launch completed
    ];

    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (animationStep === 4) {
      onComplete();
    }
  }, [animationStep, onComplete]);

  return (
    <div className="fixed inset-0 bg-[#030303] flex flex-col justify-between items-center px-6 py-12 z-50 overflow-hidden font-sans">
      {/* Decorative Ambient Orbs */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-lime-400/10 blur-[120px] pointer-events-none" />

      {/* Spacer */}
      <div />

      {/* Main Animated Arena */}
      <div className="flex flex-col items-center justify-center relative w-full max-w-md h-72">
        {/* The Pitch/Stumps/Pitch Line */}
        <div className="absolute bottom-10 w-full h-[2px] bg-white/5 flex justify-center">
          {/* Stumps / Bricks */}
          <div className="flex gap-1 -mt-6">
            <div className="w-[3px] h-6 bg-white/20 rounded-full" />
            <div className="w-[3px] h-6 bg-white/20 rounded-full" />
            <div className="w-[3px] h-6 bg-white/20 rounded-full" />
          </div>
        </div>

        {/* The Ball */}
        <AnimatePresence>
          {animationStep >= 1 && animationStep < 3 && (
            <motion.div
              initial={{ x: -180, y: -80, scale: 0.6 }}
              animate={
                animationStep === 2
                  ? { x: -10, y: -2, scale: 0.9, transition: { duration: 0.8, ease: 'easeIn' } }
                  : { x: -10, y: -2, scale: 0.9 }
              }
              exit={{ opacity: 0 }}
              className="absolute z-20 w-4 h-4 bg-red-500 rounded-full shadow-lg shadow-red-500/50 flex items-center justify-center border border-red-400"
            />
          )}
        </AnimatePresence>

        {/* The Hit Shot Flying Ball */}
        <AnimatePresence>
          {animationStep >= 3 && (
            <motion.div
              initial={{ x: -10, y: -2, scale: 0.9 }}
              animate={{ 
                x: [0, 90, 240], 
                y: [-2, -180, -320], 
                scale: [0.9, 1.8, 0.4],
                rotate: 720
              }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="absolute z-20 w-4 h-4 bg-red-500 rounded-full shadow-md shadow-red-505/80 border border-red-400 flex items-center justify-center"
            >
              {/* Ball seams */}
              <div className="w-full h-[1px] bg-white/60 absolute rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interactive swinging Cricket Bat */}
        <motion.div
          initial={{ rotate: -70, originX: 0.1, originY: 0.1, x: 20, y: -40 }}
          animate={
            animationStep === 2
              ? { rotate: [45, -45, -55], transition: { duration: 0.35, ease: 'easeOut' } }
              : animationStep >= 3
              ? { rotate: -60 }
              : { rotate: 45 }
          }
          className="absolute z-10 w-6 h-28 flex flex-col items-center"
        >
          {/* Bat design */}
          {/* Handle */}
          <div className="w-1.5 h-10 bg-white/25 rounded-t-sm border border-white/20" />
          {/* Shoulder & Blade */}
          <div className="w-4 h-18 bg-amber-100/80 rounded-b-md border border-white/30 shadow-md flex items-center justify-center">
            {/* Minimal stripes on bat */}
            <div className="w-1 h-12 bg-lime-400/20 rounded" />
          </div>
        </motion.div>

        {/* Sweet Spot impact Sparkle */}
        <AnimatePresence>
          {animationStep === 2 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [1, 2, 0], opacity: [1, 1, 0] }}
              transition={{ duration: 0.3 }}
              className="absolute w-12 h-12 rounded-full border border-lime-400/50 bg-lime-400/20 blur-[1px] z-30 flex items-center justify-center"
              style={{ x: -10, y: -2 }}
            >
              <div className="w-2 h-2 bg-white rounded-full animate-ping" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* "SIX!" banner explosion */}
        <AnimatePresence>
          {animationStep >= 3 && (
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 10, stiffness: 100, delay: 0.2 }}
              className="absolute z-35 flex flex-col items-center justify-center"
            >
              <div className="px-5 py-2.5 rounded-full bg-lime-400 text-black font-black tracking-widest text-lg uppercase shadow-lg shadow-lime-400/30">
                It's a SIX! 🚀
              </div>
              <p className="text-white/40 font-mono text-[10px] mt-2 uppercase tracking-widest">Out of the street!</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Titles Block */}
      <div className="flex flex-col items-center space-y-4 w-full">
        {/* Logo Icon and App Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center space-y-2 text-center"
        >
          <div className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center border border-white/10 shadow-lg mb-2">
            <Trophy className="w-6 h-6 text-lime-400 fill-current" />
          </div>

          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white font-sans">
            Match Operating System (MOS)
          </h1>
          
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest font-bold text-lime-400 font-mono bg-lime-400/10 px-2.5 py-1 rounded border border-lime-400/25">
              Cinematic Scorecard System
            </span>
          </div>
        </motion.div>

        {/* Credits label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="pt-4 border-t border-white/5 w-2/3 text-center"
        >
          <p className="text-xs font-bold text-white tracking-wide">
            Made by Areed Hassan
          </p>
        </motion.div>
      </div>
    </div>
  );
}
