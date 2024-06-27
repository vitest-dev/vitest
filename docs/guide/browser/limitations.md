---
title: Limitations | Browser Mode
---

# Limitations

## Thread Blocking Dialogs

When using Vitest Browser, it's important to note that thread blocking dialogs like `alert` or `confirm` cannot be used natively. This is because they block the web page, which means Vitest cannot continue communicating with the page, causing the execution to hang.

In such situations, Vitest provides default mocks with default returned values for these APIs. This ensures that if the user accidentally uses synchronous popup web APIs, the execution would not hang. However, it's still recommended for the user to mock these web APIs for better experience. Read more in [Mocking](/guide/mocking).
