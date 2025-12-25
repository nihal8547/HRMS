import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, addDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import Icon from '../components/Icons';
import './Settings.css';

interface PageControl {
  id: string;
  pageName: string;
  enabled: boolean;
  description: string;
  path: string;
  icon: string;
}

type PermissionLevel = 'full' | 'view' | 'partial' | 'none';

interface RolePermission {
  role: string;
  pages: {
    [pageName: string]: PermissionLevel | boolean; // Support both old boolean and new PermissionLevel for migration
  };
}

interface Role {
  id: string;
  name: string;
  description: string;
  createdAt: any;
}

interface Department {
  id: string;
  name: string;
  description: string;
  createdAt: any;
}

const Settings = () => {
  const [pageControls, setPageControls] = useState<PageControl[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pages' | 'roles' | 'roleManagement' | 'departmentManagement'>('pages');
  const [loading, setLoading] = useState(true);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showCreateDepartment, setShowCreateDepartment] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newDepartmentDescription, setNewDepartmentDescription] = useState('');
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const navigate = useNavigate();

  const defaultPages = [
    { pageName: 'Dashboard', enabled: true, description: 'Main dashboard page', path: '/', icon: 'grid' },
    { pageName: 'Profile', enabled: true, description: 'User profile page', path: '/profile', icon: 'users' },
    { pageName: 'Documents', enabled: true, description: 'Employee documents page', path: '/documents', icon: 'file-text' },
    { pageName: 'Staffs', enabled: true, description: 'Staff management pages', path: '/staffs', icon: 'users' },
    { pageName: 'Leave', enabled: true, description: 'Leave request and management', path: '/leave', icon: 'calendar' },
    { pageName: 'Requests', enabled: true, description: 'Item purchasing and using requests', path: '/requests', icon: 'file-text' },
    { pageName: 'Complaints', enabled: true, description: 'Complaint registration and resolving', path: '/complaints', icon: 'alert-circle' },
    { pageName: 'Payrolls', enabled: true, description: 'Payroll settings and calculations', path: '/payrolls', icon: 'dollar-sign' },
    { pageName: 'Overtime', enabled: true, description: 'Overtime submission', path: '/overtime', icon: 'clock' },
    { pageName: 'Schedules', enabled: true, description: 'Duty time scheduling', path: '/schedules', icon: 'clock' },
    { pageName: 'Settings', enabled: true, description: 'System settings', path: '/settings', icon: 'settings' }
  ];

  useEffect(() => {
    const initializeData = async () => {
      await fetchPageControls();
      await fetchRoles();
      await fetchDepartments();
    };
    initializeData();
  }, []);

  useEffect(() => {
    if (roles.length > 0 && !selectedRole) {
      setSelectedRole(roles[0].name);
    }
    // Fetch role permissions when roles are loaded and pageControls are available
    if (roles.length > 0 && (pageControls.length > 0 || defaultPages.length > 0)) {
      fetchRolePermissions();
    }
  }, [roles, pageControls]);

  const fetchPageControls = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'pageControls'));
      const controlsMap = new Map<string, PageControl>();
      
      if (!snapshot.empty) {
        // Process existing controls and remove duplicates
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const pageName = data.pageName;
          
          // Only keep the first occurrence of each pageName (remove duplicates)
          if (!controlsMap.has(pageName)) {
            const defaultPage = defaultPages.find(p => p.pageName === pageName);
            if (defaultPage) {
              controlsMap.set(pageName, {
                id: doc.id,
                ...defaultPage,
                ...data,
                icon: data.icon || defaultPage.icon // Ensure icon is always set from defaultPages
              });
            }
          } else {
            // Duplicate found - delete it from Firebase
            deleteDoc(doc(db, 'pageControls', doc.id)).catch(err => 
              console.error(`Error deleting duplicate page control for ${pageName}:`, err)
            );
          }
        });
      }
      
      // Add any missing default pages
      const missingPages = defaultPages.filter(page => !controlsMap.has(page.pageName));
      if (missingPages.length > 0) {
        const newControls = await Promise.all(
          missingPages.map(async (page) => {
            const docRef = await addDoc(collection(db, 'pageControls'), page);
            return { id: docRef.id, ...page };
          })
        );
        newControls.forEach(control => controlsMap.set(control.pageName, control));
      }
      
      // Convert map to array, sorted by defaultPages order
      // Ensure all controls have icons from defaultPages
      const controls = defaultPages
        .map(page => {
          const control = controlsMap.get(page.pageName);
          if (control) {
            // Ensure icon is always set from defaultPages
            if (!control.icon && page.icon) {
              control.icon = page.icon;
            }
            return control;
          }
          return undefined;
        })
        .filter((control): control is PageControl => control !== undefined);
      
      setPageControls(controls);
    } catch (error) {
      console.error('Error fetching page controls:', error);
      // Fallback to default pages
      setPageControls(defaultPages.map((page, index) => ({ id: `default-${index}`, ...page })));
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await updateDoc(doc(db, 'pageControls', id), {
        enabled: !enabled,
        updatedAt: new Date()
      });
      setPageControls(prev =>
        prev.map(control =>
          control.id === id ? { ...control, enabled: !enabled } : control
        )
      );
    } catch (error) {
      console.error('Error updating page control:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'roles'));
      if (!snapshot.empty) {
        const rolesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Role[];
        setRoles(rolesData);
      } else {
        // Initialize with default roles
        const defaultRoles = [
          { name: 'Doctor', description: 'Medical doctor role' },
          { name: 'Nurse', description: 'Nursing staff role' },
          { name: 'Administrator', description: 'System administrator role' },
          { name: 'Technician', description: 'Medical technician role' },
          { name: 'Support Staff', description: 'Support staff role' }
        ];
        
        const createdRoles = await Promise.all(
          defaultRoles.map(async (role) => {
            const docRef = await addDoc(collection(db, 'roles'), {
              ...role,
              createdAt: new Date()
            });
            return { id: docRef.id, ...role, createdAt: new Date() };
          })
        );
        
        setRoles(createdRoles);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchRolePermissions = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'rolePermissions'));
      const allPageNames = pageControls.length > 0 
        ? pageControls.map(p => p.pageName)
        : defaultPages.map(p => p.pageName);
      
      if (!snapshot.empty) {
        const permissions = snapshot.docs.map(doc => {
          const data = doc.data();
          const existingPages = data.pages || {};
          // Use the role field from data, or fallback to doc.id
          const roleName = data.role || doc.id;
          
          // Add missing pages to permissions and migrate old boolean values
          const updatedPages: { [key: string]: PermissionLevel } = {};
          let needsMigration = false;
          
          allPageNames.forEach(pageName => {
            const existingValue = existingPages[pageName];
            if (existingValue === undefined || existingValue === null) {
              updatedPages[pageName] = 'full';
              needsMigration = true;
            } else if (typeof existingValue === 'boolean') {
              // Migrate old boolean to new PermissionLevel
              updatedPages[pageName] = existingValue ? 'full' : 'none';
              needsMigration = true;
            } else {
              // Handle migration from old permission values ('edit' -> 'full', 'not_access' -> 'none')
              let permValue = existingValue as PermissionLevel | 'edit' | 'not_access';
              if (permValue === 'edit') {
                updatedPages[pageName] = 'full';
                needsMigration = true;
              } else if (permValue === 'not_access') {
                updatedPages[pageName] = 'none';
                needsMigration = true;
              } else {
                updatedPages[pageName] = permValue as PermissionLevel;
              }
            }
          });
          
          // Update in Firebase if there are new pages or migration needed
          const hasNewPages = allPageNames.some(pageName => !(pageName in existingPages));
          if (hasNewPages || needsMigration) {
            setDoc(doc(db, 'rolePermissions', roleName), {
              role: roleName,
              pages: updatedPages,
              updatedAt: new Date()
            }).catch(err => console.error('Error updating role permissions:', err));
          }
          
          return {
            role: roleName,
            pages: updatedPages
          } as RolePermission;
        });
        
        setRolePermissions(permissions);
      } else {
        // Initialize with default permissions for existing roles
        if (roles.length > 0) {
          const defaultPermissions: RolePermission[] = roles.map(role => ({
            role: role.name,
            pages: allPageNames.reduce((acc, pageName) => {
              acc[pageName] = 'edit';
              return acc;
            }, {} as { [key: string]: PermissionLevel })
          }));
          
          // Save default permissions to Firebase (using role name as document ID)
          await Promise.all(
            defaultPermissions.map(async (permission) => {
              await setDoc(doc(db, 'rolePermissions', permission.role), {
                role: permission.role,
                pages: permission.pages,
                createdAt: new Date()
              });
            })
          );
          
          setRolePermissions(defaultPermissions);
        }
      }
    } catch (error) {
      console.error('Error fetching role permissions:', error);
    }
  };

  const handleRolePermissionChange = async (role: string, pageName: string, permissionLevel: PermissionLevel) => {
    if (!role || !pageName) {
      console.error('Invalid role or pageName:', { role, pageName });
      return;
    }

    try {
      let rolePermission = rolePermissions.find(rp => rp.role === role);
      
      // If permission doesn't exist, create it with all pages defaulting to 'edit'
      if (!rolePermission) {
        const allPageNamesForRole = pageControls.length > 0 
          ? pageControls.map(p => p.pageName)
          : defaultPages.map(p => p.pageName);
        
        const defaultPagesObj = allPageNamesForRole.reduce((acc, pageName) => {
          acc[pageName] = 'full';
          return acc;
        }, {} as { [key: string]: PermissionLevel });
        
        rolePermission = {
          role,
          pages: defaultPagesObj
        };
      }
      
      // Update the permission level for this page
      const updatedPages: { [key: string]: PermissionLevel } = {};
      Object.keys(rolePermission.pages).forEach(key => {
        const value = rolePermission.pages[key];
        // Migrate old boolean values and old permission names
        if (typeof value === 'boolean') {
          updatedPages[key] = value ? 'full' : 'none';
        } else {
          const permValue = value as PermissionLevel | 'edit' | 'not_access';
          if (permValue === 'edit') {
            updatedPages[key] = 'full';
          } else if (permValue === 'not_access') {
            updatedPages[key] = 'none';
          } else {
            updatedPages[key] = permValue as PermissionLevel;
          }
        }
      });
      updatedPages[pageName] = permissionLevel;

      console.log('Updating role permission:', { role, pageName, newPermissionLevel: permissionLevel });

      // Save to Firebase using role name as document ID
      await setDoc(doc(db, 'rolePermissions', role), {
        role,
        pages: updatedPages,
        updatedAt: new Date()
      });

      // Update local state immediately for better UX
      setRolePermissions(prev => {
        const existing = prev.find(rp => rp.role === role);
        if (existing) {
          return prev.map(rp =>
            rp.role === role
              ? { ...rp, pages: updatedPages }
              : rp
          );
        } else {
          return [...prev, { role, pages: updatedPages }];
        }
      });

      console.log('Role permission updated successfully');
    } catch (error) {
      console.error('Error updating role permission:', error);
      alert(`Failed to update role permission: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handlePageClick = (path: string, enabled: boolean) => {
    if (!enabled) {
      alert('This page is currently disabled. Please enable it using the toggle switch first.');
      return;
    }
    navigate(path);
  };

  const getPermissionLevel = (permission: PermissionLevel | 'edit' | 'not_access' | boolean | undefined): PermissionLevel => {
    if (permission === undefined || permission === null) {
      return 'full'; // Default to full access
    }
    if (typeof permission === 'boolean') {
      // Migrate old boolean to new PermissionLevel
      return permission ? 'full' : 'none';
    }
    // Handle migration from old permission values
    if (permission === 'edit') {
      return 'full';
    }
    if (permission === 'not_access') {
      return 'none';
    }
    return permission as PermissionLevel;
  };

  const getRolePermissions = (role: string): { [key: string]: PermissionLevel } => {
    const pages = rolePermissions.find(rp => rp.role === role)?.pages || {};
    // Migrate old boolean values and old permission names to new PermissionLevel
    const migratedPages: { [key: string]: PermissionLevel } = {};
    Object.keys(pages).forEach(key => {
      const value = pages[key];
      if (typeof value === 'boolean') {
        migratedPages[key] = value ? 'full' : 'none';
      } else {
        // Handle migration from old permission values
        const permValue = value as PermissionLevel | 'edit' | 'not_access';
        if (permValue === 'edit') {
          migratedPages[key] = 'full';
        } else if (permValue === 'not_access') {
          migratedPages[key] = 'none';
        } else {
          migratedPages[key] = permValue as PermissionLevel;
        }
      }
    });
    return migratedPages;
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      alert('Role name is required');
      return;
    }

    // Check if role already exists
    if (roles.some(r => r.name.toLowerCase() === newRoleName.trim().toLowerCase())) {
      alert('Role with this name already exists');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'roles'), {
        name: newRoleName.trim(),
        description: newRoleDescription.trim() || '',
        createdAt: new Date()
      });

      const newRole: Role = {
        id: docRef.id,
        name: newRoleName.trim(),
        description: newRoleDescription.trim() || '',
        createdAt: new Date()
      };

      setRoles([...roles, newRole]);
      setNewRoleName('');
      setNewRoleDescription('');
      setShowCreateRole(false);

      // Create default permissions for new role (all pages enabled)
      const defaultPagePermissions = pageControls.length > 0 
        ? pageControls.reduce((acc, page) => {
            acc[page.pageName] = true;
            return acc;
          }, {} as { [key: string]: boolean })
        : defaultPages.reduce((acc, page) => {
            acc[page.pageName] = true;
            return acc;
          }, {} as { [key: string]: boolean });

      await setDoc(doc(db, 'rolePermissions', newRole.name), {
        role: newRole.name,
        pages: defaultPagePermissions,
        createdAt: new Date()
      });

      setRolePermissions([...rolePermissions, {
        role: newRole.name,
        pages: defaultPagePermissions
      }]);
    } catch (error) {
      console.error('Error creating role:', error);
      alert('Error creating role. Please try again.');
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!window.confirm(`Are you sure you want to delete the role "${roleName}"? This will also delete all permissions for this role.`)) {
      return;
    }

    try {
      // Delete role
      await deleteDoc(doc(db, 'roles', roleId));
      
      // Delete role permissions
      await deleteDoc(doc(db, 'rolePermissions', roleName));

      setRoles(roles.filter(r => r.id !== roleId));
      setRolePermissions(rolePermissions.filter(rp => rp.role !== roleName));

      // If deleted role was selected, select first role
      if (selectedRole === roleName && roles.length > 1) {
        const remainingRoles = roles.filter(r => r.id !== roleId);
        setSelectedRole(remainingRoles[0]?.name || '');
      }
    } catch (error) {
      console.error('Error deleting role:', error);
      alert('Error deleting role. Please try again.');
    }
  };

  const handleEditRole = async () => {
    if (!editingRole || !newRoleName.trim()) {
      return;
    }

    // Check if another role with this name exists
    if (roles.some(r => r.id !== editingRole.id && r.name.toLowerCase() === newRoleName.trim().toLowerCase())) {
      alert('Role with this name already exists');
      return;
    }

    try {
      const oldRoleName = editingRole.name;
      const updatedRole = {
        name: newRoleName.trim(),
        description: newRoleDescription.trim() || '',
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'roles', editingRole.id), updatedRole);

      // Update role permissions document ID if name changed
      if (oldRoleName !== newRoleName.trim()) {
        const rolePermission = rolePermissions.find(rp => rp.role === oldRoleName);
        if (rolePermission) {
          // Create new permission document with new role name
          await setDoc(doc(db, 'rolePermissions', newRoleName.trim()), {
            role: newRoleName.trim(),
            pages: rolePermission.pages,
            updatedAt: new Date()
          });
          // Delete old permission document
          await deleteDoc(doc(db, 'rolePermissions', oldRoleName));
          
          setRolePermissions(rolePermissions.map(rp => 
            rp.role === oldRoleName 
              ? { ...rp, role: newRoleName.trim() }
              : rp
          ));
        }
      }

      setRoles(roles.map(r => 
        r.id === editingRole.id 
          ? { ...r, ...updatedRole }
          : r
      ));

      if (selectedRole === oldRoleName) {
        setSelectedRole(newRoleName.trim());
      }

      setEditingRole(null);
      setNewRoleName('');
      setNewRoleDescription('');
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Error updating role. Please try again.');
    }
  };

  const startEditRole = (role: Role) => {
    setEditingRole(role);
    setNewRoleName(role.name);
    setNewRoleDescription(role.description || '');
    setShowCreateRole(true);
  };

  const fetchDepartments = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'departments'));
      if (!snapshot.empty) {
        const departmentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Department[];
        setDepartments(departmentsData);
      } else {
        // Initialize with default departments
        const defaultDepartments = [
          { name: 'Cardiology', description: 'Cardiology department' },
          { name: 'Emergency', description: 'Emergency department' },
          { name: 'Surgery', description: 'Surgery department' },
          { name: 'Pediatrics', description: 'Pediatrics department' },
          { name: 'Nursing', description: 'Nursing department' },
          { name: 'Administration', description: 'Administration department' }
        ];
        
        const createdDepartments = await Promise.all(
          defaultDepartments.map(async (dept) => {
            const docRef = await addDoc(collection(db, 'departments'), {
              ...dept,
              createdAt: new Date()
            });
            return { id: docRef.id, ...dept, createdAt: new Date() };
          })
        );
        
        setDepartments(createdDepartments);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleCreateDepartment = async () => {
    if (!newDepartmentName.trim()) {
      alert('Department name is required');
      return;
    }

    // Check if department already exists
    if (departments.some(d => d.name.toLowerCase() === newDepartmentName.trim().toLowerCase())) {
      alert('Department with this name already exists');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'departments'), {
        name: newDepartmentName.trim(),
        description: newDepartmentDescription.trim() || '',
        createdAt: new Date()
      });

      const newDepartment: Department = {
        id: docRef.id,
        name: newDepartmentName.trim(),
        description: newDepartmentDescription.trim() || '',
        createdAt: new Date()
      };

      setDepartments([...departments, newDepartment]);
      setNewDepartmentName('');
      setNewDepartmentDescription('');
      setShowCreateDepartment(false);
    } catch (error) {
      console.error('Error creating department:', error);
      alert('Error creating department. Please try again.');
    }
  };

  const handleDeleteDepartment = async (deptId: string, deptName: string) => {
    if (!window.confirm(`Are you sure you want to delete the department "${deptName}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'departments', deptId));
      setDepartments(departments.filter(d => d.id !== deptId));
    } catch (error) {
      console.error('Error deleting department:', error);
      alert('Error deleting department. Please try again.');
    }
  };

  const handleEditDepartment = async () => {
    if (!editingDepartment || !newDepartmentName.trim()) {
      return;
    }

    // Check if another department with this name exists
    if (departments.some(d => d.id !== editingDepartment.id && d.name.toLowerCase() === newDepartmentName.trim().toLowerCase())) {
      alert('Department with this name already exists');
      return;
    }

    try {
      const updatedDepartment = {
        name: newDepartmentName.trim(),
        description: newDepartmentDescription.trim() || '',
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'departments', editingDepartment.id), updatedDepartment);

      setDepartments(departments.map(d => 
        d.id === editingDepartment.id 
          ? { ...d, ...updatedDepartment }
          : d
      ));

      setEditingDepartment(null);
      setNewDepartmentName('');
      setNewDepartmentDescription('');
      setShowCreateDepartment(false);
    } catch (error) {
      console.error('Error updating department:', error);
      alert('Error updating department. Please try again.');
    }
  };

  const startEditDepartment = (dept: Department) => {
    setEditingDepartment(dept);
    setNewDepartmentName(dept.name);
    setNewDepartmentDescription(dept.description || '');
    setShowCreateDepartment(true);
  };

  if (loading) {
    return <div className="loading">Loading settings...</div>;
  }

  const currentRolePermissions = getRolePermissions(selectedRole);

  return (
    <div className="settings-page">
      <h2>Page Settings & Control</h2>
      
      {/* Tab Navigation */}
      <div className="settings-tabs">
        <button
          className={`tab-button ${activeTab === 'pages' ? 'active' : ''}`}
          onClick={() => setActiveTab('pages')}
        >
          Page Control
        </button>
        <button
          className={`tab-button ${activeTab === 'roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          Role-Based Access
        </button>
        <button
          className={`tab-button ${activeTab === 'roleManagement' ? 'active' : ''}`}
          onClick={() => setActiveTab('roleManagement')}
        >
          Role Management
        </button>
        <button
          className={`tab-button ${activeTab === 'departmentManagement' ? 'active' : ''}`}
          onClick={() => setActiveTab('departmentManagement')}
        >
          Department Management
        </button>
      </div>

      {activeTab === 'pages' && (
        <div className="settings-container">
          <div className="pages-grid">
            {pageControls.map((control) => (
              <div key={control.id} className={`page-card ${!control.enabled ? 'disabled' : ''}`}>
                <div className="page-card-header">
                  <div className="page-icon"><Icon name={control.icon} /></div>
                  <div className="page-info">
                    <h3>{control.pageName}</h3>
                    <p>{control.description}</p>
                  </div>
                </div>
                <div className="page-card-actions">
                  <button
                    className={`page-button ${control.enabled ? 'enabled' : 'disabled'}`}
                    onClick={() => handlePageClick(control.path, control.enabled)}
                    disabled={!control.enabled}
                  >
                    {control.enabled ? 'Open Page' : 'Page Disabled'}
                  </button>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={control.enabled}
                      onChange={() => handleToggle(control.id, control.enabled)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="settings-note">
            <p><strong>Note:</strong> Click "Open Page" button to navigate to the page. Use the toggle switch to enable/disable pages from the navigation menu.</p>
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="settings-container">
          <div className="role-control-section">
            <div className="role-selector">
              <label htmlFor="role-select">Select Role:</label>
              <select
                id="role-select"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="role-select"
              >
                {roles.map(role => (
                  <option key={role.id} value={role.name}>{role.name}</option>
                ))}
              </select>
            </div>
            <div className="role-info">
              <h3>Page Access Permissions for {selectedRole}</h3>
              <p>Configure which pages are accessible to users with the <strong>{selectedRole}</strong> role.</p>
            </div>
          </div>

          {/* Show permission summary */}
          <div className="granted-pages-summary">
            <h4>Permission Summary</h4>
            <div className="permission-summary-stats">
              <div className="permission-stat">
                <span className="stat-label">Full Access:</span>
                <span className="stat-value full">{pageControls.filter(control => {
                  const perm = getPermissionLevel(currentRolePermissions[control.pageName]);
                  return perm === 'full';
                }).length}</span>
              </div>
              <div className="permission-stat">
                <span className="stat-label">View Only:</span>
                <span className="stat-value view">{pageControls.filter(control => {
                  const perm = getPermissionLevel(currentRolePermissions[control.pageName]);
                  return perm === 'view';
                }).length}</span>
              </div>
              <div className="permission-stat">
                <span className="stat-label">Partial Access:</span>
                <span className="stat-value partial">{pageControls.filter(control => {
                  const perm = getPermissionLevel(currentRolePermissions[control.pageName]);
                  return perm === 'partial';
                }).length}</span>
              </div>
              <div className="permission-stat">
                <span className="stat-label">No Access:</span>
                <span className="stat-value none">{pageControls.filter(control => {
                  const perm = getPermissionLevel(currentRolePermissions[control.pageName]);
                  return perm === 'none';
                }).length}</span>
              </div>
            </div>
          </div>

          <div className="role-permissions-grid">
            {pageControls.map((control) => {
              const currentPermission = getPermissionLevel(currentRolePermissions[control.pageName]);
              return (
                <div key={control.id} className="role-permission-card">
                  <div className="permission-card-header">
                    <div className="permission-icon"><Icon name={control.icon} /></div>
                    <div className="permission-info">
                      <h4>{control.pageName}</h4>
                      <p>{control.description}</p>
                    </div>
                  </div>
                  <div className="permission-control">
                    <label className="permission-select-label">Access Level:</label>
                    <select
                      className="permission-select"
                      value={currentPermission}
                      onChange={(e) => {
                        handleRolePermissionChange(selectedRole, control.pageName, e.target.value as PermissionLevel);
                      }}
                    >
                      <option value="full">Full Access (Edit, Delete, Approve)</option>
                      <option value="view">View Only</option>
                      <option value="partial">Partial Access (Create & Submit Own Data)</option>
                      <option value="none">No Access</option>
                    </select>
                    <div className="permission-badge" data-permission={currentPermission}>
                      {currentPermission === 'full' && (
                        <>
                          <Icon name="check" /> Full Access
                        </>
                      )}
                      {currentPermission === 'view' && (
                        <>
                          <Icon name="view" /> View Only
                        </>
                      )}
                      {currentPermission === 'partial' && (
                        <>
                          <Icon name="edit" /> Partial Access
                        </>
                      )}
                      {currentPermission === 'none' && (
                        <>
                          <Icon name="x" /> No Access
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="settings-note">
            <p><strong>Note:</strong> These permissions control which pages users with specific roles can access. Changes are saved automatically. Users will only see pages they have permission to access in the navigation menu.</p>
          </div>
        </div>
      )}

      {activeTab === 'roleManagement' && (
        <div className="settings-container">
          <div className="role-management-header">
            <h3>Manage Roles</h3>
            <button
              className="btn-create-role"
              onClick={() => {
                setShowCreateRole(!showCreateRole);
                setEditingRole(null);
                setNewRoleName('');
                setNewRoleDescription('');
              }}
            >
              {showCreateRole ? 'Cancel' : '+ Create New Role'}
            </button>
          </div>

          {showCreateRole && (
            <div className="create-role-form">
              <h4>{editingRole ? 'Edit Role' : 'Create New Role'}</h4>
              <div className="form-group">
                <label>Role Name *</label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g., Manager, Supervisor"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  placeholder="Brief description of this role"
                  className="form-textarea"
                  rows={3}
                />
              </div>
              <div className="form-actions">
                <button
                  className="btn-save"
                  onClick={editingRole ? handleEditRole : handleCreateRole}
                >
                  {editingRole ? 'Update Role' : 'Create Role'}
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setShowCreateRole(false);
                    setEditingRole(null);
                    setNewRoleName('');
                    setNewRoleDescription('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="roles-list">
            <h4>Existing Roles ({roles.length})</h4>
            {roles.length === 0 ? (
              <div className="no-roles">
                <p>No roles created yet. Create your first role to get started.</p>
              </div>
            ) : (
              <div className="roles-grid">
                {roles.map((role) => (
                  <div key={role.id} className="role-card">
                    <div className="role-card-header">
                      <h5>{role.name}</h5>
                      <div className="role-actions">
                        <button
                          className="btn-edit"
                          onClick={() => startEditRole(role)}
                          title="Edit role"
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => handleDeleteRole(role.id, role.name)}
                          title="Delete role"
                        >
                          <Icon name="delete" />
                        </button>
                      </div>
                    </div>
                    <p className="role-description">
                      {role.description || 'No description provided'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="settings-note">
            <p><strong>Note:</strong> Create, edit, or delete roles here. When you create a new role, it will automatically have access to all pages. You can then configure specific page permissions in the "Role-Based Access" tab.</p>
          </div>
        </div>
      )}

      {activeTab === 'departmentManagement' && (
        <div className="settings-container">
          <div className="role-management-header">
            <h3>Manage Departments</h3>
            <button
              className="btn-create-role"
              onClick={() => {
                setShowCreateDepartment(!showCreateDepartment);
                setEditingDepartment(null);
                setNewDepartmentName('');
                setNewDepartmentDescription('');
              }}
            >
              {showCreateDepartment ? 'Cancel' : '+ Create New Department'}
            </button>
          </div>

          {showCreateDepartment && (
            <div className="create-role-form">
              <h4>{editingDepartment ? 'Edit Department' : 'Create New Department'}</h4>
              <div className="form-group">
                <label>Department Name *</label>
                <input
                  type="text"
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  placeholder="e.g., Cardiology, Emergency"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newDepartmentDescription}
                  onChange={(e) => setNewDepartmentDescription(e.target.value)}
                  placeholder="Brief description of this department"
                  className="form-textarea"
                  rows={3}
                />
              </div>
              <div className="form-actions">
                <button
                  className="btn-save"
                  onClick={editingDepartment ? handleEditDepartment : handleCreateDepartment}
                >
                  {editingDepartment ? 'Update Department' : 'Create Department'}
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setShowCreateDepartment(false);
                    setEditingDepartment(null);
                    setNewDepartmentName('');
                    setNewDepartmentDescription('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="roles-list">
            <h4>Existing Departments ({departments.length})</h4>
            {departments.length === 0 ? (
              <div className="no-roles">
                <p>No departments created yet. Create your first department to get started.</p>
              </div>
            ) : (
              <div className="roles-grid">
                {departments.map((dept) => (
                  <div key={dept.id} className="role-card">
                    <div className="role-card-header">
                      <h5>{dept.name}</h5>
                      <div className="role-actions">
                        <button
                          className="btn-edit"
                          onClick={() => startEditDepartment(dept)}
                          title="Edit department"
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                          title="Delete department"
                        >
                          <Icon name="delete" />
                        </button>
                      </div>
                    </div>
                    <p className="role-description">
                      {dept.description || 'No description provided'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="settings-note">
            <p><strong>Note:</strong> Create, edit, or delete departments here. These departments will be available in the Staff Creation form for assigning staff members to departments.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;

