# Galaxy backend and MCP

## Checklist

**Types and procedures**

- [ ] **Shared types** - Reuse utility types from their owning package.
- [ ] **Exported declarations** - Check exports meet the package's compiler requirements.
- [ ] **Schema conventions** - Preserve adopted factory naming and declaration contracts.
- [ ] **Instruction conflicts** - Report declaration/Zod conflicts and follow instruction priority.
- [ ] **Procedure middleware** - Reuse adopted tRPC bases and middleware.
- [ ] **Error helpers** - Use adopted helpers without weakening validation or authorisation.

**Queries and backend boundaries**

- [ ] **Pass-through procedures** - Replace thin tRPC wrappers with supported `api-query` calls.
- [ ] **Generated contracts** - Remove redundant schemas for replaced pass-through procedures.
- [ ] **Frontend joins** - Move multi-query data assembly into tRPC.
- [ ] **Eager pagination** - Check automatic page fetching needs a more capable backend endpoint.
- [ ] **Query ownership** - Check where requests live and avoid overquerying.
- [ ] **Large downloads** - Use dedicated download URLs rather than proxying bytes through Next.js.

**MCP tools**

- [ ] **Batch mutations** - Accept arrays for mutation tools by default.
- [ ] **Bounded pages** - Bound list page sizes and support pagination.
- [ ] **Backend pagination** - Flag synthetic pagination over an unpaged backend.
- [ ] **Tool fan-out** - Calculate calls at maximum input size; verify enforced request limits.
- [ ] **Code Mode** - Prefer Scout Code Mode to straight-through backend tools.
- [ ] **Output size** - Calculate maximum payload growth; verify result limits or paging.

## Guidance

### Types and procedures

#### Types and declarations

- Reuse shared utility types after checking their defining package.
- Check compiler settings and annotate exports where required.
- Preserve adopted schema-factory naming and declaration contracts.
- Report conflicts between declaration requirements and Zod-first instructions; follow instruction priority.

#### Procedures

- Reuse established tRPC bases and tracing, logging, and error-mapping middleware.
- Use `@nominal-io/trpc/errors` where adopted; preserve validation and authorisation boundaries.

### Queries and backend boundaries

- When a tRPC procedure only forwards a backend call with basic input validation, use the supported `api-query` call and generated types instead. Remove schemas added solely for the replaced procedure. Follow applicable input-validation instructions at any remaining trust boundary.
- Push multi-query frontend joins into tRPC. If the frontend automatically pages through an endpoint to collect all results, identify the backend endpoint in `nominal-io/scout` that needs a better contract. User-driven pagination is different.
- Trace request ownership and frequency to catch overquerying. Use dedicated download URLs, such as S3 URLs, for large payloads instead of routing bytes through the Next.js backend.

### MCP tools

- In `apps/nominal-mcp`, make mutation tools batch-oriented by default. Accept arrays with bounded sizes and check per-item outcomes.
- Bound page sizes and allow list pagination. Flag pagination implemented only in the tool when the backend cannot page results.
- Calculate downstream calls at maximum batch and page sizes, including nested expansion and per-item lookups. Verify the enforced request budget.
- Calculate maximum result count and payload growth, including variable-size fields. Verify an enforced result budget, truncation, or paging contract. Use the existing project/model limits; report missing budgets as unverified rather than inventing a quota.
- Use Scout Code Mode rather than adding tools that simply forward backend endpoints.
