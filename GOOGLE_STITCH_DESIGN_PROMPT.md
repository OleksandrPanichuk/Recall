# Recall Quiz — complete Google Stitch design brief

## How to use this file

Start with **First prompt** below. Then provide **Master design specification** as the project brief, and generate the screen batches at the end in order. Keep the first approved screens as visual references for every later batch. If a batch loses detail, generate its screens individually using their specifications here.

This staged approach follows the [Stitch team's prompting guide](https://discuss.ai.google.dev/t/stitch-prompt-guide/83844): establish the product and visual direction, then refine specific screens with focused instructions. The precise design decisions below are proposals for Recall Quiz, not rules from Google.

## Examination notes — context for the owner

This brief was prepared from `DESCRIPTION.md`, the current `REWRITE_PLAN.md`, relevant product documentation, shared contracts, API domain rules and application use cases. No files under `apps/web` or `apps/admin`, existing browser screens, or admin implementation files were examined. This is a fresh design direction based on product behavior, not a reskin of either UI. It is a source review, not a runtime audit.

The original description establishes a personal **knowledge gym**: give source material to an external AI assistant, turn it into validated questions through MCP, practice, understand mistakes, and return for scheduled reviews. Current contracts and backend code extend that idea with nested pages, Markdown notes, images, vocabulary, seven question types, page sharing, analytics, authentication and personal tokens.

The description is partly historical: it lists some now-supported question types as future work and describes an older architecture. Current code governs the supported behaviors in this brief. The current rewrite plan concerns backend reorganization; its layout is not a visual design reference.

Proposed product organization: one coherent personal workspace with **Today, Library, Practice, Insights**, and **Settings**. Content management belongs to the same design family as learning. “Studio” below means a proposed authoring workspace; it does not imply a new administrator role or access to other users' data. Infrastructure dashboards, account administration and operational controls are outside this design scope.

The navigation, visual identity, responsive behavior, client-side filters and composition of existing capabilities into screens are design proposals. They should not be mistaken for an audit of currently implemented frontend routes.

## First prompt

```text
Design Recall Quiz, a responsive personal learning workspace: a knowledge gym where people organize notes and quizzes, practice what they learned, review mistakes, and return when questions are due. An external AI assistant creates content through a connection; this product is where people organize, check, and study it.

Create a cohesive, polished product UI with a calm editorial notebook aesthetic. Use warm off-white #F7F8F5, white surfaces, dark ink #172B29, deep teal #146C60 actions, subtle sage #E8F3EE selection, and restrained amber for due work. Use Inter for UI and Source Serif 4 for page titles and reading headings. Avoid gradients, glass effects, oversized marketing heroes, mascots, and decorative dashboard clutter.

First generate three reference screens: desktop Today at 1440×1024, desktop single-choice quiz player at 1440×1024, and mobile quiz player at 390×844. Today should prioritize “12 questions ready to review” with a clear Review due questions action, then a compact three-quiz due list, an existing session to resume, and a small weekly activity section. The player should show one question, four comfortable answer rows, explicit Check answer, progress, Pause, and a quiet “I don’t know” action.

Desktop workspace: 240px sidebar, 64px top bar, 32px page padding, 24px section gaps. The player removes the sidebar and centers a 720px column. Mobile uses 16px page padding and 48px primary controls. Use a 4px spacing scale, 12px card radius, 8px control radius, 44px desktop controls, clear form labels and visible keyboard focus. Include selected and incorrect-answer player variants. Keep answer text readable and never truncate it.

This establishes the reference design for a larger screen family. Preserve these tokens, navigation, component shapes and density when I provide the remaining specifications. Use realistic English interface copy and a little English–Ukrainian learning content. Do not create a marketing landing page.
```

## Master design specification — prompt for Stitch

### 1. Assignment and product character

Act as a senior product designer. Design the complete responsive Recall Quiz experience, including its design system, screen family, interactive states and implementation handoff. Create distinct screens, not one long page containing every feature.

The interface should feel like an excellent personal study notebook: quiet, precise, warm, and useful for sustained reading. Give the next learning action the clearest visual emphasis. Use generous space around questions and tighter, structured spacing in content management. Encourage return without guilt, competitive rankings, exaggerated celebrations, or invented mastery scores.

Primary audience: self-directed adults learning from books, PDFs, articles, transcripts and notes, including language learners and people studying technical subjects. Practice happens on the web and through a Telegram companion. Authoring can happen manually or through a connected external AI assistant. The web experience must stand on its own.

Use English interface copy. Support Unicode, Ukrainian text, accents, phonetic transcription, long titles and code examples. Do not imply that UI language switching is already an account preference.

### 2. Product model and behavior boundaries

| Concept | Meaning and required behavior |
| --- | --- |
| Page | A nested learning space with a title, optional icon, Markdown notes, child pages, contained quizzes and attached quiz references. Use “Page” in user-facing copy. |
| Quiz | A named question collection with language, description, source, source chapters, tags and an optional containing page. |
| Lifecycle | Draft → Published → Archived; drafts can also be archived. Published means available for personal practice, not publicly accessible. No unpublish or restore action is established. |
| Authoring | Draft and published quizzes can be edited. Archived quiz content is read-only. New content requires validation. A quiz with no questions cannot be published. |
| Questions | Single choice, multiple choice, true/false, typed answer, fill in the blank, ordering and matching. No AI-graded essays, audio answers or code execution. |
| Vocabulary | Terms and translations with multiple accepted variants, optional transcription and example; practice in either or both directions. These generate linked questions. |
| Sessions | Full quiz, due questions from one quiz, outstanding mistakes from one quiz, or weak topics from one quiz. One unfinished session at a time; pause, resume, finish early and abandon are different actions. |
| Scheduling | Per-question review schedules, grouped by quiz in the due list. Full and due-only sessions update schedules on completion; mistakes/weak-topic practice does not. |
| Grading | Correct, incorrect, skipped/revealed and partial-credit results must remain distinguishable. Use returned scores; do not assume score equals an integer count of fully correct questions. |
| Exam mode | Hide correctness, answers, explanations, hints, recall ratings and running score until completion. “I don’t know” advances without revealing an answer. No countdown or revisiting submitted answers is required. |
| Weak topics | A named topic with at least 3 recorded answers and accuracy below 70%. Insufficient evidence is distinct from poor performance. |
| Sharing | Public read-only access to one page's title, icon, notes and referenced images. Does not grant access to its quizzes, children, private navigation, attempt history or account. Link rotation and revocation are supported. |
| History | Inspect attempt answers and page revisions. Revision inspection does not imply a restore API. |
| Integrations | External AI content creation through MCP, personal access token issue/list/revoke, OAuth consent and Telegram login links. No embedded general-purpose AI chat. |

Do not invent a PDF upload-to-AI pipeline inside the app. Source books and PDFs are supplied to the external assistant. Image uploads inside notes are a separate supported capability. Do not invent social feeds, teams, billing, leaderboards, public quiz marketplaces, editable notification schedules, arbitrary cross-quiz practice sessions or auto-generated explanations during a quiz.

### 3. Visual system: exact tokens

Use semantic variables consistently. All sizes below are CSS pixels at default zoom. Dimensions are minimums or maximum widths where content must grow; do not clip text to enforce a fixed screenshot height.

#### Color

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `canvas` | `#F7F8F5` | `#111B19` | App background |
| `surface` | `#FFFFFF` | `#192622` | Cards, fields, menus |
| `surface-subtle` | `#EFF2ED` | `#22322D` | Secondary panels and table headers |
| `text-primary` | `#172B29` | `#EDF5F0` | Main text |
| `text-secondary` | `#52645F` | `#B6C8BF` | Descriptions and metadata |
| `text-muted` | `#5E6F68` | `#9FB3A9` | Supporting labels; never hide essential copy |
| `border-subtle` | `#DCE3DD` | `#354B40` | Decorative separators |
| `border-control` | `#81938A` | `#839B8D` | Visible input and unchecked selection boundaries |
| `primary` | `#146C60` | `#88D7B8` | Main action and selected indicator |
| `primary-hover` | `#10584E` | `#A0E4CA` | Action hover |
| `primary-pressed` | `#0B473F` | `#70C6A6` | Action pressed |
| `on-primary` | `#FFFFFF` | `#10251D` | Text/icons on primary fill |
| `selection` | `#E8F3EE` | `#243E33` | Selected row background |
| `success` | `#236844` | `#95D7AC` | Correct result |
| `success-bg` | `#EDF7EF` | `#20382A` | Correct result panel |
| `warning` | `#86500B` | `#F1C478` | Due/partial-credit labels |
| `warning-bg` | `#FFF4DB` | `#3B301E` | Warning panel |
| `danger` | `#B33E42` | `#FFB2B4` | Error/destructive action |
| `danger-bg` | `#FDEEF0` | `#3A2428` | Error panel |
| `info` | `#345F9C` | `#A7C9FA` | Informational labels and chart series |
| `info-bg` | `#EEF4FD` | `#203046` | Information panel |
| `focus` | `#146C60` | `#88D7B8` | 2px focus outline with 2px offset |

Dark mode is a proposed presentation feature with local/system preference, not a claimed account setting. Design all light screens first and at least Today, player, editor and Settings in dark mode. Preserve hierarchy; do not mechanically invert images or colors. Verify contrast in the final artifact: 4.5:1 for normal text, 3:1 for large text and essential UI boundaries. Adjust a failing pair consistently across tokens rather than using one-off fixes.

Use white/teal action contrast, neutral text, and icons plus labels to communicate state. A selected answer is not yet a correct answer. Reserve success/error fills for graded feedback. Amber means attention or partial credit; never use it as unreadable yellow text on white.

#### Type, icons and imagery

| Role | Font | Desktop size / line height | Mobile size / line height | Weight |
| --- | --- | --- | --- | --- |
| Page title | Source Serif 4 | 32 / 40 | 28 / 36 | 600 |
| Reading heading | Source Serif 4 | 28 / 36 | 24 / 32 | 600 |
| Section heading | Inter | 20 / 28 | 20 / 28 | 600 |
| Quiz question | Inter | 24 / 34 | 22 / 32 | 600 |
| Body and answer text | Inter | 16 / 24 | 16 / 24 | 400 |
| Navigation, button, field label | Inter | 14 / 20 | 14 / 20 | 500–600 |
| Supporting text | Inter | 13 / 20 | 13 / 20 | 400 |
| Small metadata | Inter | 12 / 16 | 12 / 16 | 500 |
| Metric | Inter, tabular numerals | 32 / 40 | 28 / 36 | 600 |
| Code/token | System monospace | 14 / 22 | 14 / 22 | 400 |

Fallbacks: serif → Georgia; sans → system-ui. Body text uses normal letter spacing; large headings may use -0.02em. Inputs remain 16px on mobile. No all-caps paragraphs. Use one consistent outline icon family, 20px with approximately 1.75px stroke; 16px for metadata, 24px for primary navigation. Use a simple original book/recall-loop mark beside “Recall Quiz.” Do not depend on photography or generated artwork. Small empty-state line drawings are optional. User page icons and actual source images are allowed.

#### Spacing, borders and elevation

Spacing scale: **4, 8, 12, 16, 20, 24, 32, 40, 48, 64**. Use layout gaps, not stacked margins that accidentally double spacing.

| Relationship | Desktop | Mobile |
| --- | --- | --- |
| Page outer padding | 32 | 16 |
| Title to description | 8 | 8 |
| Page header to first section | 32 | 24 |
| Section-to-section | 24 | 24 |
| Major reading sections | 40 | 32 |
| Card padding | 24 | 16 |
| Form field group gap | 20 | 20 |
| Label to input | 8 | 8 |
| Input to helper/error | 4 | 4 |
| Related controls | 8 | 8 |
| Toolbar to results | 16 | 16 |
| Answer row gap | 12 | 12 |
| Question to answer group | 24 | 24 |
| Dialog padding | 24 | 20 |

Radius: fields/buttons 8; cards 12; dialogs 16; badges 999. Borders: 1px, with selected answer using a 2px inset treatment that does not shift layout. Most cards use a border and no shadow. Raised menus: `0 8px 24px rgba(23,43,41,0.10)`. Dialogs: `0 16px 48px rgba(23,43,41,0.18)`. Modal scrim: `rgba(12,24,20,0.42)`. Do not add a card around every heading or paragraph.

### 4. Responsive layout and navigation

Reference frames: 1440×1024 desktop, 1024×768 compact landscape, 768×1024 tablet, 390×844 mobile. Also check 320px width and 200% zoom for reflow. Heights are viewports, not fixed content heights.

At 1200px and above: fixed 240px sidebar; remaining workspace has a 64px top bar. Center the main content with 32px outer padding and 1200px maximum content width. Use a 12-column grid with 24px gutters where useful. Reading content caps at 720px; regular forms at 640px. Two-column dashboard: flexible main column plus 320px secondary column. Do not squeeze these two columns when the available space is insufficient.

At 768–1199px: use a 72px navigation rail with labeled tooltips and a menu button for the page tree. Use 24px content padding. Stack secondary dashboard panels below the primary column. Authoring inspector becomes a drawer. At widths below 768px: 56px header, 16px padding, a full-width single column, and a 64px bottom navigation bar plus safe-area inset. Four destinations: Today, Library, Practice, Insights. Settings and Connections are accessible from the profile/menu sheet. Labels remain visible with icons.

Sidebar order: brand; primary destinations; “Pages” with expandable nested tree and add button; Settings and account at bottom. Indent child pages 16px per level, allow scrolling and collapse deep branches. Use breadcrumbs and an explicit Move dialog so deep trees never depend solely on dragging. Active destination has sage fill and a teal indicator. Top bar contains breadcrumbs and context actions; no duplicate full-size page title.

Library-local search filters loaded quiz metadata; page search can use the page search capability. Do not imply global full-text search across all questions and attachments. On small screens search opens a full-width field/sheet.

The quiz player uses a separate focus layout: no sidebar or bottom app navigation. A 64px desktop/56px mobile bar contains exit/pause, quiz title and progress. Center a 720px main column. Desktop content starts 40px below the bar; mobile starts 24px below it. Answer controls are full width. Footer actions remain reachable without covering the last option; add bottom content padding equal to any sticky footer plus 16px and safe-area inset. When the mobile keyboard opens, keep the input visible and let actions flow above the keyboard or into normal document flow. Never fix the question to a height that clips long content.

### 5. Component library and interaction states

Show a component reference board with actual examples of every state below.

| Component | Geometry and behavior |
| --- | --- |
| Primary button | Minimum 44px high desktop, 48px mobile; 16px horizontal padding; icon gap 8px. Teal fill. Show default, hover, pressed, focus, disabled and loading; preserve width during loading. |
| Secondary / quiet / destructive button | Same geometry. Secondary surface fill with control border; quiet is text with subtle hover; destructive uses danger and explicit action copy. No unlabeled destructive icons. |
| Icon button | At least 44×44 hit area; 20px icon; visible tooltip and accessible label. |
| Text input/select | 44px desktop, 48px mobile minimum; 12px horizontal padding; visible label above; control border. Show empty, populated, focus, invalid, disabled and read-only. Placeholders illustrate values and never replace labels. |
| Textarea | 120px minimum height, 12px padding, resize/grow with content. Show character counter when a real limit applies. |
| Checkbox/radio | 20px visual control in at least a 44px label row. Checked, mixed where applicable, focus and disabled states. Whole label is clickable. |
| Toggle | 40×24 visual switch in a 44px minimum row; label and description remain outside it. Keyboard-operable. |
| Segmented control/tabs | 44px touch targets, 4px group inset; text labels, visible selected indicator. Tabs may scroll horizontally; do not shrink text to fit. |
| Answer row | Minimum 64px high, 16px padding, 12px internal gap; wrap text. Render unselected, hover, selected, submitting, correct, wrong selection, missed correct answer and read-only. |
| Badge | 24px minimum height, 8px horizontal padding; 12/16 text. Draft, Published, Archived, Due, Overdue, Inherited and Custom use labels, not color alone. |
| Table/list | Header minimum 44px; rows minimum 56px; cells 12px vertical / 16px horizontal. Use row separators. Mobile becomes labeled stacked rows with retained actions. |
| Menu/popover | Minimum 220px wide, 8px padding, 44px action rows; anchor within viewport. Long lists scroll. Escape closes and restores focus. |
| Dialog/sheet | Desktop confirm 440px max; normal form 560px max. Width no more than viewport minus 32px. Mobile bottom sheet for short actions, full-screen sheet for long forms. Scroll body independently when necessary. |
| Toast/banner | 16px padding, icon, concise text and optional Retry. Success toast may dismiss after 4 seconds; important errors remain visible inline. Mobile toast sits above navigation. |
| Progress | 6px bar with accompanying “Question 4 of 20” text. Distinguish question position from answered count. No score-coded progress during exams. |
| Skeleton/empty state | Match final layout to reduce movement. Empty states explain what is missing and give one relevant next step. |

Tooltips supplement labels and must work on keyboard focus. Menus and dialogs have complete focus behavior. Enter submits an appropriate form; Shift+Enter inserts a newline in multiline editing. Never bind numeric quiz shortcuts while typing. Ordering and matching must be usable without dragging.

Animate color/opacity over 120–160ms and drawers over 180–220ms. Respect reduced motion. Do not animate the position of answer options after selection. Loading must not advance a quiz before the server confirms the answer. Preserve entered values on recoverable failures.

### 6. Screen family

#### S01–S03 — Authentication and first use

**S01 Sign in / create account.** Use a restrained 440px form area, brand and “Make what you learn stick.” Email and password; create account also has name. Password visibility toggle and minimum 10-character helper for registration. Primary action, switch between sign-in/create account, forgot password link. An alternative Telegram area explains that a short-lived sign-in link is obtained from the bot; do not fabricate a Telegram user-ID input or guaranteed identity-linking flow. No unconfigured Google/Apple sign-in buttons.

**S02 Password recovery and login-link states.** Email form, neutral sent confirmation, new password form, expired/invalid/reset-used link state, retryable service failure and rate-limit state. Link confirmation flows should not expose tokens in decorative UI. Session lookup outage shows “We couldn’t load your session” with Retry, rather than pretending the user signed out.

**S03 First-use workspace.** Empty Today explains the loop in three short steps: add learning material through your assistant or create a quiz, review content, practice regularly. Actions “Create a quiz” and “Connect an assistant.” A secondary “Create a page” organizes notes. No fake stats or mandatory tutorial carousel. This screen becomes the populated Today once content exists.

#### S04 — Today

Heading “Ready for a little practice?” and a short current-day label. Primary section “12 questions ready to review,” a Review due questions action leading to the due queue, and compact due rows grouped by quiz. Keep the primary review CTA above the fold at 390px. If a session is unfinished, elevate its “Continue session” card above starting new work.

Below: three compact metrics for study streak, answers and accuracy with an explicit shared reporting period; small weekly activity bars with labels; recently updated quizzes. Use actual exposed/derived values. Do not imply an API for last-opened pages, minutes studied or predicted mastery. Show a friendly “You’re up to date” variant with no due questions and a Library action.

#### S05 — Library and page search

Header “Library,” search, “Create” menu for Page/Quiz. Pages have a compact icon, name and count. Quiz rows/cards show title, language when available, question count, status and updated date. Filters: All, Published, Drafts, Archived; simple local title/tag/language filtering where metadata is available. Do not promise server-side search over unavailable data.

Prefer a readable list as default, not a mosaic of giant tiles. Row opens detail; overflow menu provides meaningful actions. Distinguish “Move quiz” from attaching it to another page. Include no-results with clear filters, empty library and long multi-line title variants. Search pages uses title and note excerpts and opens the matching page.

#### S06–S08 — Learning page, notes and sharing

**S06 Page detail.** Breadcrumb, editable page title and optional icon. Header actions Edit notes, Add and Share; overflow Rename, Move, Reorder, History and Delete. Reading column contains Markdown headings, paragraphs, lists, quote, code, link, table and image. Under notes, display child pages, contained quizzes and attached quiz references as separate labeled sections. Attaching references does not duplicate questions or results.

**S07 Notes editor and revisions.** Edit/Preview tabs, visible Markdown affordances, optional split preview on wide screens, explicit Save and Cancel, unsaved-change warning. Use a clean writing surface with 16/26 body text; do not build a full collaborative block editor. Image insertion supports PNG, JPEG, GIF, WebP, AVIF and SVG up to 8 MiB, with uploading/success/failure and meaningful alt-text entry. This is an image attachment flow, not PDF ingestion. History drawer lists revision title, time and “You” or “AI assistant” author; selecting opens a read-only revision. No Restore button without a new requirement.

**S08 Sharing and public reader.** Share dialog explains “Anyone with this link can read this page’s notes.” Copy link, rotate link with old-link warning, and stop sharing. Design copied, updating and failed states. Public reader shows brand, title, icon, updated date and notes with referenced images, maximum 720px width; no account sidebar, child-page tree, quiz list or private statistics. Unavailable/revoked link has a neutral explanation without leaking the private page title.

Deletion of a page containing children or quizzes is blocked with the actual reason and move-content guidance. Show deletion confirmation only when allowed. Removing an attached reference uses “Detach,” not “Delete quiz.”

#### S09–S12 — Quiz detail and content studio

**S09 Quiz detail.** Breadcrumb, title, language, status, description, source/chapter text and tags. Tabs Overview, Questions, Vocabulary when present, Results, Settings. Published quiz: “Start quiz,” with alternative due/mistakes/weak-topics actions when available. Draft: “Review and publish.” Archived: read-only content and retained results; no Start or Restore. Show global/inherited versus custom settings summary. Source references without valid URLs remain plain text.

**S10 Create/edit quiz.** Form fields: title required (200 characters), language required (2–20 characters), description (2000), source (300), source chapters (300), tags (up to 20, 40 characters each), and page picker. Use a two-column form only for short related fields; title/description span full width. Save creates a draft. Editing existing metadata and moving the quiz are distinct operations even if the UX presents them nearby. Show validation adjacent to the field and focus the first failure. Do not clear values after failure.

**S11 Question manager and editor.** Desktop question list alongside a 640–720px editor when space permits; mobile separate list/editor screens. Each row shows prompt, type, topic, difficulty and recorded answer count. Actions Add question, Edit and allowed Delete. Filters operate on the loaded quiz. Do not add unsupported question reordering or bulk deletion. Preview visually differs from a live attempt and does not create learning history.

The editor uses readable question-type labels. Common fields: prompt required (1000), difficulty Easy/Medium/Hard, topic (100), explanation (1000), source reference (300), hint (300). Type-specific controls:

| Type | Authoring controls |
| --- | --- |
| Single choice | 2–10 option text rows, each up to 300 characters; exactly one correct radio selection. |
| Multiple choice | 2–10 options; one or more correct checkboxes. |
| True/false | Exactly two options; one correct choice. |
| Typed answer | 1–10 accepted text answers, up to 300 characters each. |
| Fill in the blank | Prompt containing `___`; accepted answers as above; preview the blank in context. |
| Ordering | 2–10 items entered in correct order; drag handle plus accessible Move up/down controls. |
| Matching | 2–5 left/right pairs with distinct field labels; up to 300 characters per side. |

The type is chosen when creating a question; editing does not offer unsupported type conversion. Show duplicate-content and malformed-answer errors. Deletion is blocked for questions with recorded answers and for the last remaining question. Explain why and offer Edit where allowed. Published content remains editable; do not incorrectly mark every published editor read-only.

**S12 Vocabulary.** A focused list with term variants, translation variants, transcription, example and generated-question count. Add/Edit form uses separate term and translation chip groups, optional transcription/example, and direction selection when adding: term → translation, translation → term, or both. Maximum 10 variants per side, 200 characters per variant; transcription 200, example 500. Display common topic/difficulty when adding. Saving an edit rebuilds linked questions; show the returned change summary without promising that old answered questions were deleted. No audio-playback control unless audio support is separately implemented.

Publishing uses a review dialog with title, question count and content warnings; explain that publishing makes the quiz available for personal practice. Structural validation is mandatory; factual quality still requires human/assistant review. Optional missing explanations can be warnings, not fabricated mandatory backend rules. Archiving confirms that learning history remains and active practice is hidden; no permanent quiz-delete action.

#### S13–S15 — Practice selection and due work

**S13 Practice hub.** Three clear destinations: Due reviews, Repeat mistakes, Weak topics. Full quizzes are accessible through Library. For mistakes and weak topics, select a quiz first. Show one existing-session banner with Continue and an explicit abandon flow before starting a different session.

**S14 Due queue.** Group due questions by quiz, with title, count, overdue days and “Review 5 questions.” Sort most overdue first. The aggregate CTA leads here; it does not start an unsupported mixed-quiz session. Include empty/up-to-date, loading and retry states. Place a modest upcoming-review forecast below the actionable list.

**S15 Practice setup.** Selected quiz, chosen mode, available question count, and relevant topics. Explain “Extra practice won’t change your review schedule” for mistakes and weak-topic modes. “No outstanding mistakes” is a success/empty state. For weak topics without enough answers, explain “Complete more questions to find topics that need practice.” Do not offer arbitrary session length, topic picking or a timed exam unless backed by a new requirement.

#### S16–S22 — All seven quiz player types

Use one focus shell and consistent progress/action placement. Show question topic/difficulty quietly when available. Prompt and answer group dominate. “Check answer” submits a complete selection; do not immediately submit upon tapping a radio row. “I don’t know” records a skipped/revealed answer; it does not silently discard the question. A hint link appears only when available in learning mode. Input selection does not reveal correctness.

| Screen | Interaction |
| --- | --- |
| S16 Single choice | Four example radio rows; Check answer enabled after one selection. |
| S17 Multiple choice | Checkbox rows and “Select all answers that apply.” Do not disclose the number of correct answers. |
| S18 True/false | Two clearly labeled full-width selectable rows, with the same submission model. |
| S19 Typed answer | Visible label, autofocus only when it will not disrupt mobile layout, text field, submit action; preserve diacritics and Unicode. |
| S20 Fill in the blank | Sentence with a clearly marked blank and an associated labeled answer input; never rely on an unlabeled underline alone. |
| S21 Ordering | Numbered movable item rows; drag on desktop/touch plus Move up/down alternatives. Submit the complete order. |
| S22 Matching | Two labeled columns on desktop with selected-pair markers. Mobile uses one left item and a right-choice control per row. Support undoing a pairing before submission and prohibit reusing a right item. No drag-only puzzle. |

For all seven, create an unanswered state and a submitted state; selected/error variants can share component reference frames. Long answers wrap; code blocks scroll within themselves, not the page. Do not permit changing a recorded answer as though it were still a local selection.

#### S23–S26 — Feedback, exam, interruption and results

**S23 Learning feedback.** Selected and correct answers stay visible with text labels/icons. Panel shows Correct, Not quite, Partly correct, or Answer revealed; explanation and source reference when present; Next question or Finish quiz on the final answer. Show “2 of 3 points” only when returned credit supports it. Near-miss text can say “Close — expected ‘accommodate’,” but do not turn a near miss into a correct answer. An unanswered early-finish question differs from an explicit skip.

Only when the result is eligible for recall rating, show Hard, Good, Easy. This applies to correct answers in full-mode FSRS sessions. Wrong answers are scheduled as Again automatically. Do not display a universal four-button flashcard rating row. Hide ratings in exam mode and do not invent exact next-review dates in the feedback response.

**S24 Exam player.** Same seven input types, neutral submitted/advance transition, no correctness panel, hints, answer reveal, running score, colored correctness progress or recall rating. After a successful submission advance to the next question; after the final one show an explicit Finish action if completion has not yet been saved. “I don’t know” skips without revealing. Full review becomes available after completion. No time limit, question jumping or answer editing is implied.

**S25 Pause / finish early / abandon.** Pause saves a resumable session. Resume returns to the saved position. Finish early confirms the remaining unanswered count and saves a result. Abandon discards the unfinished attempt and is a separate destructive confirmation. Copy must state which outcome applies. Include paused, existing-session conflict, answer-submit failure and finish-save failure. No premature “Saved” state.

**S26 Results and attempt review.** Heading “Session complete,” returned percentage and clearly named earned/possible points where appropriate, unanswered count when relevant, actions Review answers, Repeat mistakes and Back to quiz. Do not fabricate elapsed time if it is unavailable. Review lists every question in actual attempt order with the user's answer, correct answer, explanation where available and distinct Correct/Incorrect/Partial/Skipped/Unanswered labels. Provide local filters. Preserve the difference between “17 of 20 fully correct” and a partial-credit score; label whichever is actually being shown.

#### S27–S28 — Insights and quiz statistics

**S27 Insights.** Period selector, total answers, accuracy and streak. Activity chart with labeled dates and accessible values; next-review forecast as a separate chart, clearly distinguished from completed activity. Hardest questions list shows prompt, quiz, answer count, accuracy and lapses; prefer “Needs more practice” over the internal term “leech.” Charts should be compact and explanatory, with a tabular equivalent. No smoothed invented data or unlabeled decorative rings. Empty history says “Your progress starts with your first session,” not 0% mastery.

**S28 Quiz statistics.** Quiz-specific accuracy, attempt list, first-to-latest change in percentage points and topic accuracy rows with sample counts. “Not enough data” for weak-topic classification below the threshold. Clicking an attempt opens its review. Mistake and weak-topic actions remain scoped to this quiz. Improvement of 60% → 85% is +25 percentage points, not “25% more knowledge.”

#### S29–S31 — Settings and integrations

**S29 Study settings.** Global defaults page and quiz-specific variant. A prominent source label says Built-in defaults, Inherited from global, or Custom for this quiz. Quiz variant has “Use global settings”; inheriting must not silently persist a copy as a custom override. Explicit Save changes and Cancel; show pending/error/saved states.

Scheduling method cards: Fixed intervals (Ladder) and Adaptive (FSRS), each with a plain-language description. Fixed defaults: 1, 3, 7, 14, 30 days; maximum interval 30 days; maximum repetitions 10. Custom intervals allow 1–12 positive whole-day values in the entered order; maximum interval ceiling is 1–365 days and repetition limit 1–100. Validate against actual backend rules. FSRS desired retention defaults to 90%, allowed 70–98%; use an accessible slider with synchronized numeric input and label. Show only relevant controls for the selected method; do not promise fixed FSRS dates. Explain repetition limits in plain language.

Separate switches: Shuffle answers, Shuffle questions, Exam mode. Built-in values are off. State that question-order changes apply to the next attempt; avoid claiming all settings are frozen at session start. Appearance Light/Dark/System is a proposed local presentation preference. Do not add notification-time controls because scheduled reminder configuration is not exposed as a user preference here.

**S30 Connections and tokens.** An assistant setup guide explains: connect an external assistant, give it source material, ask for a quiz, review the draft, publish and practice. Provide copyable example instructions, not a large conversational AI composer. Example: “Create 20 questions from this chapter. Include explanations, topics and source references. Save a draft in my Recall Quiz library for review.” Use a deployment-provided MCP endpoint placeholder and no fabricated live credentials or unsupported connection-health indicator.

Token list: name, scope labels, created time, last used, expiry and revoke action. Create token dialog: name up to 80 characters and optional expiry in days, 1–3650. Show newly created secret once in a dedicated copy state with “Save this token now. You won’t be able to view it again.” Later rows never reveal the secret. Revoke confirmation and successful/failed states. No automatic clipboard copy or fake stored credentials.

**S31 Connection authorization.** Signed-in OAuth consent screen with requesting client identity and the actual requested scope descriptions, Allow and Cancel. Explain what access is being granted; do not imply a read-only grant when content writes are requested. Include sign-in-required, expired authorization and success/return-to-client states. Telegram companion help describes available login/practice access without promising a generic new-account linking feature.

### 7. Cross-screen states and realistic sample content

Use coherent fixtures rather than random metrics. Demonstration values are illustrative, not real user data.

- Page tree: Computer Science → Distributed Systems; English → Everyday Vocabulary; Learning Methods.
- Published quiz: “Distributed Systems — Replication,” English, 20 questions, source “Study notes,” chapters “Replication and consistency,” tags “databases” and “systems.”
- Other quizzes: “Everyday English — Work and Study,” 24 questions, and “Learning Strategies,” 16 questions.
- Due queue: Replication 5 due, Everyday English 4 due, Learning Strategies 3 due = 12 questions. Show overdue days per row rather than inventing a countdown.
- Weekly fixture: 80 answered, 64 correct = 80% accuracy; four consecutive study days. If chart daily values are shown, they must sum to these totals and support the streak.
- Separate completed-session fixture: 17/20 fully correct single-choice questions = 85%. If demonstrating partial credit, use a separately labeled example with mathematically consistent returned points.
- Question: “What is the main benefit of replication?” Options: Reduce storage usage; Improve availability; Replace database indexes; Eliminate transactions. Correct: Improve availability. Explanation: “Keeping copies on several nodes can keep data available when one node fails.” Source: “Replication notes, section 2.”
- Vocabulary: “to retain” → “зберігати,” “утримувати”; example “Regular practice helps you retain new vocabulary.”
- Matching fixture: term → definition; ordering fixture: Read → Recall → Check → Repeat. No irrelevant stock project-management tasks.

Across the screen family explicitly show: loading, empty, no matches, validation errors, permission/session expiry, service unavailable, unsaved changes, submitting, saved, archived, stale/already-submitted answer, missing optional explanation, long text and narrow viewport. On network failure retain current answers and notes and offer Retry. Do not claim offline persistence or sync support. Auth failures and API outages need different messages.

### 8. Accessibility and implementation handoff

Design for semantic headings, real labels, keyboard traversal, visible focus and screen-reader feedback. Use radio groups for single choice and checkboxes for multiple choice. Announce submission results without moving focus unexpectedly; move focus to the next question heading after explicit advancement. Provide a skip link in the workspace shell and accessible dialog titles. Charts need text/data equivalents. Selection, correctness and validation always have a non-color indicator.

If producing frontend code, extract semantic CSS variables and reusable primitives: Button, Field, TextInput, Textarea, Select, Checkbox, Radio, Switch, Tabs, Badge, Dialog, Sheet, Menu, Toast, EmptyState, AppShell, FocusShell, QuizRow, AnswerRow and FeedbackPanel. Use Grid/Flex, `minmax(0, 1fr)`, sensible max-widths and content-driven heights. Do not absolutely position the page into a screenshot. Put spacing in shared tokens and component rules.

Use mock data and explicit callback boundaries in a generated prototype. Clearly separate mock transitions from working integration. Actual implementation should call the established authenticated API contracts; browser/server UI code does not access the database or accept a caller-selected owner ID. Do not let generated styling work rewrite authentication, grading, scheduling or API contracts. Never use untrusted notes as raw HTML without a safe rendering boundary.

Deliver a component/token board, named screen frames and variants, desktop/mobile counterparts, key dark examples, and linked paths for onboarding → library → quiz → feedback → result; page → edit → share; assistant setup → draft → publish; due queue → review; insights → attempt review. Include a handoff checklist mapping each screen to its available states. Treat design generation as incomplete if essential states or question types are missing.

### 9. Acceptance checklist

- Every S01–S31 screen specification has a named design frame or clearly named variant; no feature is represented only by a decorative navigation item.
- All seven player types and their authoring fields exist, with mobile and keyboard alternatives for matching and ordering.
- Exact colors, type roles, radii, borders, paddings, margins/gaps, control sizes and breakpoint rules are reused across screens.
- Mobile primary actions remain visible and reachable; keyboard, sheets, safe areas and bottom navigation never cover content.
- Normal learning, exam, partial credit, reveal/skip and early finish remain distinct.
- Draft, Published and Archived actions match their allowed behavior. Publish does not imply public access.
- Page sharing exposes only supported public content. Tokens are shown once and secrets never appear in sample screenshots as real values.
- Due questions are grouped by quiz; extra practice does not promise schedule advancement; recall ratings are conditional.
- Charts, counts, percentages and example results reconcile; missing data is not shown as failure or zero mastery.
- Focus, contrast, reflow and text wrapping are demonstrated, not merely mentioned.
- No added billing, team roles, social features, PDF-to-AI uploader, unsupported grading, countdown timer or generic AI chat.

## Follow-up prompts — generate in manageable batches

Use these after the reference screens and master specification. Attach/paste the relevant S-sections when the tool does not retain the complete brief. These batches are an ordering suggestion, not a claim about Stitch generation limits.

### Batch A — Workspace and identity

```text
Using the approved Recall Quiz reference screens and unchanged design tokens, generate S01–S05: sign-in/create account, recovery/link states, first-use workspace, populated Today, and Library/search. Include 1440px desktop and 390px mobile. Reuse the exact navigation, typography, spacing and components from the reference. Include empty, loading and form-error variants. Keep Today focused on the next study action. Do not redesign the visual identity.
```

### Batch B — Notes and sharing

```text
Continue the same Recall Quiz design system with S06–S08: nested learning page, notes editor/preview, read-only revision drawer, share dialog and public reader. Show desktop/mobile, long Markdown content, image upload error, unsaved changes, blocked page deletion and revoked share link. The public reader exposes only the shared page's notes and referenced images. Keep the writing surface spacious and the actions restrained.
```

### Batch C — Content studio

```text
Generate S09–S12 in the same system: quiz detail, create/edit metadata, question manager/editor and vocabulary management. Include Draft, Published and Archived variants. Render the editor for all seven question types from the brief, not just multiple choice. Include publication validation, protected deletion, duplicate content, token-like text wrapping in sources and mobile full-screen editors. Preserve all field limits and the difference between moving and attaching a quiz.
```

### Batch D — Practice and question interactions

```text
Generate S13–S22: practice hub, per-quiz due queue, practice setup and the seven question players. Keep the approved focus shell and answer-row geometry. Show desktop/mobile, selected and submitting states. Matching and ordering need keyboard/tap alternatives to drag. Due reviews, mistakes and weak topics stay scoped to a selected quiz. Do not replace typed-answer or fill-in-the-blank with choice questions.
```

### Batch E — Feedback, exams and progress

```text
Generate S23–S28 using the approved components: learning feedback, exam player, pause/finish/abandon dialogs, results and full attempt review, Insights and quiz statistics. Include partial credit, near miss, revealed answer, unanswered early finish, no data and failed save. Exam screens must not leak score or answers before completion. Recall rating appears only when eligible. Use coherent chart numbers and correctly label percentage-point improvement.
```

### Batch F — Settings and connections

```text
Generate S29–S31: global and inherited/custom quiz settings; Ladder and FSRS variants; assistant connection guide; personal token list/create/show-once/revoke; and OAuth consent/link error states. Reuse the same form components. No editable reminder schedule, fabricated live connection state or general AI chat. Include 390px layouts and dark variants of Today, player, notes editor and Settings.
```

### Final refinement prompt

```text
Audit all Recall Quiz frames against the supplied S01–S31 specifications and acceptance checklist. Create a compact coverage board listing each screen and its missing variants, then fill the omissions. Verify exact spacing, margins, paddings, typography, semantic colors, borders, radii, inputs and button states. Check mobile keyboard/safe-area behavior, long Ukrainian text, 320px reflow and 200% zoom. Preserve the approved identity. Connect the main study and authoring journeys; do not add new product capabilities to fill visual gaps.
```

## Source map for implementation review

These are evidence pointers, not frontend design references. Resolve them in this checkout; ongoing backend reorganization can move paths.

| Brief area | Sources examined |
| --- | --- |
| Product purpose and source-to-practice loop | `DESCRIPTION.md`; product and practice sections of `README.md` |
| Current architectural scope | `REWRITE_PLAN.md` |
| Fields, actions, result shapes, pages, history, analytics and tokens | `packages/contracts/src/bot.ts`, `authoring.ts`, `questions.ts`, `practice.ts` |
| Quiz lifecycle and editing restrictions | `apps/api/src/domain/quiz-set/quiz-set.ts`; `create-question.validation.ts`; `application/use-cases/quiz-sets/delete-question.ts`, `update-question.ts` |
| Practice selection and thresholds | `apps/api/src/application/use-cases/practice/start-practice-session.ts`; `packages/contracts/src/practice.ts` |
| Scheduling and conditional recall | `apps/api/src/application/use-cases/attempts/finish-quiz-attempt.ts`, `answer-question.ts`, `rate-recall.ts`; `domain/repetition/repetition.constants.ts`; `domain/settings/quiz-settings.ts` |
| Public page scope and deletion guard | `apps/api/src/application/use-cases/sharing/read-shared-page.ts`; `application/use-cases/folders/delete-folder.ts` |
| Image types and size | `apps/api/src/modules/app/uploads.constants.ts` — API constants only |
| Authentication and password policy | `apps/api/src/modules/auth/build-auth.ts`, `build-auth.constants.ts` |

This deliverable specifies a proposed design and generation prompts. It does not claim that Stitch has generated the frames, that the existing UI has been tested, or that generated designs have passed a contrast or usability audit.
