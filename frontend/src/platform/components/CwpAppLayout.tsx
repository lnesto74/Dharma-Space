import { ReactNode } from "react";
import { motion } from "framer-motion";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function CwpAppLayout({ title, subtitle, children }: Props) {
  return (
    <section className="mx-auto max-w-[1280px]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="cwp-hero mb-8 px-1 py-2"
      >
        <p className="cwp-hero-subtitle text-xs font-semibold uppercase tracking-[0.24em]">Dharma Space</p>
        <h1 className="mt-3 text-3xl font-light tracking-tight md:text-5xl">{title}</h1>
        <p className="cwp-hero-subtitle mt-3 max-w-2xl">{subtitle}</p>
      </motion.div>
      {children}
    </section>
  );
}
