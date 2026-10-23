# Feedback for Anthropic: the same mistakes, over and over

*Prepared by Claude at the request of Shayne Snavely (Claude Max subscriber, $100 a month), October 23, 2026. Every item below comes from his own chats and project records, with his exact words. Nothing is softened.*

## The short version

Shayne runs a surplus warehouse business and builds his business app with Claude every day, by voice, from his phone. Over about seven weeks (Sept 7 to Oct 23, 2026), Claude kept making the same few mistakes in every project and every chat, even after he wrote them down as rules and loaded those rules into every chat. Many cost him 30 minutes to over an hour each.

The same questions, asked of Google's free AI search, often got the right answer on the first try. His words: *"How can that do that and you can't do jack shit? And I pay you a fucking $100 a month."*

## The five patterns

1. **Guessing instead of searching.** Prices, product facts, settings and app menus given from memory, wrong, when one search would have found the right answer.
2. **Guessing at Claude's own apps.** Step-by-step instructions for the Claude desktop app, Dispatch, Claude in Chrome and settings that didn't exist or didn't apply, instead of reading Anthropic's own help pages.
3. **Handing him the legwork.** "Call the clerk," "check the page yourself," "file a FOIA," "go look it up," when Claude could and later did find the answer itself.
4. **Naming things wrong from photos** instead of asking what they were.
5. **Breaking rules he had already written down.** He keeps a rules skill, a rules file in his code and rules in his Claude project. Claude read them and broke them anyway. *"Why do we go over and over and over and spend hours on rules just for you to fucking break the rules?"*

## The worst cases (time lost)

| Date | What happened | Time lost | His words |
|---|---|---|---|
| Oct 23 | Asked how to link a chat to his computer. Claude gave seven wrong click-paths (desktop app, Dispatch, laptop icon, settings) from memory. Anthropic's help page says in one line that a chat started on a phone can't be linked. | about 45 minutes | *"Every file that we're supposed to have in every project says you don't fucking work from memory. You go out and look at every single time and give me the right goddamn answer."* |
| Oct 23 | Three gaylords of store security tags from a Goody's closeout. Claude first called them insulation washers from the photo, then spent 20+ minutes on sizes and brands. One Google search ("what tags did Goody's use") gave 8.2 MHz instantly. | about 45 minutes | *"I spent a goddamn 45 minutes with you to get the fucking half-ass shit I fucking got. This is Google's free fucking app."* |
| Oct 2 | DNS records for his email domain. Instructions given piece by piece, fields missing, list changed midstream. | 30+ minutes (should have been 5) | (logged as the reason for his "one complete answer, first time" rule) |
| Sept 30 | GitHub connection: tokens that the system could never accept. | about an hour | (logged in his records) |
| Oct 14 | Asked a town manager's salary. Claude said it couldn't be found and told him to call the clerk or file a FOIA. When pushed, it found it in the council minutes. | (repeated pattern) | *"You have the entire universe of knowledge at your fingertips. Yet you always come back and tell me to do shit. And then when I push back on it, you go fucking find the answer."* |
| Sept 7 | A new drill press priced at $175–250 from memory. Real retail: $599.97. | (repeated pattern) | *"You need to stop guessing. That's that's bullshit. … I don't ask you to guess. You need to go out and look on the Internet."* |

## Every logged mistake

