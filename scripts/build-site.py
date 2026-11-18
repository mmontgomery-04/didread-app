# Builds the didread.app pages in site/ (home, blog, 3 articles, support, site.css) and the site icons
# (favicon.svg, favicon.ico, apple-touch-icon.png: the app's "DR" monogram in the site's green on near-black).
# The words come from docs/SITE-COPY.md (the source): change that file first, then the matching
# text here, then run:  python scripts/build-site.py
# site/privacy/ and site/media/ are not touched (the privacy page is hand-made from docs/PRIVACY.md;
# media files are made with ffmpeg, see docs/NEXT-SESSION.md). Upload the whole site/ folder's
# contents to Cloudflare Pages afterwards.
import html, io, os, re

import didread_icon  # the DR monogram, shared with the app's icons (scripts/make-app-icon.py)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')
ORIGIN = 'https://didread.app'

def ext(href, text):
    return f'<a href="{href}" target="_blank" rel="noopener noreferrer">{text}</a>'

DESCRIPTIONS = {}  # path -> meta description, checked against the 160-character limit below

def head(title, desc, path, og_type='website', extra='', og_title=None):
    e = html.escape
    DESCRIPTIONS[path] = desc
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{ORIGIN}{path}">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="DidRead">
<meta property="og:title" content="{e(og_title or title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{ORIGIN}{path}">
<meta name="twitter:card" content="summary">
{extra}<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#1B1917">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/site.css">
</head>
<body>
'''

HEADER = '''<header class="site-header">
  <a class="wordmark" href="/">DidRead</a>
  <nav aria-label="Site"><a href="/blog/">Blog</a><a href="/support/">Support</a></nav>
</header>
'''

FOOTER = '''<footer class="site-footer">
  <nav aria-label="Footer">
    <a href="/">DidRead</a><span aria-hidden="true">·</span><a href="/blog/">Blog</a><span aria-hidden="true">·</span><a href="/support/">Support</a><span aria-hidden="true">·</span><a href="/privacy/">Privacy</a><span aria-hidden="true">·</span><a href="mailto:hello@didread.app">hello@didread.app</a>
  </nav>
  <p>© 2026 DidRead</p>
</footer>
</body>
</html>
'''

EARLY = '<a class="button" href="mailto:hello@didread.app?subject=DidRead%20early%20access">Want to try it early? Email us →</a>'

ARTICLES = [  # home page's From the blog keeps this order; the blog index sorts by 'date', newest first.
    # 'home': False keeps an article off the home page.
    {
        'slug': 'how-to-improve-reading-comprehension',
        'title': 'How to improve reading comprehension as an adult',
        'seo_title': 'How to improve reading comprehension as an adult · DidRead',
        'description': 'Learn how to improve reading comprehension as an adult with five research-backed habits, from slowing down and reading on paper to explaining ideas back.',
        'dek': 'Five habits that help you understand more of what you read, and the research behind each one.',
        'card': 'Five habits that help you understand more of what you read, and the research behind each one.',
        'minutes': 4,
        'date': '2026-09-12',
        'home': False,
    },
    {
        'slug': 'how-to-focus-while-reading',
        'title': 'How to focus while reading when your mind keeps wandering',
        'seo_title': 'How to focus while reading: what actually helps · DidRead',
        'description': 'Struggling to focus while reading? Learn what attention research actually says about screens and switching, plus small habits that help your focus come back.',
        'dek': 'What attention research actually says, and the small habits that help you stay with a page.',
        'card': 'What attention research actually says, and the small habits that help you stay with a page.',
        'minutes': 4,
        'date': '2026-09-26',
        'home': False,
    },
    {
        'slug': 'how-didread-works',
        'date': '2026-10-03',
        'title': 'How DidRead works (and why we built it)',
        'seo_title': 'How DidRead works: a 5-minute daily reading habit',
        'description': "DidRead is a 5-minute daily reading and writing habit: read a short passage, answer one question, get feedback on your thinking. Here's how it works and why.",
        'dek': 'The best way to keep a skill is to keep using it.',
        'card': 'The best way to keep a skill is to keep using it.',
        'minutes': 4,
        'home': False,
    },
    {
        'slug': 'too-long-read-it-anyway',
        'date': '2026-08-29',
        'title': 'Too long? Read it anyway.',
        'seo_title': 'Why reading still matters in the age of AI · DidRead',
        'description': "Reading for pleasure has fallen more than 40% in twenty years, and AI can summarize anything. Why reading still matters, and why DidRead isn't anti-AI.",
        'dek': "Why we built DidRead, and why it isn't anti-AI.",
        'card': "Daily reading for fun has dropped by more than 40% in twenty years, and AI can now summarize anything. Here's why we think the long way still matters.",
    },
    {
        'slug': 'the-skills-you-dont-notice-losing',
        'date': '2026-09-05',
        'title': "The skills you don't notice losing",
        'seo_title': 'AI and critical thinking: what the research says · DidRead',
        'description': 'What studies say about AI and critical thinking: cognitive offloading, memory and learning, with the caveats and minus the panic.',
        'card_title': "The skills you don't notice losing.",
        'dek': 'What the research actually says about handing our thinking to tools, minus the panic.',
        'card': 'What the research actually says about handing our thinking to tools, minus the panic.',
    },
    {
        'slug': 'think-first-then-ask',
        'date': '2026-09-19',
        'title': 'Think first, then ask',
        'seo_title': 'When to use AI for writing: think first, then ask · DidRead',
        'description': 'When you bring in AI for writing matters. Studies on ownership, motivation and sameness point to one habit: draft your own ideas first, then ask AI.',
        'card_title': 'Think first, then ask.',
        'dek': 'New studies suggest that when you bring in AI matters as much as whether you do.',
        'dek_html': 'New studies suggest that <em>when</em> you bring in AI matters as much as <em>whether</em> you do.',
        'card': 'New studies suggest that <em>when</em> you bring in AI matters as much as <em>whether</em> you do.',
    },
]

MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
          'October', 'November', 'December']

def nice_date(iso):
    y, m, d = map(int, iso.split('-'))
    return f'{MONTHS[m - 1]} {d}, {y}'

def byline(a):
    return f"By Monty Montgomery · {nice_date(a['date'])} · {a.get('minutes', 3)} min read"

BY_DATE = sorted(ARTICLES, key=lambda a: a['date'], reverse=True)

def card(a, meta):
    title = a.get('card_title', a['title'])
    m = f'<p class="meta">{byline(a).replace("By ", "")}</p>' if meta else ''
    return f'''    <li class="card post-card">
      <h3><a href="/blog/{a['slug']}/">{title}</a></h3>
      <p>{a['card']}</p>
      {m}<a class="more" href="/blog/{a['slug']}/" aria-hidden="true" tabindex="-1">Read →</a>
    </li>
