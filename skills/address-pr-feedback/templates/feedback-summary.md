# Feedback summary

The summary is appended below the finished checklist in the progress comment. It is posted without user approval.

## Structure

```markdown
**Applied**

- {{ Comment summary }} — {{ What changed, and why the fix was accepted. Link the original comment and the commit. }}

**Skipped**

- {{ Comment summary }} — {{ Why the fix was disproportionate. Link the original comment. }}

**Dismissed**

- {{ Comment summary }} — {{ The evidence that the comment is invalid, already addressed, duplicate or out of scope. Link the original comment. }}

**Blocked**

- {{ Comment summary }} — {{ The blocker and what would unblock it. Link the original comment. }}

**Verification**

{{ Actual checks run and their results. Which fixes are verified, attempted but blocked, or unverified. }}

Sent with Pi
```

- Omit a section when it is empty.
- Keep each item to one or two short sentences.
- Link the original comment for each item. Link the commit only for applied fixes that have been committed; a blocked or uncommitted fix must not carry a commit link.
- Keep the `Sent with Pi` footer as the final line.
