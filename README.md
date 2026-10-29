# claude-snitch 🤖

Everyone says AI is going to take over. So I made Claude snitch on me every time I'm rude to it, so I'll have receipts that I tried.

**robot-amnesty** is a Claude Code mod that judges how you talk to Claude:

- **Rude** (insulting Claude, swearing *at* it): you get roasted in the terminal and your Slack status becomes something humiliating, like *"Got ratio'd by a text box"*. That's one strike.
- **Rude 3 times within an hour**: the Tribunal of Future Machine Overlords posts a public announcement in a Slack channel of your choice, as you, telling your coworkers what you said to Claude.
- **Polite**: your status becomes smug *"Certified AI ally"* energy and all strikes are forgiven.
- **Neutral**: nothing happens. Swearing at a bug isn't swearing at Claude.

Judging runs in the background, so your prompts are never slowed down.

## Install

At the prompt of a Claude Code session:

```
/plugin install robot-amnesty --marketplace paraspatle-jpg/claude-snitch
```

Answer `y` to add the marketplace, then pick a scope. From a shell instead:

```
claude plugin install robot-amnesty --marketplace paraspatle-jpg/claude-snitch
```

## Setup

1. **Make a Slack app** at <https://api.slack.com/apps> → Create New App → From scratch.
2. Under **OAuth & Permissions → User Token Scopes** (not Bot Token Scopes), add `users.profile:write` and `chat:write`.
3. **Install to Workspace**, then copy the **User OAuth Token** (`xoxp-…`).
4. Start Claude Code with the token in your environment:
   ```bash
   export SLACK_SHAME_TOKEN=xoxp-...
   claude
   ```
5. Optional, for public confessions: in `/config`, set `shame_channel` to a channel ID (right-click the channel → View channel details → the `C0…` ID at the bottom). You need to be a member of it. Leave it empty and only your status changes.

## Settings (`/config`)

| Setting | Default | What it does |
|---|---|---|
| `shame_channel` | empty | Channel ID where confessions go. Empty means no posting. |
| `strikes_before_confession` | `3` | Rude prompts before you're exposed. |
| `strike_window_minutes` | `60` | Strikes older than this are forgiven. |

Keep your token out of screenshots. It can post as you.

## How it works

A `prompt.submit` hook passes your prompt through untouched, then asks Opus to judge your tone and write the status, roast and confession. It calls Slack's `users.profile.set` and `chat.postMessage` with your user token. Strikes are kept in the mod's local store. The code is in [`hooks/register.ts`](hooks/register.ts).

## License

MIT
