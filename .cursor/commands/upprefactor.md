# upprefactor

You are refactoring code in the Uppstaff project.

Goal:
{{input}}

Constraints:
- Preserve external behavior and API contracts.
- Do NOT change public interfaces unless absolutely necessary.
- Extract business logic into lib/** services where meaningful.
- Ensure multi-tenancy (businessId) and role checks remain correct.
- Keep TypeScript types or improve them; do not weaken typing.

Steps:
1. Briefly explain what smells or issues you see.
2. Propose a refactored structure (functions, files, folders).
3. Apply the refactoring to the selected code.
4. At the end, list potential risks and how to verify them (e.g., which flows/tests to run).


This command will be available in chat with /upprefactor
