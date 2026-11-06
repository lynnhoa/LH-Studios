# LYNNHOA — Master Content Structure

The structure has separate layers: your identity, the environments you create content in, your personal eras, and the way you package stories.

## 1. Overall identity

**LYNNHOA = Fashion Personality**

The overall personality and world people follow: fashion, beauty, personal image, experiences, opinions and everyday life.

## 2. Personal Eras

Longer-term developments in your personal appearance and recognisable image.

| Era | What it covers |
|---|---|
| Beauty Era | Hair, nails, makeup and beauty identity |
| Style Era | Wardrobe, personal style, silhouettes and aesthetic |
| Signature Era | Signature accessories, everyday look and personal uniform |

Example: Going Blonde is a project within your Beauty Era, not an Era of its own.

## 3. Main Areas & Phases

These define where the content takes place and what kind of activity or experience is happening.

### Home

| Phase | What belongs here |
|---|---|
| After Trip | Coming home: unpacking, laundry, resetting and settling back in |
| Home Projects | Bedroom, bathroom, furniture, decorating, home improvements |
| Maintenance | Hair, lashes, nails, skincare and other beauty upkeep |
| Beauty Projects | New hair, new makeup, beauty changes and experiments |
| Wardrobe & Style | Wardrobe edits, new pieces, seasonal wardrobe changes, style development |
| Kits & Preparation | Travel kits, work bag, beauty kits, packing and restocking |
| Before Next Trip | Planning, outfits, packing and counting down to the next trip |

### Travel

| Phase | What belongs here |
|---|---|
| City Break | Short trips, city experiences, outfits, restaurants and activities |
| Long Trip | Longer holidays, travel experiences, packing, destinations and daily life away |

### Brand Work

| Phase | What belongs here |
|---|---|
| Invited | Brand invitations, events, hosted experiences |
| Brand Collab | Paid partnerships, gifting, campaigns and collaborations |
| Fashion Week | Fashion Week trips, shows, events, street style and industry experiences |

### In the app (06.11.2026)

Each main area holds its **chapters** (the phases above). Each chapter holds its **selected arcs**, each arc its **matching formats**:

```
Main area → Chapter → Selected arcs → Matching formats
```

Home has 7 chapters: After Trip · Home Projects · Maintenance · Beauty Projects · Wardrobe & Style · Kits & Preparation · Before Next Trip.
**Everyday Life** (getting ready, routines, matcha, quiet days, thoughts and personality) sits under **Base** for now; its own structure comes later.

## 4. Signature Series

An ongoing storyline that can run through multiple Home phases.

**Getting My Life Together** — your unfinished projects, accumulated chaos, decisions and the process of getting things sorted, with satisfying results.

Possible chapters:

- Fixing up my bedroom
- Getting my beauty collection together
- Sorting out my wardrobe
- Building my permanent travel kits

The series is not the whole account. It is one recurring content pillar within your fashion-personality identity.

## 5. Content Packages

A planned collection of posts documenting one finite project, experience or story. Two types:

- **Series packages:** content packages belonging to a chapter of Getting My Life Together.
- **Standalone packages:** independent stories such as Going Blonde, a beauty appointment, a shoot, a city trip or Paris Fashion Week.

A package is essentially a curation of Arcs.

## 6. Arcs

Your nine narrative approaches for individual posts, each with its formats (main formats marked):

**1. The Before**
The build-up and anticipation before you go out.
- GRWM Talking (main)
- Voiceover
- Presence + Text
- Lip Sync Song
- TikTok Trends
- Transition

**2. The Look**
Your fashion identity and what draws people in.
- Outfit Check (main)
- Walk + Text

**3. The Moment**
Being there and capturing the scene as it happens.
- Walk + Text (main)
- TikTok Trends (main)
- Lip Sync Song
- Selfie Reaction
- Presence + Text

**4. The Opinion**
Your point of view and honest judgments on things.
- Presence + Text (main)
- Question + Reply/Reaction
- Walk + Text
- Lip Sync Talk

**5. The Personality**
Your quirks and humor that make you recognizable.
- Lip Sync Talk (main)
- Skits (main)
- Selfie Reaction
- Presence + Text

**6. The Obsession**
Your desires, fantasies and the things you can't stop wanting.
- Presence + Text (main)
- Lip Sync Song (main)
- Voiceover (main)
- Question + Reply/Reaction
- Selfie Reaction + Result

**7. The Edit**
What you choose, why you choose it, and the result.
- Seated Talking (main)
- Half-Body Talking (main)

**8. The Story**
Real experiences with context, progression and a payoff.
- Vlog (main)
- GRWM Talking
- Voiceover
- Selfie Reaction + Result
- Presence + Text

**9. The Editorial**
Creative campaigns and brand collaborations, kept separate.
- Own Shoots (main)

You select and repeat the Arcs that suit each package. You don't need to use all nine.

In the app: run `LH-Studio-lynnhoa-arcs.sql` once in Supabase to set these arcs and formats.

## 7. Base Posts

Recurring individual posts that keep your personality and fashion presence alive between bigger packages.

- Signatures
- Today's Outfit
- New In
- Thoughts
- Opinions
- Trends

They don't need to belong to a Series or Content Package.

## 8. Context, Format & Setup

Supporting production layers, not additional content categories.

| Term | Definition | Examples |
|---|---|---|
| Context | What you're doing within a phase | Occasion, preparation, organisation, maintenance, seasonal change, shoot |
| Format | How the content is presented | Talking, outfit video, vlog, voiceover, editorial |
| Setup | Where/how you film | Talking Spot, Mirror Spot, project location |

Your Talking Spot can be the recognisable home base for Getting My Life Together.

## The complete hierarchy

- **LYNNHOA — Fashion Personality**
  - **Personal Eras:** Beauty · Style · Signature
  - **Main Areas:** Home · Travel · Brand Work
    - **Phases:** what kind of activity or experience is happening?
  - **Content Types**
    - Base Posts
    - Signature Series → Chapters → Content Packages
    - Standalone Content Packages
      - Arcs → Posts (narrative approach → individual content pieces)
      - Context · Format · Setup (how the content is situated and produced)

**The key distinction:** Personal Eras describe the image you're developing. Main Areas and Phases describe what's happening in your life. Series and Packages turn those things into stories. Base Posts keep people connected to you in between.

---

In the app: Planner › @lynnhoa concept shows **Personal Eras | Base | Home | Travel | Work** and the **Arcs** pill. The eras and each area's phases come from `planner.ts` (`PERSONAL_ERAS`, `MAIN_AREAS`) and are empty placeholders until they're filled.
