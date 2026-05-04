import { useNavigate } from 'react-router-dom';
import './SharedNavbar.css';

export default function Navbar({ roleName }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('pyrochain_user') || '{}');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <nav className="shared-nav">
      <div className="shared-nav-left">
        <span className="shared-nav-brand">PyroChain</span>
        <div className="shared-nav-divider" />
        <span className="shared-nav-role">{roleName}</span>
      </div>
      <div className="shared-nav-right">
        <span className="shared-nav-user">{user.name || 'User'}</span>
        <button onClick={handleLogout} className="shared-nav-logout">Sign Out</button>
      </div>
    </nav>
  );
}
