#!/bin/bash
# usage: debug-firefox-crash.sh <fixture> <max iterations> <time budget in seconds>
set -u
fixture=$1
max=$2
budget=$3
logs=/tmp/ff-logs
mkdir -p "$logs"
crashes=0
runs=0
cd test/browser || exit 1
cpu=$(grep -m1 "model name" /proc/cpuinfo | sed "s/.*: //")
echo "cpu: $cpu, cores: $(nproc)"
echo "firefox pref dom.multiple_import_maps.enabled: ${FIREFOX_MULTIPLE_IMPORT_MAPS:-on}"
df -h /dev/shm
cat /sys/fs/cgroup/memory.events 2>/dev/null
for i in $(seq 1 "$max"); do
  if [ "$SECONDS" -ge "$budget" ]; then
    break
  fi
  runs=$i
  DEBUG='pw:browser*' timeout 180 pnpm exec vitest --run --root "./fixtures/$fixture" > /tmp/ff-run.log 2>&1
  code=$?
  if grep -q "page crashed" /tmp/ff-run.log; then
    crashes=$((crashes + 1))
    cp /tmp/ff-run.log "$logs/crash-$i.log"
    echo "::warning::iteration $i: firefox page crashed"
    grep -n -i "exceptionhandler\|moz_crash\|signal\|crash\|out of memory\|segfault\|abort" /tmp/ff-run.log | grep -v "JavaScript warning" | tail -60
    cat /sys/fs/cgroup/memory.events 2>/dev/null
    df -h /dev/shm
  elif [ "$code" -ne 0 ]; then
    cp /tmp/ff-run.log "$logs/fail-$i.log"
    echo "iteration $i failed with exit code $code"
  fi
done
echo "RESULT pref=${FIREFOX_MULTIPLE_IMPORT_MAPS:-on} playwright=$(node -p "require('playwright-core/package.json').version" 2>/dev/null || echo unknown) crashes=$crashes runs=$runs cpu=$cpu"
cat /sys/fs/cgroup/memory.events 2>/dev/null
