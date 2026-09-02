"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useInView } from "motion/react";

export interface AnimatedListItemProps {
  children: React.ReactNode;
  delay?: number;
  index: number;
  onSelect?: (index: number) => void;
  className?: string;
}

export const AnimatedListItem: React.FC<AnimatedListItemProps> = ({
  children,
  delay = 0,
  index,
  onSelect,
  className = "",
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });

  return (
    <motion.div
      ref={ref}
      data-index={index}
      initial={{ scale: 0.85, opacity: 0, y: 15 }}
      animate={inView ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.85, opacity: 0, y: 15 }}
      transition={{ duration: 0.25, delay: delay }}
      onClick={() => onSelect && onSelect(index)}
      className={`cursor-pointer transition-transform duration-200 hover:scale-[1.01] ${className}`.trim()}
    >
      {children}
    </motion.div>
  );
};

export interface AnimatedListProps {
  items?: (string | React.ReactNode)[];
  children?: React.ReactNode;
  onItemSelect?: (item: string | React.ReactNode, index: number) => void;
  showGradients?: boolean;
  enableArrowNavigation?: boolean;
  displayScrollbar?: boolean;
  initialSelectedIndex?: number;
  className?: string;
  itemClassName?: string;
}

export const AnimatedList: React.FC<AnimatedListProps> = ({
  items,
  children,
  onItemSelect,
  showGradients = true,
  enableArrowNavigation = true,
  displayScrollbar = true,
  initialSelectedIndex = -1,
  className = "",
  itemClassName = "",
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(initialSelectedIndex);
  const [keyboardNav, setKeyboardNav] = useState<boolean>(false);
  const [topGradientOpacity, setTopGradientOpacity] = useState<number>(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState<number>(1);

  const rawItems = items || React.Children.toArray(children);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setTopGradientOpacity(Math.min(scrollTop / 40, 1));
    const bottomDistance = scrollHeight - (scrollTop + clientHeight);
    setBottomGradientOpacity(scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 40, 1));
  };

  useEffect(() => {
    if (!enableArrowNavigation) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((prev) => Math.min(prev + 1, rawItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        if (onItemSelect) {
          onItemSelect(rawItems[selectedIndex], selectedIndex);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableArrowNavigation, selectedIndex, rawItems, onItemSelect]);

  useEffect(() => {
    if (!keyboardNav || selectedIndex < 0 || !listRef.current) return;
    const container = listRef.current;
    const selectedItem = container.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex, keyboardNav]);

  return (
    <div className={`relative flex flex-col ${className}`.trim()}>
      {showGradients && (
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background to-transparent z-10 transition-opacity duration-300"
          style={{ opacity: topGradientOpacity }}
        />
      )}

      <div
        ref={listRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto space-y-2 p-1 ${
          !displayScrollbar ? "scrollbar-none" : ""
        }`}
      >
        {rawItems.map((item, index) => (
          <AnimatedListItem
            key={index}
            index={index}
            delay={Math.min(index * 0.04, 0.3)}
            onSelect={(idx) => {
              setSelectedIndex(idx);
              if (onItemSelect) onItemSelect(item, idx);
            }}
            className={itemClassName}
          >
            {item}
          </AnimatedListItem>
        ))}
      </div>

      {showGradients && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent z-10 transition-opacity duration-300"
          style={{ opacity: bottomGradientOpacity }}
        />
      )}
    </div>
  );
};

export default AnimatedList;
