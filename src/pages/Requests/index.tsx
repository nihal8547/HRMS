import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Icon from '../../components/Icons';
import '../Staffs/StaffManagement.css';

interface Request {
  id: string;
  employeeId: string;
  name: string;
  type: string;
  itemName?: string;
  quantity?: string;
  unit?: string;
  priority?: string;
  status: string;
  createdAt: any;
}

const Requests = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'requests'));
      const requestsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Request[];
      setRequests(requestsData.sort((a, b) => 
        (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)
      ));
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'requests', id), { 
        status: newStatus,
        updatedAt: new Date()
      });
      fetchRequests();
    } catch (error) {
      console.error('Error updating request status:', error);
    }
  };

  const filteredRequests = requests.filter(request => {
    const matchesFilter = filter === 'all' || request.status === filter;
    const matchesSearch = 
      request.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (request.itemName && request.itemName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="staff-management">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h2>Requests Management</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/requests/purchasing" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Item Purchasing
            </Link>
            <Link to="/requests/using" className="btn btn-primary" style={{ textDecoration: 'none', background: '#10b981' }}>
              Item Using
            </Link>
          </div>
        </div>
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-management">
      <h2 style={{ marginBottom: '24px', color: '#1f2937', fontSize: '1.75rem', fontWeight: '600' }}>Requests Management</h2>
      <div className="management-header">
        <div className="search-wrapper">
          <input
            type="text"
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className="filter-select">
          <option>All Types</option>
          <option>Purchasing</option>
          <option>Using</option>
        </select>
        <div className="action-buttons">
          <button className="btn-export">Export</button>
          <Link to="/requests/purchasing" className="btn-new-record">
            New Record
          </Link>
        </div>
      </div>
      <div className="staff-table-container">
        <table className="staff-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Type</th>
              <th>Item Name</th>
              <th>Quantity</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={8} className="no-data">No requests found</td>
              </tr>
            ) : (
              filteredRequests.map((request) => (
                <tr key={request.id}>
                  <td>{request.employeeId}</td>
                  <td>{request.name}</td>
                  <td>{request.type}</td>
                  <td>{request.itemName || '-'}</td>
                  <td>{request.quantity ? `${request.quantity} ${request.unit || ''}` : '-'}</td>
                  <td>
                    {request.priority && (
                      <span className={`priority-badge ${request.priority}`}>
                        {request.priority}
                      </span>
                    )}
                  </td>
                  <td>
                    <select
                      value={request.status}
                      onChange={(e) => handleStatusUpdate(request.id, e.target.value)}
                      className={`status-select ${request.status}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </td>
                  <td>
                    <div className="action-icons">
                      <button className="action-icon view" title="View">
                        <Icon name="view" />
                      </button>
                      <button className="action-icon edit" title="Edit">
                        <Icon name="edit" />
                      </button>
                      <button className="action-icon delete" title="Delete">
                        <Icon name="delete" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Requests;

