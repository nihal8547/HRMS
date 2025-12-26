interface IconProps {
  name: string;
  className?: string;
}

const Icon = ({ name, className = '' }: IconProps) => {
  const icons: { [key: string]: JSX.Element } = {
    'chevron-left': (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    'chevron-down': (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    check: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16.25 6.25L8.125 14.375L3.75 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    x: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    grid: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <rect x="12" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <rect x="2" y="12" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <rect x="12" y="12" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      </svg>
    ),
    users: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 10C12.2091 10 14 8.20914 14 6C14 3.79086 12.2091 2 10 2C7.79086 2 6 3.79086 6 6C6 8.20914 7.79086 10 10 10Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M3.33334 18C3.33334 14.6863 6.31371 12 10 12C13.6863 12 16.6667 14.6863 16.6667 18" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      </svg>
    ),
    calendar: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4" width="14" height="13" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M3 8H17" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M13 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    'file-text': (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 2H11.6667L15 5.33333V16.6667C15 17.5871 14.2538 18.3333 13.3333 18.3333H5C4.07953 18.3333 3.33334 17.5871 3.33334 16.6667V3.66667C3.33334 2.74619 4.07953 2 5 2Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M11.6667 2V5.33333H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6.66666 10H13.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M6.66666 13.3333H13.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    'alert-circle': (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M10 6.66667V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="10" cy="13.3333" r="0.833333" fill="currentColor"/>
      </svg>
    ),
    'alert-triangle': (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 3.33333L2.5 16.6667H17.5L10 3.33333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M10 8.33333V11.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="10" cy="14.1667" r="0.833333" fill="currentColor"/>
      </svg>
    ),
    clock: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M10 5V10L13.3333 13.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    'dollar-sign': (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M13.3333 5.33333H8.33334C7.41287 5.33333 6.66667 6.07953 6.66667 7C6.66667 7.92047 7.41287 8.66667 8.33334 8.66667H11.6667C12.5871 8.66667 13.3333 9.41287 13.3333 10.3333C13.3333 11.2538 12.5871 12 11.6667 12H6.66667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    settings: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M15.8333 10C15.8333 9.58333 15.9167 9.16667 16.0833 8.79167L17.9167 5.83333C18.1667 5.41667 18.0833 4.875 17.6667 4.625L16.25 3.79167C15.8333 3.54167 15.2917 3.625 15.0417 4.04167L13.2083 7C12.875 7.375 12.4583 7.5 12.0417 7.5H7.95833C7.54167 7.5 7.125 7.375 6.79167 7L4.95833 4.04167C4.70833 3.625 4.16667 3.54167 3.75 3.79167L2.33333 4.625C1.91667 4.875 1.83333 5.41667 2.08333 5.83333L3.91667 8.79167C4.08333 9.16667 4.16667 9.58333 4.16667 10C4.16667 10.4167 4.08333 10.8333 3.91667 11.2083L2.08333 14.1667C1.83333 14.5833 1.91667 15.125 2.33333 15.375L3.75 16.2083C4.16667 16.4583 4.70833 16.375 4.95833 15.9583L6.79167 13C7.125 12.625 7.54167 12.5 7.95833 12.5H12.0417C12.4583 12.5 12.875 12.625 13.2083 13L15.0417 15.9583C15.2917 16.375 15.8333 16.4583 16.25 16.2083L17.6667 15.375C18.0833 15.125 18.1667 14.5833 17.9167 14.1667L16.0833 11.2083C15.9167 10.8333 15.8333 10.4167 15.8333 10Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      </svg>
    ),
    logout: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7.5 17.5H4.16667C3.24619 17.5 2.5 16.7538 2.5 15.8333V4.16667C2.5 3.24619 3.24619 2.5 4.16667 2.5H7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M13.3333 14.1667L17.5 10L13.3333 5.83333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M17.5 10H7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    view: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 4C5 4 1.73 7.11 1 10C1.73 12.89 5 16 10 16C15 16 18.27 12.89 19 10C18.27 7.11 15 4 10 4Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      </svg>
    ),
    edit: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.6667 3.33333L16.6667 8.33333M2.5 17.5H6.66667L15.8333 8.33333L11.6667 4.16667L2.5 13.3333V17.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M13.3333 5.83333L16.6667 9.16667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    delete: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.33334 5.83333H16.6667M7.5 5.83333V4.16667C7.5 3.24619 8.24619 2.5 9.16667 2.5H10.8333C11.7538 2.5 12.5 3.24619 12.5 4.16667V5.83333M5.83334 5.83333V16.6667C5.83334 17.5871 6.57953 18.3333 7.5 18.3333H12.5C13.4205 18.3333 14.1667 17.5871 14.1667 16.6667V5.83333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8.33334 9.16667V14.1667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M11.6667 9.16667V14.1667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    bill: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4" width="14" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M7 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M7 11H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M7 14H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    search: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9.16667" cy="9.16667" r="6.66667" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M15 15L17.5 17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    export: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 3.33333V16.6667M10 3.33333L4.16667 9.16667M10 3.33333L15.8333 9.16667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    plus: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 3.33333V16.6667M3.33333 10H16.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    download: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 3.33333V13.3333M10 13.33333L6.66667 10M10 13.33333L13.3333 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3.33333 16.6667H16.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    upload: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 16.6667V6.66667M10 6.66667L6.66667 10M10 6.66667L13.3333 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3.33333 3.33333H16.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    lock: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4.16667" y="9.16667" width="11.6667" height="8.33333" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M6.66667 9.16667V5.83333C6.66667 3.99238 8.15905 2.5 10 2.5C11.841 2.5 13.3333 3.99238 13.3333 5.83333V9.16667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="10" cy="13.3333" r="1.25" fill="currentColor"/>
      </svg>
    ),
    home: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.33333 10L10 3.33333L16.6667 10V16.6667C16.6667 17.5871 15.9205 18.3333 15 18.3333H5C4.07953 18.3333 3.33333 17.5871 3.33333 16.6667V10Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M7.5 18.3333V10H12.5V18.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    mail: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="5" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M3 6L10 11L17 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    phone: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.16667 3.33333C3.24619 3.33333 2.5 4.07953 2.5 5V15C2.5 15.9205 3.24619 16.6667 4.16667 16.6667H7.5L9.16667 15H10.8333L12.5 16.6667H15.8333C16.7538 16.6667 17.5 15.9205 17.5 15V5C17.5 4.07953 16.7538 3.33333 15.8333 3.33333H4.16667Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M8.33333 10H11.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    'id-card': (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4" width="14" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M6 7H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M6 10H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="13" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      </svg>
    ),
    user: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M4.16667 17.5C4.16667 14.1863 6.81371 11.6667 10 11.6667C13.1863 11.6667 15.8333 14.1863 15.8333 17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    'check-circle': (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M7 10L9 12L13 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    list: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.33333 5H16.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M3.33333 10H16.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M3.33333 15H16.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    image: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4" width="14" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M3 12L7 8L11 12L17 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="13" cy="7" r="1.5" fill="currentColor"/>
      </svg>
    ),
    info: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M10 6.66667V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="10" cy="13.3333" r="0.833333" fill="currentColor"/>
      </svg>
    )
  };

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {icons[name] || <span>.</span>}
    </span>
  );
};

export default Icon;

