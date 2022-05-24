const timeToMsMap = {
  day: 24 * 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  minute: 60 * 1000,
  second: 1000,
};

const timeUnitShort = {
  day: "d",
  hour: "h",
  minute: "m",
  second: "s",
};

/**
 * Formats a given milliseconds amount into readable time amounts (days, hours, minutes, seconds)
 * e.g., 2 hours, 3 minutes, 55 seconds
 * @param {Int} milliseconds
 * @param {Boolean} expressive - Whether to use time units ('hour', 'min', etc.)
 * @param {Boolean} omitSeconds - Whether to remove seconds
 */
module.exports = (
  milliseconds = 0,
  expressive = false,
  omitSeconds = false
) => {
  const timeToMsEntries = Object.entries(timeToMsMap);

  const timeAmount = timeToMsEntries
    .reduce(
      ([timeAmountSegments, remainingMs], [timeUnit, timeMs]) => {
        const segmentCount = Math.floor(remainingMs / timeMs);

        if (expressive) {
          if (omitSeconds && /second/i.test(timeUnit)) {
            return [timeAmountSegments, remainingMs];
          }

          const unit = timeUnitShort[timeUnit];

          if (segmentCount) {
            timeAmountSegments.push(
              `${segmentCount}${unit}`
            );
          }
        } else {
          timeAmountSegments.push(
            `${segmentCount < 10 ? 0 : ""}${segmentCount}`
          );
        }

        remainingMs -= segmentCount * timeMs;

        return [timeAmountSegments, remainingMs];
      },
      [[], milliseconds]
    )[0]
    .join(expressive ? ", " : ":");

  return timeAmount;
};
