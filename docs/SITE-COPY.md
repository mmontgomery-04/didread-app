# DidRead website copy (v1)

Drafted Oct 2, 2026 in the planning chat. For Claude Code to build into `site/` as static pages, in the app's style. Every research link must be checked before publishing (see the build notes at the end). **Fact-checked Oct 3, 2026: `docs/FACTCHECK.md`, "Website copy"; fixes applied below.**

Pages:
- `/`: home
- `/blog/`: article list
- `/blog/too-long-read-it-anyway/`
- `/blog/the-skills-you-dont-notice-losing/`
- `/blog/think-first-then-ask/`
- `/blog/how-didread-works/` (not on the home page)
- `/blog/how-to-improve-reading-comprehension/` (not on the home page)
- `/blog/how-to-focus-while-reading/` (not on the home page)
- `/support/`
- `/privacy/`: already live, unchanged

---

## HOME (`/`)

### 1. Opening

**DidRead**

# Too long? Read it anyway.

Keep your reading, writing, and thinking muscles strong in the age of AI.

DidRead gives you one short passage and one good question each day, then a reaction to *your* thinking, not a summary of someone else's.

**Coming soon to iPhone.** [Want to try it early? Email us →](mailto:hello@didread.app?subject=DidRead%20early%20access)

[For app details, read the blog →](/blog/) *(a second green button, under the early-access button)*

*(Just below the buttons, with no heading: the video, in a simple CSS phone frame: `site/media/a-day.mp4`, silent, autoplay, muted, loop, inline, no controls, loaded only when near the screen; with Reduce Motion, only its poster `a-day-poster.jpg` shows.)*
*Video label: Screen recording of a DidRead exercise: the passage "The Shrinking Bag" from the top, "I read it", the question "Which sentence explains why shrinkflation is easy to miss?", tapping a sentence, a green highlight sweeping across it, and the Feedback screen "Yes, exactly. ✓".*

### 2. How it works

**5-minute mental workouts to flex your thinking**

