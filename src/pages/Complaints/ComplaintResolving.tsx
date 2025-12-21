import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import '../Staffs/StaffManagement.css';

interface Complaint {
  id: string;
  employeeId: string;
  name: string;
  complaintType: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  resolution?: string;
  createdAt: any;
}

const ComplaintResolving = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'complaints'));
      const complaintsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Complaint[];
      setComplaints(complaintsData.sort((a, b) => 
        b.createdAt?.toDate?.()?.getTime() - a.createdAt?.toDate?.()?.getTime()
      ));
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string, resolutionText?: string) => {
    try {
      const updateData: any = { 
        status: newStatus,
        updatedAt: new Date()
      };
      if (resolutionText) {
        updateData.resolution = resolutionText;
        updateData.resolvedAt = new Date();
      }
      await updateDoc(doc(db, 'complaints', id), updateData);
      fetchComplaints();
      setSelectedComplaint(null);
      setResolution('');
    } catch (error) {
      console.error('Error updating complaint:', error);
    }
  };

  const filteredComplaints = complaints.filter(complaint => {
    const matchesFilter = filter === 'all' || complaint.status === filter;
    const matchesSearch = 
      complaint.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="staff-management">
        <h2>Resolve Complaints</h2>
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading complaints...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-management">
      <h2>Resolve Complaints</h2>
      <div className="management-header">
        <input
          type="text"
          placeholder="Search by employee ID or subject..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="status-select"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>
      <div className="staff-table-container">
        <table className="staff-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Type</th>
              <th>Subject</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredComplaints.length === 0 ? (
              <tr>
                <td colSpan={7} className="no-data">No complaints found</td>
              </tr>
            ) : (
              filteredComplaints.map((complaint) => (
                <tr key={complaint.id}>
                  <td>{complaint.employeeId}</td>
                  <td>{complaint.name}</td>
                  <td>{complaint.complaintType}</td>
                  <td>{complaint.subject}</td>
                  <td>
                    <span className={`priority-badge ${complaint.priority}`}>
                      {complaint.priority}
                    </span>
                  </td>
                  <td>
                    <select
                      value={complaint.status}
                      onChange={(e) => handleStatusUpdate(complaint.id, e.target.value)}
                      className={`status-select ${complaint.status}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </td>
                  <td>
                    <button
                      onClick={() => setSelectedComplaint(complaint)}
                      className="btn-delete"
                      style={{ background: '#3b82f6' }}
                    >
                      View/Resolve
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedComplaint && (
        <div className="modal-overlay" onClick={() => setSelectedComplaint(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Complaint Details</h3>
            <div className="modal-body">
              <p><strong>Employee:</strong> {selectedComplaint.name} ({selectedComplaint.employeeId})</p>
              <p><strong>Type:</strong> {selectedComplaint.complaintType}</p>
              <p><strong>Subject:</strong> {selectedComplaint.subject}</p>
              <p><strong>Description:</strong> {selectedComplaint.description}</p>
              {selectedComplaint.resolution && (
                <p><strong>Resolution:</strong> {selectedComplaint.resolution}</p>
              )}
              <div className="form-group" style={{ marginTop: '20px' }}>
                <label>Resolution Notes</label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={4}
                  placeholder="Enter resolution details..."
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                onClick={() => handleStatusUpdate(selectedComplaint.id, 'resolved', resolution)}
                className="btn btn-primary"
              >
                Mark as Resolved
              </button>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplaintResolving;

