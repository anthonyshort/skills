# Is this code clear and easy to maintain?

Review how easy the code is to read and navigate. Recommend changes that make purpose and ownership clearer. Distinguish project conventions from personal preferences.

## Verification checklist

- [ ] **Names**: Check that files, folders, functions and variables clearly describe their purpose.
- [ ] **File organisation**: Check that files are placed intentionally and the folder hierarchy makes ownership clear. Avoid unnecessary nesting or fragmentation.
- [ ] **Readability**: Look for confusing control flow, nesting and indirection. Can we split large blocks into smaller functions to make it easier to read and follow?
- [ ] **Comments**: Check that comments explain intent or surprising behaviour and follow the selected specialist skill guidance.
- [ ] **Formatting**: Read CI formatter and lint results. Avoid repeating automated style findings.

## Deliverable

Return a **readability assessment** containing:

1. **Verdict**: Clear and easy to maintain, or improvements recommended, with a short reason.
2. **Names and placement**: Explain any unclear names, misplaced files or folder structures that hide ownership. Include source locations and concrete alternatives.
3. **Readability and style**: Identify code, comments or formatting that make the change harder to understand. Distinguish broken conventions from preferences.
4. **Recommended changes**: Explain what each change would make clearer or simpler. State when no improvements are supported.
