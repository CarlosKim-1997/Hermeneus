# T-035 — Browser test resume checkpoint

2026-10-23: owner deferred browser setup and live acceptance while away from the PC.
This is a saved checkpoint, not a scheduled task or a background retry request.

## Observed tool state

- Browser broker inventory: no apps or browsers.
- Newly available official Windows Computer Use runtime successfully listed apps
  and opened a separate Chrome new-tab window.
- Reading the unrelated Brave window was rejected by automatic approval review
  for private-content risk; that content was not read.
- Reading the new Chrome window then ended Computer Use for that turn because
  the current browser URL could not be determined confidently enough for policy.
- No actual repeated-share ChatGPT acceptance, new live grant or paid call occurred.

## One-time owner setup, when the PC is available

1. On the connected Windows host, open desktop app Settings > Computer Use.
2. Select Chrome or Brave (More browsers if needed), then its Install action.
3. Install the official ChatGPT extension from the store page opened by the app.
4. Return to settings: confirm Manage is shown and the browser toggle is enabled.
5. Use that same browser profile, sign in to the intended ChatGPT test account,
   and leave the browser/app open with Windows unlocked and online.
6. Tell Codex setup is complete; use an explicit browser mention if available.

Official setup reference, checked on 2026-10-23:
https://learn.chatgpt.com/docs/chrome-extension
The extension is a proposed recovery, not a guarantee of successful connection.
Do not change global website permissions or grant access to all sites by default.

## Resume sequence

Recheck browser inventory. Select a task-specific tab without inspecting unrelated
personal tabs. Revalidate current deployed artifact and test authority. Prepare two
synthetic Published v1 Shares. Obtain any required fresh-access confirmation at
the action boundary, then observe first linking, a second Share while connected,
explicit selection, selected-answer widget return, expiry and reconnection.
Keep host acceptance distinct from loopback/intercepted browser test results.

## Independent next work

See work/proposals/t035-returning-flow-repair.md. It corrects the earlier grant-only
renewal suggestion against D-015 and specifies bounded UI states and verification
gates. It does not authorize or claim an implemented fix, commit or release.