'''

# ---------------------------------------------------------------- home
ICON = '<svg class="step-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{}</svg>'
ICON_READ = ICON.format('<path d="M3 5.5c2.6-1.1 5.6-.9 9 1.2v13c-3.4-2.1-6.4-2.3-9-1.2z"/><path d="M21 5.5c-2.6-1.1-5.6-.9-9 1.2v13c3.4-2.1 6.4-2.3 9-1.2z"/>')
ICON_ANSWER = ICON.format('<path d="M5 19l1.2-4.2L15.8 5.2a2 2 0 0 1 2.9 0l.1.1a2 2 0 0 1 0 2.9L9.2 17.8z"/><path d="M14 7l3 3"/><path d="M4 21h16"/>')
ICON_REACTION = ICON.format('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4A1.5 1.5 0 0 1 4 14.5z"/><path d="M8.5 10.2l2.3 2.3 4.7-4.7"/>')

SHOT_ALT = ("DidRead's Feedback screen on an iPhone. Under the heading “Nice thinking. Here's a reaction.”, "
            "a short reaction names what the reader got right, that luck plays a role in each attempt, and asks "
            "how that luck explains the change, with a Continue button below.")
VIDEO_LABEL = ("Screen recording of a DidRead exercise: the passage “The Shrinking Bag” from the top, “I read it”, the question "
               "“Which sentence explains why shrinkflation is easy to miss?”, tapping a sentence, a green "
               "highlight sweeping across it, and the Feedback screen “Yes, exactly. ✓”.")

def step(icon, name, line):
    return f'''    <li>
      {icon}
      <h3>{name}</h3>
      <p>{line}</p>
    </li>
'''

def skill(name, line):
    return f'''    <details class="row">
      <summary><h3>{name}</h3></summary>
      <p>{line}</p>
    </details>
'''

VIDEO_SCRIPT = """<script>
// The day video: loads only when it's near the screen, and never with Reduce Motion (poster only).
(function () {
  var v = document.querySelector('video[data-src]');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!v || still.matches || !('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    v.src = v.getAttribute('data-src');
    v.play().catch(function () {});
  }, { rootMargin: '300px' });
  io.observe(v);
  still.addEventListener('change', function (e) { if (e.matches) v.pause(); });
})();
</script>
"""

home = head('DidRead · Too long? Read it anyway.', 'Keep your reading, writing, and thinking muscles strong in the age of AI.', '/') + f'''<main class="home">
<section class="hero">
  <p class="wordmark-large">DidRead</p>
  <h1>Too long? Read it anyway.</h1>
  <p class="lead">Keep your reading, writing, and thinking muscles strong in the age of AI.</p>
  <p>DidRead gives you one short passage and one good question each day, then a reaction to <em>your</em> thinking, not a summary of someone else's.</p>
  <p class="cta"><strong>Coming soon to iPhone.</strong></p>
  <div class="buttons">
    {EARLY}
    <a class="button" href="/blog/">For app details, read the blog →</a>
  </div>
  <figure class="phone day-phone">
    <video data-src="/media/a-day.mp4" poster="/media/a-day-poster.jpg" width="720" height="1476" autoplay muted loop playsinline preload="none" aria-label="{html.escape(VIDEO_LABEL)}"></video>
  </figure>
</section>

<section>
  <h2>5-minute mental workouts to flex your thinking</h2>
  <ol class="steps">
{step(ICON_READ, 'Read', 'A short passage worth your time: a strange bit of history, a quiet scene, a small idea that changes how you see something. Chosen and fact-checked by a person.')}{step(ICON_ANSWER, 'Answer', "One question. Sometimes you'll tap or order. Often you'll write a sentence or two in your own words.")}{step(ICON_REACTION, 'Get a reaction', 'Feedback that names what you did well and asks one question to push you further. No grades or red pens.')}  </ol>
  <figure class="phone shot-phone">
    <picture>
      <source srcset="/media/feedback.webp" type="image/webp">
      <img src="/media/feedback.jpg" width="660" height="1359" loading="lazy" alt="{html.escape(SHOT_ALT)}">
    </picture>
  </figure>
</section>

