# Payroll Excel Upload Template

## Excel File Format

When uploading payroll data via Excel, ensure your file follows this format:

### Required Columns:
- **Employee ID** (or `EmployeeID` or `employeeId`) - Must match existing employee IDs
- **Month** (or `month`) - Full month name (e.g., "January", "February")
- **Year** (or `year`) - Four-digit year (e.g., "2024")

### Optional Columns (will use defaults if not provided):
- **Base Salary** (or `baseSalary`) - Base monthly salary
- **Overtime Hours** (or `overtimeHours`) - Number of overtime hours
- **Bonus** (or `bonus`) - Bonus amount
- **Deductions** (or `deductions`) - Deduction amount
- **Status** (or `status`) - "pending", "approved", or "paid" (default: "pending")
- **Notes** (or `notes`) - Additional notes

### Example Excel Format:

| Employee ID | Month     | Year | Base Salary | Overtime Hours | Bonus | Deductions | Status   | Notes           |
|-------------|-----------|------|-------------|----------------|-------|------------|----------|-----------------|
| EMP001      | January   | 2024 | 5000        | 10             | 500   | 200        | pending  | Regular payroll |
| EMP002      | January   | 2024 | 6000        | 5               | 0     | 0          | approved |                 |
| EMP003      | February  | 2024 | 5500        | 15             | 1000  | 300        | pending  | Bonus included  |

### Notes:
- Column names are case-insensitive
- Employee ID must exist in the system
- Month should be full name (January, February, etc.)
- Year should be 4 digits
- All amounts should be numeric values
- If Base Salary is not provided, it will use the employee's salary from their profile or default from settings
- Overtime Amount, Tax, Gross Salary, and Net Salary are automatically calculated based on Payroll Settings

### Calculation Formula:
- **Overtime Amount** = Overtime Hours × Overtime Rate (from settings)
- **Gross Salary** = Base Salary + Overtime Amount + Bonus
- **Tax** = Gross Salary × Tax Rate (from settings)
- **Net Salary** = Gross Salary - Tax - Deductions








<<<<<<< HEAD

=======
>>>>>>> 414ddb490a202f32e9848d52f3c90863d8c4fe1e
