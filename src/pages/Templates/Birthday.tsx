import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { fetchAllEmployees } from '../../utils/fetchEmployees';
import Icon from '../../components/Icons';
import './Birthday.css';

interface BirthdayEmployee {
  id: string;
  fullName: string;
  name?: string;
  employeeId: string;
  profileImageUrl?: string;
  dateOfBirth: string;
  department?: string;
  position?: string;
}

const Birthday = () => {
  const [loading, setLoading] = useState(true);
  const [birthdayEmployees, setBirthdayEmployees] = useState<BirthdayEmployee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<BirthdayEmployee | null>(null);
  const [generating, setGenerating] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string>('/logo.png');
  const [wishMessage, setWishMessage] = useState('Happy Birthday! Wishing you a wonderful day filled with joy and happiness!');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await fetchBirthdayEmployees();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchBirthdayEmployees = async () => {
    try {
      setLoading(true);
      const employees = await fetchAllEmployees();
      const today = new Date();
      const todayMonth = today.getMonth();
      const todayDate = today.getDate();

      const birthdays = employees
        .filter(emp => {
          if (!emp.dateOfBirth) return false;
          try {
            const birthDate = new Date(emp.dateOfBirth);
            return birthDate.getMonth() === todayMonth && birthDate.getDate() === todayDate;
          } catch {
            return false;
          }
        })
        .map(emp => ({
          id: emp.id,
          fullName: emp.fullName || emp.name || 'Unknown',
          name: emp.name,
          employeeId: emp.employeeId || '',
          profileImageUrl: emp.profileImageUrl || '',
          dateOfBirth: emp.dateOfBirth || '',
          department: emp.department || '',
          position: emp.position || ''
        })) as BirthdayEmployee[];

      setBirthdayEmployees(birthdays);
      if (birthdays.length > 0 && !selectedEmployee) {
        setSelectedEmployee(birthdays[0]);
      }
    } catch (error) {
      console.error('Error fetching birthday employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  const generatePoster = async (employee: BirthdayEmployee) => {
    setGenerating(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(0.5, '#1e293b');
      gradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Load and draw company logo
      try {
        const logoImg = await loadImage(companyLogo);
        const logoSize = 200;
        const logoX = (canvas.width - logoSize) / 2;
        const logoY = 80;
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      } catch (error) {
        console.warn('Could not load company logo:', error);
        // Draw text logo as fallback
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('FOCUS MEDICAL CENTRE', canvas.width / 2, 180);
      }

      // Decorative elements
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(100, 350);
      ctx.lineTo(1100, 350);
      ctx.stroke();

      // Birthday title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 72px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Happy Birthday!', canvas.width / 2, 450);

      // Load and draw profile image
      let profileImg: HTMLImageElement | null = null;
      if (employee.profileImageUrl) {
        try {
          profileImg = await loadImage(employee.profileImageUrl);
        } catch (error) {
          console.warn('Could not load profile image:', error);
        }
      }

      // Draw profile image or placeholder
      const imageSize = 400;
      const imageX = (canvas.width - imageSize) / 2;
      const imageY = 500;
      
      if (profileImg) {
        // Create circular mask
        ctx.save();
        ctx.beginPath();
        ctx.arc(canvas.width / 2, imageY + imageSize / 2, imageSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(profileImg, imageX, imageY, imageSize, imageSize);
        ctx.restore();
        
        // Draw border
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, imageY + imageSize / 2, imageSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Draw placeholder circle
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, imageY + imageSize / 2, imageSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 8;
        ctx.stroke();
        
        // Draw initials
        const initials = employee.fullName
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .substring(0, 2);
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 120px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(initials, canvas.width / 2, imageY + imageSize / 2 + 40);
      }

      // Employee name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(employee.fullName, canvas.width / 2, imageY + imageSize + 100);

      // Employee details
      if (employee.department || employee.position) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '36px Arial';
        const details = [employee.position, employee.department].filter(Boolean).join(' - ');
        ctx.fillText(details, canvas.width / 2, imageY + imageSize + 160);
      }

      // Birthday wish message
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'italic 42px Arial';
      ctx.textAlign = 'center';
      const maxWidth = 1000;
      const words = wishMessage.split(' ');
      let line = '';
      let y = imageY + imageSize + 280;
      
      words.forEach((word) => {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== '') {
          ctx.fillText(line, canvas.width / 2, y);
          line = word + ' ';
          y += 50;
        } else {
          line = testLine;
        }
      });
      ctx.fillText(line, canvas.width / 2, y);

      // Decorative bottom line
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(100, y + 100);
      ctx.lineTo(1100, y + 100);
      ctx.stroke();

      // Company name at bottom
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('FOCUS MEDICAL CENTRE', canvas.width / 2, y + 180);

      // Convert canvas to image and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Birthday_Wish_${employee.fullName.replace(/\s+/g, '_')}_${new Date().getFullYear()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error generating poster:', error);
      alert('Failed to generate birthday poster. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const generateAllPosters = async () => {
    if (birthdayEmployees.length === 0) {
      alert('No birthday employees found for today.');
      return;
    }

    for (const employee of birthdayEmployees) {
      await generatePoster(employee);
      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  if (loading) {
    return (
      <div className="birthday-page">
        <div className="loading-state">Loading birthday employees...</div>
      </div>
    );
  }

  return (
    <div className="birthday-page">
      <div className="birthday-header">
        <h1>Birthday Wishes Template</h1>
        <p>Generate birthday posters for employees celebrating their birthday today</p>
      </div>

      <div className="birthday-content">
        <div className="birthday-controls">
          <div className="control-group">
            <label>Birthday Wish Message</label>
            <textarea
              value={wishMessage}
              onChange={(e) => setWishMessage(e.target.value)}
              placeholder="Enter birthday wish message..."
              rows={4}
              className="wish-input"
            />
          </div>

          <div className="control-group">
            <label>Company Logo</label>
            <input
              type="text"
              value={companyLogo}
              onChange={(e) => setCompanyLogo(e.target.value)}
              placeholder="/logo.png"
              className="logo-input"
            />
            <small>Path to company logo image (default: /logo.png)</small>
          </div>

          {birthdayEmployees.length > 0 && (
            <div className="action-buttons">
              <button
                className="btn-generate-all"
                onClick={generateAllPosters}
                disabled={generating}
              >
                <Icon name="download" />
                Generate All Posters ({birthdayEmployees.length})
              </button>
            </div>
          )}
        </div>

        <div className="birthday-list">
          <h2>Today's Birthdays ({birthdayEmployees.length})</h2>
          {birthdayEmployees.length === 0 ? (
            <div className="no-birthdays">
              <Icon name="calendar" />
              <p>No employees have birthdays today.</p>
            </div>
          ) : (
            <div className="birthday-grid">
              {birthdayEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className={`birthday-card ${selectedEmployee?.id === employee.id ? 'selected' : ''}`}
                  onClick={() => setSelectedEmployee(employee)}
                >
                  <div className="card-image">
                    {employee.profileImageUrl ? (
                      <img src={employee.profileImageUrl} alt={employee.fullName} />
                    ) : (
                      <div className="placeholder-image">
                        <Icon name="user" />
                      </div>
                    )}
                  </div>
                  <div className="card-info">
                    <h3>{employee.fullName}</h3>
                    <p className="employee-id">{employee.employeeId}</p>
                    {employee.department && <p className="department">{employee.department}</p>}
                    {employee.position && <p className="position">{employee.position}</p>}
                  </div>
                  <button
                    className="btn-generate"
                    onClick={(e) => {
                      e.stopPropagation();
                      generatePoster(employee);
                    }}
                    disabled={generating}
                  >
                    <Icon name="download" />
                    Generate Poster
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Birthday;