<section>
  <h2>Four kinds of thinking, one passage at a time.</h2>
  <div class="rows">
{skill('Getting it.', 'Understanding what a passage actually says, and finding the line that proves it.')}{skill('Reading between the lines.', "Noticing what's implied: the motive, the mood, the thing nobody says out loud.")}{skill('Thinking it through.', "Spotting the leap in an argument, the missing comparison, the number that doesn't prove what it claims.")}{skill('Saying it well.', 'Explaining an idea in your own words, to a real person, clearly enough that it lands.')}  </div>
  <p class="callout">Difficulty adjusts quietly as you go. You'll never see a level or a score.</p>
</section>

<section>
  <details class="row why">
    <summary><h2>Why DidRead exists</h2></summary>
    <h3>Pro-reader. Not anti-AI.</h3>
    <p>AI can summarize anything. That's genuinely useful, and we use it too. But some things are worth keeping for yourself: the patience to finish a page, the instinct to ask "wait, does that follow?", the satisfaction of saying exactly what you mean.</p>
    <p>Those are skills, and skills fade when we hand them off. DidRead is a small daily rep to keep them.</p>
    <h4 class="small-heading">How it's built:</h4>
    <ul class="principles">
      <li><strong>Every passage is fact-checked and approved by a person.</strong> Never generated on the fly.</li>
      <li><strong>AI gives feedback, but never decides.</strong> It reacts to your answer against a clear rubric. Your progress, difficulty and streak are handled by plain, predictable code.</li>
      <li><strong>No guilt.</strong> No "you'll lose your streak," no fake urgency, no leaderboards. One friendly reminder a day, if you want it.</li>
      <li><strong>Your writing stays yours.</strong> Your free-writes are private and never sent to AI. We don't sell data or show ads. <a href="/privacy/">Privacy policy</a></li>
    </ul>
  </details>
  <p class="after-why"><a class="button" href="/blog/how-didread-works/">Read the article</a></p>
</section>