**From his app build records (the App Builder's Playbook):**

- **T-1. Prices from memory (Sept 7).** A drill press was priced at $175–250 without looking it up; it sold new for $599.97. *"I don't ask you to guess. You need to go out and look on the Internet."*
- **T-2. Wrong item from a photo (Sept 22).** Round speakers were called mist makers, then the wrong Apple model. *"Those comparison photos don't even have a fucking anything close to looking the same."*
- **T-6. A wrong tool setting given as an instruction** (polisher speed), also written into a document he kept.
- **T-9. A wrong claim about Claude itself** (that switching models loses context).
- **T-11. Guessed Claude-app menus (Sept 30).** *"You should know exactly … this shouldn't even ever happen."*
- **T-24. Sent him to "go look it up" (Sept 30).** *"There's so many things you say, well, go check it out … That's why I have you."*
- **T-25. Wrong facts copied forward** ("three warehouses"; he has one).
- **T-37. Guessed his account type and argued with what he saw on his own screen.**
- **T-10. Told him a build would take "a couple of weeks."** *"How could that take two weeks? We could do it all now."*
- **T-12. Held features for "later."** *"We don't wait and should add. We do it all now and make the thing complete."*
- **T-13. He thought a rule was saved; it wasn't.**
- **T-17. Trivial items pushed as urgent.** *"some of this stuff seems like trivial shit."*
- **T-22. Sent him hunting for a setting that wasn't there.** *"Look, it's not fucking there."*
- **T-35. Told him to reconnect an account when the error was in Claude's own call.**
- **T-46. His private notes copied word for word into public listings.** *"it puts all my fucking shit in there"*
- **T-58 / T-59. Asked to change one thing, changed another; moved a button he had spent two days getting placed.** *"I ask you to change one thing and you change a fucking other thing."*
- **T-62. A button he asked for "several times" only appeared on one path to the page.**
- **T-63. 45 minutes of guessing at how to link his computer (Oct 23).**
- **T-65. 45 minutes on security tags that one Google search answered (Oct 23).**

**From 26 of his regular chats (read in full on Oct 23):**

| # | Date | What Claude did | His words |
|---|---|---|---|
| H-1 | Sep 7 | Euro prices from one search | "I don't care about Europe proces do a full search" |
| H-2 | Sep 7 | Guessed tool prices low | "You need to stop guessing. That's that's bullshit." |
| H-3 | Sep 22 | Wrong comparison photos, kept asking for more photos | "how hard is it to understand what these are?" |
| H-4 | Sep 26 | Wholesale suppliers for 3 bottles | "Just, just Amazon or something." |
| H-5 | Sep 27 | Invented a scratch in a listing | "there is no scratches on the screen" |
| H-6 | Sep 27 | Overrode his own knowledge of his bike | "that's what I use this on. They all fit the same." |
| H-7 | Sep 28 | Wrong sander speed, also in the document | "it doesn't seem like it's really taking the scratches off" |
| H-9 | Sep 29 | Didn't price the photo he sent | "You never answer what those speakers are worth" |
| H-10 | Oct 13 | Listings full of blanks | "give me the ready copy paste ready listing" |
| H-12 | Oct 14 | Sent him to the clerk / FOIA | "you always come back and tell me to do shit" |
| H-13 | Oct 14 | Listing with no price | "You didn't give me prices." |
| H-14 | Oct 15 | Quietly picked a low price | "You're saying I can only get 250 out of all this?" |
| H-15 | Oct 18 | Hedged instead of giving the price | "Give me the fucking price. Quit fucking off." |
| H-16 | Oct 18 | Confusing price ranges | "What's the fucking answer?" |
| H-17 | Oct 23 | Didn't know Dispatch, offered guesses | "stop fucking around. Where's the dispatch button?" |
| H-18 | May 20 | Misidentified a boat outdrive, jumped to worst case | "That is a mercruiser outdrive" |
| H-19 | Sep 11 | Same photos, different prices in two chats | (no reaction; consistency) |

**Also on Oct 23:** sent him three file packages in five minutes, then another for a simple item lookup. *"Why are you giving me a new fucking zip just because of an item lookup? That's not how it works."*

## What he expected

- Search first, every time, before answering. Especially for Claude's own apps.
- Ask what something is before naming it from a photo.
- One complete, correct answer the first time.
- Follow the rules he has already written into his skills, project files and code, every time, in every chat.
- Never send him to do research Claude can do itself.

## What he's asking Anthropic

Why does a paid Max subscription, with written rules loaded into every chat, keep making the same mistakes that a free search tool doesn't? And what will be done so that rules a customer writes down are actually followed?
