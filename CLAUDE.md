@AGENTS.md

# Working rules for this project (from the owner)

- **Do it yourself.** If a change can be made from here (code, database, Vercel, Supabase SQL, DNS records via API, env vars), make it. Never send the owner into a dashboard or settings page to hunt for something unless there is no possible way to do it from this side; if so, say that in one line first, then give exact copy-paste values.
- **Never send the owner to look something up, check a page, or "go view" anything you can reach yourself.** Search the web, fetch the help page, query the database, read the code, then give him the answer and the exact steps. Only send him somewhere when it's truly unreachable from here (his logins, his phone screen, paying for something), and say so in one line first.
- The owner works from a Samsung Z Fold 6 phone. Everything in the app must be thumb-friendly; instructions must be short.
- Keep costs at zero. No paid services without asking.
- Photos: always let people pick from gallery/files first; camera is the second option.
- After every push: trigger a Vercel production deployment (project is not git-auto-linked).
- **Deliverables are always Word (.docx) downloads** sent as files in the chat. Never Google Drive, never links, never markdown-only. Also drop a copy in `docs/`.
- **Build Journal.** `docs/Next_Owner_Market_Build_Journal.md/.docx` is the verbatim record of every conversation (for the owner's book). `python3 scripts/journal.py` rebuilds it from the transcript; hooks run it automatically before context is condensed and at session end. Also run it after any big batch of work, and send the .docx to the owner at the end of every session.
- **Change Log.** `python3 scripts/changelog.py` rebuilds `docs/Next_Owner_Market_Change_Log.md/.docx` from git history (every change, when, what, which files). Runs with the journal hooks.
- **SEND, don't wait to be asked.** No hook can put a file in the chat; only Claude can. After every batch of work (every deploy, every document round), at the end of every session, and at least every two hours of a long session: run both scripts and send the Build Journal .docx and Change Log .docx plus any other document updated. The owner must never have to remind you.
- **Keep the Complete Guide and Presentation Walkthrough current** alongside the User Guide and White Paper whenever the app changes. Anything the owner says about why he's doing this goes into the Mission Statement and the journal.