*(Always open, numbered. Each step's name is an H3 with no period, with its copy below it. A small line icon in the accent green, inline SVG, sits above each name: an open book for Read, a pencil for Answer, a speech bubble with a check for Get a reaction. The number stays on the left.)*

1. ### Read
   A short passage worth your time: a strange bit of history, a quiet scene, a small idea that changes how you see something. Chosen and fact-checked by a person.
2. ### Answer
   One question. Sometimes you'll tap or order. Often you'll write a sentence or two in your own words.
3. ### Get a reaction
   Feedback that names what you did well and asks one question to push you further. No grades or red pens.

*(Below the steps: the Feedback screenshot in the same phone frame, `site/media/feedback.webp` with a `.jpg` fallback.)*
*Alt text: DidRead's Feedback screen on an iPhone. Under the heading "Nice thinking. Here's a reaction.", a short reaction names what the reader got right, that luck plays a role in each attempt, and asks how that luck explains the change, with a Continue button below.*

### 3. The four skills

**Four kinds of thinking, one passage at a time.**

*(The heading stays visible. Each skill is its own dropdown row: the name shows, the line opens below it. + / − marker.)*

- **Getting it.** Understanding what a passage actually says, and finding the line that proves it.
- **Reading between the lines.** Noticing what's implied: the motive, the mood, the thing nobody says out loud.
- **Thinking it through.** Spotting the leap in an argument, the missing comparison, the number that doesn't prove what it claims.
- **Saying it well.** Explaining an idea in your own words, to a real person, clearly enough that it lands.

Difficulty adjusts quietly as you go. You'll never see a level or a score. *(In a callout box: forest green fill, near-black italic text.)*

### 4. Why DidRead exists

**Why DidRead exists** *(section title, visible; the whole section is one dropdown)*

*(Inside, as an H3:)* **Pro-reader. Not anti-AI.**

AI can summarize anything. That's genuinely useful, and we use it too. But some things are worth keeping for yourself: the patience to finish a page, the instinct to ask "wait, does that follow?", the satisfaction of saying exactly what you mean.

Those are skills, and skills fade when we hand them off. DidRead is a small daily rep to keep them.

**How it's built:**
- **Every passage is fact-checked and approved by a person.** Never generated on the fly.
- **AI gives feedback, but never decides.** It reacts to your answer against a clear rubric. Your progress, difficulty and streak are handled by plain, predictable code.
- **No guilt.** No "you'll lose your streak," no fake urgency, no leaderboards. One friendly reminder a day, if you want it.
- **Your writing stays yours.** Your free-writes are private and never sent to AI. We don't sell data or show ads. [Privacy policy](/privacy/)

*(Below the dropdown, always visible, above From the blog:)* [Read the article](/blog/how-didread-works/) *(a green button)*

### 5. Featured

**From the blog**

- **Too long? Read it anyway.** Daily reading for fun has dropped by more than 40% in twenty years, and AI can now summarize anything. Here's why we think the long way still matters. [Read →](/blog/too-long-read-it-anyway/)
- **The skills you don't notice losing.** What the research actually says about handing our thinking to tools, minus the panic. [Read →](/blog/the-skills-you-dont-notice-losing/)
- **Think first, then ask.** New studies suggest that *when* you bring in AI matters as much as *whether* you do. [Read →](/blog/think-first-then-ask/)

*(No "All articles" link: the footer links to the blog.)*

### 6. Footer

DidRead · [Blog](/blog/) · [Support](/support/) · [Privacy](/privacy/) · hello@didread.app

© 2026 DidRead

---

## BLOG INDEX (`/blog/`)

# The DidRead blog

Short essays on reading, thinking, and keeping your mind your own. Each one takes about three minutes, which is less than a DidRead exercise.

(Then every article card, newest first by date (each article's date is in its byline below). Each shows title, one-line description, author, date, and its reading time. Articles 4, 5 and 6 are on the blog index only, not the home page.)

---

## ARTICLE 1 (`/blog/too-long-read-it-anyway/`)

*(Search only, not shown on the page. Title tag: "Why reading still matters in the age of AI · DidRead". Keyword: reading in the age of AI. Meta description: "Reading for pleasure has fallen more than 40% in twenty years, and AI can summarize anything. Why reading still matters, and why DidRead isn't anti-AI." The H1, link previews and blog cards keep the visible title.)*

# Too long? Read it anyway.

*Why we built DidRead, and why it isn't anti-AI.*

By Monty Montgomery · August 29, 2026 · 3 min read

Somewhere in the last few years, "TL;DR" stopped being a joke and became a habit. A long email arrives and we skim for the ask. An article looks dense and we paste it into a chatbot. A friend sends a thoughtful message and we reply to the gist.

None of this is a moral failing. It's a reasonable response to too much text and too little time. But it has a cost we rarely stop to count.

Reading for its own sake was already slipping before AI arrived. A 2025 study of more than 236,000 Americans in the American Time Use Survey found that [the share of people reading for pleasure on a given day fell by more than 40% between 2003 and 2023](https://www.cell.com/iscience/fulltext/S2589-0042(25)01549-4), a decline of [about 3% a year](https://news.ufl.edu/2025/08/reading-for-pleasure-study/). Now we have tools that make not reading effortless.

At the same time, we're drowning in text that nobody really read or wrote. Researchers at Stanford and BetterUp coined a word for one version of it, ["workslop"](https://hbr.org/2025/09/ai-generated-workslop-is-destroying-productivity): AI-generated work that looks polished but has no substance, and pushes the real thinking onto whoever receives it. In their survey, about four in ten workers had received some in the past month, and each instance took nearly two hours to deal with, on average.

So we skim more, partly because there's more not worth reading. Then the habit spreads to the things that are.

**What we're actually losing**

When you read something properly, you're not just collecting information. You're practicing a handful of quiet skills: following an argument to its end, noticing what an author implies but doesn't say, catching the moment a claim outruns its evidence, and, finally, being able to say what you think in your own words.

A summary gives you the conclusion. It skips the practice. And like any skill, these get rusty when you stop using them. (We dig into the research on that in [The skills you don't notice losing](/blog/the-skills-you-dont-notice-losing/).)

**Why this isn't anti-AI**

We use AI. DidRead even uses it, to react to your answers. Summaries are useful, and so are calculators, maps, and spellcheck.

The point isn't to refuse the tools. It's to keep a part of your thinking in shape, so you can tell when a summary got it wrong, so your writing still sounds like you, and so a long, good piece of writing feels like a pleasure instead of a chore.

**Five minutes, on purpose**

That's what DidRead is: one short passage a day, chosen because it's worth reading, and one question that asks you to actually engage with it. Sometimes you'll find the line that proves a point. Sometimes you'll explain an idea to an imaginary friend. Then you get a reaction to your thinking, not a grade.

It won't fix the internet. But five minutes a day of reading something properly is a small way of saying: this, I'll do myself.

Too long? Read it anyway.

---

## ARTICLE 2 (`/blog/the-skills-you-dont-notice-losing/`)

*(Search only, not shown on the page. Title tag: "AI and critical thinking: what the research says · DidRead". Keyword: AI and critical thinking. Meta description: "What studies say about AI and critical thinking: cognitive offloading, memory and learning, with the caveats and minus the panic." The H1, link previews and blog cards keep the visible title.)*

# The skills you don't notice losing

*What the research actually says about handing our thinking to tools, minus the panic.*

By Monty Montgomery · September 5, 2026 · 3 min read

Psychologists have a name for using tools to do mental work for us: **cognitive offloading.** We've always done it. Writing things down is offloading, and so is a calendar. Mostly it's a great deal: you free your mind for the things that matter.

But there's a catch, and you can see it in something as ordinary as GPS. In one study, [people who relied more on GPS over the years had worse spatial memory when they had to find their way without it](https://www.nature.com/articles/s41598-020-62877-0). The tool didn't break anything. The skill just stopped getting practice.

The question now is what happens when the thing we offload isn't directions, but thinking itself.

**What the studies are finding**

The research is young, and it's worth reading carefully. Here's where it stands.

- **More offloading, less critical thinking.** A 2025 study of 666 people found that [heavier use of AI tools was linked to lower critical-thinking scores](https://www.mdpi.com/2075-4698/15/1/6), with offloading explaining much of the link. It's a correlation, not proof of cause, but it points the same way as other work.
- **Trusting the tool, thinking less.** Microsoft Research and Carnegie Mellon surveyed 319 knowledge workers about 936 real tasks. [The more people trusted AI to handle a task, the less critical thinking they reported doing](https://www.microsoft.com/en-us/research/publication/the-impact-of-generative-ai-on-critical-thinking-self-reported-reductions-in-cognitive-effort-and-confidence-effects-from-a-survey-of-knowledge-workers/). The more they trusted *themselves*, the more they did.
- **Better homework, worse exams.** In a field experiment with nearly 1,000 high-school math students, [students given open access to GPT-4 did much better on practice problems, then scored worse than students who never had it once it was taken away](https://www.pnas.org/doi/10.1073/pnas.2422633122). A version designed as a tutor, which gave hints instead of answers, largely avoided the harm.
- **Quieter brains, fuzzier memories.** An MIT Media Lab study measured the brain activity of people writing essays. [Those using ChatGPT showed the weakest brain connectivity, and many struggled to quote a single sentence from essays they'd just written](https://www.media.mit.edu/publications/your-brain-on-chatgpt/). It's an early, small study (54 people) that hasn't been peer-reviewed, and [other researchers have questioned its methods](https://arxiv.org/abs/2601.00856), so treat it as a signal, not a verdict.

**What it adds up to**

Not "AI is rotting your brain." The honest version is smaller and more useful: **skills you don't use get weaker, and AI makes it very easy not to use some important ones.** The math study points to the encouraging part too. The tool that made students think for themselves didn't do the damage. *How* you use AI matters.

**Keeping the skill**

The fix isn't to give up the tools. It's to keep doing some of the work yourself, on purpose, the way someone with a car still takes the stairs.

That's the idea behind DidRead. Each day you read a short passage and do the thinking yourself: find the evidence, notice the hidden motive, spot the flawed argument, put an idea in your own words. Then AI reacts to your work, rather than doing it for you.

Five minutes of thinking for yourself won't undo the internet. But it keeps the skill getting its reps.

---

## ARTICLE 3 (`/blog/think-first-then-ask/`)

*(Search only, not shown on the page. Title tag: "When to use AI for writing: think first, then ask · DidRead". Keyword: AI for writing. Meta description: "When you bring in AI for writing matters. Studies on ownership, motivation and sameness point to one habit: draft your own ideas first, then ask AI." The H1, link previews and blog cards keep the visible title.)*

# Think first, then ask

*New studies suggest that when you bring in AI matters as much as whether you do.*

By Monty Montgomery · September 19, 2026 · 3 min read

Here's a question that sounds small: when you use AI for something you're writing, do you open it first, or after you've had a go yourself?

A growing pile of research suggests the order matters, for what you remember, for whether the work feels like yours, and even for whether you want to do it at all.

**Ownership: is it still yours?**

In the MIT Media Lab's essay-writing study, people who wrote with ChatGPT reported [the lowest sense of ownership over their essays, and many couldn't accurately quote what they'd written](https://www.media.mit.edu/publications/your-brain-on-chatgpt/). The study is small, not yet peer-reviewed, and its methods have been questioned, but its most interesting finding was about timing. In a final session with just 18 of the participants, people who had written on their own first and *then* got AI showed stronger brain engagement and better recall than people who went the other way.

A larger, pre-registered experiment published in 2026 makes the timing point even more clearly. People who [simply copied AI-generated work reported lower confidence in their own abilities, less ownership, and less sense that the work mattered, and some of those effects lingered after they went back to working alone](https://www.nature.com/articles/s41598-026-42312-6). But people who **wrote their own draft first and then used AI to improve it** felt about the same as people who never used AI at all.

**Motivation: the boredom afterward**

Across four studies with more than 3,500 people, researchers found that [working with ChatGPT improved the quality of the work in front of people, but when they then had to do a task on their own, their intrinsic motivation dropped and boredom rose](https://www.nature.com/articles/s41598-025-98385-2). The boost didn't carry over to the solo work. The flatness did.

**Sameness: everyone starts to sound alike**

There's a quieter cost too. In one study, [stories written with AI ideas were rated more creative individually, but were more similar to each other](https://www.science.org/doi/10.1126/sciadv.adn5290). Another, with writers in India and the United States, found that [AI writing suggestions nudged the Indian writers toward Western styles and flattened cultural detail](https://news.cornell.edu/stories/2025/04/ai-suggestions-make-writing-more-generic-western). When everyone starts from the same machine, the starting points converge.

**The rule of thumb**

Put together, these studies point to a simple habit: **think first, then ask.** Have your own idea, write your own rough version, and then bring in the tool to sharpen it. You keep your voice, your memory of the work, and your reason to care about it, and you still get the help.

**Why DidRead works this way**

Every DidRead exercise is built on that order. You read the passage yourself. You answer in your own words, before anything else weighs in. Only then does AI respond, and it doesn't rewrite your answer or hand you a model one. It names what you did well and asks you a question to take your thinking one step further.

It's a five-minute rehearsal of the habit: you go first.

---

## ARTICLE 4 (`/blog/how-didread-works/`)

*(Search only, not shown on the page. Title tag: "How DidRead works: a 5-minute daily reading habit". Keyword: daily reading habit. Meta description: "DidRead is a 5-minute daily reading and writing habit: read a short passage, answer one question, get feedback on your thinking. Here's how it works and why." The H1, link previews and blog cards keep the visible title.)*

*(Not listed on the home page's From the blog. Linked from the "Read the article" button below the Why DidRead exists dropdown, and listed on the blog index. Blog card description: the dek.)*

# How DidRead works (and why we built it)

*The best way to keep a skill is to keep using it.*

By Monty Montgomery · October 3, 2026 · 4 min read

**How DidRead works**

DidRead is a daily reading and writing habit designed to fit into ordinary life.

Each day, you'll receive a short passage chosen to be interesting, approachable, and worth a few minutes of attention. Some pieces explore history, science, psychology, or current ideas. Others focus on observation, storytelling, or the way people communicate.

After reading, you'll answer a question. Sometimes you'll identify evidence or explain an idea in your own words. Other times you'll reflect on what you've read or make a connection to something else.

Once you've responded, DidRead provides feedback on your thinking. The response is intended to help you refine an idea, notice a detail, or consider another perspective before moving on with your day.

Most sessions take only a few minutes. Over time, those small moments add up to a regular practice of reading closely, thinking carefully, and expressing your own ideas.

**Why we built it**

The arrival of generative AI has changed the way many people learn, work, and create. Students can complete assignments with a prompt. Professionals can draft emails, reports, and presentations in seconds. Writers can brainstorm, outline, and revise with assistance that would have seemed impossible only a few years ago.

As these tools become part of everyday life, researchers have begun studying how increased reliance on AI affects thinking, memory, writing, and learning. The research is still developing, but many of the questions being asked share a common theme: what happens to important skills when they are practiced less often?

For children, those questions often center on learning. Reading comprehension, written communication, and critical thinking develop through repetition. Parents and educators are increasingly navigating a world where powerful tools are available long before many of those skills have fully formed.

Adults face a different challenge. Large portions of the workday can now be spent reviewing, editing, and approving machine-generated text. Many people who once wrote regularly for work or enjoyment find that they spend less time wrestling with ideas themselves. Reading becomes more fragmented, writing becomes less frequent, and expression begins to feel less natural than it once did.

DidRead was created in response to that shift.

We believe reading, writing, and thinking remain valuable skills whether you're a student, a professional, a parent, or someone who simply enjoys learning. Like any skill, they benefit from regular use. A few minutes spent engaging with an idea, responding in your own words, and reflecting on the result is often enough to keep those habits active.

That's what DidRead is for. A short daily opportunity to read something worthwhile, think about it, and express a thought of your own. In a world filled with generated content, the ability to engage with ideas directly remains one of the most valuable skills we can develop and maintain.

---

## ARTICLE 5 (`/blog/how-to-improve-reading-comprehension/`)

*(Search only, not shown on the page. Title tag: "How to improve reading comprehension as an adult · DidRead" (58 characters). Keyword: how to improve reading comprehension. Meta description: "Learn how to improve reading comprehension as an adult with five research-backed habits, from slowing down and reading on paper to explaining ideas back." (153 characters). The H1, link previews and blog cards keep the visible title.)*

*(Not on the home page's From the blog. Blog card description: the dek.)*

# How to improve reading comprehension as an adult

*Five habits that help you understand more of what you read, and the research behind each one.*

By Monty Montgomery · September 12, 2026 · 4 min read

Most advice about reading comprehension is written for schoolchildren, which leaves adults in an odd spot. You can read perfectly well, yet you finish an article and realize you couldn't say what its main point was, or you reach the bottom of an email and have to scroll back up to find the one thing it asked of you.

That gap between reading the words and taking in the meaning is normal, and it has grown easier to fall into as skimming has become a daily habit for many of us (we wrote about that shift in [Too long? Read it anyway.](/blog/too-long-read-it-anyway/)). The good news is that comprehension responds to practice. Here are five habits that strengthen it, each with a note on what the evidence says.

**Read a little slower than feels necessary**

Speed reading apps promise to double or triple your pace without any loss of understanding. A major review of the reading research led by Keith Rayner [found that gains in speed come with a drop in comprehension](https://www.psychologicalscience.org/publications/speed_reading.html), and that methods which stop your eyes from moving back over the text tend to hurt recall.

Skimming has its place, for sorting through your inbox or checking whether an article is worth your time. When you want to understand something, give yourself permission to read at a natural pace and to glance back at a sentence that didn't land.

**Grow your vocabulary by reading widely**

The same review found that the speed gains that do hold up come from ordinary practice, because the more often you've met a word, the faster and more easily you process it. Vocabulary grows mostly through exposure, so the simplest strategy is to read across topics you don't usually touch. A short piece on geology or medieval trade will introduce more new words than another article in your usual lane.

**Put important reading on paper, or slow down on screens**

A 2018 meta-analysis by Pablo Delgado and colleagues, covering 54 studies, [found that people understood informational texts better on paper than on screens](https://doi.org/10.1016/j.edurev.2018.09.003), especially when they were short on time. Readers on screens also tended to overestimate how much they had understood. The effect is modest and didn't appear for stories and novels, so treat it as a nudge.

If printing isn't practical, you can borrow what paper encourages. Close other tabs, give the text your full screen, and set aside enough time that you aren't racing the clock. Our guide on [how to focus while reading](/blog/how-to-focus-while-reading/) has more ideas for keeping your attention on the page.

**Test yourself after you read**

Trying to recall what you read is one of the best-studied ways to remember it. In a well-known experiment, Henry Roediger and Jeffrey Karpicke had students either reread prose passages or try to recall them from memory. [Rereading helped more on a test five minutes later, while recalling helped more on tests days later](https://profiles.wustl.edu/en/publications/test-enhanced-learning-taking-memory-tests-improves-long-term-ret/). The effort of pulling ideas back out of your head is what makes them stick.

You don't need flashcards to use this. When you finish something worth remembering, look away and ask yourself what it said and why it mattered. The same principle explains why handing the work to a tool can leave memories fuzzy, which we cover in [The skills you don't notice losing](/blog/the-skills-you-dont-notice-losing/).

**Explain it in your own words**

Recall becomes even more useful once you put the idea into a sentence or two of your own. Writing it down forces you to notice the parts you only half understood, because those are the parts that refuse to come out clearly. A one-line summary in a notes app counts, and so does explaining the idea aloud to a friend over dinner. If you like to use AI for writing, try doing this step before you open it, an order we explore in [Think first, then ask](/blog/think-first-then-ask/).

**Making it a habit**

None of these habits needs much time. What matters is doing them regularly, on texts that are interesting enough to hold your attention and short enough that you'll finish them.

That combination is what DidRead is built around. Each day you read one short passage, then answer a question about it. Some days that means finding the sentence that proves a point, and other days it means explaining an idea in your own words. Afterward you get feedback on your thinking, and over a few weeks the habits above start to feel automatic. You can read more in [How DidRead works (and why we built it)](/blog/how-didread-works/).

---

## ARTICLE 6 (`/blog/how-to-focus-while-reading/`)

*(Search only, not shown on the page. Title tag: "How to focus while reading: what actually helps · DidRead" (57 characters). Keyword: how to focus while reading (secondary: attention span). Meta description: "Struggling to focus while reading? Learn what attention research actually says about screens and switching, plus small habits that help your focus come back." (157 characters). The H1, link previews and blog cards keep the visible title.)*

*(Not on the home page's From the blog. Blog card description: the dek.)*

# How to focus while reading when your mind keeps wandering

*What attention research actually says, and the small habits that help you stay with a page.*

By Monty Montgomery · September 26, 2026 · 4 min read

You sit down with a book you genuinely want to read, and by the third paragraph your hand is already reaching for your phone. Or you get through a whole page and realize your eyes moved across every line while your mind was planning dinner.

If that sounds familiar, you're in large company. Reading for pleasure has been declining for two decades, as we described in [Too long? Read it anyway.](/blog/too-long-read-it-anyway/), and many people who still love books find it harder to settle into one. The research on attention is more hopeful than the headlines suggest, though, and a few small habits make a real difference.

**What the research shows about attention**

Gloria Mark, a professor emerita of informatics at UC Irvine, has measured how long people stay on one screen before switching to something else. In her early studies the average was about two and a half minutes, and by the years 2016 to 2020 [it had fallen to around 47 seconds](https://www.universityofcalifornia.edu/news/how-sharpen-your-attention-and-meet-your-goals-2024). She also notes that getting back on track after an interruption can take close to half an hour.

Her studies follow how people move between screens during the workday, which makes them a record of a habit many of us have practiced for years: the quick glance at something else. That framing is encouraging, because habits that were learned can be reshaped. Attention behaves much like the other mental skills we rely on, which tend to weaken when we stop using them, a pattern we look at in [The skills you don't notice losing](/blog/the-skills-you-dont-notice-losing/).

**Learn when your focus is strongest**

In the same interview, Mark suggests learning your own rhythm of attention, for example by keeping a short diary of when you feel most and least focused, and saving your most important work for the times your attention peaks. Reading fits into that plan well. If your mind is sharpest in the morning, a few pages before you open email will go further than an hour at the end of a long day.

**Make the distraction harder to reach**

Putting your phone in another room adds a few seconds of friction, and those seconds often give the urge to check it time to pass. If you read on your phone, turn on a focus mode that silences notifications for the length of your session, and close the apps you tend to drift toward.

**Start smaller than you think you need to**

Long sessions are where focus tends to fall apart, so begin with something you can finish. A short article, a single chapter or a passage of a few hundred words gives your attention a clear finish line. Once a short session feels comfortable, you can stretch it gradually, the same way you'd add distance to a run.

**Give your reading a purpose**

Your mind wanders less when it has a job to do. Before you start, pick one question you want the text to answer, such as what the author is arguing or why a character made a particular choice. When you notice yourself drifting, that question gives you somewhere to return. Afterward, try saying the answer to yourself in a sentence, which helps the reading stay with you. That last step is one of the habits in our guide on [how to improve reading comprehension as an adult](/blog/how-to-improve-reading-comprehension/).

**A daily rep for your attention**

DidRead was designed with these ideas in mind. Each day there's one short passage and a single question to answer once you reach the end, about five minutes in all. The passage is short enough to finish in one sitting, and the question gives your attention a reason to stay on the page. Over a few weeks, staying with a text for five minutes starts to feel ordinary again, which is the foundation for reading longer things with ease. [How DidRead works (and why we built it)](/blog/how-didread-works/) explains the thinking behind that design.

---

## SUPPORT (`/support/`)

# Support

Questions, problems, or ideas? Email **hello@didread.app**. A real person reads every message.

**Common questions**

**What is DidRead?**
A daily reading app. Each day you read one short passage, answer one question, and get a reaction to your thinking. It takes about five minutes.

**Is DidRead free?**
Yes, during the beta.

**How does the AI feedback work?**
When you answer in your own words, AI compares your answer with a clear rubric written for that exercise and replies with short feedback. It never decides your progress. That's handled by plain code. Tap and multiple-choice answers are checked by the app itself.

**Is my writing private?**
Yes. Your "Say it your way" free-writes are never sent to AI. Exercise answers are sent only to score them, without your name or email. We don't sell data or show ads. See the [privacy policy](/privacy/).

**How do I turn off reminders?**
In DidRead, go to Settings → Daily reminder. You can also turn off notifications for DidRead in your iPhone's Settings.

**How do I delete my account?**
In DidRead, go to Settings → Delete account. This permanently deletes your account, answers and progress.

**I found a mistake in a passage.**
Thank you. Please email hello@didread.app with the passage title. Every passage is fact-checked, but we'd rather know.

---

## BUILD NOTES (for Claude Code)

**Design**
- Same feel as the app: warm near-black background, warm off-white text (never pure white), one accent (forest green `#8DBE9F`) for links, buttons and the home page's one callout box ("Difficulty adjusts quietly…").
- Headings and article text in a serif, using system fonts only: `ui-serif, "New York", Georgia, serif`. Interface text: `-apple-system, system-ui, sans-serif`. **No Google Fonts or other outside requests**, so there's no tracking.
- Generous spacing, comfortable reading width (about 65 characters), phone-first, no horizontal scrolling. Gentle fades at most, no heavy animation. Dark only, as in the app.
- Favicon: the app icon's angular "DR" monogram in accent green on the near-black background (rounded tile in the browser tab; square for the iPhone home screen, which rounds it). Made by `scripts/build-site.py`.
- Each page gets its own `<title>` and meta description, and Open Graph tags (title and description) for link previews. No analytics, cookies or third-party scripts.
- Every page's meta description is 160 characters or fewer (the build stops if one isn't). Articles have their own search title tags and keyword-targeted descriptions (above each article); link previews use the visible title.
- `sitemap.xml` lists every page (privacy included); `robots.txt` allows everything and points to the sitemap. Both are made by `scripts/build-site.py`.
- Article pages show a small "Back to the blog" link at the top, and a "Coming soon to iPhone" note with the early-access email at the end.
- External research links open in a new tab, with `rel="noopener"`.

**Fact-check before publishing (same standard as exercises)**
- Open every link and confirm it works and supports the exact sentence it's attached to. Note anything that overstates the source, and suggest the smallest fix.
- Keep all the hedges: the MIT study as a small, non-peer-reviewed preprint with methodological critiques; Gerlich as correlational; the Microsoft and CMU study as self-reported.
- Confirm in particular: the iScience figures (more than 40%, more than 236,000 people, 2003–2023, about 3% a year); the HBR workslop figures (about 4 in 10, about 2 hours); the GPS paper (Dahmani & Bohbot 2020, Scientific Reports; confirm the link); Bastani et al. (nearly 1,000 students; the tutor version largely avoided the harm); Wu et al. 2025 (4 studies, more than 3,500 people); Lee, Yin, Jia & Wakslak 2026 (pre-registered; draft-first preserved ownership); Doshi & Hauser 2024; Agarwal et al. (CHI 2025, India and US).
- The exercise in the home page video is comp-f-003, "The Shrinking Bag" (approved, our own text).

**Other**
- The byline "Monty Montgomery" is confirmed (Oct 3, 2026).
- hello@didread.app is set up (Cloudflare Email Routing, Oct 3, 2026).
