import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import PermissionRoute from './components/PermissionRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Staffs from './pages/Staffs';
import StaffCreate from './pages/Staffs/StaffCreate';
import StaffManagement from './pages/Staffs/StaffManagement';
import EmployeeProfileView from './pages/Staffs/EmployeeProfileView';
import Leave from './pages/Leave';
import LeaveRequest from './pages/Leave/LeaveRequest';
import LeaveStatus from './pages/Leave/LeaveStatus';
import Requests from './pages/Requests';
import ItemPurchasing from './pages/Requests/ItemPurchasing';
import ItemUsing from './pages/Requests/ItemUsing';
import Complaints from './pages/Complaints';
import ComplaintRegistration from './pages/Complaints/ComplaintRegistration';
import ComplaintResolving from './pages/Complaints/ComplaintResolving';
import Payrolls from './pages/Payrolls';
import PayrollManagement from './pages/Payrolls/PayrollManagement';
import PayrollSettings from './pages/Payrolls/PayrollSettings';
import OvertimeCalculation from './pages/Payrolls/OvertimeCalculation';
import Overtime from './pages/Overtime';
import Schedules from './pages/Schedules';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Documents from './pages/Documents';
import Birthday from './pages/Templates/Birthday';
import Fines from './pages/Fines';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            {/* Dashboard */}
            <Route
              path="/"
              element={
                <PermissionRoute pageName="Dashboard">
                  <Dashboard />
                </PermissionRoute>
              }
            />
            {/* Staffs */}
            <Route
              path="/staffs"
              element={
                <PermissionRoute pageName="Staffs">
                  <Staffs />
                </PermissionRoute>
              }
            />
            <Route
              path="/staffs/create"
              element={
                <PermissionRoute pageName="Staffs">
                  <StaffCreate />
                </PermissionRoute>
              }
            />
            <Route
              path="/staffs/management"
              element={
                <PermissionRoute pageName="Staffs">
                  <StaffManagement />
                </PermissionRoute>
              }
            />
            <Route
              path="/staffs/view/:id"
              element={
                <PermissionRoute pageName="Staffs">
                  <EmployeeProfileView />
                </PermissionRoute>
              }
            />
            {/* Leave */}
            <Route
              path="/leave"
              element={
                <PermissionRoute pageName="Leave">
                  <Leave />
                </PermissionRoute>
              }
            />
            <Route
              path="/leave/request"
              element={
                <PermissionRoute pageName="Leave">
                  <LeaveRequest />
                </PermissionRoute>
              }
            />
            <Route
              path="/leave/status"
              element={
                <PermissionRoute pageName="Leave">
                  <LeaveStatus />
                </PermissionRoute>
              }
            />
            {/* Requests */}
            <Route
              path="/requests"
              element={
                <PermissionRoute pageName="Requests">
                  <Requests />
                </PermissionRoute>
              }
            />
            <Route
              path="/requests/purchasing"
              element={
                <PermissionRoute pageName="Requests">
                  <ItemPurchasing />
                </PermissionRoute>
              }
            />
            <Route
              path="/requests/using"
              element={
                <PermissionRoute pageName="Requests">
                  <ItemUsing />
                </PermissionRoute>
              }
            />
            {/* Complaints */}
            <Route
              path="/complaints"
              element={
                <PermissionRoute pageName="Complaints">
                  <Complaints />
                </PermissionRoute>
              }
            />
            <Route
              path="/complaints/registration"
              element={
                <PermissionRoute pageName="Complaints">
                  <ComplaintRegistration />
                </PermissionRoute>
              }
            />
            <Route
              path="/complaints/resolving"
              element={
                <PermissionRoute pageName="Complaints">
                  <ComplaintResolving />
                </PermissionRoute>
              }
            />
            {/* Fines */}
            <Route
              path="/fines"
              element={
                <PermissionRoute pageName="Fines">
                  <Fines />
                </PermissionRoute>
              }
            />
            {/* Payrolls */}
            <Route
              path="/payrolls"
              element={
                <PermissionRoute pageName="Payrolls">
                  <Payrolls />
                </PermissionRoute>
              }
            />
            <Route
              path="/payrolls/management"
              element={
                <PermissionRoute pageName="Payrolls">
                  <PayrollManagement />
                </PermissionRoute>
              }
            />
            <Route
              path="/payrolls/settings"
              element={
                <PermissionRoute pageName="Payrolls">
                  <PayrollSettings />
                </PermissionRoute>
              }
            />
            <Route
              path="/payrolls/overtime-calculation"
              element={
                <PermissionRoute pageName="Payrolls">
                  <OvertimeCalculation />
                </PermissionRoute>
              }
            />
            {/* Other Pages */}
            <Route
              path="/overtime"
              element={
                <PermissionRoute pageName="Overtime">
                  <Overtime />
                </PermissionRoute>
              }
            />
            <Route
              path="/schedules"
              element={
                <PermissionRoute pageName="Schedules">
                  <Schedules />
                </PermissionRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PermissionRoute pageName="Settings">
                  <Settings />
                </PermissionRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PermissionRoute pageName="Profile">
                  <Profile />
                </PermissionRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <PermissionRoute pageName="Documents">
                  <Documents />
                </PermissionRoute>
              }
            />
            {/* Templates */}
            <Route
              path="/templates/birthday"
              element={
                <PermissionRoute pageName="Templates">
                  <Birthday />
                </PermissionRoute>
              }
            />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;