<section>
  <h2>From the blog</h2>
  <ul class="cards posts">
{''.join(card(a, False) for a in ARTICLES if a.get('home', True))}  </ul>
</section>
</main>
''' + FOOTER.replace('</body>', VIDEO_SCRIPT + '</body>')

# ---------------------------------------------------------------- blog index
blog = head('The DidRead blog', 'Short essays on reading, thinking, and keeping your mind your own.', '/blog/') + HEADER + f'''<main class="page">
<h1>The DidRead blog</h1>
<p class="lead">Short essays on reading, thinking, and keeping your mind your own. Each one takes about three minutes, which is less than a DidRead exercise.</p>
<ul class="cards posts">
{''.join(card(a, True) for a in BY_DATE)}</ul>
</main>
''' + FOOTER

# ---------------------------------------------------------------- articles
BODIES = {}

BODIES['how-to-improve-reading-comprehension'] = f'''<p>Most advice about reading comprehension is written for schoolchildren, which leaves adults in an odd spot. You can read perfectly well, yet you finish an article and realize you couldn't say what its main point was, or you reach the bottom of an email and have to scroll back up to find the one thing it asked of you.</p>
<p>That gap between reading the words and taking in the meaning is normal, and it has grown easier to fall into as skimming has become a daily habit for many of us (we wrote about that shift in <a href="/blog/too-long-read-it-anyway/">Too long? Read it anyway.</a>). The good news is that comprehension responds to practice. Here are five habits that strengthen it, each with a note on what the evidence says.</p>
<h2>Read a little slower than feels necessary</h2>
<p>Speed reading apps promise to double or triple your pace without any loss of understanding. A major review of the reading research led by Keith Rayner {ext('https://www.psychologicalscience.org/publications/speed_reading.html', 'found that gains in speed come with a drop in comprehension')}, and that methods which stop your eyes from moving back over the text tend to hurt recall.</p>
<p>Skimming has its place, for sorting through your inbox or checking whether an article is worth your time. When you want to understand something, give yourself permission to read at a natural pace and to glance back at a sentence that didn't land.</p>
<h2>Grow your vocabulary by reading widely</h2>
<p>The same review found that the speed gains that do hold up come from ordinary practice, because the more often you've met a word, the faster and more easily you process it. Vocabulary grows mostly through exposure, so the simplest strategy is to read across topics you don't usually touch. A short piece on geology or medieval trade will introduce more new words than another article in your usual lane.</p>
<h2>Put important reading on paper, or slow down on screens</h2>
<p>A 2018 meta-analysis by Pablo Delgado and colleagues, covering 54 studies, {ext('https://doi.org/10.1016/j.edurev.2018.09.003', 'found that people understood informational texts better on paper than on screens')}, especially when they were short on time. Readers on screens also tended to overestimate how much they had understood. The effect is modest and didn't appear for stories and novels, so treat it as a nudge.</p>
<p>If printing isn't practical, you can borrow what paper encourages. Close other tabs, give the text your full screen, and set aside enough time that you aren't racing the clock. Our guide on <a href="/blog/how-to-focus-while-reading/">how to focus while reading</a> has more ideas for keeping your attention on the page.</p>
<h2>Test yourself after you read</h2>
<p>Trying to recall what you read is one of the best-studied ways to remember it. In a well-known experiment, Henry Roediger and Jeffrey Karpicke had students either reread prose passages or try to recall them from memory. {ext('https://profiles.wustl.edu/en/publications/test-enhanced-learning-taking-memory-tests-improves-long-term-ret/', 'Rereading helped more on a test five minutes later, while recalling helped more on tests days later')}. The effort of pulling ideas back out of your head is what makes them stick.</p>
<p>You don't need flashcards to use this. When you finish something worth remembering, look away and ask yourself what it said and why it mattered. The same principle explains why handing the work to a tool can leave memories fuzzy, which we cover in <a href="/blog/the-skills-you-dont-notice-losing/">The skills you don't notice losing</a>.</p>
<h2>Explain it in your own words</h2>
<p>Recall becomes even more useful once you put the idea into a sentence or two of your own. Writing it down forces you to notice the parts you only half understood, because those are the parts that refuse to come out clearly. A one-line summary in a notes app counts, and so does explaining the idea aloud to a friend over dinner. If you like to use AI for writing, try doing this step before you open it, an order we explore in <a href="/blog/think-first-then-ask/">Think first, then ask</a>.</p>
<h2>Making it a habit</h2>
<p>None of these habits needs much time. What matters is doing them regularly, on texts that are interesting enough to hold your attention and short enough that you'll finish them.</p>
<p>That combination is what DidRead is built around. Each day you read one short passage, then answer a question about it. Some days that means finding the sentence that proves a point, and other days it means explaining an idea in your own words. Afterward you get feedback on your thinking, and over a few weeks the habits above start to feel automatic. You can read more in <a href="/blog/how-didread-works/">How DidRead works (and why we built it)</a>.</p>
'''

BODIES['how-to-focus-while-reading'] = f'''<p>You sit down with a book you genuinely want to read, and by the third paragraph your hand is already reaching for your phone. Or you get through a whole page and realize your eyes moved across every line while your mind was planning dinner.</p>
<p>If that sounds familiar, you're in large company. Reading for pleasure has been declining for two decades, as we described in <a href="/blog/too-long-read-it-anyway/">Too long? Read it anyway.</a>, and many people who still love books find it harder to settle into one. The research on attention is more hopeful than the headlines suggest, though, and a few small habits make a real difference.</p>
<h2>What the research shows about attention</h2>
<p>Gloria Mark, a professor emerita of informatics at UC Irvine, has measured how long people stay on one screen before switching to something else. In her early studies the average was about two and a half minutes, and by the years 2016 to 2020 {ext('https://www.universityofcalifornia.edu/news/how-sharpen-your-attention-and-meet-your-goals-2024', 'it had fallen to around 47 seconds')}. She also notes that getting back on track after an interruption can take close to half an hour.</p>
<p>Her studies follow how people move between screens during the workday, which makes them a record of a habit many of us have practiced for years: the quick glance at something else. That framing is encouraging, because habits that were learned can be reshaped. Attention behaves much like the other mental skills we rely on, which tend to weaken when we stop using them, a pattern we look at in <a href="/blog/the-skills-you-dont-notice-losing/">The skills you don't notice losing</a>.</p>
<h2>Learn when your focus is strongest</h2>
<p>In the same interview, Mark suggests learning your own rhythm of attention, for example by keeping a short diary of when you feel most and least focused, and saving your most important work for the times your attention peaks. Reading fits into that plan well. If your mind is sharpest in the morning, a few pages before you open email will go further than an hour at the end of a long day.</p>
<h2>Make the distraction harder to reach</h2>
<p>Putting your phone in another room adds a few seconds of friction, and those seconds often give the urge to check it time to pass. If you read on your phone, turn on a focus mode that silences notifications for the length of your session, and close the apps you tend to drift toward.</p>
<h2>Start smaller than you think you need to</h2>
<p>Long sessions are where focus tends to fall apart, so begin with something you can finish. A short article, a single chapter or a passage of a few hundred words gives your attention a clear finish line. Once a short session feels comfortable, you can stretch it gradually, the same way you'd add distance to a run.</p>
<h2>Give your reading a purpose</h2>
<p>Your mind wanders less when it has a job to do. Before you start, pick one question you want the text to answer, such as what the author is arguing or why a character made a particular choice. When you notice yourself drifting, that question gives you somewhere to return. Afterward, try saying the answer to yourself in a sentence, which helps the reading stay with you. That last step is one of the habits in our guide on <a href="/blog/how-to-improve-reading-comprehension/">how to improve reading comprehension as an adult</a>.</p>
<h2>A daily rep for your attention</h2>
<p>DidRead was designed with these ideas in mind. Each day there's one short passage and a single question to answer once you reach the end, about five minutes in all. The passage is short enough to finish in one sitting, and the question gives your attention a reason to stay on the page. Over a few weeks, staying with a text for five minutes starts to feel ordinary again, which is the foundation for reading longer things with ease. <a href="/blog/how-didread-works/">How DidRead works (and why we built it)</a> explains the thinking behind that design.</p>
'''

BODIES['how-didread-works'] = '''<h2>How DidRead works</h2>
<p>DidRead is a daily reading and writing habit designed to fit into ordinary life.</p>
<p>Each day, you'll receive a short passage chosen to be interesting, approachable, and worth a few minutes of attention. Some pieces explore history, science, psychology, or current ideas. Others focus on observation, storytelling, or the way people communicate.</p>
<p>After reading, you'll answer a question. Sometimes you'll identify evidence or explain an idea in your own words. Other times you'll reflect on what you've read or make a connection to something else.</p>
<p>Once you've responded, DidRead provides feedback on your thinking. The response is intended to help you refine an idea, notice a detail, or consider another perspective before moving on with your day.</p>
<p>Most sessions take only a few minutes. Over time, those small moments add up to a regular practice of reading closely, thinking carefully, and expressing your own ideas.</p>
<h2>Why we built it</h2>
<p>The arrival of generative AI has changed the way many people learn, work, and create. Students can complete assignments with a prompt. Professionals can draft emails, reports, and presentations in seconds. Writers can brainstorm, outline, and revise with assistance that would have seemed impossible only a few years ago.</p>
<p>As these tools become part of everyday life, researchers have begun studying how increased reliance on AI affects thinking, memory, writing, and learning. The research is still developing, but many of the questions being asked share a common theme: what happens to important skills when they are practiced less often?</p>
<p>For children, those questions often center on learning. Reading comprehension, written communication, and critical thinking develop through repetition. Parents and educators are increasingly navigating a world where powerful tools are available long before many of those skills have fully formed.</p>
<p>Adults face a different challenge. Large portions of the workday can now be spent reviewing, editing, and approving machine-generated text. Many people who once wrote regularly for work or enjoyment find that they spend less time wrestling with ideas themselves. Reading becomes more fragmented, writing becomes less frequent, and expression begins to feel less natural than it once did.</p>
<p>DidRead was created in response to that shift.</p>
<p>We believe reading, writing, and thinking remain valuable skills whether you're a student, a professional, a parent, or someone who simply enjoys learning. Like any skill, they benefit from regular use. A few minutes spent engaging with an idea, responding in your own words, and reflecting on the result is often enough to keep those habits active.</p>
<p>That's what DidRead is for. A short daily opportunity to read something worthwhile, think about it, and express a thought of your own. In a world filled with generated content, the ability to engage with ideas directly remains one of the most valuable skills we can develop and maintain.</p>
'''

BODIES['too-long-read-it-anyway'] = f'''<p>Somewhere in the last few years, "TL;DR" stopped being a joke and became a habit. A long email arrives and we skim for the ask. An article looks dense and we paste it into a chatbot. A friend sends a thoughtful message and we reply to the gist.</p>
<p>None of this is a moral failing. It's a reasonable response to too much text and too little time. But it has a cost we rarely stop to count.</p>
<p>Reading for its own sake was already slipping before AI arrived. A 2025 study of more than 236,000 Americans in the American Time Use Survey found that {ext('https://www.cell.com/iscience/fulltext/S2589-0042(25)01549-4', 'the share of people reading for pleasure on a given day fell by more than 40% between 2003 and 2023')}, a decline of {ext('https://news.ufl.edu/2025/08/reading-for-pleasure-study/', 'about 3% a year')}. Now we have tools that make not reading effortless.</p>
<p>At the same time, we're drowning in text that nobody really read or wrote. Researchers at Stanford and BetterUp coined a word for one version of it, {ext('https://hbr.org/2025/09/ai-generated-workslop-is-destroying-productivity', '"workslop"')}: AI-generated work that looks polished but has no substance, and pushes the real thinking onto whoever receives it. In their survey, about four in ten workers had received some in the past month, and each instance took nearly two hours to deal with, on average.</p>
<p>So we skim more, partly because there's more not worth reading. Then the habit spreads to the things that are.</p>
<h2>What we're actually losing</h2>
<p>When you read something properly, you're not just collecting information. You're practicing a handful of quiet skills: following an argument to its end, noticing what an author implies but doesn't say, catching the moment a claim outruns its evidence, and, finally, being able to say what you think in your own words.</p>
<p>A summary gives you the conclusion. It skips the practice. And like any skill, these get rusty when you stop using them. (We dig into the research on that in <a href="/blog/the-skills-you-dont-notice-losing/">The skills you don't notice losing</a>.)</p>
<h2>Why this isn't anti-AI</h2>
<p>We use AI. DidRead even uses it, to react to your answers. Summaries are useful, and so are calculators, maps, and spellcheck.</p>
<p>The point isn't to refuse the tools. It's to keep a part of your thinking in shape, so you can tell when a summary got it wrong, so your writing still sounds like you, and so a long, good piece of writing feels like a pleasure instead of a chore.</p>
<h2>Five minutes, on purpose</h2>
<p>That's what DidRead is: one short passage a day, chosen because it's worth reading, and one question that asks you to actually engage with it. Sometimes you'll find the line that proves a point. Sometimes you'll explain an idea to an imaginary friend. Then you get a reaction to your thinking, not a grade.</p>
<p>It won't fix the internet. But five minutes a day of reading something properly is a small way of saying: this, I'll do myself.</p>
<p class="closing">Too long? Read it anyway.</p>
'''

BODIES['the-skills-you-dont-notice-losing'] = f'''<p>Psychologists have a name for using tools to do mental work for us: <strong>cognitive offloading.</strong> We've always done it. Writing things down is offloading, and so is a calendar. Mostly it's a great deal: you free your mind for the things that matter.</p>
<p>But there's a catch, and you can see it in something as ordinary as GPS. In one study, {ext('https://www.nature.com/articles/s41598-020-62877-0', 'people who relied more on GPS over the years had worse spatial memory when they had to find their way without it')}. The tool didn't break anything. The skill just stopped getting practice.</p>
<p>The question now is what happens when the thing we offload isn't directions, but thinking itself.</p>
<h2>What the studies are finding</h2>
<p>The research is young, and it's worth reading carefully. Here's where it stands.</p>
<ul class="findings">
  <li><strong>More offloading, less critical thinking.</strong> A 2025 study of 666 people found that {ext('https://www.mdpi.com/2075-4698/15/1/6', 'heavier use of AI tools was linked to lower critical-thinking scores')}, with offloading explaining much of the link. It's a correlation, not proof of cause, but it points the same way as other work.</li>
  <li><strong>Trusting the tool, thinking less.</strong> Microsoft Research and Carnegie Mellon surveyed 319 knowledge workers about 936 real tasks. {ext('https://www.microsoft.com/en-us/research/publication/the-impact-of-generative-ai-on-critical-thinking-self-reported-reductions-in-cognitive-effort-and-confidence-effects-from-a-survey-of-knowledge-workers/', 'The more people trusted AI to handle a task, the less critical thinking they reported doing')}. The more they trusted <em>themselves</em>, the more they did.</li>
  <li><strong>Better homework, worse exams.</strong> In a field experiment with nearly 1,000 high-school math students, {ext('https://www.pnas.org/doi/10.1073/pnas.2422633122', 'students given open access to GPT-4 did much better on practice problems, then scored worse than students who never had it once it was taken away')}. A version designed as a tutor, which gave hints instead of answers, largely avoided the harm.</li>
  <li><strong>Quieter brains, fuzzier memories.</strong> An MIT Media Lab study measured the brain activity of people writing essays. {ext('https://www.media.mit.edu/publications/your-brain-on-chatgpt/', "Those using ChatGPT showed the weakest brain connectivity, and many struggled to quote a single sentence from essays they'd just written")}. It's an early, small study (54 people) that hasn't been peer-reviewed, and {ext('https://arxiv.org/abs/2601.00856', 'other researchers have questioned its methods')}, so treat it as a signal, not a verdict.</li>
</ul>
<h2>What it adds up to</h2>
<p>Not "AI is rotting your brain." The honest version is smaller and more useful: <strong>skills you don't use get weaker, and AI makes it very easy not to use some important ones.</strong> The math study points to the encouraging part too. The tool that made students think for themselves didn't do the damage. <em>How</em> you use AI matters.</p>
<h2>Keeping the skill</h2>
<p>The fix isn't to give up the tools. It's to keep doing some of the work yourself, on purpose, the way someone with a car still takes the stairs.</p>
<p>That's the idea behind DidRead. Each day you read a short passage and do the thinking yourself: find the evidence, notice the hidden motive, spot the flawed argument, put an idea in your own words. Then AI reacts to your work, rather than doing it for you.</p>
<p>Five minutes of thinking for yourself won't undo the internet. But it keeps the skill getting its reps.</p>
'''

BODIES['think-first-then-ask'] = f'''<p>Here's a question that sounds small: when you use AI for something you're writing, do you open it first, or after you've had a go yourself?</p>
<p>A growing pile of research suggests the order matters, for what you remember, for whether the work feels like yours, and even for whether you want to do it at all.</p>
<h2>Ownership: is it still yours?</h2>
<p>In the MIT Media Lab's essay-writing study, people who wrote with ChatGPT reported {ext('https://www.media.mit.edu/publications/your-brain-on-chatgpt/', "the lowest sense of ownership over their essays, and many couldn't accurately quote what they'd written")}. The study is small, not yet peer-reviewed, and its methods have been questioned, but its most interesting finding was about timing. In a final session with just 18 of the participants, people who had written on their own first and <em>then</em> got AI showed stronger brain engagement and better recall than people who went the other way.</p>
<p>A larger, pre-registered experiment published in 2026 makes the timing point even more clearly. People who {ext('https://www.nature.com/articles/s41598-026-42312-6', 'simply copied AI-generated work reported lower confidence in their own abilities, less ownership, and less sense that the work mattered, and some of those effects lingered after they went back to working alone')}. But people who <strong>wrote their own draft first and then used AI to improve it</strong> felt about the same as people who never used AI at all.</p>
<h2>Motivation: the boredom afterward</h2>
<p>Across four studies with more than 3,500 people, researchers found that {ext('https://www.nature.com/articles/s41598-025-98385-2', 'working with ChatGPT improved the quality of the work in front of people, but when they then had to do a task on their own, their intrinsic motivation dropped and boredom rose')}. The boost didn't carry over to the solo work. The flatness did.</p>
<h2>Sameness: everyone starts to sound alike</h2>
<p>There's a quieter cost too. In one study, {ext('https://www.science.org/doi/10.1126/sciadv.adn5290', 'stories written with AI ideas were rated more creative individually, but were more similar to each other')}. Another, with writers in India and the United States, found that {ext('https://news.cornell.edu/stories/2025/04/ai-suggestions-make-writing-more-generic-western', 'AI writing suggestions nudged the Indian writers toward Western styles and flattened cultural detail')}. When everyone starts from the same machine, the starting points converge.</p>
<h2>The rule of thumb</h2>
<p>Put together, these studies point to a simple habit: <strong>think first, then ask.</strong> Have your own idea, write your own rough version, and then bring in the tool to sharpen it. You keep your voice, your memory of the work, and your reason to care about it, and you still get the help.</p>
<h2>Why DidRead works this way</h2>
<p>Every DidRead exercise is built on that order. You read the passage yourself. You answer in your own words, before anything else weighs in. Only then does AI respond, and it doesn't rewrite your answer or hand you a model one. It names what you did well and asks you a question to take your thinking one step further.</p>
<p>It's a five-minute rehearsal of the habit: you go first.</p>
'''

def article_page(a):
    path = f"/blog/{a['slug']}/"
    extra = (f'<meta property="article:author" content="Monty Montgomery">\n'
             f'<meta property="article:published_time" content="{a['date']}">\n')
    return head(a['seo_title'], a['description'], path, 'article', extra, og_title=a['title']) + HEADER + f'''<main class="page article">
<p class="back"><a href="/blog/">← Back to the blog</a></p>
<article>
<header class="article-header">
  <h1>{a['title']}</h1>
  <p class="dek">{a.get('dek_html', a['dek'])}</p>
  <p class="meta">{byline(a)}</p>
</header>
<div class="prose">
{BODIES[a['slug']]}</div>
</article>
<aside class="note">
  <p><strong>Coming soon to iPhone.</strong></p>
  <p>{EARLY}</p>
</aside>
</main>
''' + FOOTER

# ---------------------------------------------------------------- support
QA = [
    ('What is DidRead?', 'A daily reading app. Each day you read one short passage, answer one question, and get a reaction to your thinking. It takes about five minutes.'),
    ('Is DidRead free?', 'Yes, during the beta.'),
    ('How does the AI feedback work?', "When you answer in your own words, AI compares your answer with a clear rubric written for that exercise and replies with short feedback. It never decides your progress. That's handled by plain code. Tap and multiple-choice answers are checked by the app itself."),
    ('Is my writing private?', 'Yes. Your "Say it your way" free-writes are never sent to AI. Exercise answers are sent only to score them, without your name or email. We don\'t sell data or show ads. See the <a href="/privacy/">privacy policy</a>.'),
    ('How do I turn off reminders?', "In DidRead, go to Settings → Daily reminder. You can also turn off notifications for DidRead in your iPhone's Settings."),
    ('How do I delete my account?', 'In DidRead, go to Settings → Delete account. This permanently deletes your account, answers and progress.'),
    ('I found a mistake in a passage.', 'Thank you. Please email <a href="mailto:hello@didread.app">hello@didread.app</a> with the passage title. Every passage is fact-checked, but we\'d rather know.'),
]
support = head('Support · DidRead', 'Questions, problems, or ideas? Email hello@didread.app. A real person reads every message.', '/support/') + HEADER + '''<main class="page">
<h1>Support</h1>
<p class="lead">Questions, problems, or ideas? Email <strong><a href="mailto:hello@didread.app">hello@didread.app</a></strong>. A real person reads every message.</p>
<h2>Common questions</h2>
<dl class="faq">
''' + ''.join(f'  <div class="card"><dt>{q}</dt><dd>{a}</dd></div>\n' for q, a in QA) + '''</dl>
</main>
''' + FOOTER

CSS = '''/* didread.app: the app's calm, bookish dark style (SPEC section 8). System fonts only; no outside requests. */
:root {
  --background: #1B1917;
  --surface: #25231F;
  --text: #ECE6DA;
  --muted: #A29C8F;
  --border: #39352E;
  --accent: #8DBE9F;
  --on-accent: #1B1917;
  --serif: ui-serif, "New York", Georgia, serif;
  --sans: -apple-system, system-ui, sans-serif;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--background);
  color: var(--text);
  font: 17px/1.6 var(--sans);
}
main, .site-header, .site-footer { max-width: 44rem; margin: 0 auto; padding-left: 16px; padding-right: 16px; }
@media (prefers-reduced-motion: no-preference) {
  main { animation: fade 0.5s ease-out both; }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
}

