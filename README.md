# REBEL's Website

The content for the website of the **Reality Bending Lab**: https://realitybendinglab.com

This repository *is* the site. There is no build step, no framework and no
`npm install`: plain HTML, plain CSS, plain JavaScript modules, and a few Python
scripts that turn folders of content into the JSON files the page reads.

**If you are a lab member wanting to add your profile or write a post, you only need the two guides below.**
You do not need to understand the rest of the site, and you cannot break it by adding a folder.

- [Add your profile](#add-your-profile)
- [Write a blog post](#write-a-blog-post)
- [Pictures: please read this bit](#pictures-please-read-this-bit)
- [Getting your change onto the site](#getting-your-change-onto-the-site)

---

## Before you start

Everything you write is **JSON**, a text format that is picky about
punctuation. Three rules cover almost every mistake:

- Every `"key"` and every text value goes in **double quotes**.
- Items in a list are separated by commas, and there is **no comma after the last one**.
- If you need a `"` inside a piece of text, write `\"`.

If something does not appear on the site after your change, a broken JSON file
is the first thing to suspect. Paste it into <https://jsonlint.com>, it will
point at the line.

---

## Add your profile

Your profile is **one folder** in `people/`, containing a photo and a
`profile.json`. Nothing else. The folder's name becomes your page's web address,
so `people/ada-lovelace/` is published at
`https://realitybendinglab.com/people/ada-lovelace/`.

### 1. Make your folder

Name it `firstname-lastname`, all lowercase, with a hyphen instead of the space
and no accents:

```
people/ada-lovelace/
```

<details>
<summary>Two names that are not allowed (rare, but worth knowing)</summary>

The folder name is also used as an internal link, so it must not be `lab`,
`collaborations` or `memories`, and it must not start with `people-`, `post-`,
`sec-`, `join-`, `services-`, `contact-`, `research-`, `news-` or
`publications-`. No real name does any of this — it only comes up if you were
going to be creative.
</details>

### 2. Add your photo

Put a picture of yourself in that folder, named exactly `avatar.jpg` (`.png`,
`.jpeg` and `.webp` also work):

```
people/ada-lovelace/avatar.jpg
```

**Resize it to about 700 pixels on its longest side first** — see
[Pictures](#pictures-please-read-this-bit). A photo straight off a phone is
around 4000 pixels wide and roughly fifty times larger than it needs to be, for
a picture the site never shows above 188 pixels.

Square-ish works best; it is displayed as a circle.

### 3. Write your `profile.json`

Create `people/ada-lovelace/profile.json`. **Only `name` and `category` are
required** — start with those two and add what you feel like:

```json
{
    "name": "Ada Lovelace",
    "category": "PhD Student"
}
```

`category` must be **exactly** one of:

```
PI    Postdoc    PhD Student    Research Assistant    Alumni
```

(Spelling and capitals matter. Anything else is rejected with a message telling
you so.)

A fuller example, using every optional field:

```json
{
    "name": "Ada Lovelace",
    "category": "PhD Student",
    "title": "PhD Candidate in Psychology",
    "affiliation": "University of Sussex",
    "location": "Brighton, UK",
    "email": "a.lovelace@sussex.ac.uk",
    "website": "https://adalovelace.example.org",

    "keywords": ["memory", "dreams", "attention"],
    "hook": "Did you know that Ada Lovelace once stayed awake for a whole sleep study?",

    "summary": "<p>Ada studies how the sense of reality survives a night without sleep.</p><p>She joined the lab in 2025 after an MSc in cognitive neuroscience.</p>",

    "interests": ["Dream research", "Sleep and memory", "Bayesian statistics"],

    "achievements": [
        "Departmental Prize for Best MSc Thesis (2025)"
    ],

    "experience": [
        {
            "degree": "MSc in Cognitive Neuroscience",
            "institution": "University of Sussex",
            "year": "2025",
            "details": "Thesis on sleep deprivation and reality monitoring."
        },
        {
            "degree": "BSc in Psychology",
            "institution": "University of Edinburgh",
            "year": "2023"
        }
    ],

    "socials": [
        { "label": "GitHub", "url": "https://github.com/adalovelace" },
        { "label": "Google Scholar", "url": "https://scholar.google.com/citations?user=XXXX" },
        { "label": "ResearchGate", "url": "https://www.researchgate.net/profile/Ada-Lovelace" },
        { "label": "X", "url": "https://x.com/adalovelace" },
        { "label": "LinkedIn", "url": "https://www.linkedin.com/in/adalovelace" },
        { "label": "ORCID", "url": "https://orcid.org/0000-0000-0000-0000" }
    ],

    "details": "<p>Anything else you want at the bottom of your panel, as HTML.</p>"
}
```

Field by field:

| Field                     | What it is                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                    | **Required.** How you want to be named across the whole site.                                                                                                                                      |
| `category`                | **Required.** One of the five roles above.                                                                                                                                                         |
| `title`                   | Your job title, shown under your name.                                                                                                                                                             |
| `affiliation`, `location` | Where you are.                                                                                                                                                                                     |
| `email`, `website`        | Shown as contact links. Leave `email` out if you would rather not publish it.                                                                                                                      |
| `keywords`                | Three or so short words. These are the ring that appears around your photo when someone points at it — so single words work far better than phrases.                                               |
| `hook`                    | One playful sentence, shown by the "discover someone" button.                                                                                                                                      |
| `summary`                 | Your bio. Written as HTML: wrap each paragraph in `<p>…</p>`.                                                                                                                                      |
| `interests`               | Research interests, as a list of short phrases.                                                                                                                                                    |
| `achievements`            | Prizes and awards, as a list of lines.                                                                                                                                                             |
| `experience`              | Your CV, newest first. Each entry takes `degree`, `institution`, `year` and an optional `details`.                                                                                                 |
| `socials`                 | Your profiles elsewhere. `GitHub`, `Google Scholar`, `ResearchGate`, `X`, `Twitter`, `LinkedIn` and `ORCID` get their proper icon automatically; anything else gets a generic one and still works. |
| `details`                 | A free HTML block at the end of your panel.                                                                                                                                                        |

`summary` and `details` are **HTML**, not plain text — a blank line between two
paragraphs does nothing, and `<p>…</p>` around each one is what you want.

### 4. Regenerate the list

Open a pull request with just your folder.
Someone will run the `update_people.py` script to update the website

---

## Write a blog post

A post is **one folder** in `news/`, containing a `post.json` and any pictures it
uses.

### 1. Make your folder

Name it `<year>-<a-few-words>`, lowercase and hyphenated:

```
news/2026-sleep-study-results/
```

That name is the post's web address —
`https://realitybendinglab.com/news/2026-sleep-study-results/` — so keep it short
and readable. **The date is not in the folder name**; it goes in `post.json`, and
that is the only place it lives.

<details>
<summary>Two folder names that are not allowed</summary>

`all` and `featured`. They used to be the two tabs of the News section, and
they are still the addresses of two old links that have to keep working.
</details>

### 2. Write `post.json`

```json
{
    "title": "What a week without sleep does to reality",
    "date": "2026-03-14",
    "authors": ["ada-lovelace"],
    "category": "Research",
    "summary": "One or two sentences, shown on the news index.",
    "content": [
        "<p>We ran a study. Here is the opening paragraph.</p>",
        "<p>And here is the second one, with <a href=\"https://example.org\">a link</a> in it.</p>",
        "<h3>What we found</h3>",
        "<p>Then some more prose.</p>",
        "<figure><img src=\"eeg-trace.jpg\"><figcaption>An EEG trace from the third night.</figcaption></figure>",
        "<ul><li>First point</li><li>Second point</li></ul>"
    ]
}
```

| Field      | What it is                                                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`    | **Required.**                                                                                                                                                                                                                      |
| `date`     | **Required**, as `YYYY-MM-DD`. This is what orders the news list.                                                                                                                                                                  |
| `content`  | **Required.** The post itself — see below.                                                                                                                                                                                         |
| `authors`  | A list. Use someone's **people folder name** (`"ada-lovelace"`) and the site fills in their photo and links their name to their profile. A guest with no profile is written as a plain name (`"Jane Guest"`) and stays plain text. |
| `category` | One of `Research`, `Thoughts`, `Methods`, `Lab`, `Awards`, `Media`. This is the chip readers filter by.                                                                                                                            |
| `summary`  | Shown on the index. If you leave it out, the first paragraph is used.                                                                                                                                                              |
| `subtitle` | Optional, shown under the title.                                                                                                                                                                                                   |
| `featured` | `true` puts the post behind the **Featured** chip, beside the category chips.                                                                                                                                                                                          |
| `draft`    | `true` keeps the post out of the site entirely. **Use this while you are writing.**                                                                                                                                                |

### 3. About `content`

`content` is **HTML**, and there is a good reason for it: you get all of HTML
rather than a half-implemented dialect of Markdown. In practice you need five
tags:

```html
<p>a paragraph</p>
<h3>a section heading</h3>          <!-- start at h3, not h1 -->
<ul><li>a bullet</li></ul>
<blockquote>a quotation</blockquote>
<figure><img src="photo.jpg"><figcaption>a caption</figcaption></figure>
```

**Do not add `class="..."` to anything.** The stylesheet dresses these tags
directly, and a class of your own will not match it.

Two things the site does for you, so you don't have to:

- `<img src="photo.jpg">` means *a file in this post's own folder*. Put
  `photo.jpg` next to `post.json` and write just the filename.
- Any link to another website automatically opens in a new tab and gets the
  right styling. Just write a plain `<a href="…">`.

**Write `content` as a list of strings, one per paragraph**, as in the example
above. JSON cannot contain a real line break inside a piece of text, so a post
written as one long string is a single enormous unreadable line. The site glues
the list back together and never looks at where you split it — so split wherever
it makes the file easy to read. (A two-sentence post can just be one string.)

### 4. Add a picture for the index

Put a picture named `featured.jpg` (or `.png`, `.webp`, `.gif`) in the folder and
it becomes the post's thumbnail and its header image. Resize it to **1400 pixels**
on its longest side first.

### 5. Regenerate the list

```bash
python update_news.py
```

Same as for people: it prints what it found, and you **commit the changed
`news/news_manifest.json`** together with your folder.

---

## Pictures: please read this bit

Every visitor downloads every picture on the page they open. A phone photo
dropped in unchanged is typically **4000 pixels wide and 5 MB**, to be displayed
at 156 pixels. The site once pulled 122 MB on a single visit this way. Resizing
22 files brought it to 10.8 MB and **nothing on screen looked any different.**

So: before you commit an image, resize it to the size it is actually shown at.

| What it is                        | Resize to (longest side) |
| --------------------------------- | ------------------------ |
| Your profile photo (`avatar.jpg`) | 700 px                   |
| A post's header (`featured.jpg`)  | 1400 px                  |
| A picture inside a post           | 1100 px                  |
| A lab photo for the Memories wall | 1400 px                  |

Quality 80–85 as JPEG is plenty. Two further rules:

- **Save photographs as JPEG, never PNG.** A photo saved as PNG is roughly ten
  times larger for no visible gain. One avatar here was a 14 MB PNG; as a JPEG
  it is 80 KB. Use PNG only for logos and diagrams with transparency.
- **Animated GIFs need special care.** They are enormous. Ask before adding one.

Any tool will do this — Preview on a Mac, Photos on Windows, GIMP, or
<https://squoosh.app> in a browser (drag the file in, set the width, download).

---

## Getting your change onto the site


Use the GitHub website. On the repository page, **Add file → Upload files**, drag
your folder in, and choose *"Create a new branch for this commit and start a pull request"* at the bottom.
Say in the description that you could not run the update
script, and someone will do it.

