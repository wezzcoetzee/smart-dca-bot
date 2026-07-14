"use client";

import { useEffect, useState, memo } from "react";

type Direction = "up" | "down" | null;

interface TickerDigitProps {
  char: string;
  prevChar: string;
  direction: Direction;
}

const TickerDigit = memo(function TickerDigit({
  char,
  prevChar,
  direction,
}: TickerDigitProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayChar, setDisplayChar] = useState(char);
  const [exitingChar, setExitingChar] = useState<string | null>(null);
  const [animDirection, setAnimDirection] = useState<Direction>(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (prevChar !== char && direction) {
      // Animation state updates - legitimate use of setState in effect
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExitingChar(prevChar);
       
      setDisplayChar(char);
       
      setAnimDirection(direction);
       
      setIsAnimating(true);
       
      setAnimKey((k) => k + 1);

      const timer = setTimeout(() => {
        setIsAnimating(false);
        setExitingChar(null);
        setAnimDirection(null);
      }, 300);

      return () => clearTimeout(timer);
    } else {
      setDisplayChar(char);
    }
  }, [char, prevChar, direction]);

  const isDigit = /\d/.test(char);

  if (!isDigit) {
    return <span className="inline-block">{char}</span>;
  }

  if (!isAnimating || !exitingChar) {
    return (
      <span className="inline-block relative h-[1em] w-[0.6em]">
        <span className="absolute inset-0 flex items-center justify-center">
          {displayChar}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-block relative overflow-hidden h-[1em] w-[0.6em]">
      <span
        key={animKey}
        className={`absolute inset-x-0 flex flex-col ${
          animDirection === "up" ? "digit-rail-up" : "digit-rail-down"
        }`}
      >
        {animDirection === "up" ? (
          <>
            <span className="h-[1em] flex items-center justify-center">
              {displayChar}
            </span>
            <span className="h-[1em] flex items-center justify-center">
              {exitingChar}
            </span>
          </>
        ) : (
          <>
            <span className="h-[1em] flex items-center justify-center">
              {exitingChar}
            </span>
            <span className="h-[1em] flex items-center justify-center">
              {displayChar}
            </span>
          </>
        )}
      </span>
    </span>
  );
});

interface PriceTickerProps {
  price: number;
  direction: Direction;
  prevPrice: number;
}

export function PriceTicker({ price, direction, prevPrice }: PriceTickerProps) {
  const formatPrice = (p: number): string => {
    return "$" + p.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const currentChars = formatPrice(price).split("");
  const prevChars = formatPrice(prevPrice).split("");

  while (prevChars.length < currentChars.length) {
    prevChars.unshift("");
  }
  while (currentChars.length < prevChars.length) {
    currentChars.unshift("");
  }

  return (
    <span
      className={`inline-flex transition-colors duration-300 ${
        direction === "up"
          ? "text-emerald-500"
          : direction === "down"
          ? "text-red-500"
          : "text-white"
      }`}
    >
      {currentChars.map((char, i) => (
        <TickerDigit
          key={`${i}-${currentChars.length}`}
          char={char}
          prevChar={prevChars[i] || ""}
          direction={prevChars[i] !== char ? direction : null}
        />
      ))}
    </span>
  );
}
