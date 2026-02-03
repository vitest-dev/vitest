---
"vitest": patch
---

fix: log seed when only `sequence.shuffle.tests` is enabled

Previously, the seed was only logged when `sequence.shuffle.files` was enabled (which uses RandomSequencer). 
Now the seed is also logged when only `sequence.shuffle.tests` is enabled, since the seed is used for 
shuffling tests within files even when file order is not randomized.

Fixes #9557
