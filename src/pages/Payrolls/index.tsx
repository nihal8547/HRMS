import { Link } from 'react-router-dom';
import '../Staffs/Staffs.css';

const Payrolls = () => {
  return (
    <div className="staffs-page">
      <h2>Payrolls Management</h2>
      <div className="page-actions">
        <Link to="/payrolls/settings" className="btn btn-primary">
          Payroll Settings
        </Link>
        <Link to="/payrolls/overtime-calculation" className="btn btn-secondary">
          Overtime Calculation
        </Link>
      </div>
      <div className="info-card">
        <h3>Payroll Management Options</h3>
        <ul>
          <li><strong>Payroll Settings:</strong> Configure payroll settings and parameters</li>
          <li><strong>Overtime Calculation:</strong> Calculate and manage overtime payments</li>
        </ul>
      </div>
    </div>
  );
};

export default Payrolls;