a { color: var(--accent); text-underline-offset: 3px; text-decoration-thickness: 1px; }
a:hover { text-decoration-thickness: 2px; }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
h1, h2, h3, .wordmark, .wordmark-large { font-family: var(--serif); font-weight: 600; line-height: 1.2; color: var(--text); }
h1 { font-size: 36px; margin: 0 0 16px; }
h2 { font-size: 25px; margin: 0 0 16px; }
h3 { font-size: 19px; margin: 0 0 6px; }
p { margin: 0 0 16px; }
ul, ol { margin: 0 0 16px; padding: 0; list-style: none; }
strong { font-weight: 600; }
.lead { font-size: 19px; color: var(--muted); }
.meta { color: var(--muted); font-size: 15px; margin: 0; }

/* Top bar (every page but home) */
.site-header { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding-top: 20px; padding-bottom: 8px; }
.wordmark { font-size: 22px; text-decoration: none; }
.site-header nav { display: flex; gap: 20px; font-size: 15px; }
.site-header nav a { color: var(--muted); text-decoration: none; }
.site-header nav a:hover { color: var(--text); }

/* Footer */
.site-footer { margin-top: 64px; padding-top: 24px; padding-bottom: 40px; border-top: 1px solid var(--border); color: var(--muted); font-size: 15px; }
.site-footer nav { display: flex; flex-wrap: wrap; gap: 6px 10px; margin-bottom: 8px; }
.site-footer nav a { color: var(--muted); }
.site-footer nav a:hover { color: var(--text); }
.site-footer p { margin: 0; }

