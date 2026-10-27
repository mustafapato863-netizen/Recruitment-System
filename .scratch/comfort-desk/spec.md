# Comfort desk

**Status:** ready-for-agent

**Source:** the Comfort plan in `docs/odoo-style-redesign-plan.md`, agreed 27 October 2026.

## Problem Statement

A recruiter and a hiring manager spend the day on My Work, Team work, Open jobs, the pipeline, and the file. The desk name is printed twice. A short list sits on a large empty gradient. A waiting row's next action looks the same as its other destination. On a file the header says "Applications" while the page names the candidate. From 1280px to 1359px the pipeline still scrolls sideways.

## Solution

A quiet operational glass desk. The header is the only desk name. A short list fills one glass surface. Each of Overdue, Today, and Waiting has one filled next action. The file header shows the candidate's name. The pipeline is five columns from 1280px. Gates, permissions, seats, and drawer links stay.

## User Stories

1. As a recruiter on My Work, I want the header to be the only "My Work", so the page does not repeat the desk name.
2. As a recruiter on My Work, I want the subtitle to lead the page, so I can see what this list is for.
3. As a recruiter on the Next actions tab, I want no second heading under the tab, so the tab is the name of the list.
4. As a recruiter, I want the All tasks control to stay, so I can still see every bucket together.
5. As a recruiter with one task or a short list, I want the rows at the top of one glass surface that fills the rest of the viewport, the same surface an empty tab already uses.
6. As a recruiter, I want the space under a short list to stay quiet, so a second "all caught up" message does not appear.
7. As a recruiter on a tab with no rows, I want that tab to keep its one empty card.
8. As a recruiter on All tasks, I want one filled button in Overdue, one in Today, and one in Waiting: the next action on the first row of that bucket.
9. As a recruiter who filters to one bucket, I want the first row of that bucket to carry the filled next action.
10. As a recruiter, I want every other destination on those rows to stay a text button.
11. As a recruiter, I want a destination the gate refuses to stay disabled, with the reason.
12. As a recruiter, I want a waiting row to keep every destination it already has, and to keep naming who it waits on.
13. As a recruiter, I want Upcoming interviews and Joining soon to keep the row actions they have now.
14. As a recruiter using the keyboard, I want View open jobs, Notifications, Show today, and Show tomorrow to come before the section tabs.
15. As a hiring manager on Team work, I want the header to be the only "Team work", and the subtitle to lead.
16. As a hiring manager with a short roster, I want that roster to fill the viewport the same way My Work does.
17. As a hiring manager with nothing waiting, I want "Nothing is waiting on your decision." to stay one line inside Waiting on you.
18. As a recruiter on Open jobs, I want the header to be the only "Open jobs", and the existing subtitle to lead.
19. As a recruiter on Open jobs, I want the filters and the job rows to stay as they are.
20. As a recruiter on a pipeline, I want the header to stay "Open jobs" and the page heading to stay the job name.
21. As a recruiter on a desktop at 1280px and wider, I want the pipeline in five columns, so the board does not scroll sideways.
22. As a recruiter on a tablet from 768px to 1279px, I want the pipeline in two columns.
23. As a recruiter on a phone, I want the pipeline in one column.
24. As a recruiter or hiring manager on a file, I want the header and the page heading to both show the candidate's name.
25. As a recruiter on a desktop file, I want the stage rail and smart bar across the top, the record on the left, and chatter on the right.
26. As a recruiter on a tablet file, I want chatter under the record.
27. As a recruiter on a file, I want the spacing loosened by one existing space step, so the file matches the other desks.
28. As a recruiter in light or dark mode, I want the same desk, using the colors, type, and glass already in the shell.
29. As a person on a phone, I want the same title and button changes, because they are the same screens, and I want no separate phone layout beyond the single pipeline column.
30. As a recruiter who tries to move a stage the gate refuses, I want the stage to stay where it is and the click to open the same next-action path.

