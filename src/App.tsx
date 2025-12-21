import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Staffs from './pages/Staffs';
import StaffCreate from './pages/Staffs/StaffCreate';
import StaffManagement from './pages/Staffs/StaffManagement';
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
import PayrollSettings from './pages/Payrolls/PayrollSettings';
import OvertimeCalculation from './pages/Payrolls/OvertimeCalculation';
import Overtime from './pages/Overtime';
import Schedules from './pages/Schedules';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/staffs" element={<Staffs />} />
          <Route path="/staffs/create" element={<StaffCreate />} />
          <Route path="/staffs/management" element={<StaffManagement />} />
          <Route path="/leave" element={<Leave />} />
          <Route path="/leave/request" element={<LeaveRequest />} />
          <Route path="/leave/status" element={<LeaveStatus />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/requests/purchasing" element={<ItemPurchasing />} />
          <Route path="/requests/using" element={<ItemUsing />} />
          <Route path="/complaints" element={<Complaints />} />
          <Route path="/complaints/registration" element={<ComplaintRegistration />} />
          <Route path="/complaints/resolving" element={<ComplaintResolving />} />
          <Route path="/payrolls" element={<Payrolls />} />
          <Route path="/payrolls/settings" element={<PayrollSettings />} />
          <Route path="/payrolls/overtime-calculation" element={<OvertimeCalculation />} />
          <Route path="/overtime" element={<Overtime />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;







