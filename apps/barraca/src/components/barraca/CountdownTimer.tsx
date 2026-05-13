"use client";

import { useState, useEffect } from "react";

export default function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    function update() {
      const now = new Date();
      // Calculate midnight Chile time (UTC-4)
      const chileOffset = -4 * 60;
      const chileTime = new Date(
        now.getTime() + (chileOffset + now.getTimezoneOffset()) * 60000
      );

      // Next midnight in Chile
      const nextMidnight = new Date(chileTime);
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);

      const diff = nextMidnight.getTime() - chileTime.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
      setIsUrgent(hours < 1);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timeLeft) return null;

  return (
    <div
      className={`text-2xl font-mono font-bold tabular-nums ${
        isUrgent ? "text-red-600" : "text-navy-950"
      }`}
    >
      {timeLeft}
    </div>
  );
}