/* Cards */
.card { background: var(--surface); border-radius: 16px; padding: 20px; }
.cards { display: grid; gap: 12px; }
.cards p:last-child { margin-bottom: 0; }

/* Button (the early-access email) */
.button {
  display: inline-block;
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 600;
  text-decoration: none;
  padding: 14px 22px;
  border-radius: 14px;
}
.button:hover { filter: brightness(1.06); }

/* Home */
.home { padding-top: 56px; }
.home section { margin-bottom: 64px; }
.hero h1 { font-size: 40px; }
.wordmark-large { font-size: 24px; margin: 0 0 24px; }
.hero .cta { margin: 32px 0 14px; }
.steps { counter-reset: step; }
.steps li { counter-increment: step; display: grid; grid-template-columns: 22px 1fr; column-gap: 12px; margin-bottom: 28px; }
.steps li::before {
  content: counter(step);
  grid-column: 1; grid-row: 2; align-self: baseline;
  font-family: var(--serif); font-size: 24px; font-weight: 600; line-height: 1.1; color: var(--muted);
}
.steps li > * { grid-column: 2; }
.steps h3 { align-self: baseline; font-size: 21px; margin: 0 0 6px; }
.steps p { margin: 0; }
.step-icon { display: block; color: var(--accent); margin-bottom: 8px; }

