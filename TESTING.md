# Test employee management

After redeploying the updated code, sign in as the existing administrator.

1. Open **Employee Allocation** from the menu.
2. Select **Add employee**. Enter a fictional name, such as **Anita Test**, and a department, such as **Operations**. Select **Save changes**.
3. Confirm the employee card appears. Refresh the page and confirm it remains.
4. Select **Edit** on that employee card, change the department, and save. The employee's identity and existing allocations are preserved.
5. Open an Available asset in **Asset Master**, choose **Assign asset**, select the new employee, and save. Confirm the holder on asset details and the asset listed on their employee card.
6. Select **Return asset** on the asset detail page. Confirm the employee's current asset list updates and allocation history retains the return.
7. Creating the same name and department twice should show a validation error without adding a duplicate. Blank name or department should also be rejected.

Employees are asset-allocation records. Adding one does not create a Firebase login or password. Only administrators sign in during this phase.

Targeted domain check: `npm run test:employees`. Browser checks use fictional local fixtures, not your connected Firebase data.
