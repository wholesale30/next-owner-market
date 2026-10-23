---
title: "WHITE PAPER: The Full Rules Harvest"
subtitle: "How to pull every lesson from every Claude project into one set of master rules"
date: "October 23, 2026"
---

# Summary

Every Claude project and chat learns how Shayne works: what he wants, what made him angry, what worked. That knowledge gets stuck inside each project, because Claude in one project can't see another project's chats. This paper is the fix. It is one prompt, pasted once into each project, that makes Claude read every chat in that project and hand back a Word file of every rule, mistake, fix and fact, in Shayne's own words. Those files are then merged into the master rules for the whole account.

This is exactly what was done for the Warehouse items project on October 23, 2026: 26 chats were read in full, and the lessons became Operating Rules 24 and 25, playbook lesson T-64, and a new section of the shayne-operating-rules skill.

# Why it has to be done project by project

Anthropic's help page ("Use Claude's chat search and memory to build on previous context") says:

- Inside a project, chat search covers **only that project's** conversations.
- Outside projects, it covers **only chats that aren't in a project**.
- Project chats are never searched from outside their project.

So the harvest runs once in every project, plus once in a plain chat outside all projects.

# Before you start (once)

**Settings → Memory → "Search and reference chats"** must be switched on. It's usually on already. Without it, Claude can't read your old chats.

# The steps

1. Open a project and tap **New chat** inside it.
2. Copy the whole prompt in the next section and paste it in. Send it.
3. Wait for the Word file. A big project can take several minutes. Download it.
4. Upload that Word file to the Next Owner Market chat. Claude merges it into the master files and sends back an updated zip and a skill card to tap Save on.
5. Repeat for every project.
6. Last: start a plain **New chat outside every project**, paste the same prompt, and upload that file too. That covers your loose chats.

# The prompt to copy and paste

Copy everything from "FULL RULES HARVEST" down to "Don't change anything else in this project."

**FULL RULES HARVEST. Do this completely before anything else, even if it takes a long time.**

I'm collecting everything this project has taught you about how I work, so it can go into the master rules for my whole Claude account. Be thorough: completeness beats speed.

**Step 1: Find every chat.** Use your past-chat tools (list recent chats and chat search) to list EVERY chat you can reach in this project. Page backward through the whole history until nothing more comes back. Write down each chat's title and date. If you can't search past chats at all, tell me right away that "Search and reference chats" needs to be on in Settings → Memory, and stop.

**Step 2: Read every chat completely.** Open each chat and read it start to finish, following every page. Don't skim and don't stop at the first page. If you can run helpers in parallel, split the chats among them. Also read this project's instructions and every file in its knowledge.

**Step 3: Pull out only what is actually there.** Never invent, guess or fill gaps from memory. Quote my exact words (including typos and cussing) with the chat title and date. My messages are voice-dictated, so read them for meaning.

**Step 4: Make ONE Word file (.docx)** named `Lessons_Export_<this project's name>_<today's date>.docx`, with these sections in this order:

1. **What I could and couldn't reach:** every chat read (title and date), the total count, and anything I couldn't open.
2. **What this project is:** name, purpose, websites, repos and databases, key people.
3. **The big lessons:** every rule or preference I stated or clearly showed (how to answer, format, prices, listings, files, costs, phone use, design, anything). For each: my exact words with chat and date, then one line on what it means in practice, written as a rule.
4. **Mistakes and fixes:** every time Claude got something wrong. Put them in a table numbered P-1, P-2, P-3… with the date, what Claude did, my exact reaction, and the correct behavior.
5. **What worked:** formats, prompts, listing styles, answer structures and methods I accepted, used again, or built on. Describe each pattern concretely enough to copy.
6. **Workarounds and back doors:** tool quirks, blocked sites and what worked instead, outside services (what they do, cost, free limits, gotchas), with exact values and steps.
7. **Facts about me and my business:** only what I stated (places, warehouses, inventory, equipment, accounts, people, numbers).
8. **Conflicts to check with me:** anything that disagrees with another rule or fact, with both sides and which one I said last.
9. **Open items:** anything unfinished, promised but not done, or waiting on me.
10. **Suggested master rules:** the 5 to 20 most important lessons, written as short rules ready to paste into my master skill.

**Step 5:** Check the Word file opens and every section is filled (write "none found" if a section is empty). Then give me the download and tell me in three lines: how many chats you read, and how many rules, mistakes and workarounds you found. Don't change anything else in this project.

# What each project sends back

One Word file named Lessons_Export_<project>_<date>.docx with ten sections: what it could and couldn't reach; what the project is; the big lessons in Shayne's exact words; a numbered table of mistakes (P-1, P-2…); what worked; workarounds and back doors; facts; conflicts to check; open items; and suggested master rules.

# What happens when you bring the files back

1. Claude reads every export.
2. New rules go into the shayne-operating-rules skill (a card to tap Save), the App Builder's Playbook (new T- numbers and services), and the Operating Rules.
3. The "Warehouse items" project copies are updated.
4. You get the one dated zip with everything.
5. Any conflicts between projects are listed so you can pick which rule wins.

# Source

Anthropic, "Use Claude's chat search and memory to build on previous context," support.claude.com/en/articles/11817273