/* Phone frame (screenshot and video) */
.phone {
  margin: 0;
  padding: 7px;
  border-radius: 38px;
  background: #121110;
  border: 1px solid var(--border);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5), 0 2px 10px rgba(0, 0, 0, 0.35);
}
.phone img, .phone video { display: block; width: 100%; height: auto; border-radius: 31px; background: #181615; }
.buttons { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.shot-phone { width: min(64%, 250px); margin: 28px auto 8px; }
.callout { background: var(--accent); color: var(--on-accent); font-style: italic; border-radius: 16px; padding: 16px 20px; }
.day-phone { width: min(72%, 270px); margin: 40px auto 0; }

/* Dropdowns: native details/summary, no JavaScript */
.rows { background: var(--surface); border-radius: 16px; padding: 0 20px; margin-bottom: 20px; }
.row + .row { border-top: 1px solid var(--border); }
.row > summary {
  list-style: none;
  cursor: pointer;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 16px 0;
  font-weight: 600;
}
.row > summary::-webkit-details-marker { display: none; }
.row > summary::after {
  content: "+"; content: "+" / "";
  flex: none; width: 24px; text-align: center;
  font: 400 26px/1 var(--sans); color: var(--accent);
}
.row[open] > summary::after { content: "\\2212"; content: "\\2212" / ""; }
.row > summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 6px; }
.row > summary h2, .row > summary h3 { margin: 0; }
.row > :not(summary):last-child { padding-bottom: 18px; margin-bottom: 0; }
.rows .row > p { margin-top: -4px; }
@media (prefers-reduced-motion: no-preference) {
  .row[open] > :not(summary) { animation: reveal 0.25s ease-out; }
  @keyframes reveal { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
}
.why { padding: 0 20px; background: var(--surface); border-radius: 16px; }
.why h3 { font-size: 22px; margin: 4px 0 12px; }
.why .principles { margin-bottom: 0; }
.after-why { margin: 24px 0 0; }
.passage {
  margin: 0 0 16px;
  background: var(--surface);
  border-radius: 16px;
  padding: 24px 22px 8px;
  font-family: var(--serif);
  font-size: 19px;
  line-height: 1.65;
}
.question { font-family: var(--serif); font-size: 19px; }
.small-heading { font-family: var(--sans); font-weight: 600; font-size: 17px; margin: 24px 0 8px; }
.principles li { margin-bottom: 12px; }
.post-card h3 a { color: var(--text); text-decoration: none; }
.post-card h3 a:hover { text-decoration: underline; }
.post-card .meta { margin-bottom: 8px; }
.more { font-size: 15px; }

/* Inner pages */
.page { padding-top: 32px; }
.back { font-size: 15px; margin-bottom: 24px; }
.back a { color: var(--muted); text-decoration: none; }
.back a:hover { color: var(--text); }
.article-header { margin-bottom: 32px; }
.dek { font-family: var(--serif); font-style: italic; font-size: 20px; color: var(--muted); margin-bottom: 12px; }
.dek em { font-style: normal; }
.prose { max-width: 65ch; font-family: var(--serif); font-size: 19px; line-height: 1.7; }
.prose h2 { font-size: 23px; margin-top: 40px; }
.prose .findings li { margin-bottom: 16px; padding-left: 18px; position: relative; }
.prose .findings li::before { content: "•"; position: absolute; left: 0; color: var(--muted); }
.closing { font-style: italic; margin-top: 32px; }
.note { margin-top: 48px; padding: 24px 20px 8px; background: var(--surface); border-radius: 16px; }
.faq { margin: 0; display: grid; gap: 12px; }
.faq dt { font-family: var(--serif); font-weight: 600; font-size: 19px; margin-bottom: 6px; }
.faq dd { margin: 0; }
.page > h2 { margin-top: 40px; }

@media (min-width: 640px) {
  h1 { font-size: 42px; }
  .hero h1 { font-size: 50px; }
  .home { padding-top: 88px; }
}
'''

def write(rel, text):
    p = os.path.join(SITE, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)

write('index.html', home)
write('blog/index.html', blog)
for a in ARTICLES:
    write(f"blog/{a['slug']}/index.html", article_page(a))
write('support/index.html', support)
write('site.css', CSS)

# Search engines: every page (privacy included), and robots.txt pointing at the sitemap
PAGES = ['/', '/blog/'] + [f"/blog/{a['slug']}/" for a in ARTICLES] + ['/support/', '/privacy/']
write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + ''.join(f'  <url><loc>{ORIGIN}{p}</loc></url>\n' for p in PAGES) + '</urlset>\n')
write('robots.txt', f'User-agent: *\nAllow: /\n\nSitemap: {ORIGIN}/sitemap.xml\n')

# Meta descriptions: every page has one, none over 160 characters (the privacy page is hand-made, so read it)
with io.open(os.path.join(SITE, 'privacy', 'index.html'), encoding='utf-8') as f:
    m = re.search(r'<meta name="description" content="([^"]*)"', f.read())
DESCRIPTIONS['/privacy/'] = html.unescape(m.group(1)) if m else ''
for page in PAGES:
    desc = DESCRIPTIONS.get(page, '')
    if not 0 < len(desc) <= 160:
        raise SystemExit(f'{page}: meta description is {len(desc)} characters (must be 1-160)')
write('favicon.svg', didread_icon.svg(rounded=True))
with open(os.path.join(SITE, 'favicon.ico'), 'wb') as f:
    f.write(didread_icon.ico([didread_icon.png(n, background='rounded') for n in (16, 32, 48)]))
with open(os.path.join(SITE, 'apple-touch-icon.png'), 'wb') as f:
    f.write(didread_icon.png(180, background='square'))  # iPhone rounds the corners itself
print('built')
