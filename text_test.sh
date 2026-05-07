#!/usr/bin/env bash
set -e

NUMBERS=(
 "18285587157"
  "18282765382"
  "18282766082"
)

MESSAGE="Hey, just letting you know that i love you. -Scheduled message from Johnathan"
TARGET_TIME="14:45"

now=$(date +%s)
target=$(date -d "today $TARGET_TIME" +%s 2>/dev/null || date -j -f "%H:%M" "$TARGET_TIME" +%s)

if [ "$target" -le "$now" ]; then
  echo "Time already passed today."
  exit 1
fi

delay=$((target - now))

echo "Waiting $delay seconds..."
sleep "$delay"

for NUMBER in "${NUMBERS[@]}"; do
  echo "$MESSAGE" | mail -s "" "${NUMBER}@email.uscc.net"
done

echo "Messages sent."