## Implementation Decisions

- This pass is presentation only. The next action stays computed in the browser from the file the server already returns. The server response stays as it is.
- Gates stay on the server. Screen, scorecard, offer, and joining keep the endpoints the file already uses. A refused stage stays where it is.
- Seats stay. The recruiter still lands on My Work. The hiring manager still lands on Team work. The final approver still starts on the approvals inbox. The licence specialist still starts on the licence desk.
- My Work, Team work, and Open jobs drop the repeated in-page desk name. The subtitle already on each page leads. Section names such as Waiting on you, and the candidate and job names, stay.
- The glass surface is the same surface the empty card already uses. Rows sit at the top. An empty tab keeps its one card.
- On All tasks, the filled control is the next action of the first Overdue row, the first Today row, and the first Waiting row. Other destinations on those three rows are text buttons. A disabled destination stays disabled and keeps its reason.
- The pipeline header stays the Open jobs label because that sidebar item is the one in use. Five columns start at 1280px. Two columns cover 768–1279px. One column covers a phone.
- The file header shows the candidate name that the page heading already shows. Desktop keeps the current two-column record. Tablet keeps chatter underneath. Spacing moves by one existing space step.
- Type stays IBM Plex Sans. Action color stays the Saudi German Health cyan. Success stays emerald. Both themes use the existing tokens.
- Suggest from bank and Import CVs stay on the job header. Interviewer-only interview rows still open My Interviews. Joining readiness still opens the file on the pre-hire drawer. The licence file still mounts on its application path and opens that drawer once.
- The work stays uncommitted until a commit is asked for.

## Testing Decisions

A good test reads as what the person sees. It names the desk, the candidate, or the next action. It does not lock a spacing value, a palette, or a font.

Seams, confirmed from the existing page tests:

- **My Work page.** Catches the single desk name, the subtitle, the filled next action on the first row of each bucket, text destinations beside it, a disabled destination that keeps its reason, the empty card copy, and the keyboard order. Misses the glass surface filling the viewport.
- **Team work page.** Catches the single desk name, the subtitle, and the one-line waiting note. Misses the short roster filling the viewport.
- **Open jobs page.** Catches the single "Open jobs" name and the subtitle. Misses nothing important on this slice, because the rows and filters are unchanged.
- **Pipeline page.** Catches the job name and that Suggest from bank and Import CVs remain. The column counts are a browser check, not a class-name assertion.
- **File page.** Catches the candidate name as the page heading, and that a refused move does not advance the stage. The shell heading showing that same name is covered with the shell header tests.
- **Shell header.** Catches the desk name for My Work, Team work, and Open jobs, and the candidate name on a file.

Browser check for the glass surface, the pipeline columns, the file columns, and the looser file spacing, at 768, 1024, 1280, and 1440 CSS pixels, in light and dark. The document does not scroll sideways. Phone width is checked only to see that the pipeline is one column and the titles and buttons match the wider screens.

Prior art is the current My Work, Team work, Open jobs, pipeline, file, and shell header tests. Empty interview and joining sentences stay exact, including the final period. The empty next-actions title stays the same sentence with the trailing period removed. The joining footnote stays.

## Out of Scope

- Candidates, requisitions, reports, and admin.
- A separate phone layout.
- Any change to gates, permissions, seats, drawer destinations, or the server response.
- A new field, schema change, or endpoint for the next action.
- A new palette, a new font, or a new component library.
- Deleting classic page modules. Signed-in classic visits stay on the redirect that already sends them into the v2 shell.
- Committing, pushing, opening a pull request, or switching branches.

## Further Notes

The visual direction is a quiet operational glass desk: one obvious next action, one glass surface under a short list, and the brand color only on the filled action. Reports and Team result stay data-dense and are outside this pass.

Exact strings that must survive: "Nothing is waiting on your decision." The interview empty sentence and the joining empty sentence, each with its period. The joining footnote.
