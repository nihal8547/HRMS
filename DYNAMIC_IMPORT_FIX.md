# Dynamic Import Error Fix

## Problem
The error `GET http://localhost:5173/src/utils/fetchEmployees.ts net::ERR_ABORTED 500` occurs because:
- Dynamic imports (`await import()`) in Vite can cause the dev server to try serving raw TypeScript files
- TypeScript files need to be compiled first, so serving them directly fails

## Solution
Replace all dynamic imports with static imports at the top of files.

### Before (Dynamic Import - Causes Error):
```typescript
const { fetchAllEmployees } = await import('../utils/fetchEmployees');
const employees = await fetchAllEmployees();
```

### After (Static Import - Works Correctly):
```typescript
import { fetchAllEmployees } from '../utils/fetchEmployees';

// Then use directly:
const employees = await fetchAllEmployees();
```

## Files That Need Fixing
The following files still use dynamic imports and should be updated:
- src/pages/Payrolls/PayrollManagement.tsx
- src/pages/Staffs/StaffManagement.tsx
- src/pages/Staffs/index.tsx
- src/pages/Requests/ItemUsing.tsx
- src/pages/Requests/ItemPurchasing.tsx
- src/pages/Payrolls/OvertimeCalculation.tsx
- src/pages/Leave/LeaveRequest.tsx
- src/pages/Leave/index.tsx
- src/pages/Overtime.tsx
- src/pages/Complaints/index.tsx
- src/pages/Complaints/ComplaintRegistration.tsx
- src/pages/Requests/index.tsx
- src/pages/Schedules.tsx

## Already Fixed
- src/pages/Fines.tsx ✅
- src/pages/Dashboard.tsx ✅
- src/pages/Templates/Birthday.tsx ✅

