'use client';

import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';

export default function FadeInOnScroll({
  children,
  delay = 0,
  hover = false, // if true, add hover scale
  tagSlideIn = false, // if true, animate tag/date like OpenAI
}: {
  children: React.ReactNode;
  delay?: number;
  hover?: boolean;
  tagSlideIn?: boolean;
}) {
  const controls = useAnimation();
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  useEffect(() => {
    if (inView) {
      controls.start('visible');
    }
  }, [controls, inView]);

  const baseVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const TagSlideWrapper = ({ children }: { children: React.ReactNode }) => (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: delay + 0.1 }}
    >
      {children}
    </motion.div>
  );

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      transition={{ duration: 0.6, delay }}
      variants={baseVariants}
      whileHover={hover ? { scale: 1.02 } : {}}
      className={hover ? 'transition-transform duration-300 ease-in-out' : ''}
    >
      {tagSlideIn ? <TagSlideWrapper>{children}</TagSlideWrapper> : children}
    </motion.div>
  );
}
