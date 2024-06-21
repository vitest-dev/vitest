# Explorer Overall Behavior

This document describes the overall behavior of the new Explorer component and the logic for:
- searching
- expanding/collapsing nodes
- filtering by status
- `Test Only` filter

Check [Notes](#notes) for a brief summary about the old and the new logic.

## New Logic

The explorer will not use the `idsMap` and `filesMap` directly from the `ws-client` state to render the tree. It will use new types to represent the tree in the ui, and a new logic to handle the tree list in the DOM:
- [nodes](client/composables/explorer/tree.ts): changes in the `ws-client` state will be mapped here with tree structure.
- [uiEntries](client/composables/explorer/state.ts): a shallow ref to represent the flat tree entries in the ui, the logic will use `nodes` to build it.

Any operation in the explorer using `queueMicrotask` to avoid blocking the main thread, and any operation on list/map using `generators`.

The explorer logic splits the actions in three main parts:
- collecting tasks while running the tests
- searching/filtering: hereinafter searching for simplicity
- expanding/collapsing nodes

Whereas collecting and searching are complex operations, expanding/collapsing nodes is a simple operation. Why?:
- collecting tasks: we need to traverse the full tree to update every test/suite/file in the ui tree: we're collecting `ws-client` messages from the server, and the nodes in the ui must be updated to reflect the state.
- searching: we need to traverse the full tree to collect every test/suite/file in the tree matching applied search and/or the filter.
- expanding/collapsing: simple operation that only requires traversing nodes present in the ui switching the `expanded` property (_expanding all nodes requires full search_).

### Collecting tasks

Old [ws-client](client/composables/client/index.ts) logic was traversing the full tree to update all the nodes in the ui on every `onTaskUpdate` callback (was using reactive `idsMap` in the `ws-client` state).
The new logic will traverse only the task files in the task result provided in the `onTaskUpdate` callback, that's a huge improvement in performance.

The main change in the new logic is about using `requestAnimationFrame` to collect ui updates every 100ms, collecting all changes received in `onTaskUpdate` callback. On every loop, the [uiEntries](client/composables/state.ts) will be recreated with collected changes, the virtual scroller will handle the updates properly.

The logic is implemented in [collect](client/composables/explorer/collector.ts) function and the `requestAnimationFrame` loop configured in the [tree class](client/composables/explorer/tree.ts), `runCollect` function.

### Searching

Search and filtering are quite simple, we only need to apply some logic to the task name, mode and result state.
The complexity lies in filtering the nodes of the entire tree. We need to traverse the tree several times:
- from top to bottom to collect all tasks matching the search/filter criteria (full tree): `visitNodes` function in the [filter](client/composables/explorer/filter.ts) module.
- from bottom to top to collect tasks and parent tasks containing children matching the search/filter criteria (full tree): `filterParents` in the [filter](client/composables/explorer/filter.ts) module.
- from top to bottom to collect parent tasks for expanded files tasks, or parent tasks whose parent tasks are expanded (filtered tree from the previous step).
- from top to button to collect tasks that are files, or the parent task included in the previous list and expanded (filtered tree).

The main logic is the `expandNode` function in the [filter](client/composables/explorer/filter.ts) module, will apply previous logic.

The search logic can be found in [filter](client/composables/explorer/filter.ts) module.

### Collapsing nodes

This is the cheapest operation in the explorer, it only requires traversing the nodes in the ui and updating the `expanded` property:
- collapsing all nodes: traverse the full tree ([nodes](client/composables/explorer/tree.ts) in the explorer tree) and set `expanded` to `false`, then filter the `uiEntries` by `file` type.
- collapsing a single node: traverse the full tree and set `expanded` to `false` for the node and all its children, and replace the child in the `uiEntries` with the new collapsed one, removing its children from `uiEntries`.

The actions can be found in the [tree class](client/composables/explorer/tree.ts), `collapseAllNodes` and `collapseNode` methods, and the logic in the [collapse.ts](client/composables/explorer/collapse.ts) module.

### Expanding nodes

This is also an affordable operation in the explorer, it only requires traversing the nodes in the ui and updating the `expanded` property:
- collapsing all nodes: traverse the full tree ([nodes](client/composables/explorer/tree.ts) in the explorer tree) and set `expanded` to `true`, then rebuild the `uiEntries` using `filterAll` in the `search` module.
- expanding single node: traverse its children in the ui ([nodes](client/composables/explorer/tree.ts) in the explorer tree) and set `expanded` to `true`, then filter its children using `filterNode` in the `search` module, and rebuild `uiEntries` replacing the current node in the ui tree with the new node and its filtered children.

The actions can be found in the [tree class](client/composables/explorer/tree.ts), `expandAllNodes` and `expandNode` methods, and the logic in the [expand.ts](client/composables/explorer/expand.ts) module.

## Notes

The previous tree list approach was using a nested structure to map the tree rendering the full tree in the DOM. It was using the entries from the web socket client state (`idsMap` and `filesMap`), using Vue reactive for both maps. Since we updated Vue dependency to latest v3.4.27, every message received from the server was updating the corresponding entries in the maps. The tree list was being updated accordingly, firing a lot of patch updates in the vue components in the recursive tree, which was causing performance issues.

The new Explorer is using a flat structure to represent the tree via virtual scroller (`vue-virtual-scroller`). This new structure is easier to handle and manipulate, and it's also a performance improvement since the virtual scroller will update only a few nodes in the ui and not the full tree in the DOM.
It is using a new approach to handle the tree list, now we have a separated vue shallow ref for entries in the ui ([uiEntries in composables/explorer/state.ts](client/composables/explorer/state.ts)), and the web socket state using vue shallow ref for both, `idsMap` and `filesMap`, while keeping the state itself with Vue reactive.
Now we are able to update the tree list only when the entries are updated and not when the web socket state is updated, which is a huge performance improvement.

Some numbers running `test/core` with Vitest UI (162 files with 3 workspaces: 5100+ tests) in a `i7-12700H` laptop:
- tree list: after server finishing running the tests, Vitest UI took ~1 minute to finish rendering the full tree (~150MB of memory usage)
- explorer: Vitest UI finishing rendering the full tree before the server reporter shows the tests summary (~10MB of memory usage)

Expanding/collapsing nodes or searching with tree list approach is blocking the main thread, while with the new explorer, it's not blocking the main thread anymore, it is just instant.

Whereas the new explorer will not be affected by the number of tests, the number of tests affected the tree list approach, the more tests, the slower the ui was.
Anyway, on really huge projects, both approaches will have performance issues, but the new explorer will be much better than the tree list approach (`vue-virtual-scroller` should be fine using ~500_000 entries, check the docs).
